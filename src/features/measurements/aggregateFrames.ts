/**
 * Multi-frame aggregation — VARIANCE REDUCTION ONLY, no bias shift.
 *
 * The scan screen polls MoveNet ~every 1.2 s and used to keep only the single
 * most-recent good-pose frame. A single frame carries whatever detector jitter,
 * micro-sway, or momentary mis-detection happened to land on that tick. Taking
 * the MEDIAN of several independent good-pose frames cancels that per-frame
 * noise without moving the expected value — the median of samples drawn from
 * around the true pose still centers on the true pose, it just narrows the
 * spread. This is the reason median (not mean) is used throughout: a single
 * wild outlier frame (e.g. one bad detection) cannot drag a median anywhere
 * near as far as it can drag a mean.
 *
 * Pure module — no native/Expo imports — so it is fully jest-testable without
 * a device or the TF Lite runtime.
 */

import type { Keypoint } from './poseEstimate';
import type { SilhouetteWidths } from './silhouetteMath';

/** Default minimum keypoint confidence to trust a frame's sample for a landmark. */
const DEFAULT_MIN_SCORE = 0.3;

/** Standard median: sorted middle value, or the mean of the two middle values. */
function median(vals: number[]): number {
  const s = [...vals].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 !== 0 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/**
 * Median-aggregate several full 17-keypoint frames into one.
 *
 * For each named keypoint, samples are taken from the frames where that
 * landmark's score clears `minScore` (the frames the detector itself trusted
 * for that joint); x, y, and score are each medianed independently per axis.
 * If FEWER THAN ONE frame clears the threshold for a given keypoint (i.e. the
 * detector never trusted it), fall back to the median over ALL frames for
 * that keypoint rather than dropping it — a low-confidence median is still
 * better signal than no landmark at all, and the caller's own confidence
 * gate (`EstimatedMeasurements.confidence`) already reflects that low score.
 */
export function medianKeypoints(frames: Keypoint[][], minScore = DEFAULT_MIN_SCORE): Keypoint[] {
  if (frames.length === 0) return [];
  // All frames come from the same estimator call (poseEstimate.ts) and share
  // identical ordering/names — use the first frame's name list as the index.
  const names = frames[0].map((k) => k.name);

  return names.map((name, i) => {
    // Match by name (not index) in case a caller ever passes reordered arrays;
    // fall back to positional lookup only if a name lookup somehow misses.
    const samples = frames
      .map((f) => f.find((k) => k.name === name) ?? f[i])
      .filter((k): k is Keypoint => !!k);

    const confident = samples.filter((k) => k.score >= minScore);
    const source = confident.length >= 1 ? confident : samples;

    return {
      name,
      x: median(source.map((k) => k.x)),
      y: median(source.map((k) => k.y)),
      score: median(source.map((k) => k.score)),
    };
  });
}

const WIDTH_FIELDS: (keyof SilhouetteWidths)[] = ['shoulderU', 'chestU', 'waistU', 'hipU'];

/**
 * Median-aggregate several per-frame silhouette width readings, field by
 * field. A field absent (null/undefined) from every reading is omitted
 * entirely rather than defaulted — same "leave it blank, don't guess"
 * contract as the rest of the measurement pipeline.
 */
export function medianWidths(widths: (SilhouetteWidths | null)[]): SilhouetteWidths {
  const result: SilhouetteWidths = {};
  for (const field of WIDTH_FIELDS) {
    const vals = widths
      .filter((w): w is SilhouetteWidths => w != null)
      .map((w) => w[field])
      .filter((v): v is number => v != null);
    if (vals.length > 0) result[field] = median(vals);
  }
  return result;
}

/** nose→avg-ankle vertical span for one frame, or null if either is missing. */
function noseAnkleSpan(frame: Keypoint[]): number | null {
  const nose = frame.find((k) => k.name === 'nose');
  const lAnkle = frame.find((k) => k.name === 'leftAnkle');
  const rAnkle = frame.find((k) => k.name === 'rightAnkle');
  if (!nose || !lAnkle || !rAnkle) return null;
  return Math.abs(((lAnkle.y + rAnkle.y) / 2) - nose.y);
}

/**
 * Coefficient of variation (stddev / mean) of the nose→avg-ankle vertical
 * span across frames — a genuine MEASUREMENT-STABILITY signal.
 *
 * This is deliberately distinct from the existing per-frame `confidence`
 * (the min keypoint score): confidence only says the detector was sure it
 * found a joint, it says nothing about whether repeated frames agree on the
 * SAME scale. Two frames can each report high-confidence keypoints yet
 * disagree wildly on the person's apparent height in-frame (sway, a
 * half-step, a momentary crouch) — that disagreement is exactly what
 * inflates the downstream cm-per-unit scale error. Low CV across frames is
 * the honest signal that the scale reference (and therefore every derived
 * cm value) is trustworthy; low CV is not implied by high per-frame scores.
 *
 * Returns 0 when fewer than 2 frames have a usable span (nothing to compare).
 */
export function scaleAgreement(frames: Keypoint[][]): number {
  const spans = frames.map(noseAnkleSpan).filter((s): s is number => s != null);
  if (spans.length < 2) return 0;
  const mean = spans.reduce((s, v) => s + v, 0) / spans.length;
  if (mean === 0) return 0;
  const variance = spans.reduce((s, v) => s + (v - mean) ** 2, 0) / spans.length;
  return Math.sqrt(variance) / mean;
}

/**
 * Drop frames whose nose→ankle span deviates (relatively) by more than
 * `maxCV` from the MEDIAN span across the buffer — e.g. a foreshortened or
 * mis-detected frame where the apparent standing height is way off from the
 * rest. Always keeps at least the frame closest to the median span (so the
 * pipeline never ends up with an empty frame set), and frames that can't be
 * assessed at all (missing nose/ankle) are treated as unreliable and dropped
 * unless every frame is unassessable, in which case nothing can be judged
 * and the input is returned unchanged.
 *
 * `maxCV = 0.08` is CALIBRATION-PENDING — chosen as a conservative first cut
 * (natural sway between poll ticks 1.2 s apart should stay well under this);
 * tune against on-device capture logs once available.
 */
export function rejectOutlierFrames(frames: Keypoint[][], maxCV = 0.08): Keypoint[][] {
  if (frames.length <= 1) return frames;

  const spans = frames.map(noseAnkleSpan);
  const validSpans = spans.filter((s): s is number => s != null);
  if (validSpans.length === 0) return frames; // nothing assessable — keep all

  const medSpan = median(validSpans);
  if (medSpan === 0) return frames;

  // Frame closest to the median span — always kept, even if every frame were
  // (hypothetically) outside maxCV, so the result is never empty.
  let closestIdx = -1;
  let closestDev = Infinity;
  frames.forEach((_, i) => {
    const s = spans[i];
    if (s == null) return;
    const dev = Math.abs(s - medSpan) / medSpan;
    if (dev < closestDev) { closestDev = dev; closestIdx = i; }
  });

  const kept = frames.filter((_, i) => {
    if (i === closestIdx) return true;
    const s = spans[i];
    if (s == null) return false; // unassessable and not the closest → drop
    return Math.abs(s - medSpan) / medSpan <= maxCV;
  });

  return kept.length > 0 ? kept : [frames[closestIdx]];
}
