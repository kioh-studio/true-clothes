import { useState, useCallback, useMemo } from 'react';
import { useAuthStore } from '../../stores/authStore';
import {
  type BodyMeasurements, type BodyShape,
  computeBodyShape, computeBodyShapeLegacy, stabilizeBodyShape,
} from '../../types/measurements';
import { useTranslation } from '../../i18n';
import type { TFunction } from 'i18next';

type NumericKey = keyof Omit<BodyMeasurements, 'bodyShape' | 'poseEstimated' | 'measurementsConsent' | 'preferredFit'>;

function parseNum(s: string): number | undefined {
  const n = parseFloat(s);
  return isNaN(n) || !isFinite(n) ? undefined : n;
}

/**
 * Validate measurement values before save. Returns an error string or null.
 * `t` is passed in (rather than calling useTranslation internally) so this
 * stays a plain, testable function usable both from the useMeasurements hook
 * below and directly from app/measurements-edit.tsx.
 */
export function validateMeasurements(parsed: BodyMeasurements, t: TFunction): string | null {
  const { body_height, body_weight, body_bust, body_waist, body_hip } = parsed;
  if (body_height !== undefined) {
    if (body_height < 50 || body_height > 250) return t('measurements_errHeightRange');
  }
  if (body_weight !== undefined) {
    if (body_weight < 20 || body_weight > 300) return t('measurements_errWeightRange');
  }
  if (body_bust !== undefined && (body_bust < 30 || body_bust > 200)) return t('measurements_errChestRange');
  if (body_waist !== undefined && (body_waist < 30 || body_waist > 200)) return t('measurements_errWaistRange');
  if (body_hip !== undefined && (body_hip < 30 || body_hip > 200)) return t('measurements_errHipRange');
  return null;
}

