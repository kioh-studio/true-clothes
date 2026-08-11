// Edge Function: evaluate-item
// POST /functions/v1/evaluate-item
// Auth: Bearer token (Supabase JWT) — same pattern as generate-outfits.
// Body: { item: { type, color, material?, fit?, pattern?, warmth_season?,
//                  measurements?: { m_chest?, m_body_length?, … } }, locale? }
// Response: VerdictResult (snake_case) per contracts/evaluate-item.md

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  BodyMeasurements, ClothingItemRow,
} from '../generate-outfits/engine/types.ts';
import { toFitItem, registerColors } from '../generate-outfits/engine/enrichment.ts';
import { seasonForMonth, resolveHemisphere } from '../generate-outfits/engine/scoring.ts';
import { computeVerdict } from './scoring.ts';
import { buildNoteContext, generateFitNote, resolveLocale } from './note.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Mapping from the flat m_* request keys to the label/value array that toFitItem expects.
// Keys match what the contract accepts in item.measurements.
const M_REQ_COLS: Array<[string, string]> = [
  ['m_chest',          'chest'],
  ['m_shoulder_width', 'shoulder'],
  ['m_sleeves',        'sleeve'],
  ['m_body_length',    'length'],
  ['m_upper_arm',      'upper arm'],
  ['m_waist',          'waist'],
  ['m_hip',            'hip'],
  ['m_inseam',         'inseam'],
  ['m_thigh',          'thigh'],
  ['m_rise',           'rise'],
];

Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return jsonResponse({ ok: true }, 200);
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
    if (req.method !== 'POST') {
      return jsonResponse({ error: 'Method not allowed' }, 405);
    }

    let rawItem: Record<string, unknown> | undefined;
    let localeRaw: unknown;
    let bodyNeutral = false; // opt-in body-neutral styling (recommendation #6)
    try {
      const body = await req.json() as Record<string, unknown>;
      rawItem = body.item as Record<string, unknown> | undefined;
      localeRaw = body.locale;
      if (body.body_neutral === true) bodyNeutral = true;
    } catch {
      return jsonResponse({ error: 'Invalid JSON body' }, 400);
    }
    const locale = resolveLocale(typeof localeRaw === 'string' ? localeRaw : undefined);

    if (!rawItem || typeof rawItem !== 'object' || Object.keys(rawItem).length === 0) {
      return jsonResponse({ error: 'Missing or empty item in request body' }, 400);
    }

    // Validate required field: type
    if (typeof rawItem.type !== 'string' || !rawItem.type.trim()) {
      return jsonResponse({ error: 'item.type is required' }, 400);
    }

    // ── Load user profile from DB (mirrors generate-outfits pattern) ──────
    const [profileRes, measurementsRes, styleRes] = await Promise.all([
      supabase.from('profiles').select('color_season, color_tone12, personal_palette, location_country, location_country_code, gender').eq('id', userId).single(),
      supabase.from('body_measurements').select('*').eq('user_id', userId).single(),
      supabase.from('style_profiles').select('selected_styles, color_preferences, suggest_by_style, suggest_by_personal_color, suggest_by_formula, suggest_by_measurements').eq('user_id', userId).single(),
    ]);

    // ── Map DB rows to engine types ───────────────────────────────────────
    const bodyMeasurements: BodyMeasurements = measurementsRes.data ?? {};
    // Body-neutral styling (recommendation #6): suppress body_shape BEFORE it
    // reaches computeVerdict — the fit criterion's shape delta and
    // fitExplanation's shapePart are already guarded by `if (bodyShape)`, so
    // nulling it here removes both the scoring effect and the rationale text.
    if (bodyNeutral) {
      bodyMeasurements.body_shape = undefined;
      console.log('[evaluate-item] body-neutral: body_shape suppressed');
    }

    const styleData = styleRes.data as
      | {
          selected_styles?: string[]; color_preferences?: string[];
          suggest_by_style?: boolean; suggest_by_personal_color?: boolean;
          suggest_by_formula?: boolean; suggest_by_measurements?: boolean;
        }
      | null;
    const selectedStyles: string[] = styleData?.selected_styles ?? [];

    // 4 suggestion toggles (2026-08-10) — mirrors generate-outfits/index.ts.
    // suggest_by_formula has no effect here: evaluate-item scores one item,
    // never an outfit combo, so it never reads formula_preferences to begin
    // with — the toggle is a structural no-op for this endpoint.
    const suggestByStyle = styleData?.suggest_by_style !== false;
    const suggestByPersonalColor = styleData?.suggest_by_personal_color !== false;
    const suggestByMeasurements = styleData?.suggest_by_measurements !== false;
    {
      const off = [
        !suggestByStyle && 'style',
        !suggestByPersonalColor && 'personal_color',
        !suggestByMeasurements && 'measurements',
      ].filter((v): v is string => typeof v === 'string');
      if (off.length > 0) console.log(`[evaluate-item] suggestion toggles off: ${off.join(', ')}`);
    }

    const profileData = profileRes.data as
      | { color_season?: string; color_tone12?: string; personal_palette?: string[]; location_country?: string; location_country_code?: string; gender?: string }
      | null;
    // suggest_by_personal_color=false: same rule as generate-outfits — drop the
    // detected palette from the union and null the season/tone12 classification.
    // colorPreferences still carries the user's own manual color_preferences, so
    // the 'color' criterion stays scoreable, just without the personal-color
    // signal (and colorExplanation/skip-list note drop their season/tone12
    // phrasing automatically, since both are already conditional on these).
    const personalPalette: string[] = suggestByPersonalColor ? (profileData?.personal_palette ?? []) : [];
    const colorPreferences: string[] = [
      ...new Set([...(styleData?.color_preferences ?? []), ...personalPalette]),
    ];
    const colorSeason = suggestByPersonalColor ? (profileData?.color_season?.toLowerCase() || undefined) : undefined;
    const colorTone12 = suggestByPersonalColor ? (profileData?.color_tone12?.toLowerCase() || undefined) : undefined;

    // Current real-world season (date + best-effort hemisphere from country), used
    // for the Verdict's seasonal colour + fabric criteria — mirrors the feed engine.
    const weatherSeason = seasonForMonth(
      new Date().getUTCMonth(),
      resolveHemisphere(profileData?.location_country_code, profileData?.location_country),
    );

    // ── Build ClothingItemRow from request item ────────────────────────────
    // Convert the flat m_* measurements map to the label/value array format.
    const rawMeasurements = rawItem.measurements as Record<string, unknown> | undefined;
    const measurements = rawMeasurements
      ? M_REQ_COLS
          .filter(([reqKey]) => rawMeasurements[reqKey] != null)
          .map(([reqKey, label]) => ({
            label,
            value: Number(rawMeasurements[reqKey]),
            unit: 'cm',
          }))
          .filter(m => !isNaN(m.value))
      : undefined;

    const itemRow: ClothingItemRow = {
      id: 'scanned',
      type:  String(rawItem.type),
      name:  String(rawItem.type),  // name used for pattern/graphics inference; type works here
      color: typeof rawItem.color === 'string' ? rawItem.color : '',
      material:     typeof rawItem.material     === 'string' ? rawItem.material     : undefined,
      fit:          typeof rawItem.fit          === 'string' ? rawItem.fit          : undefined,
      pattern:      typeof rawItem.pattern      === 'string' ? rawItem.pattern      : undefined,
      warmthSeason: typeof rawItem.warmth_season === 'string' ? rawItem.warmth_season : undefined,
      // distressed (2026-08-11): mirrors pattern/material/fit above — a scanned
      // item's own extraction pass can supply this before it's ever saved.
      distressed: typeof rawItem.distressed === 'boolean' ? rawItem.distressed : undefined,
      measurements: measurements && measurements.length > 0 ? measurements : undefined,
    };

    // Load colors lookup so the Verdict can score colors not in the curated
    // COLOR_MAP (auto-added by generate-item-image). Best-effort.
    try {
      const { data: colorRows } = await supabase
        .from('colors')
        .select('name, primary_color, lightness, saturation, hue, sat_pct, lum_pct, undertone');
      if (colorRows) registerColors(colorRows as Parameters<typeof registerColors>[0]);
    } catch (_e) { /* keep hardcoded color map */ }

    // ── Build FitItem and compute Verdict ─────────────────────────────────
    const fitItem = toFitItem(itemRow);

    const verdict = computeVerdict(fitItem, {
      colorPreferences,
      colorSeason,
      colorTone12,
      selectedStyles,
      bodyMeasurements,
      weatherSeason,
      gender: profileData?.gender,
      locale,
      suggestByStyle,
      suggestByMeasurements,
    });

    // ── AI fit note (shown under the measurement bars) ────────────────────────
    // Best-effort: a Gemini-written, GROUNDED note paraphrasing the verdict above
    // — where it fits, where it doesn't — so the user can decide buy/skip. Never
    // blocks or fails the verdict: on missing key / rate-limit / LLM error the
    // note is simply null and the scores still render. No cache (the scan flow
    // calls this once per item; see plan.md changelog).
    let fitNote: string | null = null;
    const apiKey = Deno.env.get('GOOGLE_API_KEY');
    if (apiKey) {
      let allowed = true;
      try {
        const { data: ok } = await supabase.rpc('consume_rate_limit', {
          p_bucket: 'verdict_note', p_max: 30, p_window_secs: 60,
        });
        if (ok === false) allowed = false; // over budget → skip note, keep verdict
      } catch (_e) { /* fail open — note is best-effort */ }

      if (allowed) {
        const context = buildNoteContext(
          verdict, fitItem, bodyMeasurements,
          { type: itemRow.type, color: itemRow.color, material: itemRow.material, fit: itemRow.fit, pattern: itemRow.pattern ?? undefined },
          // Defense-in-depth (2026-08-11 batch, confirmed defect #4): the
          // `style` criterion is already gated off via verdict.criteria when
          // suggestByStyle is false (computeVerdict above receives the same
          // flag), so this isn't user-visible today — but blank the raw
          // styles list here too so a future prompt change can't accidentally
          // start reading a signal the toggle was meant to turn off. Reuses
          // the SAME `suggestByStyle` accessor already read at :121 — no
          // second source of truth.
          { gender: profileData?.gender, colorSeason, styles: suggestByStyle ? selectedStyles : [] },
          locale,
        );
        const note = await generateFitNote(apiKey, context, locale);
        fitNote = note || null;
      }
    }

    return jsonResponse({ ...verdict, fit_note: fitNote }, 200);

  } catch (err) {
    console.error('[evaluate-item] Error:', err);
    return jsonResponse({ error: 'Internal server error' }, 500);
  }
});

function jsonResponse(data: unknown, status: number): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
