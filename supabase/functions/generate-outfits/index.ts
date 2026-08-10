// Edge Function: generate-outfits
// POST /functions/v1/generate-outfits
// Auth: Bearer token (Supabase JWT)
// Body: { intent?: IntentContext }
// Response: { outfits: ScoredOutfit[] }

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  EngineContext, FitItem, IntentContext, ClothingItemRow,
  BodyMeasurements, UserStyleProfile, ScoredOutfit, StyleConfig,
} from './engine/types.ts';
import { toFitItem, registerColors, colorProfileOf, toBodyMeasurements } from './engine/enrichment.ts';
import { filterByStyle, styleConfigById, resolveFallbackStyles, passesStyleNaturally } from './engine/filtering.ts';
import { generateCandidates, generatePinnedCandidates, generateHeroCandidates, GENERATION_CAP, FormulaId } from './engine/generation.ts';
import { resolveIntent, applyIntent, rankCandidates, dailyShuffle } from './engine/ranking.ts';
import { resolveTargetSilhouette, outfitSilhouetteTag, resultingBodySilhouette } from './engine/silhouette.ts';
import { deriveStylingTips } from './engine/styling-tips.ts';
import { buildTasteVector, buildDismissVector, VIEWED_WEIGHT, SAVED_WEIGHT, WORN_WEIGHT } from './engine/taste.ts';
import { seasonForMonth, resolveHemisphere, outfitDominantColor, computeUserAttributes } from './engine/scoring.ts';
import { curateOutfits, curatorEnabled, CuratorImage } from './engine/curator.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ── Quality gate ──────────────────────────────────────────────────────────────
// The engine ranks every type-valid combo but never DROPPED weak ones, so the feed
// always padded to ~10 outfits even when the only options were mediocre. This gate
// removes outfits that are either objectively weak (below MIN_QUALITY) OR much worse
// than the day's best (relative band) BEFORE the daily shuffle, so the shuffle only
// reorders genuinely good options. If too few survive, show fewer rather than
// backfilling junk — but never an empty feed (keep the best MIN_FEED). Tunable; the
// per-outfit score is logged below so the cut can be calibrated against real feeds.
const MIN_QUALITY = 0.50;   // absolute floor on totalScore (0..1)
const QUALITY_BAND = 0.18;  // also drop anything this far below the day's best
const MIN_FEED = 3;         // floor on feed length when candidates exist

