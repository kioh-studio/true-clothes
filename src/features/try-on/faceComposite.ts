// Face compositing — pastes the user's REAL face (from their try-on source
// photo) onto the AI-generated (edit-in-place) image, so identity is
// guaranteed regardless of how faithfully the generative model rendered it.
//
// Pipeline:
//   1. detectFace (BlazeFace, on-device) on both the source photo and the
//      generated image → 4 landmarks each (eyes, nose, mouth).
//   2. estimateSimilarity (faceCompositeMath) fits a scale+rotation+
//      translation mapping source→generated face space. isAlignmentPlausible
//      gates out bad mismatches (wrong face size/angle) — the composite is
//      skipped rather than pasting a warped face.
//   3. A feathered ellipse mask is built around the GENERATED face — sized
//      by faceMaskRadii() (faceCompositeMath.ts), which reaches toward the
//      jaw/hairline/ears when a trustworthy ear span is available (2026-08-07:
//      widened from the old fixed eyes/nose/mouth/cheeks-only mask, now that
//      edit-in-place keeps source→generated alignment close to identity).
//   4. Per-channel color statistics are taken over both faces' core pixels so
//      the pasted source face is tone-matched to the generated lighting
//      (colorTransfer) rather than looking pasted-on.
//   5. Every masked generated pixel is replaced by inverse-mapping to the
//      source photo (bilinear sample), color-matching, and alpha-blending
//      with the original generated pixel.
//   6. Re-encoded to JPEG and written to a cache file; that uri is returned.
//
// DEGRADES TO NULL (uri) ON ANY FAILURE (no face detected, implausible
// alignment, decode/encode error, etc.) — the caller falls back to the raw
// generated image, which is the pre-existing behaviour. This never throws.
// The specific failure cause is reported via CompositeOutcome.reason (see
// below) — previously all ~6 distinct causes collapsed into a single `null`,
// so nobody could tell WHY the composite fell back, or whether it had ever
// once succeeded on-device.
//
// CALIBRATION-PENDING: the mask ellipse size/feather, alignment plausibility
// thresholds, and BlazeFace input normalisation all need on-device tuning
// (see faceDetect.ts / faceCompositeMath.ts comments and backlog.md).

import * as FileSystem from 'expo-file-system/legacy';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import jpeg from 'jpeg-js';
import { detectFace, type Pt } from './faceDetect';
import {
  estimateSimilarity, invertSim, applySim, isAlignmentPlausible,
  ellipseAlpha, channelStats, colorTransfer, bilinearSample, faceMaskRadii,
} from './faceCompositeMath';

// Specific cause of a compositeFace() outcome. 'ok' = pasted successfully;
// every other value is a distinct reason the caller fell back to the raw
// generated image (see CompositeOutcome below).
export type CompositeReason =
  | 'ok'
  | 'no_face_source'          // detectFace found nothing in the SOURCE photo
  | 'no_face_generated'       // source face was found, but not in the GENERATED image
  | 'decode_failed'           // pixel decode of either image failed
  | 'implausible_alignment'   // source→generated similarity fit was rejected
  | 'degenerate_mask'         // mask geometry collapsed (zero-size / no core pixels)
  | 'encode_failed'           // JPEG re-encode or file write failed
  | 'error';                  // anything else (unexpected throw)

export interface CompositeOutcome {
  /** Local file uri of the composited image, or null when compositing wasn't
   *  possible/safe — the caller should use the raw generated image instead. */
  uri: string | null;
  reason: CompositeReason;
}

// Working resolution both images are downscaled to before pixel manipulation
// (perf: full-res generated images can be several MP; the face region is a
// small fraction of the frame, so this is plenty of detail for the paste).
// Raised 1024 -> 1600 (2026-08-07, edit-in-place face-composite hardening):
// the face region is what actually gets pasted, and at 1024 that region was
// only a few dozen pixels wide — nowhere near enough detail once the mask
// was widened (see faceCompositeMath.faceMaskRadii) to include jaw/hairline/
// ears. Costs more RGBA memory (1600x1600x4 vs 1024x1024x4 — roughly 2.4x
// the decoded-buffer size per image) but this runs once per generation, not
// in a hot loop.
const WORK_MAX = 1600;
const JPEG_QUALITY = 92; // jpeg-js scale is 0..100, not 0..1

interface DecodedImage { width: number; height: number; data: Uint8Array }

function decodeJpegBase64(base64: string): DecodedImage {
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return jpeg.decode(bytes, { useTArray: true }) as DecodedImage;
}

