// Measurement mapping service (feature 009).
// Calls the `map-measurements` Edge Function and converts the snake_case response
// into the camelCase MeasurementMapResult domain type.
//
// Usage:
//   const result = await mapMeasurements(pastedText, item.type ?? '');

import { sb } from './supabase';
import { MeasurementMapResult, MappedMeasure, MeasureConversion } from '../types/measurementMap';
import { MKey } from '../types/fitEngine';
import i18n from '../i18n';

// ─── Raw snake_case shape from the edge function ──────────────────────────────

interface RawMappedEntry {
  value: number;
  source_label: string;
  conversion: string;
  confidence: number;
}

interface RawMapResponse {
  mapped: Record<string, RawMappedEntry>;
  unmapped: Array<{ label: string; value: string }>;
  multiple_sizes: boolean;
  detected_size: string | null;
}

// ─── Conversion helpers ───────────────────────────────────────────────────────

const VALID_CONVERSIONS = new Set<MeasureConversion>([
  'none', 'inch_to_cm', 'doubled', 'inch_to_cm+doubled',
]);

function toConversion(raw: string): MeasureConversion {
  return VALID_CONVERSIONS.has(raw as MeasureConversion)
    ? (raw as MeasureConversion)
    : 'none';
}

/**
 * Map raw shop measurement text to the app's canonical m_* keys.
 *
 * @param rawText     Free-text measurement block pasted from a shop listing.
 * @param garmentType Garment type string (e.g. 'TEE', 'JEANS', 'SNEAKERS').
 * @returns           Normalised MeasurementMapResult with all values in full-circumference cm.
 * @throws            Error with a user-facing message on network/auth/upstream failure.
 */
export async function mapMeasurements(
  rawText: string,
  garmentType: string,
): Promise<MeasurementMapResult> {
  const { data, error } = await sb.functions.invoke('map-measurements', {
    body: { raw_text: rawText, garment_type: garmentType },
  });

  if (error) {
    throw new Error(i18n.t('measurementAIMap_mappingFailed'));
  }

  const raw = data as RawMapResponse;

  if (!raw || typeof raw !== 'object') {
    throw new Error(i18n.t('measurementAIMap_mappingFailed'));
  }

  // Convert mapped object (keyed by m_key) → ordered array of MappedMeasure.
  const mapped: MappedMeasure[] = Object.entries(raw.mapped ?? {})
    .map(([key, entry]) => ({
      key: key as MKey,
      value: typeof entry.value === 'number' ? entry.value : 0,
      sourceLabel:
        typeof entry.source_label === 'string' ? entry.source_label : key,
      conversion: toConversion(entry.conversion ?? 'none'),
      confidence:
        typeof entry.confidence === 'number'
          ? Math.max(0, Math.min(1, entry.confidence))
          : 0.5,
    }))
    .filter((m) => m.value > 0);

  const unmapped: { label: string; value: string }[] = Array.isArray(raw.unmapped)
    ? raw.unmapped.filter(
        (u) => u && typeof u.label === 'string' && u.label.trim(),
      )
    : [];

  return {
    mapped,
    unmapped,
    multipleSizes: raw.multiple_sizes === true,
    detectedSize:
      typeof raw.detected_size === 'string' && raw.detected_size.trim()
        ? raw.detected_size.trim()
        : null,
  };
}
