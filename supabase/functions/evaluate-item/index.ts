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
import { computeVerdict } from './scoring.ts';

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
    try {
      const body = await req.json() as Record<string, unknown>;
      rawItem = body.item as Record<string, unknown> | undefined;
    } catch {
      return jsonResponse({ error: 'Invalid JSON body' }, 400);
    }

    if (!rawItem || typeof rawItem !== 'object' || Object.keys(rawItem).length === 0) {
      return jsonResponse({ error: 'Missing or empty item in request body' }, 400);
    }

    // Validate required field: type
    if (typeof rawItem.type !== 'string' || !rawItem.type.trim()) {
      return jsonResponse({ error: 'item.type is required' }, 400);
    }

    // ── Load user profile from DB (mirrors generate-outfits pattern) ──────
    const [profileRes, measurementsRes, styleRes] = await Promise.all([
      supabase.from('profiles').select('color_season, personal_palette').eq('id', userId).single(),
      supabase.from('body_measurements').select('*').eq('user_id', userId).single(),
      supabase.from('style_profiles').select('selected_styles, color_preferences').eq('user_id', userId).single(),
    ]);

    // ── Map DB rows to engine types ───────────────────────────────────────
    const bodyMeasurements: BodyMeasurements = measurementsRes.data ?? {};

    const styleData = styleRes.data as
      | { selected_styles?: string[]; color_preferences?: string[] }
      | null;
    const selectedStyles: string[] = styleData?.selected_styles ?? [];

    const profileData = profileRes.data as
      | { color_season?: string; personal_palette?: string[] }
      | null;
    const personalPalette: string[] = profileData?.personal_palette ?? [];
    const colorPreferences: string[] = [
      ...new Set([...(styleData?.color_preferences ?? []), ...personalPalette]),
    ];
    const colorSeason = profileData?.color_season?.toLowerCase() || undefined;

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
      selectedStyles,
      bodyMeasurements,
    });

    return jsonResponse(verdict, 200);

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