/** Downscale (long side → maxSize) and decode to RGBA. */
async function decodeDownscaled(uri: string, maxSize: number): Promise<DecodedImage | null> {
  const probe = await manipulateAsync(uri, []);
  const scale = Math.min(1, maxSize / Math.max(probe.width, probe.height));
  const tW = Math.max(1, Math.round(probe.width * scale));
  const tH = Math.max(1, Math.round(probe.height * scale));
  const resized = await manipulateAsync(
    uri,
    [{ resize: { width: tW, height: tH } }],
    { base64: true, format: SaveFormat.JPEG, compress: 0.95 },
  );
  if (!resized.base64) return null;
  return decodeJpegBase64(resized.base64);
}

// jpeg-js's encoder calls the Node `Buffer.from(...)` API internally even
// though RN/Hermes has no Buffer global. We only need an indexable byte
// container back (we base64-encode it ourselves below), so a minimal shim is
// enough here — this avoids pulling in a full "buffer" polyfill package just
// for this one call site.
function ensureBufferShim(): void {
  const g = globalThis as unknown as { Buffer?: unknown };
  if (typeof g.Buffer === 'undefined') {
    g.Buffer = { from: (arr: ArrayLike<number>) => Uint8Array.from(arr) };
  }
}

/** Base64-encode a byte array without ever materialising one giant JS string arg. */
function bytesToBase64(bytes: Uint8Array): string {
  const CHUNK = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += CHUNK) {
    const chunk = bytes.subarray(i, i + CHUNK);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

function encodeJpegToBase64(img: DecodedImage, quality: number): string {
  ensureBufferShim();
  const encoded = jpeg.encode({ data: img.data, width: img.width, height: img.height }, quality);
  const bytes = encoded.data instanceof Uint8Array ? encoded.data : Uint8Array.from(encoded.data as ArrayLike<number>);
  return bytesToBase64(bytes);
}

// Mask radii are now computed per-composite by faceMaskRadii() (ear-span
// aware — see faceCompositeMath.ts), not fixed factors. Feather raised
// 0.25 -> 0.30 (2026-08-07): the mask itself got wider (now reaches toward
// jaw/hairline/ears instead of stopping at eyes/nose/mouth/cheeks), so the
// seam needs a softer, wider ramp to stay convincing.
const MASK_FEATHER = 0.30;
// Only pixels this deep inside the mask contribute to the color-match stats
// (avoids the feathered edge, where the sample is a blend region, skewing
// the mean/std used to compute the transfer).
const STATS_ALPHA_THRESHOLD = 0.6;

/**
 * Paste the user's real face (from `sourceUri`) onto the AI-generated image
 * (`generatedUri`), tone-matched and feather-blended. Returns a
 * CompositeOutcome: `uri` is the composited image's local file uri, or null
 * if compositing wasn't possible/safe (no face detected in either image,
 * implausible alignment, or any error) — the caller should use
 * `generatedUri` as-is in that case. `reason` reports which of the ~6
 * distinct failure causes applied (or 'ok'), for diagnostics. Never throws.
 */
export async function compositeFace(sourceUri: string, generatedUri: string): Promise<CompositeOutcome> {
  try {
    const [srcLandmarks, genLandmarks] = await Promise.all([
      detectFace(sourceUri),
      detectFace(generatedUri),
    ]);
    // Distinguish which image's detection missed — a source-photo miss
    // (bad angle/lighting on the user's own upload) is a very different
    // signal from a generated-image miss (the model rendered something
    // face-detector-unfriendly).
    if (!srcLandmarks) return { uri: null, reason: 'no_face_source' };
    if (!genLandmarks) return { uri: null, reason: 'no_face_generated' };

    const [srcImg, genImg] = await Promise.all([
      decodeDownscaled(sourceUri, WORK_MAX),
      decodeDownscaled(generatedUri, WORK_MAX),
    ]);
    if (!srcImg || !genImg) return { uri: null, reason: 'decode_failed' };

    const toPx = (p: Pt, w: number, h: number): Pt => ({ x: p.x * w, y: p.y * h });
    const srcPts: Pt[] = [srcLandmarks.rightEye, srcLandmarks.leftEye, srcLandmarks.nose, srcLandmarks.mouth]
      .map((p) => toPx(p, srcImg.width, srcImg.height));
    const genPts: Pt[] = [genLandmarks.rightEye, genLandmarks.leftEye, genLandmarks.nose, genLandmarks.mouth]
      .map((p) => toPx(p, genImg.width, genImg.height));

    // Source → generated face-space mapping, and its inverse (generated →
    // source) for the per-pixel paste below.
    const sim = estimateSimilarity(srcPts, genPts);
    if (!isAlignmentPlausible(sim)) return { uri: null, reason: 'implausible_alignment' };
    const inv = invertSim(sim);

    // Mask centred on the GENERATED face (where we're painting). Radii now
    // come from faceMaskRadii(), which widens toward the jaw/hairline when a
    // trustworthy ear span is available (edit-in-place makes the source→
    // generated alignment close to identity, so a wider mask is safe — see
    // faceCompositeMath.ts).
    const cx = genPts.reduce((s, p) => s + p.x, 0) / genPts.length;
    const cy = genPts.reduce((s, p) => s + p.y, 0) / genPts.length;
    const interEye = Math.hypot(genPts[0].x - genPts[1].x, genPts[0].y - genPts[1].y);

    const genRightEarPx = toPx(genLandmarks.rightEar, genImg.width, genImg.height);
    const genLeftEarPx = toPx(genLandmarks.leftEar, genImg.width, genImg.height);
    const rawEarSpan = Math.hypot(genRightEarPx.x - genLeftEarPx.x, genRightEarPx.y - genLeftEarPx.y);
    // Guard against a nonsense ear span (bad detection): non-finite, zero,
    // or wildly out of proportion to inter-eye distance (< interEye or
    // > interEye * 6 — a real ear span is always wider than the eyes but
    // not by an absurd multiple).
    const earSpanPx = isFinite(rawEarSpan) && rawEarSpan > 0
      && isFinite(interEye) && interEye > 0
      && rawEarSpan >= interEye && rawEarSpan <= interEye * 6
      ? rawEarSpan
      : null;

    const { rx, ry } = faceMaskRadii(interEye, earSpanPx);
    if (rx <= 0 || ry <= 0) return { uri: null, reason: 'degenerate_mask' };

    const bx0 = Math.max(0, Math.floor(cx - rx));
    const bx1 = Math.min(genImg.width - 1, Math.ceil(cx + rx));
    const by0 = Math.max(0, Math.floor(cy - ry));
    const by1 = Math.min(genImg.height - 1, Math.ceil(cy + ry));
    if (bx1 <= bx0 || by1 <= by0) return { uri: null, reason: 'degenerate_mask' };

    // ── Pass 1: per-channel color stats over the mask's "core" (feather
    //    excluded) — both the generated face (the target tone) and the
    //    corresponding source-face pixels (inverse-mapped).
    const srcSamples: number[][] = [[], [], []];
    const genSamples: number[][] = [[], [], []];
    for (let y = by0; y <= by1; y++) {
      for (let x = bx0; x <= bx1; x++) {
        const alpha = ellipseAlpha(x, y, cx, cy, rx, ry, MASK_FEATHER);
        if (alpha < STATS_ALPHA_THRESHOLD) continue;
        const gIdx = (y * genImg.width + x) * 4;
        const sp = applySim({ x, y }, inv);
        for (let c = 0; c < 3; c++) {
          genSamples[c].push(genImg.data[gIdx + c]);
          srcSamples[c].push(bilinearSample(srcImg.data, srcImg.width, srcImg.height, sp.x, sp.y, c as 0 | 1 | 2));
        }
      }
    }
    if (genSamples[0].length === 0) return { uri: null, reason: 'degenerate_mask' }; // near-zero mask core

    const genStats = [0, 1, 2].map((c) => channelStats(genSamples[c]));
    const srcStats = [0, 1, 2].map((c) => channelStats(srcSamples[c]));

    // ── Pass 2: paste. Mutate the generated RGBA buffer in place.
    const out = genImg.data;
    for (let y = by0; y <= by1; y++) {
      for (let x = bx0; x <= bx1; x++) {
        const alpha = ellipseAlpha(x, y, cx, cy, rx, ry, MASK_FEATHER);
        if (alpha <= 0) continue;
        const sp = applySim({ x, y }, inv);
        const gIdx = (y * genImg.width + x) * 4;
        for (let c = 0; c < 3; c++) {
          const srcV = bilinearSample(srcImg.data, srcImg.width, srcImg.height, sp.x, sp.y, c as 0 | 1 | 2);
          const matched = colorTransfer(srcV, srcStats[c].mean, srcStats[c].std, genStats[c].mean, genStats[c].std);
          out[gIdx + c] = Math.round(alpha * matched + (1 - alpha) * out[gIdx + c]);
        }
      }
    }

    try {
      const base64 = encodeJpegToBase64(genImg, JPEG_QUALITY);
      const dir = `${FileSystem.cacheDirectory}try-on/`;
      await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
      const dest = `${dir}composite_${Date.now()}.jpg`;
      await FileSystem.writeAsStringAsync(dest, base64, { encoding: FileSystem.EncodingType.Base64 });
      return { uri: dest, reason: 'ok' };
    } catch {
      return { uri: null, reason: 'encode_failed' };
    }
  } catch {
    // Anything unexpected not already caught above (e.g. detectFace/decode
    // throwing instead of returning null) → the caller uses the raw
    // generated image; identity is not guaranteed but the flow is never
    // broken.
    return { uri: null, reason: 'error' };
  }
}