export function useMeasurements() {
  const { t } = useTranslation();
  const measurements = useAuthStore((s) => s.measurements);
  const saveMeasurements = useAuthStore((s) => s.saveMeasurements);

  const initialValues: Record<NumericKey, string> = {
    body_height: measurements?.body_height != null ? String(measurements.body_height) : '',
    body_weight: measurements?.body_weight != null ? String(measurements.body_weight) : '',
    body_bust:   measurements?.body_bust   != null ? String(measurements.body_bust)   : '',
    body_shoulder_width:    measurements?.body_shoulder_width    != null ? String(measurements.body_shoulder_width)    : '',
    body_sleeve_length:     measurements?.body_sleeve_length     != null ? String(measurements.body_sleeve_length)     : '',
    body_upper_body_length: measurements?.body_upper_body_length != null ? String(measurements.body_upper_body_length) : '',
    body_upper_arm:         measurements?.body_upper_arm         != null ? String(measurements.body_upper_arm)         : '',
    body_neck:              measurements?.body_neck              != null ? String(measurements.body_neck)              : '',
    body_waist:             measurements?.body_waist             != null ? String(measurements.body_waist)             : '',
    body_hip:               measurements?.body_hip               != null ? String(measurements.body_hip)               : '',
    body_inseam:            measurements?.body_inseam            != null ? String(measurements.body_inseam)            : '',
    body_thigh:             measurements?.body_thigh             != null ? String(measurements.body_thigh)             : '',
    body_rise:              measurements?.body_rise              != null ? String(measurements.body_rise)              : '',
    body_foot_length:       measurements?.body_foot_length       != null ? String(measurements.body_foot_length)       : '',
    body_foot_width:        measurements?.body_foot_width        != null ? String(measurements.body_foot_width)        : '',
  };

  const [values, setValues] = useState<Record<NumericKey, string>>(initialValues);
  const [consentGiven, setConsentGiven] = useState(measurements?.measurementsConsent ?? false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Provenance of the currently-held VALUE SET, not per-field: true only while
  // every numeric field still holds exactly what the last pose scan produced.
  // Starts from whatever was already saved (so an untouched re-visit doesn't
  // lie about a previous scan); applyEstimate() below sets it true, and any
  // hand-edit via setField() clears it — once the user touches even one
  // field, the saved set can no longer be truthfully labelled "from the scan".
  const [poseEstimated, setPoseEstimated] = useState(measurements?.poseEstimated ?? false);
  // A saved shape counts as a manual override ONLY if it matches NEITHER the
  // current classifier NOR the legacy (pre-2026-08-03) classifier's output for
  // the saved measurements — otherwise it's just current or old-classifier
  // output (never a real user choice), so treat it as AUTO and keep editing
  // bust/waist/hip re-deriving the shape instead of pinning a stale value
  // forever.
  const [bodyShapeOverride, setBodyShapeOverride] = useState<BodyShape | null>(() => {
    const saved = measurements?.bodyShape ?? null;
    if (!saved) return null;
    const current = computeBodyShape(measurements ?? {});
    const legacy = computeBodyShapeLegacy(measurements ?? {});
    return saved === current || saved === legacy ? null : saved;
  });

  const setField = useCallback((key: NumericKey, val: string) => {
    setValues(prev => ({ ...prev, [key]: val }));
    // A manual edit — even to a field the scan never touched — means the
    // value set as a whole is no longer purely scan-derived.
    setPoseEstimated(false);
  }, []);

  // Applies a full pose-scan estimate in one shot (as opposed to setField's
  // one-manual-edit-at-a-time), and marks the value set as scan-derived.
  // Callers should use this instead of looping setField() for each estimated
  // field, or the loop's own setField calls would immediately clear the flag
  // they're trying to set.
  const applyEstimate = useCallback((estimate: Partial<Record<NumericKey, number>>) => {
    setValues(prev => {
      const next = { ...prev };
      for (const [k, v] of Object.entries(estimate)) {
        if (v != null) next[k as NumericKey] = String(v);
      }
      return next;
    });
    setPoseEstimated(true);
  }, []);

  const parsedMeasurements = useMemo((): BodyMeasurements => {
    const m: BodyMeasurements = {};
    for (const [k, v] of Object.entries(values)) {
      const n = parseNum(v);
      if (n != null) (m as Record<string, number>)[k] = n;
    }
    return m;
  }, [values]);

  const bodyShape = useMemo(
    () => bodyShapeOverride ?? stabilizeBodyShape(measurements?.bodyShape ?? null, parsedMeasurements),
    [bodyShapeOverride, parsedMeasurements, measurements?.bodyShape],
  );

  const isDirty = JSON.stringify(values) !== JSON.stringify(initialValues) || consentGiven !== (measurements?.measurementsConsent ?? false);

  // `overrides` lets a caller substitute already-unit-converted values (e.g.
  // height/weight converted from IN/LB to cm/kg) without waiting for a
  // setField() state update to land first — parsedMeasurements is derived from
  // `values`, which is async, so merging overrides here avoids a stale-read race.
  const save = useCallback(async (overrides?: Partial<Record<NumericKey, number>>): Promise<{ ok: boolean; message?: string }> => {
    if (saving) return { ok: false };
    const toSave: BodyMeasurements = overrides ? { ...parsedMeasurements, ...overrides } : parsedMeasurements;
    const validationError = validateMeasurements(toSave, t);
    if (validationError) {
      setError(validationError);
      return { ok: false, message: validationError };
    }
    setSaving(true);
    setError(null);
    try {
      await saveMeasurements({
        ...toSave,
        // `bodyShape` is `BodyShape | null` here — pass it through as-is.
        // `null` (bust/waist/hip no longer sufficient to derive a shape, and
        // no manual override) must reach the DB as an explicit clear; collapsing
        // it to `undefined` would make the upsert skip the column entirely and
        // leave a stale, now-inconsistent shape behind (see bodyToRow()).
        bodyShape,
        measurementsConsent: consentGiven,
        poseEstimated,
      });
      return { ok: true };
    } catch {
      const msg = t('measurements_errSaveFailed');
      setError(msg);
      return { ok: false, message: msg };
    } finally {
      setSaving(false);
    }
  }, [saving, parsedMeasurements, bodyShape, consentGiven, poseEstimated, saveMeasurements, t]);

  return {
    values,
    setField,
    applyEstimate,
    bodyShape,
    bodyShapeOverride,
    setBodyShapeOverride,
    consentGiven,
    setConsentGiven,
    poseEstimated,
    isDirty,
    saving,
    error,
    save,
  };
}
