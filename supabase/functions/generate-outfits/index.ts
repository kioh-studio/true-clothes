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
    if (req.method === 'POST') {
      try {
        const body = await req.json();
        intent = body.intent;
      } catch {
        // Empty body is fine — intent is optional
      }
    }

    // ── Load user data from DB (4 queries in parallel) ────────────────────
    const [profileRes, measurementsRes, styleRes, wardrobeRes] = await Promise.all([
      supabase.from('profiles').select('skin_undertone').eq('id', userId).single(),
      supabase.from('body_measurements').select('*').eq('user_id', userId).single(),
      supabase.from('style_profiles').select('*').eq('user_id', userId).single(),
      supabase.from('clothing_items').select('id, type, name, color, material, fit, measurements').eq('user_id', userId),
    ]);

    // ── Map DB rows to engine types ──────────────────────────────────────

    const bodyMeasurements: BodyMeasurements = measurementsRes.data ?? {};

    const styleData = styleRes.data;
    const styleProfile: UserStyleProfile = {
      selectedStyles: styleData?.selected_styles ?? [],
    };
    const colorPreferences: string[] = styleData?.color_preferences ?? [];
    const formulaPreferences: FormulaId[] = (styleData?.formula_preferences ?? []) as FormulaId[];

    const wardrobeRows: ClothingItemRow[] = (wardrobeRes.data ?? []).map((row: Record<string, unknown>) => ({
      id: row.id as string,
      type: row.type as string,
      name: row.name as string,
      color: row.color as string,
      material: row.material as string | undefined,
      fit: row.fit as string | undefined,
      measurements: row.measurements as ClothingItemRow['measurements'],
    }));

    if (wardrobeRows.length === 0) {
      return jsonResponse({ outfits: [], message: 'No clothing items in wardrobe' }, 200);
    }

    // ── Run engine pipeline ──────────────────────────────────────────────

    const callStart = Date.now();
    const primaryStyle = styleProfile.selectedStyles[0] ?? 'none';
    console.log(`[generate-outfits] CALL userId=${userId} style=${primaryStyle} wardrobe=${wardrobeRows.length} items intent=${intent ? JSON.stringify(intent) : 'none'}`);

    let ctx: EngineContext = { bodyMeasurements, styleProfile, colorPreferences, intent };
    let effectiveFormulas: FormulaId[] | undefined = formulaPreferences.length > 0 ? formulaPreferences : undefined;

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

    // 3. Apply style hard constraints
    let filteredItems = fitItems;
    const primaryStyleId = ctx.styleProfile.selectedStyles[0];
    const styleConfig = primaryStyleId ? styleConfigById(primaryStyleId) : undefined;

    if (styleConfig) {
      const { passed } = filterByStyle(fitItems, styleConfig);
      filteredItems = passed;
      console.log(`[generate-outfits] style filter: ${fitItems.length} → ${filteredItems.length} items (style=${primaryStyleId})`);

      if (!ctx.scoringWeights) {
        ctx = { ...ctx, scoringWeights: styleConfig.weights };
      }
    }

    // 4. Generate candidates
    const itemMap = new Map<string, FitItem>(filteredItems.map(i => [i.id, i]));
    const candidates = generateCandidates(filteredItems, effectiveFormulas);
    console.log(`[generate-outfits] candidates generated: ${candidates.length}`);

    // 5. Score, rank, and shuffle
    const ranked = rankCandidates(candidates, itemMap, ctx);
    const outfits = dailyShuffle(ranked, userId);

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

    return jsonResponse({ outfits }, 200);

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
