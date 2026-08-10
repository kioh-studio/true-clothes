// Measurement service — read/update `public.body_measurements`.
// RLS scopes every row to the authenticated user.
// Unlike profiles (auto-created on signup), measurements are upserted on
// first save — the row may not exist yet.
import { sb } from './supabase';
import { BodyMeasurements } from '../types/fitEngine';
import { computeBodyShape, computeBodyShapeLegacy } from '../types/measurements';

// ── DB row shape ────────────────────────────────────────────────────────────
interface MeasurementRow {
  user_id: string;
  body_height: number | null;
  body_weight: number | null;
  body_bust: number | null;
  body_waist: number | null;
  body_hip: number | null;
  body_inseam: number | null;
  body_thigh: number | null;
  body_rise: number | null;
  body_shoulder_width: number | null;
  body_sleeve_length: number | null;
  body_upper_body_length: number | null;
  body_upper_arm: number | null;
  body_neck: number | null;
  body_foot_length: number | null;
  body_foot_width: number | null;
  preferred_fit: string | null;
  body_shape: string | null;
}

// ── DB row → app shape ──────────────────────────────────────────────────────
// Read-repair (2026-08-03 classifier rewrite, no SQL migration): a stored
// body_shape that matches the OLD (legacy) classifier's output for these
// measurements but not the CURRENT classifier's is stale old-classifier
// output, not a genuine manual override — there is only one column, so the
// legacy classifier is how we tell the two apart. Recompute it on read and
// best-effort write the corrected value back; a value that matches neither
// classifier is a real manual override and is left untouched.
function rowToBody(row: MeasurementRow): BodyMeasurements {
  const mapped: BodyMeasurements = {
    body_height:            row.body_height ?? undefined,
    body_weight:            row.body_weight ?? undefined,
    body_bust:              row.body_bust ?? undefined,
    body_waist:             row.body_waist ?? undefined,
    body_hip:               row.body_hip ?? undefined,
    body_inseam:            row.body_inseam ?? undefined,
    body_thigh:             row.body_thigh ?? undefined,
    body_rise:              row.body_rise ?? undefined,
    body_shoulder_width:    row.body_shoulder_width ?? undefined,
    body_sleeve_length:     row.body_sleeve_length ?? undefined,
    body_upper_body_length: row.body_upper_body_length ?? undefined,
    body_upper_arm:         row.body_upper_arm ?? undefined,
    body_neck:              row.body_neck ?? undefined,
    body_foot_length:       row.body_foot_length ?? undefined,
    body_foot_width:        row.body_foot_width ?? undefined,
    preferredFit:           row.preferred_fit as BodyMeasurements['preferredFit'] ?? undefined,
    bodyShape:              row.body_shape as BodyMeasurements['bodyShape'] ?? undefined,
  };

  if (mapped.bodyShape) {
    const current = computeBodyShape(mapped);
    const legacy = computeBodyShapeLegacy(mapped);
    if (mapped.bodyShape === legacy && legacy !== current) {
      mapped.bodyShape = current ?? undefined;
      if (current) {
        // Fire-and-forget — never let a best-effort write-back fail the read.
        upsertMyMeasurements(row.user_id, { bodyShape: current }).catch(() => {});
      }
    }
    // Else: already matches the current classifier, or matches neither
    // classifier (a genuine manual override) — keep untouched.
  }

  return mapped;
}

// ── App shape → DB row (partial) ────────────────────────────────────────────
function bodyToRow(m: Partial<BodyMeasurements>): Record<string, number | string | null> {
  const row: Record<string, number | string | null> = {};
  if (m.body_height !== undefined)            row.body_height = m.body_height ?? null;
  if (m.body_weight !== undefined)            row.body_weight = m.body_weight ?? null;
  if (m.body_bust !== undefined)              row.body_bust = m.body_bust ?? null;
  if (m.body_waist !== undefined)             row.body_waist = m.body_waist ?? null;
  if (m.body_hip !== undefined)               row.body_hip = m.body_hip ?? null;
  if (m.body_inseam !== undefined)            row.body_inseam = m.body_inseam ?? null;
  if (m.body_thigh !== undefined)             row.body_thigh = m.body_thigh ?? null;
  if (m.body_rise !== undefined)              row.body_rise = m.body_rise ?? null;
  if (m.body_shoulder_width !== undefined)    row.body_shoulder_width = m.body_shoulder_width ?? null;
  if (m.body_sleeve_length !== undefined)     row.body_sleeve_length = m.body_sleeve_length ?? null;
  if (m.body_upper_body_length !== undefined) row.body_upper_body_length = m.body_upper_body_length ?? null;
  if (m.body_upper_arm !== undefined)         row.body_upper_arm = m.body_upper_arm ?? null;
  if (m.body_neck !== undefined)              row.body_neck = m.body_neck ?? null;
  if (m.body_foot_length !== undefined)       row.body_foot_length = m.body_foot_length ?? null;
  if (m.body_foot_width !== undefined)        row.body_foot_width = m.body_foot_width ?? null;
  if (m.preferredFit !== undefined)           row.preferred_fit = m.preferredFit ?? null;
  if (m.bodyShape !== undefined)              row.body_shape = m.bodyShape ?? null;
  return row;
}

// ── Public API ──────────────────────────────────────────────────────────────

export async function fetchMyMeasurements(userId: string): Promise<BodyMeasurements | null> {
  const { data, error } = await sb
    .from('body_measurements')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) {
    console.warn('[measurementService] fetch failed:', error.message);
    return null;
  }
  return data ? rowToBody(data as MeasurementRow) : null;
}

export async function upsertMyMeasurements(
  userId: string,
  patch: Partial<BodyMeasurements>,
): Promise<{ ok: boolean; message?: string }> {
  const row = bodyToRow(patch);
  if (Object.keys(row).length === 0) return { ok: true };

  const { error } = await sb
    .from('body_measurements')
    .upsert({ user_id: userId, ...row }, { onConflict: 'user_id' });
  if (error) {
    console.warn('[measurementService] upsert failed:', error.message);
    return { ok: false, message: error.message };
  }
  return { ok: true };
}
