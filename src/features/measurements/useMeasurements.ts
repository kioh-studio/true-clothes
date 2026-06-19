import { useState, useCallback, useMemo } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { type BodyMeasurements, type BodyShape, computeBodyShape } from '../../types/measurements';

type NumericKey = keyof Omit<BodyMeasurements, 'bodyShape' | 'poseEstimated' | 'measurementsConsent' | 'preferredFit'>;

function parseNum(s: string): number | undefined {
  const n = parseFloat(s);
  return isNaN(n) ? undefined : n;
}

export function useMeasurements() {
  const { measurements, saveMeasurements } = useAuthStore();

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
  const [bodyShapeOverride, setBodyShapeOverride] = useState<BodyShape | null>(measurements?.bodyShape ?? null);

  const setField = useCallback((key: NumericKey, val: string) => {
    setValues(prev => ({ ...prev, [key]: val }));
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
    () => bodyShapeOverride ?? computeBodyShape(parsedMeasurements),
    [bodyShapeOverride, parsedMeasurements],
  );

  const isDirty = JSON.stringify(values) !== JSON.stringify(initialValues) || consentGiven !== (measurements?.measurementsConsent ?? false);

  const save = useCallback(async () => {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      await saveMeasurements({
        ...parsedMeasurements,
        bodyShape: bodyShape ?? undefined,
        measurementsConsent: consentGiven,
      });
    } catch {
      setError('Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  }, [saving, parsedMeasurements, bodyShape, consentGiven, saveMeasurements]);

  return {
    values,
    setField,
    bodyShape,
    bodyShapeOverride,
    setBodyShapeOverride,
    consentGiven,
    setConsentGiven,
    isDirty,
    saving,
    error,
    save,
  };
}
