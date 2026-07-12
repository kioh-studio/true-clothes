// Shared types for the measurement-mapping feature (009).
// The edge function maps raw shop text → canonical m_* keys; this file
// describes the camelCase domain representation used on the client side.

import { MKey } from './fitEngine';

/** Which unit/convention transformation the model applied to a mapped value. */
export type MeasureConversion = 'none' | 'inch_to_cm' | 'doubled' | 'inch_to_cm+doubled';

/** One successfully mapped measurement field. */
export interface MappedMeasure {
  /** Canonical engine key (e.g. 'm_chest'). */
  key: MKey;
  /** Normalised value in cm (or EU number for m_shoe_size). */
  value: number;
  /** Original label text from the shop (for user-facing display). */
  sourceLabel: string;
  /** Conversion applied by the model (for the note shown in MeasurementAIMap). */
  conversion: MeasureConversion;
  /** Model confidence 0–1 (lower when convention was inferred, e.g. flat-vs-full). */
  confidence: number;
}

/** Full result returned by mapMeasurements() / the map-measurements edge function. */
export interface MeasurementMapResult {
  /** Successfully mapped fields as an ordered array (order matches relevantKeys()). */
  mapped: MappedMeasure[];
  /** Fields the model recognised but could not map to a canonical key. */
  unmapped: { label: string; value: string }[];
  /** True when the input contained an S/M/L table — user must paste a single size. */
  multipleSizes: boolean;
  /** Optional detected size label (e.g. "M", "L", "42") when a single size was parsed. */
  detectedSize: string | null;
}