function applyQualityGate(ranked: ScoredOutfit[]): ScoredOutfit[] {
  if (ranked.length <= MIN_FEED) return ranked;
  const best = ranked.reduce((m, o) => Math.max(m, o.totalScore), 0);
  const cut = Math.max(MIN_QUALITY, best - QUALITY_BAND);
  const qualified = ranked.filter(o => o.totalScore >= cut);
  console.log(`[generate-outfits] quality gate: ${ranked.length} → ${qualified.length} kept (cut=${cut.toFixed(3)}, best=${best.toFixed(3)})`);
  return qualified.length >= MIN_FEED ? qualified : ranked.slice(0, MIN_FEED);
}

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
    let genderAware = false; // opt-in gender-aware styling (backlog #3)
    let bodyNeutral = false; // opt-in body-neutral styling (recommendation #6)
    let pinItem: Record<string, unknown> | undefined; // Try On / Mix & Match (feature 008)
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
        if (body.gender_aware === true) genderAware = true;
        if (body.body_neutral === true) bodyNeutral = true;
        intentContext = body.intent_context; // forward-compat (T078)
        if (intentContext) console.log('[generate-outfits] intent_context received:', JSON.stringify(intentContext));
        if (body.pin_item != null) pinItem = body.pin_item as Record<string, unknown>;
      } catch {
        // Empty body is fine — all fields are optional
      }
    }

    // Validate an optional pinned item early (Mix & Match). Absent ⇒ unchanged
    // behavior; present-but-invalid ⇒ 400 (contract generate-outfits-pin).
    if (pinItem !== undefined) {
      if (typeof pinItem !== 'object' || Array.isArray(pinItem) ||
          typeof pinItem.type !== 'string' || !pinItem.type.trim()) {
        return jsonResponse({ error: 'Invalid pin_item: a controlled `type` is required' }, 400);
      }
    }

    // ── Load user data from DB ────────────────────────────────────────────
    // clothing_items links to wardrobes via wardrobe_id, not user_id directly,
    // so we resolve the wardrobe_id first, then fetch items.
    const [profileRes, measurementsRes, styleRes, wardrobeIdRes, interactionsRes, impressionsRes, dismissedRes] = await Promise.all([
      supabase.from('profiles').select('skin_undertone, color_season, color_tone12, personal_palette, location_country, location_country_code, gender').eq('id', userId).single(),
      supabase.from('body_measurements').select('*').eq('user_id', userId).single(),
      supabase.from('style_profiles').select('*').eq('user_id', userId).single(),
      supabase.from('wardrobes').select('id').eq('user_id', userId).single(),
      // Positive behaviour signal for the taste vector (lever L2). RLS-scoped to
      // the caller; best-effort — a failure just leaves the taste bonus off.
      // Recent 300 only (perf, 2026-07-03): unbounded before, so the taste vector
      // payload grew without limit as an account aged. Same cap as the impressions
      // query below for consistency. `viewed` added (feed-signals, 2026-08-07) —
      // a weak positive alongside saved/worn, see engine/taste.ts VIEWED_WEIGHT.
      supabase.from('outfit_interactions').select('outfit_id, type').eq('user_id', userId).in('type', ['saved', 'worn', 'viewed']).order('created_at', { ascending: false }).limit(300),
      // Exposure history (lift upgrade 2026-07-02): what the feed already SHOWED
      // this user. Turns the taste bonus from raw save-affinity into save-vs-shown
      // lift. Recent 300 only — enough for a stable baseline, bounded payload.
      supabase.from('outfit_interactions').select('outfit_id').eq('user_id', userId).eq('type', 'impression').order('created_at', { ascending: false }).limit(300),
      // Negative behaviour signal (feed-signals, 2026-08-07): swipe-left
      // dismisses, feeding a SEPARATE dismiss vector (engine/taste.ts
      // buildDismissVector) — same cap/shape as the other interaction queries.
      supabase.from('outfit_interactions').select('outfit_id').eq('user_id', userId).eq('type', 'dismissed').order('created_at', { ascending: false }).limit(300),
    ]);

    const wardrobeId = wardrobeIdRes.data?.id as string | undefined;
    const wardrobeRes = wardrobeId
      ? await supabase
          .from('clothing_items')
          .select('id, type, name, color, material, fit, pattern, warmth_season, can_layer, print_scale, drape, visual_interest, photo_url, photo_storage, primary_hex, secondary_hex, graphics, m_chest, m_shoulder_width, m_sleeves, m_body_length, m_upper_arm, m_waist, m_hip, m_inseam, m_thigh, m_rise')
          .eq('wardrobe_id', wardrobeId)
      : { data: [] as Record<string, unknown>[], error: null };

    // A transient DB error must NOT be treated as "empty wardrobe" — that would
    // silently show the starter/onboarding state to a user with a full wardrobe.
    // Surface it as a real failure so the client can retry.
    if (wardrobeRes.error) {
      console.error('[generate-outfits] wardrobe fetch failed:', wardrobeRes.error);
      return jsonResponse({ error: 'Failed to load wardrobe' }, 500);
    }

    // ── Map DB rows to engine types ──────────────────────────────────────

    // Fix 1 (2026-08-06): explicit row→engine boundary mapper (engine/enrichment.ts
    // toBodyMeasurements) — the raw DB row was previously assigned straight into
    // the BodyMeasurements type, which silently dropped `preferred_fit` (the one
    // real snake_case/camelCase mismatch; every other field already shares its
    // name with the DB column — see toBodyMeasurements's doc comment).
    const bodyMeasurements: BodyMeasurements = toBodyMeasurements(measurementsRes.data as Record<string, unknown> | null);
    // Body-neutral styling (recommendation #6): suppress body_shape BEFORE it
    // reaches the engine. Every body-shape consumer (scoreOutfitFit's
    // bodyShapeAdjustment, the curator prompt's "Body shape:" line) is already
    // guarded by `if (!body.body_shape)` / a truthy check, so nulling it here
    // removes both the scoring effect and the shown rationale in one move.
    if (bodyNeutral) {
      bodyMeasurements.body_shape = undefined;
      console.log('[generate-outfits] body-neutral: body_shape suppressed');
    }

    const styleData = styleRes.data;
    const styleProfile: UserStyleProfile = {
      selectedStyles: styleData?.selected_styles ?? [],
    };

    // 4 suggestion toggles (2026-08-10): style_profiles.suggest_by_* — each
    // independently opts a scoring dimension out. Missing/null (row predates
    // the migration, or `.single()` found no row at all) reads as true so
    // existing users see byte-for-byte unchanged behavior.
    const suggestByStyle = styleData?.suggest_by_style !== false;
    const suggestByPersonalColor = styleData?.suggest_by_personal_color !== false;
    const suggestByFormula = styleData?.suggest_by_formula !== false;
    const suggestByMeasurements = styleData?.suggest_by_measurements !== false;
    {
      const off = [
        !suggestByStyle && 'style',
        !suggestByPersonalColor && 'personal_color',
        !suggestByFormula && 'formula',
        !suggestByMeasurements && 'measurements',
      ].filter((v): v is string => typeof v === 'string');
      if (off.length > 0) console.log(`[generate-outfits] suggestion toggles off: ${off.join(', ')}`);
    }

    // Shape-goal cascade tier (010-wardrobe-critic follow-up, 2026-08-10):
    // style_profiles.shape_goal — the user's durable "desired resulting body
    // silhouette" choice. null/missing (row predates the migration, or no row
    // at all) reads as 'auto', which is a no-op through the whole cascade
    // (engine/silhouette.ts resolveTargetSilhouette) — zero regression for
    // existing users. Validated against the DB check constraint's own value
    // set defensively, in case a stale/dirty row ever slips past it.
    const SHAPE_GOAL_VALUES = new Set([
      'auto', 'natural', 'hourglass', 'rectangle', 'oval', 'inverted-triangle', 'triangle',
    ]);
    const rawShapeGoal = typeof styleData?.shape_goal === 'string' ? styleData.shape_goal : 'auto';
    const shapeGoal = (SHAPE_GOAL_VALUES.has(rawShapeGoal) ? rawShapeGoal : 'auto') as EngineContext['shapeGoal'];
    if (shapeGoal !== 'auto') console.log(`[generate-outfits] shape goal: ${shapeGoal}`);

    // suggest_by_formula=false: don't let the user's stored formula_preferences
    // bias/filter which combo formulas generation favors — resolvedFormulaSlug
    // (explicit formula_id request) and intent-resolved formulas (below) are a
    // SEPARATE channel and stay unaffected either way.
    const formulaPreferences: FormulaId[] = suggestByFormula
      ? (styleData?.formula_preferences ?? []) as FormulaId[]
      : [];

    // Personal color (Q16): detected palette merges with manual favorites, and
    // the 4-season classification feeds color scoring via ctx.colorSeason.
    const profileData = profileRes.data as
      | { skin_undertone?: string; color_season?: string; color_tone12?: string; personal_palette?: string[]; location_country?: string; location_country_code?: string; gender?: string }
      | null;
    // suggest_by_personal_color=false: drop the detected palette from the color
    // union AND null out the 4-season/12-tone classification — colorPreferences
    // then reflects ONLY the user's own manually-picked favorites
    // (style_profiles.color_preferences), so the `color` dimension stays fully
    // scored on that alone rather than being disabled.
    const personalPalette: string[] = suggestByPersonalColor ? (profileData?.personal_palette ?? []) : [];
    const colorPreferences: string[] = [
      ...new Set([...(styleData?.color_preferences ?? []), ...personalPalette]),
    ];
    const colorSeason = suggestByPersonalColor ? (profileData?.color_season?.toLowerCase() || undefined) : undefined;
    const colorTone12 = suggestByPersonalColor ? (profileData?.color_tone12?.toLowerCase() || undefined) : undefined;

    // Current real-world season (drives seasonal colour bias + fabric matching).
    // An explicit intent.seasonOverride wins; otherwise derive from today's month +
    // hemisphere. Hemisphere prefers the stored ISO country code (exact, locale-proof)
    // and falls back to the country-name map; absent both → Northern (harmless default,
    // and equatorial countries have weak seasons anyway).
    const weatherSeason = intent?.seasonOverride
      ?? seasonForMonth(
        new Date().getUTCMonth(),
        resolveHemisphere(profileData?.location_country_code, profileData?.location_country),
      );

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

    // Photo lookup for the multimodal curator (paths only; signed lazily later).
    const photoByItemId = new Map<string, { path: string | null; storage: string | null }>();
    for (const row of (wardrobeRes.data ?? []) as Array<Record<string, unknown>>) {
      photoByItemId.set(row.id as string, {
        path: (row.photo_url as string | null) ?? null,
        storage: (row.photo_storage as string | null) ?? null,
      });
    }

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
        canLayer: row.can_layer as boolean | null | undefined,
        printScale: row.print_scale as string | null | undefined,
        drape: row.drape as string | null | undefined,
        visualInterest: row.visual_interest as number | null | undefined,
        // Fix 3 (2026-08-06): thread the measured-hex + structured-graphics
        // columns through to the engine — previously fetched nowhere, so
        // enrichment.ts's hex refinement and structured-graphics preference
        // were permanently dead (always saw undefined).
        primary_hex: row.primary_hex as string | null | undefined,
        secondary_hex: row.secondary_hex as string | null | undefined,
        graphics: row.graphics as ClothingItemRow['graphics'],
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

    // Opt-in gender-aware styling (backlog #3): only a binary profile gender feeds
    // a SOFT scoring nudge, and only when the user enabled the setting. NON-BINARY /
    // PREFER NOT TO SAY / unset stay gender-blind.
    const rawGender = (profileData?.gender ?? '').trim().toUpperCase();
    const gender = genderAware && (rawGender === 'WOMAN' || rawGender === 'MAN')
      ? (rawGender as 'WOMAN' | 'MAN')
      : undefined;

    if (genderAware) console.log(`[generate-outfits] gender-aware styling: requested, applied=${gender ?? 'none'}`);

    let ctx: EngineContext = {
      bodyMeasurements, styleProfile, colorPreferences, colorSeason, colorTone12, weatherSeason, intent, gender,
      suggestByStyle, suggestByMeasurements, shapeGoal,
    };
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

    // Load the colors lookup so enrichment can score colors that aren't in the
    // curated COLOR_MAP (auto-added by generate-item-image). Best-effort — on
    // failure the engine keeps the hardcoded map + neutral fallback.
    try {
      const { data: colorRows } = await supabase
        .from('colors')
        .select('name, primary_color, lightness, saturation, hue, sat_pct, lum_pct, undertone');
      if (colorRows) registerColors(colorRows as Parameters<typeof registerColors>[0]);
    } catch (_e) { /* keep hardcoded color map */ }

    // 2. Classify all items
    const fitItems = wardrobeRows.map(toFitItem);

    // Taste vector (lever L2): learn a per-user preference from the outfits they've
    // VIEWED/SAVED/WORN. The outfit_id is the slot key (top|bottom|shoes|outwear|accessory),
    // so item ids are recovered by splitting it and resolved against the FULL wardrobe
    // (not today's style-filtered subset, so the signal isn't biased by the filter).
    // worn > saved > viewed (see engine/taste.ts VIEWED_WEIGHT/SAVED_WEIGHT/WORN_WEIGHT).
    // Undefined when no usable history → ranking is unaffected.
    const fullItemMap = new Map<string, FitItem>(fitItems.map(i => [i.id, i]));
    const positives = ((interactionsRes.data ?? []) as Array<{ outfit_id: string; type: string }>).map(r => ({
      itemIds: String(r.outfit_id).split('|').filter(Boolean),
      weight: r.type === 'worn' ? WORN_WEIGHT : r.type === 'viewed' ? VIEWED_WEIGHT : SAVED_WEIGHT,
    }));
    // Impressions share the slot-key outfit_id format, so item ids parse the same way.
    const exposures = ((impressionsRes.data ?? []) as Array<{ outfit_id: string }>).map(r => ({
      itemIds: String(r.outfit_id).split('|').filter(Boolean),
    }));
    const tasteVector = buildTasteVector(positives, fullItemMap, exposures);
    if (tasteVector) {
      console.log(`[generate-outfits] taste vector: ${tasteVector.sampleCount} liked outfits (weighted), exposure=${tasteVector.exposure?.sampleCount ?? 0} impressions (lift=${tasteVector.exposure ? 'on' : 'off'}) → formality=${tasteVector.meanFormality.toFixed(2)} statement=${tasteVector.meanStatement.toFixed(2)}`);
      ctx = { ...ctx, tasteVector };
    }

    // Dismiss vector (feed-signals, 2026-08-07): swipe-left negative signal,
    // built the same way but as a SEPARATE aggregate — see engine/taste.ts's
    // dismiss section for why it isn't folded into the positive vector above.
    const dismissedOutfits = ((dismissedRes.data ?? []) as Array<{ outfit_id: string }>).map(r => ({
      itemIds: String(r.outfit_id).split('|').filter(Boolean),
    }));
    const dismissVector = buildDismissVector(dismissedOutfits, fullItemMap);
    if (dismissVector) {
      console.log(`[generate-outfits] dismiss vector: ${dismissVector.sampleCount} dismissed outfits → formality=${dismissVector.meanFormality.toFixed(2)} statement=${dismissVector.meanStatement.toFixed(2)}`);
      ctx = { ...ctx, dismissVector };
    }

    // 3. Apply style hard constraints — an item passes if it fits ANY of the
    //    user's selected styles (up to 5), not just the first one. Scoring
    //    weights still come from the primary style.
    let filteredItems = fitItems;
    let styleConfigs = ctx.styleProfile.selectedStyles
      .map(id => styleConfigById(id))
      .filter((c): c is NonNullable<typeof c> => c !== undefined);

    // 3a. Wardrobe-affinity style fallback (2026-08-02): the user (and intent,
    //    resolved just above) picked no styles at all, so the filter/scoring
    //    below would otherwise run style-blind — no style identity in the feed,
    //    styleCoherence dropped out of scoring entirely. Auto-select up to 3
    //    styles the wardrobe can ACTUALLY express (resolveFallbackStyles reads
    //    real per-item coverage, not a guess) and feed them into ctx BEFORE the
    //    existing filter/weights block runs, so it behaves exactly as if the
    //    user had picked these styles. Skipped for Mix & Match (pinItem): that
    //    flow must keep searching the whole wardrobe around the pinned piece,
    //    not narrow it to a guessed style.
    let styleFallback = false;
    let fallbackConfigs: StyleConfig[] = [];
    if (styleConfigs.length === 0 && !pinItem && filteredItems.length > 0) {
      fallbackConfigs = resolveFallbackStyles(fitItems);
      if (fallbackConfigs.length > 0) {
        styleFallback = true;
        styleConfigs = fallbackConfigs;
        ctx = {
          ...ctx,
          styleProfile: { ...ctx.styleProfile, selectedStyles: fallbackConfigs.map(c => c.id) },
        };
        const coverage = fallbackConfigs
          .map(c => `${c.id}=${fitItems.filter(i => passesStyleNaturally(i, c)).length}`)
          .join(', ');
        console.log(`[generate-outfits] style fallback: no selected styles → ${fallbackConfigs.map(c => c.id).join(',')} (coverage-based) [${coverage}]`);
      }
    }

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

    // 3b. Fix 2 (2026-08-06): compute the style attribute vector for the
    //    FINAL selected-styles list — after intent's styleOverrides (applyIntent,
    //    step 1 above) and the wardrobe-affinity fallback (3a) have both had a
    //    chance to change it — and set it as styleProfile.computedAttributes
    //    BEFORE resolveTargetSilhouette runs. silhouette.ts's
    //    fromStyleSilhouette reads exactly this field to drive the style level
    //    of the target-silhouette cascade; it was never set anywhere, so that
    //    level could never fire and every profile fell straight through to
    //    body_shape/neutral (dead code). applyIntent nulls computedAttributes
    //    when it applies a styleOverride (:270) — that guard protects a
    //    hypothetical CLIENT-SENT computedAttributes (this endpoint has never
    //    produced one) from surviving a style change; setting a fresh
    //    SERVER-computed value here, after applyIntent already ran, targets
    //    the styles actually in effect and doesn't conflict with that guard.
    ctx = {
      ...ctx,
      styleProfile: {
        ...ctx.styleProfile,
        computedAttributes: computeUserAttributes(ctx.styleProfile.selectedStyles),
      },
    };

    // 3c. Resolve the target silhouette (silhouette-first resolution,
    //    2026-07-12) AFTER the style filter so it's derived from the same
    //    pool generation draws from. Degradable bias + scoring term only —
    //    never a hard filter; see engine/silhouette.ts.
    ctx = { ...ctx, targetSilhouette: resolveTargetSilhouette(ctx, filteredItems) };

    // 4. Generate candidates (seeded per user+day for stable paging),
    //    then filter excluded outfits.
    const itemMap = new Map<string, FitItem>(filteredItems.map(i => [i.id, i]));
    const daySeed = `${userId}:${new Date().toISOString().slice(0, 10)}`;

    // Mix & Match (feature 008): a transient pinned item is NOT read from the DB.
    // Build a FitItem from the request, inject it into the itemMap (so scoring can
    // resolve it), and run the pinned generator so every candidate includes it.
    let pinFitItem: FitItem | undefined;
    if (pinItem) {
      pinFitItem = toFitItem(pinItemToRow(pinItem));
      itemMap.set(pinFitItem.id, pinFitItem);
    }

    let candidates = pinFitItem
      ? generatePinnedCandidates(filteredItems, pinFitItem, daySeed, ctx.targetSilhouette)
      : generateCandidates(filteredItems, effectiveFormulas, daySeed, ctx.targetSilhouette);

    // Hero-first: in the non-pinned path, mix in candidates built around
    // high-statement wardrobe items so striking pieces get featured even when
    // formula scoring would rank them lower. Merged before the exclude filter
    // so paging suppresses hero outfits the same way it suppresses formula ones.
    // PREPENDED (not appended) so the GENERATION_CAP slice can't crowd them out:
    // a data-rich wardrobe saturates the formula pool at GENERATION_CAP, and an
    // append+slice would drop every hero candidate — defeating the feature on
    // exactly the wardrobes it should help. Heroes are ≤ HERO_CAP×HERO_PER_CAP
    // (≈144), leaving ample room for formula candidates.
    if (!pinFitItem) {
      // Resolve the user's favourite colours to primaries so an on-palette piece is
      // preferred when picking the hero (a loud item in their gu beats an equally
      // loud off-palette one).
      const userPalette = colorPreferences.map(c => colorProfileOf(c).primaryColor);
      // Items from outfits the user saved/wore are proven heroes (L2 follow-up c).
      const favouriteItemIds = new Set(positives.flatMap(p => p.itemIds));
      const heroCandidates = generateHeroCandidates(filteredItems, daySeed, userPalette, favouriteItemIds, ctx.targetSilhouette);
      console.log(`[generate-outfits] hero candidates: +${heroCandidates.length} mixed in`);
      candidates = [...heroCandidates, ...candidates].slice(0, GENERATION_CAP);
    }

    // Exclude already-shown outfits by FULL-slot key (top|bottom|shoes|outwear|
    // accessory) so two distinct mixes of the same items remain available — only
    // the exact same outfit is suppressed. Legacy core-triple and bare-top keys
    // from older client caches are still honored until those caches cycle out.
    if (excludeIds.length > 0) {
      const excludeSet = new Set(excludeIds);
      candidates = candidates.filter(c => {
        const { top, bottom, shoes, outwear, accessory, mid } = c.slots;
        // mid appended last (2026-08-10) — matches the client's outfitKey
        // (fitEngineStore.ts) so two outfits sharing top/bottom/shoes/outwear/
        // accessory but differing only in the mid layer are NOT treated as
        // the same outfit for exclude/dedup purposes.
        const full = `${top}|${bottom}|${shoes}|${outwear ?? ''}|${accessory ?? ''}|${mid ?? ''}`;
        const core = `${top}|${bottom}|${shoes}`;
        return !excludeSet.has(full) && !excludeSet.has(core) && !excludeSet.has(top);
      });
    }
    console.log(`[generate-outfits] candidates generated: ${candidates.length} (after exclude)`);

    // 5. Score, rank, quality-gate, shuffle.
    //    Mix & Match (a pinned item) skips the gate: the user explicitly wants
    //    combos around their item, so showing fewer is worse than showing softer
    //    matches. The normal feed is gated so weak outfits stop padding it.
    const ranked = rankCandidates(candidates, itemMap, ctx);
    const gated = pinFitItem ? ranked : applyQualityGate(ranked);
    const shuffled = dailyShuffle(gated, userId);

    // 6. LLM curation pass (Gemini) — ONLY when GOOGLE_API_KEY is set. Without
    //    the key this entire branch is skipped and the rule-engine order is
    //    returned directly: no prompt building, no network call.
    let outfits = shuffled.slice(0, 10);
    let curated = false;

    // Rate-limit the Gemini curation step (audit 2026-07-03): curateRequested is
    // client-controlled, so a hand-rolled client could otherwise burn unbounded
    // Gemini spend. Over budget → silently keep the rule order (the feed itself
    // is never rate-limited); RPC failure fails open like evaluate-item's note.
    let curationAllowed = true;
    if (curatorEnabled() && curateRequested && shuffled.length > 0) {
      try {
        const { data: ok } = await supabase.rpc('consume_rate_limit', {
          p_bucket: 'curate_feed', p_max: 30, p_window_secs: 3600,
        });
        if (ok === false) {
          curationAllowed = false;
          console.warn('[generate-outfits] curation rate-limited — falling back to rule order');
        }
      } catch (_e) { /* fail open — curation is best-effort */ }
    }

    if (curationAllowed && curatorEnabled() && curateRequested && shuffled.length > 0) {
      const rowById = new Map(wardrobeRows.map(r => [r.id, r]));
      const describeItem = (id: string | undefined, slot: string): string | null => {
        if (!id) return null;
        const r = rowById.get(id);
        if (!r) return null;
        const parts = [r.name, `(${r.type.toLowerCase()}, ${r.color}${r.material ? `, ${r.material}` : ''}${r.fit ? `, ${r.fit} fit` : ''})`];
        return `${slot}: ${parts.join(' ')}`;
      };

      const occasionLine = intent?.occasion ? `Occasion: ${intent.occasion}.` : '';
      const seasonLine = weatherSeason ? `Current season/weather: ${weatherSeason}.` : '';
      const profileBlock = [
        `User profile — styles: ${ctx.styleProfile.selectedStyles.join(', ') || 'unspecified'}.`,
        `Favorite colors: ${colorPreferences.join(', ') || 'unspecified'}.`,
        colorSeason ? `Personal color season: ${colorSeason}${colorTone12 ? ` (12-tone: ${colorTone12}; undertone: ${profileData?.skin_undertone ?? 'unknown'})` : ` (undertone: ${profileData?.skin_undertone ?? 'unknown'})`}.` : '',
        bodyMeasurements.body_shape ? `Body shape: ${bodyMeasurements.body_shape}.` : '',
        occasionLine, seasonLine,
      ].filter(Boolean).join('\n');

      // Multimodal (2026-07-03): attach the distinct items' photos so the judge
      // sees the actual garments. Own-storage signed URLs only, hard caps on
      // count/size/time; any failure just degrades to text-only curation.
      // Kill switch: set CURATOR_MULTIMODAL=off.
      let curatorImages: CuratorImage[] | undefined;
      if ((Deno.env.get('CURATOR_MULTIMODAL') ?? 'on').toLowerCase() !== 'off') {
        const topIds = [...new Set(shuffled.slice(0, 24).flatMap(o =>
          [o.slots.top, o.slots.bottom, o.slots.shoes, o.slots.outwear, o.slots.accessory, o.slots.mid]
            .filter((id): id is string => id !== undefined)))].slice(0, MAX_CURATOR_IMAGES);
        const tImg = Date.now();
        const fetched = await Promise.all(topIds.map(id =>
          fetchCuratorImage(supabase, photoByItemId.get(id), rowById.get(id)?.name ?? id)));
        curatorImages = fetched.filter((i): i is CuratorImage => i !== null);
        if (curatorImages.length === 0) curatorImages = undefined;
        const kb = Math.round((curatorImages ?? []).reduce((s, i) => s + i.dataB64.length * 0.75, 0) / 1024);
        console.log(`[generate-outfits] curator images: ${curatorImages?.length ?? 0}/${topIds.length} attached, ~${kb}KB in ${Date.now() - tImg}ms`);
      }

      const curationResult = await curateOutfits({
        outfits: shuffled.slice(0, 24),
        locale,
        profileBlock,
        images: curatorImages,
        describe: (o) => {
          const isOnepiece = o.slots.top === o.slots.bottom;
          const items = [
            isOnepiece ? describeItem(o.slots.top, 'one-piece') : describeItem(o.slots.top, 'top'),
            isOnepiece ? null : describeItem(o.slots.bottom, 'bottom'),
            describeItem(o.slots.shoes, 'shoes'),
            describeItem(o.slots.outwear, 'outerwear'),
            describeItem(o.slots.mid, 'mid layer'),
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
    // ── Story grouping (S3) ───────────────────────────────────────────────
    // A stylist presents looks as briefs, not a ranked list. Group the final
    // feed into 2–3 stories by the outfit's register (avg formality), rotate
    // which story leads by day, and keep the curated/ranked order INSIDE each
    // story (stable sort) — the story is the narrative, the order within it
    // is the stylist's ranking.
    const itemsOf = (o: ScoredOutfit): FitItem[] => {
      // mid appended last (2026-08-10) — same ordering rule as ranking.ts's
      // slotsToIds: keeps `.find(i => i.category === …)` below (and in
      // scoring.ts/silhouette.ts, which consume this same flattened list)
      // resolving the real top/outwear slot item before a same-category mid one.
      const ids = [...new Set([o.slots.top, o.slots.bottom, o.slots.shoes, o.slots.outwear, o.slots.accessory, o.slots.mid]
        .filter((id): id is string => id !== undefined))];
      return ids.map(id => itemMap.get(id)).filter((i): i is FitItem => i !== undefined);
    };
    const storyOf = (its: FitItem[]): string => {
      if (its.length === 0) return 'EVERYDAY';
      const avg = its.reduce((s, i) => s + i.formality, 0) / its.length;
      return avg >= 3.2 ? 'REFINED' : avg <= 2.4 ? 'OFF DUTY' : 'EVERYDAY';
    };
    // Real warmth band from the outfit's fabrics/layers (replaces the client's
    // hardcoded '22°C'). Coarse and tunable; an outer layer or fall fabrics pull
    // the band down, winter fabrics pin it cold, summery fabrics push it hot.
    const weatherBandOf = (its: FitItem[], hasOuterLayer: boolean): string => {
      const seasons = its.filter(i => i.category !== 'accessory').map(i => i.fabric.season);
      if (seasons.includes('winter')) return '<15°C';
      if (hasOuterLayer || seasons.includes('fall')) return '15–22°C';
      const summery = seasons.filter(s => s === 'summer').length;
      if (summery >= 2 || (summery >= 1 && seasons.every(s => s === 'summer' || s === 'allSeason'))) return '28°C+';
      return '22–28°C';
    };
    // Wardrobe-affinity style fallback tag (2026-08-02): which fallback style
    // the outfit's items align with most (count of items passing that style's
    // checks naturally), tie-broken by the fallback ranking order (iterate in
    // that order, strict `>` so an earlier-ranked style wins ties). Only
    // meaningful — and only computed — when the fallback actually fired.
    const styleTagOf = (its: FitItem[]): string | undefined => {
      let best: StyleConfig | undefined;
      let bestCount = -1;
      for (const config of fallbackConfigs) {
        const count = its.filter(i => passesStyleNaturally(i, config)).length;
        if (count > bestCount) { bestCount = count; best = config; }
      }
      return best?.name;
    };

    const STORY_ORDER = ['REFINED', 'EVERYDAY', 'OFF DUTY'];
    const rot = (new Date().getUTCDate() + userId.length) % STORY_ORDER.length;
    const storySequence = [...STORY_ORDER.slice(rot), ...STORY_ORDER.slice(0, rot)];
    for (const o of outfits) {
      const its = itemsOf(o);
      o.story = storyOf(its);
      o.stylingTips = deriveStylingTips(its, o.formula, { top: o.slots.top, outwear: o.slots.outwear });
      // mid always implies outwear today (generation.ts never emits a bare mid
      // with no true outer) — the `|| o.slots.mid` is defensive, not currently
      // load-bearing, but a layered outfit reads warmer either way.
      o.weatherBand = weatherBandOf(its, o.slots.outwear !== undefined || o.slots.mid !== undefined);
      // Display-only tags (2026-07-12) — no scoring impact.
      o.silhouette = outfitSilhouetteTag(its);
      o.silhouetteShape = resultingBodySilhouette(its, ctx.bodyMeasurements.body_shape);
      o.colorTone = outfitDominantColor(its);
      if (styleFallback) o.styleTag = styleTagOf(its);
    }
    outfits = [...outfits].sort(
      (a, b) => storySequence.indexOf(a.story!) - storySequence.indexOf(b.story!),
    );

    const hasMore = shuffled.length > 10;

    // ── Log results ──────────────────────────────────────────────────────
    const nameById = new Map(wardrobeRows.map(r => [r.id, r.name]));

    console.log(`[generate-outfits] RESULT ${outfits.length} outfits in ${Date.now() - callStart}ms`);

    for (let i = 0; i < outfits.length; i++) {
      const outfit = outfits[i];
      const { top, bottom, shoes, outwear, accessory, mid } = outfit.slots;
      const slotEntries: [string, string][] = [
        ['top',       top],
        ['bottom',    bottom],
        ['shoes',     shoes],
        ...(outwear   ? [['outwear',   outwear]   as [string, string]] : []),
        ...(mid       ? [['mid',       mid]       as [string, string]] : []),
        ...(accessory ? [['accessory', accessory] as [string, string]] : []),
      ];
      const itemList = slotEntries
        .map(([slot, id], idx) => `${idx + 1}: ${nameById.get(id) ?? id} (${slot})`)
        .join(', ');
      console.log(`[generate-outfits] outfit #${i + 1} formula=${outfit.formula} style=${primaryStyle} score=${outfit.totalScore.toFixed(3)} items=[${itemList}]`);
    }

    // Additive, omitted entirely when the fallback didn't fire — old clients
    // that don't know this key ignore it either way.
    const responseBody: Record<string, unknown> = { outfits, has_more: hasMore, curated };
    if (styleFallback) {
      responseBody.style_fallback = {
        applied: true,
        styles: fallbackConfigs.map(c => ({ id: c.id, name: c.name })),
      };
    }
    return jsonResponse(responseBody, 200);

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

// Flat m_* request keys → the label/value array toFitItem expects. Mirrors the
// evaluate-item conversion so a scanned item enriches identically (feature 008).
const M_PIN_COLS: Array<[string, string]> = [
  ['m_chest', 'chest'], ['m_shoulder_width', 'shoulder'], ['m_sleeves', 'sleeve'],
  ['m_body_length', 'length'], ['m_upper_arm', 'upper arm'], ['m_waist', 'waist'],
  ['m_hip', 'hip'], ['m_inseam', 'inseam'], ['m_thigh', 'thigh'], ['m_rise', 'rise'],
];

// ── Multimodal curator image resolution (2026-07-03) ─────────────────────────

// Perf-tuned 2026-07-03: first prod runs with 20 × ≤1.5MB pushed paid feed
// latency to 11–15s (payload upload + Gemini vision over ~20 images). 12 × ≤800KB
// keeps the visual signal (distinct items of the top outfits) at roughly half
// the payload. Tunable; CURATOR_MULTIMODAL=off kills the whole path.
const MAX_CURATOR_IMAGES = 12;        // hard cap on photos per curation call
const CURATOR_IMAGE_MAX_BYTES = 800_000;
const CURATOR_IMAGE_FETCH_MS = 2500;  // per-image budget; slow photos are dropped

function u8ToB64(u8: Uint8Array): string {
  let bin = '';
  const chunk = 0x8000;
  for (let i = 0; i < u8.length; i += chunk) {
    bin += String.fromCharCode(...u8.subarray(i, i + chunk));
  }
  return btoa(bin);
}

// Minimal structural view of the client — avoids supabase-js generic mismatch.
interface StorageSigner {
  storage: {
    from(bucket: string): {
      createSignedUrl(path: string, ttl: number): Promise<{ data: { signedUrl: string } | null }>;
    };
  };
}

// Resolve one wardrobe item photo to an inline image. ONLY the project's own
// private bucket is fetched (fresh signed URL, user-RLS-scoped client) — stored
// absolute URLs are ignored entirely, so no user-writable URL is ever fetched.
async function fetchCuratorImage(
  supabase: StorageSigner,
  photo: { path: string | null; storage: string | null } | undefined,
  label: string,
): Promise<CuratorImage | null> {
  if (!photo?.path || photo.storage !== 'cloud') return null;
  try {
    const { data } = await supabase.storage.from('wardrobe-photos').createSignedUrl(photo.path, 60);
    if (!data?.signedUrl) return null;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), CURATOR_IMAGE_FETCH_MS);
    try {
      const res = await fetch(data.signedUrl, { signal: ctrl.signal, redirect: 'error' });
      if (!res.ok) return null;
      const mimeType = res.headers.get('content-type')?.split(';')[0] || 'image/jpeg';
      if (!mimeType.startsWith('image/')) return null;
      const buf = new Uint8Array(await res.arrayBuffer());
      if (buf.length === 0 || buf.length > CURATOR_IMAGE_MAX_BYTES) return null;
      return { label, mimeType, dataB64: u8ToB64(buf) };
    } finally {
      clearTimeout(timer);
    }
  } catch {
    return null;
  }
}

function pinItemToRow(pin: Record<string, unknown>): ClothingItemRow {
  const rawM = pin.measurements as Record<string, unknown> | undefined;
  const measurements = rawM
    ? M_PIN_COLS
        .filter(([reqKey]) => rawM[reqKey] != null)
        .map(([reqKey, label]) => ({ label, value: Number(rawM[reqKey]), unit: 'cm' }))
        .filter(m => !isNaN(m.value))
    : undefined;

  const type = String(pin.type);
  return {
    id:    typeof pin.id === 'string' && pin.id.trim() ? pin.id : 'scanned',
    type,
    name:  type, // type drives pattern/graphics inference; the scanned name isn't needed
    color: typeof pin.color === 'string' ? pin.color : '',
    material:     typeof pin.material      === 'string' ? pin.material      : undefined,
    fit:          typeof pin.fit           === 'string' ? pin.fit           : undefined,
    pattern:      typeof pin.pattern       === 'string' ? pin.pattern       : undefined,
    warmthSeason: typeof pin.warmth_season === 'string' ? pin.warmth_season : undefined,
    canLayer:     typeof pin.can_layer     === 'boolean' ? pin.can_layer    : undefined,
    printScale:   typeof pin.print_scale   === 'string' ? pin.print_scale   : undefined,
    drape:        typeof pin.drape         === 'string' ? pin.drape         : undefined,
    visualInterest: typeof pin.visual_interest === 'number' ? pin.visual_interest : undefined,
    measurements: measurements && measurements.length > 0 ? measurements : undefined,
  };
}
