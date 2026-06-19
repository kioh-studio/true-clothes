// Edge Function: generate-outfits
// POST /functions/v1/generate-outfits
// Auth: Bearer token (Supabase JWT)
// Body: { intent?: IntentContext }
// Response: { outfits: ScoredOutfit[] }

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  EngineContext, FitItem, IntentContext, ClothingItemRow,
  BodyMeasurements, UserStyleProfile,
} from './engine/types.ts';
import { toFitItem } from './engine/enrichment.ts';
import { filterByStyle, styleConfigById } from './engine/filtering.ts';
import { generateCandidates, FormulaId } from './engine/generation.ts';
import { resolveIntent, applyIntent, rankCandidates, dailyShuffle } from './engine/ranking.ts';
import { curateOutfits, curatorEnabled } from './engine/curator.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // ── Auth ──────────────────────────────────────────────────────────────
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return jsonResponse({ error: 'Missing authorization header' }, 401);
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    const userId = user.id;

    // ── Parse request body ────────────────────────────────────────────────
    let intent: IntentContext | undefined;
    let excludeIds: string[] = [];
    let formulaId: string | undefined;
    let intentContext: { rawPrompt?: string; turnCount?: number } | undefined;
    let locale = 'vi';
    let curateRequested = true; // client gates by tier; server only needs the API key
    if (req.method === 'POST') {
      try {
        const body = await req.json();
        intent = body.intent;
        excludeIds = Array.isArray(body.exclude_ids) ? body.exclude_ids : [];
        const wornCooldown = Array.isArray(body.worn_cooldown_ids) ? body.worn_cooldown_ids : [];
        excludeIds = [...new Set([...excludeIds, ...wornCooldown])];
        formulaId = body.formula_id;
        if (typeof body.locale === 'string') locale = body.locale;
        if (body.curate === false) curateRequested = false;
        intentContext = body.intent_context; // forward-compat (T078)
        if (intentContext) console.log('[generate-outfits] intent_context received:', JSON.stringify(intentContext));
      } catch {
        // Empty body is fine — all fields are optional
      }
    }

    // ── Load user data from DB ────────────────────────────────────────────
    // clothing_items links to wardrobes via wardrobe_id, not user_id directly,
    // so we resolve the wardrobe_id first, then fetch items.
    const [profileRes, measurementsRes, styleRes, wardrobeIdRes] = await Promise.all([
      supabase.from('profiles').select('skin_undertone, color_season, personal_palette').eq('id', userId).single(),
      supabase.from('body_measurements').select('*').eq('user_id', userId).single(),
      supabase.from('style_profiles').select('*').eq('user_id', userId).single(),
      supabase.from('wardrobes').select('id').eq('user_id', userId).single(),
    ]);

    const wardrobeId = wardrobeIdRes.data?.id as string | undefined;
    const wardrobeRes = wardrobeId
      ? await supabase
          .from('clothing_items')
          .select('id, type, name, color, material, fit, pattern, warmth_season, m_chest, m_shoulder_width, m_sleeves, m_body_length, m_upper_arm, m_waist, m_hip, m_inseam, m_thigh, m_rise')
          .eq('wardrobe_id', wardrobeId)
      : { data: [] as Record<string, unknown>[] };

    // ── Map DB rows to engine types ──────────────────────────────────────

    const bodyMeasurements: BodyMeasurements = measurementsRes.data ?? {};

    const styleData = styleRes.data;
    const styleProfile: UserStyleProfile = {
      selectedStyles: styleData?.selected_styles ?? [],
    };
    const formulaPreferences: FormulaId[] = (styleData?.formula_preferences ?? []) as FormulaId[];

    // Personal color (Q16): detected palette merges with manual favorites, and
    // the 4-season classification feeds color scoring via ctx.colorSeason.
    const profileData = profileRes.data as
      | { skin_undertone?: string; color_season?: string; personal_palette?: string[] }
      | null;
    const personalPalette: string[] = profileData?.personal_palette ?? [];
    const colorPreferences: string[] = [
      ...new Set([...(styleData?.color_preferences ?? []), ...personalPalette]),
    ];
    const colorSeason = profileData?.color_season?.toLowerCase() || undefined;

    // Map flat m_* DB columns to the measurements array the engine expects
    const M_COLS: Array<[string, string]> = [
      ['chest',     'm_chest'],
      ['shoulder',  'm_shoulder_width'],
      ['sleeve',    'm_sleeves'],
      ['length',    'm_body_length'],
      ['upper arm', 'm_upper_arm'],
      ['waist',     'm_waist'],
      ['hip',       'm_hip'],
      ['inseam',    'm_inseam'],
      ['thigh',     'm_thigh'],
      ['rise',      'm_rise'],
    ];

    const wardrobeRows: ClothingItemRow[] = (wardrobeRes.data ?? []).map((row: Record<string, unknown>) => {
      const measurements = M_COLS
        .filter(([, col]) => row[col] != null)
        .map(([label, col]) => ({ label, value: row[col] as number, unit: 'cm' }));
      return {
        id: row.id as string,
        type: row.type as string,
        name: row.name as string,
        color: row.color as string,
        material: row.material as string | undefined,
        fit: row.fit as string | undefined,
        pattern: row.pattern as string | null | undefined,
        warmthSeason: row.warmth_season as string | null | undefined,
        measurements: measurements.length > 0 ? measurements : undefined,
      };
    });

    if (wardrobeRows.length === 0) {
      return jsonResponse({ outfits: [], has_more: false, message: 'No clothing items in wardrobe' }, 200);
    }

    // ── Run engine pipeline ──────────────────────────────────────────────

    const callStart = Date.now();
    const primaryStyle = styleProfile.selectedStyles[0] ?? 'none';
    console.log(`[generate-outfits] CALL userId=${userId} style=${primaryStyle} wardrobe=${wardrobeRows.length} items intent=${intent ? JSON.stringify(intent) : 'none'} formula=${formulaId ?? 'none'} exclude=${excludeIds.length}`);

    // If formula_id provided, resolve its slug and use it as primary formula
    let resolvedFormulaSlug: FormulaId | undefined;
    if (formulaId) {
      const { data: formulaRow } = await supabase.from('formulas').select('slug').eq('id', formulaId).single();
      if (formulaRow) resolvedFormulaSlug = (formulaRow as { slug: string }).slug as FormulaId;
    }

    let ctx: EngineContext = { bodyMeasurements, styleProfile, colorPreferences, colorSeason, intent };
    let effectiveFormulas: FormulaId[] | undefined = resolvedFormulaSlug
      ? [resolvedFormulaSlug]
      : (formulaPreferences.length > 0 ? formulaPreferences : undefined);

    // 1. Resolve intent if present
    if (intent) {
      const resolved = resolveIntent(intent);
      ctx = applyIntent(ctx, resolved);

      if (resolved.formulaPreferences.length > 0) {
        effectiveFormulas = effectiveFormulas
          ? [...new Set([...resolved.formulaPreferences, ...effectiveFormulas])]
          : resolved.formulaPreferences;
      }

      ctx = { ...ctx, scoringWeights: resolved.weights };
    }

    // 2. Classify all items
    const fitItems = wardrobeRows.map(toFitItem);

    // 3. Apply style hard constraints — an item passes if it fits ANY of the
    //    user's selected styles (up to 5), not just the first one. Scoring
    //    weights still come from the primary style.
    let filteredItems = fitItems;
    const styleConfigs = ctx.styleProfile.selectedStyles
      .map(id => styleConfigById(id))
      .filter((c): c is NonNullable<typeof c> => c !== undefined);

    if (styleConfigs.length > 0) {
      const passedIds = new Set<string>();
      for (const config of styleConfigs) {
        for (const item of filterByStyle(fitItems, config).passed) passedIds.add(item.id);
      }
      filteredItems = fitItems.filter(i => passedIds.has(i.id));
      console.log(`[generate-outfits] style filter: ${fitItems.length} → ${filteredItems.length} items (styles=${ctx.styleProfile.selectedStyles.join(',')})`);

      if (!ctx.scoringWeights) {
        ctx = { ...ctx, scoringWeights: styleConfigs[0].weights };
      }
    }

    // 4. Generate candidates (seeded per user+day for stable paging),
    //    then filter excluded outfits.
    const itemMap = new Map<string, FitItem>(filteredItems.map(i => [i.id, i]));
    const daySeed = `${userId}:${new Date().toISOString().slice(0, 10)}`;
    let candidates = generateCandidates(filteredItems, effectiveFormulas, daySeed);

    // Exclude already-shown outfits by FULL-slot key (top|bottom|shoes|outwear|
    // accessory) so two distinct mixes of the same items remain available — only
    // the exact same outfit is suppressed. Legacy core-triple and bare-top keys
    // from older client caches are still honored until those caches cycle out.
    if (excludeIds.length > 0) {
      const excludeSet = new Set(excludeIds);
      candidates = candidates.filter(c => {
        const { top, bottom, shoes, outwear, accessory } = c.slots;
        const full = `${top}|${bottom}|${shoes}|${outwear ?? ''}|${accessory ?? ''}`;
        const core = `${top}|${bottom}|${shoes}`;
        return !excludeSet.has(full) && !excludeSet.has(core) && !excludeSet.has(top);
      });
    }
    console.log(`[generate-outfits] candidates generated: ${candidates.length} (after exclude)`);

    // 5. Score, rank, shuffle
    const ranked = rankCandidates(candidates, itemMap, ctx);
    const shuffled = dailyShuffle(ranked, userId);

    // 6. LLM curation pass — ONLY when ANTHROPIC_API_KEY is set. Without the
    //    key this entire branch is skipped and the rule-engine order is
    //    returned directly: no prompt building, no SDK call.
    let outfits = shuffled.slice(0, 10);
    let curated = false;
    if (curatorEnabled() && curateRequested && shuffled.length > 0) {
      const rowById = new Map(wardrobeRows.map(r => [r.id, r]));
      const describeItem = (id: string | undefined, slot: string): string | null => {
        if (!id) return null;
        const r = rowById.get(id);
        if (!r) return null;
        const parts = [r.name, `(${r.type.toLowerCase()}, ${r.color}${r.material ? `, ${r.material}` : ''}${r.fit ? `, ${r.fit} fit` : ''})`];
        return `${slot}: ${parts.join(' ')}`;
      };

      const occasionLine = intent?.occasion ? `Occasion: ${intent.occasion}.` : '';
      const seasonLine = intent?.seasonOverride ? `Current season/weather: ${intent.seasonOverride}.` : '';
      const profileBlock = [
        `User profile — styles: ${ctx.styleProfile.selectedStyles.join(', ') || 'unspecified'}.`,
        `Favorite colors: ${colorPreferences.join(', ') || 'unspecified'}.`,
        colorSeason ? `Personal color season: ${colorSeason} (undertone: ${profileData?.skin_undertone ?? 'unknown'}).` : '',
        bodyMeasurements.body_shape ? `Body shape: ${bodyMeasurements.body_shape}.` : '',
        occasionLine, seasonLine,
      ].filter(Boolean).join('\n');

      const curationResult = await curateOutfits({
        outfits: shuffled.slice(0, 24),
        locale,
        profileBlock,
        describe: (o) => {
          const isOnepiece = o.slots.top === o.slots.bottom;
          const items = [
            isOnepiece ? describeItem(o.slots.top, 'one-piece') : describeItem(o.slots.top, 'top'),
            isOnepiece ? null : describeItem(o.slots.bottom, 'bottom'),
            describeItem(o.slots.shoes, 'shoes'),
            describeItem(o.slots.outwear, 'outerwear'),
            describeItem(o.slots.accessory, 'accessory'),
          ].filter(Boolean).join(' | ');
          return `[${o.formula}] ${items}`;
        },
      });

      if (curationResult) {
        outfits = curationResult.outfits;
        curated = true;
        console.log(`[generate-outfits] curated: ${outfits.length} picks, ${curationResult.vetoCount} vetoes`);
      }
    }
    const hasMore = shuffled.length > 10;

    // ── Log results ──────────────────────────────────────────────────────
    const nameById = new Map(wardrobeRows.map(r => [r.id, r.name]));

    console.log(`[generate-outfits] RESULT ${outfits.length} outfits in ${Date.now() - callStart}ms`);

    for (let i = 0; i < outfits.length; i++) {
      const outfit = outfits[i];
      const { top, bottom, shoes, outwear, accessory } = outfit.slots;
      const slotEntries: [string, string][] = [
        ['top',       top],
        ['bottom',    bottom],
        ['shoes',     shoes],
        ...(outwear   ? [['outwear',   outwear]   as [string, string]] : []),
        ...(accessory ? [['accessory', accessory] as [string, string]] : []),
      ];
      const itemList = slotEntries
        .map(([slot, id], idx) => `${idx + 1}: ${nameById.get(id) ?? id} (${slot})`)
        .join(', ');
      console.log(`[generate-outfits] outfit #${i + 1} formula=${outfit.formula} style=${primaryStyle} score=${outfit.totalScore.toFixed(3)} items=[${itemList}]`);
    }

    return jsonResponse({ outfits, has_more: hasMore, curated }, 200);

  } catch (err) {
    console.error('[generate-outfits] Error:', err);
    return jsonResponse({ error: 'Internal server error' }, 500);
  }
});

function jsonResponse(data: unknown, status: number): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
