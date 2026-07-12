// Face compositing — pastes the user's REAL face (from their try-on source
// photo) onto the AI-generated studio image, so identity is guaranteed
// regardless of how faithfully the generative model rendered it.
//
// Pipeline:
//   1. detectFace (BlazeFace, on-device) on both the source photo and the
//      generated image → 4 landmarks each (eyes, nose, mouth).
//   2. estimateSimilarity (faceCompositeMath) fits a scale+rotation+
//      translation mapping source→generated face space. isAlignmentPlausible
//      gates out bad mismatches (wrong face size/angle) — the composite is
//      skipped rather than pasting a warped face.
//   3. A feathered ellipse mask (inner face only — excludes hairline/jaw, so
//      the model's hair/hairline/lighting on the body stays untouched) is
//      built around the GENERATED face.
//   4. Per-channel color statistics are taken over both faces' core pixels so
//      the pasted source face is tone-matched to the generated lighting
//      (colorTransfer) rather than looking pasted-on.
//   5. Every masked generated pixel is replaced by inverse-mapping to the
//      source photo (bilinear sample), color-matching, and alpha-blending
//      with the original generated pixel.
//   6. Re-encoded to JPEG and written to a cache file; that uri is returned.
//
// DEGRADES TO NULL ON ANY FAILURE (no face detected, implausible alignment,
// decode/encode error, etc.) — the caller falls back to the raw generated
// image, which is the pre-existing behaviour. This never throws.
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
  ellipseAlpha, channelStats, colorTransfer, bilinearSample,
} from './faceCompositeMath';

// Working resolution both images are downscaled to before pixel manipulation
// (perf: full-res generated images can be several MP; the face region is a
// small fraction of the frame, so this is plenty of detail for the paste).
const WORK_MAX = 1024;
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

// CALIBRATION-PENDING: inner-face ellipse size, expressed as a multiple of
// the inter-eye distance. Chosen to cover eyes/nose/mouth/cheeks while
// excluding the hairline, ears, and jaw contour (which stay from the
// generated image so hair/lighting/head-shape aren't disturbed).
const MASK_RX_FACTOR = 1.5;
const MASK_RY_FACTOR = 1.9;
const MASK_FEATHER = 0.25;
// Only pixels this deep inside the mask contribute to the color-match stats
// (avoids the feathered edge, where the sample is a blend region, skewing
// the mean/std used to compute the transfer).
const STATS_ALPHA_THRESHOLD = 0.6;

/**
 * Paste the user's real face (from `sourceUri`) onto the AI-generated image
 * (`generatedUri`), tone-matched and feather-blended. Returns the composited
 * image's local file uri, or null if compositing wasn't possible/safe (no
 * face detected in either image, implausible alignment, or any error) — the
 * caller should use `generatedUri` as-is in that case.
 */
export async function compositeFace(sourceUri: string, generatedUri: string): Promise<string | null> {
  try {
    const [srcLandmarks, genLandmarks] = await Promise.all([
      detectFace(sourceUri),
      detectFace(generatedUri),
    ]);
    if (!srcLandmarks || !genLandmarks) return null;

    const [srcImg, genImg] = await Promise.all([
      decodeDownscaled(sourceUri, WORK_MAX),
      decodeDownscaled(generatedUri, WORK_MAX),
    ]);
    if (!srcImg || !genImg) return null;

    const toPx = (p: Pt, w: number, h: number): Pt => ({ x: p.x * w, y: p.y * h });
    const srcPts: Pt[] = [srcLandmarks.rightEye, srcLandmarks.leftEye, srcLandmarks.nose, srcLandmarks.mouth]
      .map((p) => toPx(p, srcImg.width, srcImg.height));
    const genPts: Pt[] = [genLandmarks.rightEye, genLandmarks.leftEye, genLandmarks.nose, genLandmarks.mouth]
      .map((p) => toPx(p, genImg.width, genImg.height));

    // Source → generated face-space mapping, and its inverse (generated →
    // source) for the per-pixel paste below.
    const sim = estimateSimilarity(srcPts, genPts);
    if (!isAlignmentPlausible(sim)) return null;
    const inv = invertSim(sim);

    // Mask centred on the GENERATED face (where we're painting).
    const cx = genPts.reduce((s, p) => s + p.x, 0) / genPts.length;
    const cy = genPts.reduce((s, p) => s + p.y, 0) / genPts.length;
    const interEye = Math.hypot(genPts[0].x - genPts[1].x, genPts[0].y - genPts[1].y);
    if (!isFinite(interEye) || interEye <= 0) return null;
    const rx = interEye * MASK_RX_FACTOR;
    const ry = interEye * MASK_RY_FACTOR;

    const bx0 = Math.max(0, Math.floor(cx - rx));
    const bx1 = Math.min(genImg.width - 1, Math.ceil(cx + rx));
    const by0 = Math.max(0, Math.floor(cy - ry));
    const by1 = Math.min(genImg.height - 1, Math.ceil(cy + ry));
    if (bx1 <= bx0 || by1 <= by0) return null;

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
    if (genSamples[0].length === 0) return null; // degenerate/near-zero mask

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

    const base64 = encodeJpegToBase64(genImg, JPEG_QUALITY);
    const dir = `${FileSystem.cacheDirectory}try-on/`;
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
    const dest = `${dir}composite_${Date.now()}.jpg`;
    await FileSystem.writeAsStringAsync(dest, base64, { encoding: FileSystem.EncodingType.Base64 });
    return dest;
  } catch {
    // Any failure (no face, bad alignment, decode/encode error) → the caller
    // uses the raw generated image; identity is not guaranteed but the flow
    // is never broken.
    return null;
  }
}
