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
  // `null` is a deliberate, explicit "clear the stored shape" signal (the
  // measurements needed to derive it are no longer on file) — distinct from
  // `undefined`, which means "leave whatever is already saved untouched".
  // See measurementService.bodyToRow(): only `undefined` is skipped on write.
  bodyShape?: BodyShape | null;
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

// FFIT/Simmons-style absolute-centimetre thresholds (2026-08-03 rewrite — see
// plan.md changelog "Body-shape classifier rewrite" for the full rationale
// and scripts/sim/body-shape-sim.ts for the verification harness).

/** Bust-vs-hip dominance threshold (cm), INCLUSIVE. This is the boundary fix:
 *  the old rule required a STRICT `H > B + 5`, so a body exactly 5cm apart
 *  silently fell through to a straight-column read instead of triangle/
 *  inverted_triangle, while every other threshold in the old rule was already
 *  inclusive. Common convention ("hip >=5cm bigger = pear") is inclusive. */
const BUST_HIP_DOMINANCE = 5;
/** ~FFIT's 9in (≈23cm) bust-to-waist drop that reads as a "defined" waist. */
const WAIST_DEFINED_BUST = 23;
/** ~FFIT's 10in (≈25cm) hip-to-waist drop that reads as a "defined" waist. */
const WAIST_DEFINED_HIP = 25;
/** Below this drop on BOTH the bust side and the hip side, the waist reads as
 *  undefined (no natural indentation either way) → apple. */
const WAIST_UNDEFINED = 9;

/** Rule-based body shape classifier per Decision 3 (research.md), rewritten
 *  2026-08-03 to FFIT/Simmons-style absolute-cm bust/waist/hip differences
 *  (the prior ratio-based rules checked `apple` FIRST with no bust-vs-hip
 *  comparison, so a straight-column body with a merely thick waist collapsed
 *  to `apple` ~38.6% of the time — see scripts/sim/body-shape-sim.ts Section B).
 *  Requires bust (B), waist (W), hip (H). Returns null if any required
 *  measurement is missing. */
export function computeBodyShape(m: BodyMeasurements): BodyShape | null {
  const B = m.body_bust;
  const W = m.body_waist;
  const H = m.body_hip;
  if (!B || !W || !H) return null;

  const bustHip = B - H;
  const bustWaist = B - W;
  const hipWaist = H - W;

  // 1. A clearly dominant top or bottom half decides the shape, even if the
  //    waist is thick — bust/hip asymmetry is the stronger visual signal.
  if (bustHip >= BUST_HIP_DOMINANCE) return 'inverted_triangle';
  if (bustHip <= -BUST_HIP_DOMINANCE) return 'triangle';

  // 2. Column-ish torso (|bustHip| < 5) → the waist decides.
  //    The `|| W <= 0.75 * B` branch is DELIBERATE and must be kept: absolute-
  //    cm drops under-serve petite frames (a petite hourglass may show a
  //    smaller absolute drop despite a proportionally very defined waist), so
  //    this preserves the old ratio-based hourglass behaviour for them.
  if (bustWaist >= WAIST_DEFINED_BUST || hipWaist >= WAIST_DEFINED_HIP || W <= 0.75 * B) return 'hourglass';
  if (bustWaist < WAIST_UNDEFINED && hipWaist < WAIST_UNDEFINED) return 'apple';
  return 'rectangle';
}

/** The pre-2026-08-03 ratio-based classifier. Kept ONLY to recognise
 *  body_shape values that were persisted by the old rules, so they can be
 *  distinguished from a genuine manual user override. Do not use for new
 *  classification. */
export function computeBodyShapeLegacy(m: BodyMeasurements): BodyShape | null {
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

/** Noise-resistant shape derivation. Returns `prev` when the newly derived
 *  shape is not robust — i.e. some perturbation within ±marginCm of the
 *  entered girths still derives `prev`. Only meant for AUTO-derived shapes; a
 *  manual user override must bypass this entirely (see useMeasurements.ts).
 *  Addresses the classifier-sensitivity finding in backlog.md: the hourglass
 *  archetype could flip label with only +2cm of waist change — inside normal
 *  measurement noise (manual entry or pose-scan estimate). */
export function stabilizeBodyShape(
  prev: BodyShape | null,
  m: BodyMeasurements,
  marginCm = 2,
): BodyShape | null {
  const next = computeBodyShape(m);
  if (prev == null || next == null || next === prev) return next;

  const { body_bust: B, body_waist: W, body_hip: H } = m;
  // computeBodyShape returning non-null above guarantees B/W/H are all set;
  // this guard just keeps the compiler happy without a non-null assertion.
  if (B == null || W == null || H == null) return next;

  const probes: BodyMeasurements[] = [];
  for (const d of [-marginCm, marginCm]) {
    probes.push({ body_bust: B + d, body_waist: W, body_hip: H });
    probes.push({ body_bust: B, body_waist: W + d, body_hip: H });
    probes.push({ body_bust: B, body_waist: W, body_hip: H + d });
  }
  // If ANY probe within the noise margin still re-derives `prev`, the change
  // isn't decisive yet — hold the previous shape rather than flicker.
  for (const probe of probes) {
    if (computeBodyShape(probe) === prev) return prev;
  }
  return next;
}
