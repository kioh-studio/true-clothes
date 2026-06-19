// Type-aware measurement groups for the review card (feature 006).
// Maps a garment type → which engine m_* columns to show + their labels.

import { MKey } from '../../types/fitEngine';

export type MeasureGroup = 'top' | 'bottom' | 'shoe' | 'other';

const BOTTOM_TYPES = new Set(['JEANS', 'TROUSERS', 'CHINOS', 'SHORTS', 'SKIRT']);
const SHOE_TYPES = new Set(['LOAFERS', 'SNEAKERS', 'BOOTS', 'HEELS', 'SANDALS', 'OXFORDS', 'MULES']);
// Accessories carry no useful body measurements.
const NO_MEASURE_TYPES = new Set([
  'BAG', 'BELT', 'SCARF', 'WATCH', 'CAP', 'NECKLACE', 'SUNGLASSES', 'HAT', 'RING', 'BRACELET',
]);

export function measureGroupForType(type: string): MeasureGroup {
  const t = (type ?? '').toUpperCase();
  if (BOTTOM_TYPES.has(t)) return 'bottom';
  if (SHOE_TYPES.has(t)) return 'shoe';
  if (NO_MEASURE_TYPES.has(t)) return 'other';
  return 'top'; // tops, outerwear, one-piece
}

// [engine column, display label] shown per group, in order.
export const MEASURE_FIELDS: Record<MeasureGroup, Array<{ key: MKey; label: string }>> = {
  top: [
    { key: 'm_chest', label: 'Chest' },
    { key: 'm_shoulder_width', label: 'Shoulder' },
    { key: 'm_body_length', label: 'Length' },
    { key: 'm_sleeves', label: 'Sleeve' },
  ],
  bottom: [
    { key: 'm_waist', label: 'Waist' },
    { key: 'm_hip', label: 'Hip' },
    { key: 'm_inseam', label: 'Inseam' },
    { key: 'm_thigh', label: 'Thigh' },
  ],
  shoe: [
    { key: 'm_shoe_size', label: 'EU Size' },
  ],
  other: [],
};

// Type-aware default measurement estimates (cm; EU number for shoes), editable.
// Used by the on-device "Extract by item" method (007) and as 006-consistent fallbacks.
// Returns {} for accessories / blank type.
const GROUP_DEFAULTS: Record<MeasureGroup, Partial<Record<MKey, number>>> = {
  top: { m_chest: 54, m_shoulder_width: 46, m_body_length: 70, m_sleeves: 62 },
  bottom: { m_waist: 82, m_hip: 102, m_inseam: 78, m_thigh: 58 },
  shoe: { m_shoe_size: 42 },
  other: {},
};

export function measureDefaults(type: string): Partial<Record<MKey, number>> {
  if (!type) return {};
  return { ...GROUP_DEFAULTS[measureGroupForType(type)] };
}
