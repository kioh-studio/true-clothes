export type BodyShape = 'hourglass' | 'rectangle' | 'triangle' | 'inverted_triangle' | 'apple';

/**
 * Estimated body circumferences returned by the on-device pose scan.
 * These are rough values (±5–10 cm) intended for user-review pre-fill only.
 * Fields absent if the estimate fell outside a sane human range.
 */
export interface EstimatedMeasurements {
  // Circumferences (rough — front-view width + guessed depth)
  body_bust?: number;
  body_waist?: number;
  body_hip?: number;
  // Lengths (more reliable — direct keypoint distance × height scale)
  body_inseam?: number;
  body_shoulder_width?: number;
  body_sleeve_length?: number;
  body_upper_body_length?: number;
  /** Min keypoint confidence score (0–1) of the landmarks used. */
  confidence: number;
  /**
   * Multi-frame scale-agreement coefficient of variation (0 = perfectly
   * stable across frames, higher = frames disagreed on apparent scale).
   * Distinct from `confidence`: this reflects measurement CONSISTENCY across
   * the aggregated frames, not per-frame detector certainty. Optional —
   * absent when only a single frame was available to compare.
   */
  stability?: number;
}

export interface BodyMeasurements {
  // Required
  body_height?: number;
  body_weight?: number;
  // Upper body
  body_bust?: number;
  body_shoulder_width?: number;
  body_sleeve_length?: number;
  body_upper_body_length?: number;
  body_upper_arm?: number;
  body_neck?: number;
  // Lower body
  body_waist?: number;
  body_hip?: number;
  body_inseam?: number;
  body_thigh?: number;
  body_rise?: number;
  // Feet
  body_foot_length?: number;
  body_foot_width?: number;
  // Computed/extra
  bodyShape?: BodyShape;
  poseEstimated?: boolean;
  measurementsConsent?: boolean;
  preferredFit?: 'SLIM' | 'REGULAR' | 'RELAXED' | 'OVERSIZED';
}

export interface MeasurementFieldMeta {
  key: keyof BodyMeasurements;
  labelEn: string;
  labelVi: string;
  unit: 'cm' | 'kg' | 'cm_or_in' | 'kg_or_lb';
  required: boolean;
  tooltipEn: string;
  tooltipVi: string;
  animationKey: string;
}

export const MEASUREMENT_FIELDS: MeasurementFieldMeta[] = [
  { key: 'body_height', labelEn: 'Height', labelVi: 'Chiều cao', unit: 'cm_or_in', required: true, tooltipEn: 'Your full standing height.', tooltipVi: 'Chiều cao khi đứng thẳng.', animationKey: 'height' },
  { key: 'body_weight', labelEn: 'Weight', labelVi: 'Cân nặng', unit: 'kg_or_lb', required: true, tooltipEn: 'Your current body weight.', tooltipVi: 'Cân nặng hiện tại.', animationKey: 'weight' },
  { key: 'body_bust', labelEn: 'Bust / Chest', labelVi: 'Vòng ngực', unit: 'cm', required: false, tooltipEn: 'Measure around the fullest part of your chest.', tooltipVi: 'Đo vòng quanh phần đầy nhất của ngực.', animationKey: 'bust' },
  { key: 'body_shoulder_width', labelEn: 'Shoulder width', labelVi: 'Vai', unit: 'cm', required: false, tooltipEn: 'Measure from shoulder point to shoulder point across the back.', tooltipVi: 'Đo từ điểm vai này sang điểm vai kia qua lưng.', animationKey: 'shoulder' },
  { key: 'body_sleeve_length', labelEn: 'Sleeve length', labelVi: 'Tay áo', unit: 'cm', required: false, tooltipEn: 'From shoulder point to wrist bone.', tooltipVi: 'Từ điểm vai đến xương cổ tay.', animationKey: 'sleeve' },
  { key: 'body_upper_body_length', labelEn: 'Torso length', labelVi: 'Thân trên', unit: 'cm', required: false, tooltipEn: 'From the base of neck to natural waist.', tooltipVi: 'Từ chân cổ đến eo tự nhiên.', animationKey: 'torso' },
  { key: 'body_upper_arm', labelEn: 'Upper arm', labelVi: 'Bắp tay', unit: 'cm', required: false, tooltipEn: 'Around the fullest part of your upper arm.', tooltipVi: 'Quanh phần đầy nhất của bắp tay.', animationKey: 'upper_arm' },
  { key: 'body_neck', labelEn: 'Neck', labelVi: 'Cổ', unit: 'cm', required: false, tooltipEn: 'Around the base of your neck.', tooltipVi: 'Quanh chân cổ.', animationKey: 'neck' },
  { key: 'body_waist', labelEn: 'Waist', labelVi: 'Vòng eo', unit: 'cm', required: false, tooltipEn: 'Around your natural waist — narrowest point.', tooltipVi: 'Quanh eo tự nhiên — điểm hẹp nhất.', animationKey: 'waist' },
  { key: 'body_hip', labelEn: 'Hips', labelVi: 'Vòng hông', unit: 'cm', required: false, tooltipEn: 'Around the fullest part of your hips and seat.', tooltipVi: 'Quanh phần đầy nhất của hông.', animationKey: 'hip' },
  { key: 'body_inseam', labelEn: 'Inseam', labelVi: 'Đũng quần', unit: 'cm', required: false, tooltipEn: 'Inner leg from crotch to floor.', tooltipVi: 'Từ háng đến sàn.', animationKey: 'inseam' },
  { key: 'body_thigh', labelEn: 'Thigh', labelVi: 'Đùi', unit: 'cm', required: false, tooltipEn: 'Around the fullest part of your thigh.', tooltipVi: 'Quanh phần đầy nhất của đùi.', animationKey: 'thigh' },
  { key: 'body_rise', labelEn: 'Rise', labelVi: 'Cạp', unit: 'cm', required: false, tooltipEn: 'From waistband to crotch seam.', tooltipVi: 'Từ cạp quần đến đường chỉ giữa.', animationKey: 'rise' },
  { key: 'body_foot_length', labelEn: 'Foot length', labelVi: 'Chiều dài bàn chân', unit: 'cm', required: false, tooltipEn: 'From heel to longest toe.', tooltipVi: 'Từ gót đến ngón dài nhất.', animationKey: 'foot_length' },
  { key: 'body_foot_width', labelEn: 'Foot width', labelVi: 'Chiều rộng bàn chân', unit: 'cm', required: false, tooltipEn: 'At the widest part of the foot.', tooltipVi: 'Tại phần rộng nhất của bàn chân.', animationKey: 'foot_width' },
];

/** Rule-based body shape classifier per Decision 3 (research.md).
 *  Requires bust (B), waist (W), hip (H). Returns null if any required
 *  measurement is missing. */
export function computeBodyShape(m: BodyMeasurements): BodyShape | null {
  const B = m.body_bust;
  const W = m.body_waist;
  const H = m.body_hip;
  if (!B || !W || !H) return null;

  if (W >= B * 0.85 && W >= H * 0.85) return 'apple';
  if (B > H + 5) return 'inverted_triangle';
  if (H > B + 5) return 'triangle';
  if (Math.abs(B - H) <= 5 && W <= B * 0.75) return 'hourglass';
  return 'rectangle';
}
