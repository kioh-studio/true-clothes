// Edge Function: wardrobe-critic (feature 010)
// POST /functions/v1/wardrobe-critic
// Auth: Bearer Supabase JWT (verify_jwt ON)
// Body: { locale?, candidate_item? } — see specs/010-wardrobe-critic/contracts/
// Response: WardrobeGapReport (snake_case per contract)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { ClothingItemRow, BodyMeasurements } from '../generate-outfits/engine/types.ts';
import { toFitItem } from '../generate-outfits/engine/enrichment.ts';
import { seasonForMonth, resolveHemisphere } from '../generate-outfits/engine/scoring.ts';
import { analyzeWardrobe, unlockCountFor, matchArchetype, styleFilter } from './analyze.ts';
import { ARCHETYPES } from './archetypes.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function jsonResponse(data: unknown, status: number): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return jsonResponse({ error: 'Missing authorization header' }, 401);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return jsonResponse({ error: 'Unauthorized' }, 401);
    const userId = user.id;

    // ── Rate limit (10 analyses / hour; RPC failure fails open) ────────────
    try {
      const { data: ok, error: rlErr } = await supabase.rpc('consume_rate_limit', {
        p_bucket: 'wardrobe_critic', p_max: 10, p_window_secs: 3600,
      });
      if (!rlErr && ok === false) return jsonResponse({ error: 'rate_limited' }, 429);
    } catch (_e) { /* fail open */ }

    // ── Body ────────────────────────────────────────────────────────────────
    let candidateItem: Record<string, unknown> | undefined;
    let bodyNeutral = false; // opt-in body-neutral styling (recommendation #6)
    if (req.method === 'POST') {
      try {
        const body = await req.json();
        if (body.candidate_item != null && typeof body.candidate_item === 'object') {
          candidateItem = body.candidate_item as Record<string, unknown>;
        }
        if (body.body_neutral === true) bodyNeutral = true;
      } catch { /* empty body fine */ }
    }

    // ── Load user data (mirrors generate-outfits) ──────────────────────────
    const [profileRes, measurementsRes, styleRes, wardrobeIdRes] = await Promise.all([
      supabase.from('profiles').select('color_season, color_tone12, personal_palette, location_country, location_country_code').eq('id', userId).single(),
      supabase.from('body_measurements').select('*').eq('user_id', userId).single(),
      supabase.from('style_profiles').select('selected_styles, color_preferences').eq('user_id', userId).single(),
      supabase.from('wardrobes').select('id').eq('user_id', userId).single(),
    ]);

    const wardrobeId = wardrobeIdRes.data?.id as string | undefined;
    const wardrobeRes = wardrobeId
      ? await supabase
          .from('clothing_items')
          .select('id, type, name, color, material, fit, pattern, warmth_season, can_layer, print_scale, drape, visual_interest, m_chest, m_shoulder_width, m_sleeves, m_body_length, m_upper_arm, m_waist, m_hip, m_inseam, m_thigh, m_rise')
          .eq('wardrobe_id', wardrobeId)
      : { data: [] as Record<string, unknown>[], error: null };

    // A transient DB error must NOT be treated as "empty wardrobe" (which would
    // route into the 'starter' mode response below) — surface it as a real
    // failure so the client can retry instead of showing a wrong onboarding state.
    if (wardrobeRes.error) {
      console.error('[wardrobe-critic] wardrobe fetch failed:', wardrobeRes.error);
      return jsonResponse({ error: 'Failed to load wardrobe' }, 500);
    }

    const M_COLS: Array<[string, string]> = [
      ['chest', 'm_chest'], ['shoulder', 'm_shoulder_width'], ['sleeve', 'm_sleeves'],
      ['length', 'm_body_length'], ['upper arm', 'm_upper_arm'], ['waist', 'm_waist'],
      ['hip', 'm_hip'], ['inseam', 'm_inseam'], ['thigh', 'm_thigh'], ['rise', 'm_rise'],
    ];
    const wardrobeRows: ClothingItemRow[] = ((wardrobeRes.data ?? []) as Array<Record<string, unknown>>).map(row => {
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
        measurements: measurements.length > 0 ? measurements : undefined,
      };
    });

    if (wardrobeRows.length === 0) {
      return jsonResponse({
        mode: 'starter', generated_at: new Date().toISOString(), baseline_qualified: 0,
        recommendations: [], starter_checklist: [], redundancy: null, candidate: null,
      }, 200);
    }

    const profileData = profileRes.data as
      | { color_season?: string; color_tone12?: string; personal_palette?: string[]; location_country?: string; location_country_code?: string }
      | null;
    const styleData = styleRes.data as { selected_styles?: string[]; color_preferences?: string[] } | null;
    const bodyMeasurements: BodyMeasurements = measurementsRes.data ?? {};
    // Body-neutral styling (recommendation #6): suppress body_shape BEFORE it
    // reaches analyzeWardrobe/unlockCountFor — both thread bodyMeasurements
    // into the shared engine's scoreOutfitFit, which already no-ops the shape
    // delta when body_shape is absent.
    if (bodyNeutral) {
      bodyMeasurements.body_shape = undefined;
      console.log('[wardrobe-critic] body-neutral: body_shape suppressed');
    }
    const selectedStyles: string[] = styleData?.selected_styles ?? [];
    const colorPreferences: string[] = [
      ...new Set([...(styleData?.color_preferences ?? []), ...(profileData?.personal_palette ?? [])]),
    ];
    const weatherSeason = seasonForMonth(
      new Date().getUTCMonth(),
      resolveHemisphere(profileData?.location_country_code, profileData?.location_country),
    );
    const seed = `${userId}:${new Date().toISOString().slice(0, 10)}`;

    const t0 = Date.now();
    const colorTone12 = profileData?.color_tone12?.toLowerCase() || undefined;

    const report = analyzeWardrobe({
      wardrobeRows,
      selectedStyles,
      colorPreferences,
      bodyMeasurements,
      colorSeason: profileData?.color_season?.toLowerCase() || undefined,
      colorTone12,
      weatherSeason,
      seed,
    });

    // Optional Try-On bridge: unlock count for one concrete scanned item.
    let candidate: { unlock_count: number; matched_archetype_id: string | null } | null = null;
    if (candidateItem && typeof candidateItem.type === 'string' && candidateItem.type.trim()) {
      const candRow: ClothingItemRow = {
        id: 'hypo_candidate',
        type: String(candidateItem.type),
        name: String(candidateItem.type),
        color: typeof candidateItem.color === 'string' ? candidateItem.color : '',
        material: typeof candidateItem.material === 'string' ? candidateItem.material : undefined,
        fit: typeof candidateItem.fit === 'string' ? candidateItem.fit : undefined,
      };
      const candFit = toFitItem(candRow);
      const fitItems = wardrobeRows.map(toFitItem);
      // Same bar as analyzeWardrobe's baseline/recommendations: apply the user's
      // style hard-filter to the wardrobe BEFORE simulating the unlock, so this
      // bridge's unlock_count is measured against the identical feed-eligible
      // pool (analyze.ts styleFilter) instead of the full unfiltered wardrobe.
      const styleFilteredItems = styleFilter(fitItems, selectedStyles);
      const { count } = unlockCountFor(styleFilteredItems, candFit, {
        bodyMeasurements, styleProfile: { selectedStyles }, colorPreferences,
        colorSeason: profileData?.color_season?.toLowerCase() || undefined, colorTone12, weatherSeason,
      }, seed);
      candidate = { unlock_count: count, matched_archetype_id: matchArchetype(candFit)?.id ?? null };
    }

    console.log(`[wardrobe-critic] user=${userId} items=${wardrobeRows.length} mode=${report.mode} recs=${report.recommendations.length} baseline=${report.baselineQualified} in ${Date.now() - t0}ms`);

    return jsonResponse({
      mode: report.mode,
      generated_at: new Date().toISOString(),
      baseline_qualified: report.baselineQualified,
      recommendations: report.recommendations.map(r => ({
        archetype_id: r.archetypeId,
        label: r.label,
        unlock_count: r.unlockCount,
        note: r.note,
        sample_outfits: r.sampleOutfits,
      })),
      starter_checklist: report.starterChecklist.map(s => ({
        archetype_id: s.archetypeId, label: s.label, owned: s.owned,
      })),
      redundancy: report.redundancy
        ? {
            type_name: report.redundancy.typeName,
            color_family: report.redundancy.colorFamily,
            count: report.redundancy.count,
            note: report.redundancy.note,
          }
        : null,
      candidate,
      // Client convenience: total archetype catalog size (for "locked rows" UI).
      catalog_size: ARCHETYPES.length,
    }, 200);
  } catch (err) {
    console.error('[wardrobe-critic] Error:', err);
    return jsonResponse({ error: 'Internal server error' }, 500);
  }
});
