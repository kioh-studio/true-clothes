// Measurements AI scan — LIVE pose guide (B-lite, poll-based).
//
// Shows a live camera preview, polls a frame ~every 1.2 s, runs on-device MoveNet
// on each, draws the detected skeleton over the preview, and tells the user how to
// adjust (step back / straighten / …). When the pose is good for a couple of
// frames in a row it AUTO-CAPTURES — no manual retake loop. A "Capture now" button
// is always available as an override.
//
// PRIVACY: every polled frame is processed on-device. Frames without a pose are
// deleted immediately; up to the last BUFFER_SIZE frames WITH a pose are
// retained (a small ring buffer) only until capture, when the refinement +
// silhouette passes read each of them once and every buffered frame is deleted
// (see finish()). Nothing is uploaded or persisted.
//
// ACCURACY: capture no longer trusts a single frame OR a single model pass.
// Up to BUFFER_SIZE good frames are median-aggregated (see aggregateFrames.ts)
// — variance reduction only (no bias shift): the median of several independent
// samples of the same pose cancels per-frame detector jitter without moving
// the expected value. On TOP of that, buffered frames get a two-pass
// treatment at capture time: a BlazePose Heavy re-inference on a tight crop
// around the person (refineKeypoints — sharper, 33-landmark keypoints than
// the live-loop Lightning pass, too slow to run every poll tick) and a
// cropped MODNet matting pass (estimateSilhouetteCropped — more of the
// model's pixels land on the body instead of background, and a soft alpha
// matte instead of a coarse mask). BlazePose Heavy + MODNet both cost
// noticeably more per frame than the Lightning/selfie-segmenter combo they
// augment, so — LATENCY GUARD (2026-07-12) — only the best MAX_REFINE_FRAMES
// buffered frames (ranked by pass-1 pose completeness) are ever refined; see
// finish() below for the full two-branch policy this implies. Either the
// keypoint or the segmentation half of a refine attempt can still fail
// per-frame and falls back to that candidate's pass-1 keypoints / no widths,
// same "degrade, don't crash" contract as before.
//
// NOTE (must verify on a device build): the camera preview, live MoveNet polling,
// and especially the overlay alignment (preview crop, front-camera mirroring) can
// only be validated/tuned on a real device — not in this environment.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as FileSystem from 'expo-file-system/legacy';
import { DeviceMotion } from 'expo-sensors';
import Svg, { Line, Circle } from 'react-native-svg';
import { T, type } from '../src/design/tokens';
import { PrimaryButton, SecondaryButton, Bounded } from '../src/components/ui';
import { IconX } from '../src/components/icons';
import { useFitEngineStore } from '../src/stores/fitEngineStore';
import { useAuthStore } from '../src/stores/authStore';
import { estimateKeypoints, refineKeypoints, type Keypoint } from '../src/features/measurements/poseEstimate';
import {
  estimateSilhouette, estimateSilhouetteCropped, extractWidths, maskVerticalExtent, eraseDisk,
  type SilhouetteMask, type SilhouetteWidths,
} from '../src/features/measurements/silhouette';
import { extractSideDepths, type SideDepths, type SideRowFracs } from '../src/features/measurements/sideViewMath';
import { personCropRect, fullSquareToCropSquare, cropSquareLengthToFullSquare } from '../src/features/measurements/cropMath';
import { keypointsToMeasurements, estimatePersonUnitH, K, type Sex } from '../src/features/measurements/landmarksToMeasurements';
import { exportScanFixture } from '../src/features/measurements/scanExport';
import {
  medianKeypoints, medianWidths, medianSideDepths, medianExtent, scaleAgreement, rejectOutlierFrames,
} from '../src/features/measurements/aggregateFrames';
import {
  assessPose, assessSidePose, SKELETON_EDGES, Q, REQUIRED_KP, type PoseHint,
} from '../src/features/measurements/poseQuality';
import { useTranslation } from '../src/i18n';

// 'scanning' now covers BOTH capture passes — see `SubPhase` below. 'turn' is
// the brief full-screen interstitial between them telling the user to turn
// 90°; it is its own top-level phase (not a sub-phase of 'scanning') because
// no camera polling happens during it.
type ScanPhase = 'intro' | 'scanning' | 'turn' | 'processing' | 'success' | 'height_required' | 'error';
/** Which capture pass 'scanning' is currently running. */
type SubPhase = 'front' | 'side';

const POLL_MS = 1200;
const OK_COLOR = '#5B8A6B';   // muted green — pose good
const ADJ_COLOR = '#C2853B';  // muted amber — needs adjusting
// Ring-buffer capacity for multi-frame median aggregation (aggregateFrames.ts).
const BUFFER_SIZE = 4;
// Latency guard (2026-07-12): BlazePose Heavy + MODNet cost noticeably more
// per frame than the Lightning/selfie-segmenter combo they augment — refine
// at most this many of the buffered frames per capture, not all of them.
// See finish()'s doc comment for the full ranking + fallback policy.
const MAX_REFINE_FRAMES = 3;
// SIDE (profile) capture pass — smaller buffer/refine cap than the front
// pass: the side pass is a bonus accuracy signal on top of a front-only
// estimate that's already complete on its own, so it deliberately costs less
// capture-time latency than the front pass does.
const SIDE_BUFFER_SIZE = 3;
const SIDE_MAX_REFINE_FRAMES = 2;
// How long the 'turn' interstitial (full-screen "turn to your side" text)
// shows before auto-advancing into the side scanning loop.
const TURN_INTERSTITIAL_MS = 2500;
// Phone-tilt gate (DeviceMotion.rotation.beta, radians; upright portrait ≈ π/2).
// ~12° — CALIBRATION-PENDING, needs on-device tuning.
const TILT_THRESHOLD_RAD = 0.21;

/**
 * Run the silhouette extraction (contour widths + vertical extent) against
 * one buffered frame's mask, in WHATEVER normalised space that mask lives in
 * (crop-square when the frame was cropped, full-square when not — the caller
 * converts both to full-square units afterward via a shared scale factor).
 * Returns null widths when shoulders/hips aren't confident enough to place
 * the scan bands (the same gate `extractWidths` uses internally). The extent
 * scan probes MULTIPLE columns — the torso centre plus nose and each
 * confident ankle — because a single torso-centre probe dies in the gap
 * between the legs below the crotch and would truncate the extent at the
 * crotch instead of the soles (see `maskVerticalExtent`); with no confident
 * probe landmarks at all, extent is null for this frame.
 */
function extractWidthsAndExtent(
  mask: SilhouetteMask, kps: Keypoint[],
): { widths: SilhouetteWidths | null; extentSpan: number | null } {
  const widths = extractWidths(mask, kps) ?? null;
  const by: Record<string, Keypoint> = {};
  for (const k of kps) by[k.name] = k;
  const need = ['leftShoulder', 'rightShoulder', 'leftHip', 'rightHip'];
  const probes: number[] = [];
  if (need.every((n) => by[n] && by[n].score >= Q.minScore)) {
    probes.push((by['leftShoulder'].x + by['rightShoulder'].x + by['leftHip'].x + by['rightHip'].x) / 4);
  }
  for (const name of ['nose', 'leftAnkle', 'rightAnkle']) {
    const k = by[name];
    if (k && k.score >= Q.minScore) probes.push(k.x);
  }
  const extent = maskVerticalExtent(mask, probes);
  return { widths, extentSpan: extent ? extent.botV - extent.topV : null };
}

/** Shoulder x-span of a keypoint set, or null if either shoulder is absent —
 *  used only for the __DEV__ refined-vs-pass1 diagnostic log. */
function shoulderSpanOf(kps: Keypoint[]): number | null {
  const l = kps.find((k) => k.name === 'leftShoulder');
  const r = kps.find((k) => k.name === 'rightShoulder');
  return l && r ? Math.abs(l.x - r.x) : null;
}

/** One buffered live-poll frame — shared shape for BOTH the front and side
 *  ring buffers. `pitchRad` is the DeviceMotion beta (radians) read at the
 *  moment this frame was captured — see the module doc comment on
 *  `capturePitchRad` (groundwork for a future keystone correction, unused in
 *  any math today). */
interface BufferedFrame {
  keypoints: Keypoint[];
  uri: string;
  width: number;
  height: number;
  pitchRad?: number;
}

/** Mask-extent probe columns for the SIDE view — same pattern as
 *  `extractWidthsAndExtent`'s front-view probes, but lenient (torso-centre
 *  probe uses whichever of the four shoulder/hip joints are confident,
 *  not requiring all four) since a profile view only ever shows one side
 *  of the body clearly. */
function sideProbesOf(kps: Keypoint[]): number[] {
  const by: Record<string, Keypoint> = {};
  for (const k of kps) by[k.name] = k;
  const probes: number[] = [];
  const torsoNames = ['leftShoulder', 'rightShoulder', 'leftHip', 'rightHip']
    .filter((n) => by[n] && by[n].score >= Q.minScore);
  if (torsoNames.length > 0) {
    probes.push(torsoNames.reduce((s, n) => s + by[n].x, 0) / torsoNames.length);
  }
  for (const name of ['nose', 'leftAnkle', 'rightAnkle']) {
    const k = by[name];
    if (k && k.score >= Q.minScore) probes.push(k.x);
  }
  return probes;
}

/** Weakest-link completeness score for a SIDE frame — nose plus the best of
 *  each shoulder/hip/ankle pair — the side-pose counterpart to `finish()`'s
 *  `requiredMinScore` ranking (which needs BOTH joints of every pair; a
 *  profile view only ever needs one). Used to pick the best
 *  `SIDE_MAX_REFINE_FRAMES` candidates for the expensive refine+segment pass. */
function sideRequiredMinScore(kps: Keypoint[]): number {
  const by: Record<string, Keypoint> = {};
  for (const k of kps) by[k.name] = k;
  const pairBest = (a: string, b: string) => Math.max(by[a]?.score ?? 0, by[b]?.score ?? 0);
  return Math.min(
    by['nose']?.score ?? 0,
    pairBest('leftShoulder', 'rightShoulder'),
    pairBest('leftHip', 'rightHip'),
    pairBest('leftAnkle', 'rightAnkle'),
  );
}

/** Result of a successful side-view processing pass — see `processSideFrames`. */
interface SideProcessResult {
  /** Median-aggregated side keypoints, full-square space. */
  sideAggKps: Keypoint[];
  /** Median-aggregated measured depths, in the SIDE mask's own (already
   *  full-square-converted) normalised units — exported into the fixture
   *  (v2) so the harness can recompute cm with different tunables. */
  depthsU: SideDepths;
  /** Side mask's crown→sole vertical extent, full-square units. */
  maskExtentU?: number;
  /** Measured depths converted to centimetres via the SIDE view's OWN scale
   *  — this is what actually feeds `keypointsToMeasurements`. */
  sideDepthsCm: { chestCm?: number; waistCm?: number; hipCm?: number };
  /** Median DeviceMotion pitch across the buffered side frames. */
  capturePitchRad?: number;
}

/**
 * Process the buffered SIDE (profile) frames into measured bust/waist/hip
 * depths, using the FRONT scan's row fractions (`frontRowFracs` — a
 * `SilhouetteWidths`-shaped object works directly, only its
 * `chestRowFrac`/`waistRowFrac`/`hipRowFrac` fields are read) to register the
 * SAME anatomical rows on the profile mask (see sideViewMath.ts's module doc
 * comment for why a row FRACTION is view-invariant when absolute y is not).
 *
 * Mirrors `finish()`'s front-view refine+segment pipeline at a smaller scale
 * (`SIDE_BUFFER_SIZE`/`SIDE_MAX_REFINE_FRAMES`) — the side pass is a BONUS
 * signal on top of an already-complete front-only estimate, so any failure
 * anywhere in this pipeline (a candidate's refine/segment attempt throwing,
 * no usable depths surviving aggregation, no computable side-view scale)
 * simply returns `null` and the caller silently falls back to the front-only,
 * BMI-guessed-depth estimate — never a user-visible error.
 *
 * Per candidate frame: `personCropRect` locates the person → `refineKeypoints`
 * (BlazePose Heavy) sharpens the pose on that crop → `estimateSilhouetteCropped`
 * (MODNet-first) segments the SAME crop → `eraseDisk` zeroes a disk around
 * each confident wrist (relaxed arms put the hands near seat/hip level in a
 * profile photo, polluting the hip-depth contour — see silhouetteMath.ts's
 * `eraseDisk` doc comment) BEFORE → `extractSideDepths` scans the front's row
 * fractions. Every candidate's photo uri is deleted once this loop is done
 * reading it (privacy contract unchanged).
 *
 * `onFrameProcessed` is an optional progress callback, invoked once per
 * candidate frame (success or failure) — feeds the "x/y frames processed"
 * line under the processing spinner.
 */
async function processSideFrames(
  buffered: BufferedFrame[],
  frontRowFracs: SideRowFracs,
  heightCm: number,
  onFrameProcessed?: () => void,
): Promise<SideProcessResult | null> {
  if (buffered.length === 0) return null;

  const candidates = [...buffered]
    .sort((a, b) => sideRequiredMinScore(b.keypoints) - sideRequiredMinScore(a.keypoints))
    .slice(0, SIDE_MAX_REFINE_FRAMES);

  const perFrameKps: Keypoint[][] = [];
  const perFrameDepths: (SideDepths | null)[] = [];
  const perFrameExtents: (number | null)[] = [];

  for (const frame of candidates) {
    let finalKps = frame.keypoints;
    let depths: SideDepths | null = null;
    let extentSpan: number | null = null;
    try {
      const cropRect = personCropRect(frame.keypoints, frame.width, frame.height);
      if (cropRect) {
        const refined = await refineKeypoints(frame.uri, frame.width, frame.height, frame.keypoints);
        if (refined) finalKps = refined;

        const mask = await estimateSilhouetteCropped(frame.uri, frame.width, frame.height, cropRect);
        if (mask) {
          const kpsInCropSpace = finalKps.map((k) => {
            const { u, v } = fullSquareToCropSquare(k.x, k.y, cropRect, frame.width, frame.height);
            return { ...k, x: u, y: v };
          });

          // Hand erasure BEFORE the depth scan — radius = 0.06 × the crop's
          // own person-unit height (≈ hand length), around each wrist whose
          // score clears the standard 0.3 confidence floor.
          const personUnitForHand = estimatePersonUnitH(kpsInCropSpace, undefined, K);
          if (personUnitForHand != null) {
            for (const wristName of ['leftWrist', 'rightWrist']) {
              const wrist = kpsInCropSpace.find((k) => k.name === wristName);
              if (wrist && wrist.score >= Q.minScore) {
                eraseDisk(mask, wrist.x, wrist.y, 0.06 * personUnitForHand);
              }
            }
          }

          const sideDepths = extractSideDepths(mask, kpsInCropSpace, frontRowFracs);
          const hasAnyDepth = sideDepths.chestU != null || sideDepths.waistU != null || sideDepths.hipU != null;
          depths = hasAnyDepth
            ? {
                chestU: sideDepths.chestU != null ? cropSquareLengthToFullSquare(sideDepths.chestU, cropRect, frame.width, frame.height) : undefined,
                waistU: sideDepths.waistU != null ? cropSquareLengthToFullSquare(sideDepths.waistU, cropRect, frame.width, frame.height) : undefined,
                hipU:   sideDepths.hipU   != null ? cropSquareLengthToFullSquare(sideDepths.hipU,   cropRect, frame.width, frame.height) : undefined,
              }
            : null;

          const extent = maskVerticalExtent(mask, sideProbesOf(kpsInCropSpace));
          if (extent) {
            extentSpan = cropSquareLengthToFullSquare(extent.botV - extent.topV, cropRect, frame.width, frame.height);
          }
        }
      }
    } catch {
      // This candidate's refine/segmentation attempt failed — contributes
      // only its pass-1 keypoints below; no depths/extent for this frame.
    }
    perFrameKps.push(finalKps);
    perFrameDepths.push(depths);
    perFrameExtents.push(extentSpan);
    onFrameProcessed?.();
  }

  // Every buffered side photo (candidate or not) is done being read here.
  for (const frame of buffered) {
    FileSystem.deleteAsync(frame.uri, { idempotent: true }).catch(() => {});
  }

  const depthsU = medianSideDepths(perFrameDepths);
  if (depthsU.chestU == null && depthsU.waistU == null && depthsU.hipU == null) return null; // wholly failed

  const sideAggKps = medianKeypoints(perFrameKps);
  const maskExtentU = medianExtent(perFrameExtents);
  const capturePitchRad = medianExtent(buffered.map((f) => f.pitchRad));

  const sidePersonUnitH = estimatePersonUnitH(sideAggKps, maskExtentU, K);
  if (sidePersonUnitH == null || sidePersonUnitH <= 0) return null; // no usable side-view scale

  const sideCmPerUnit = heightCm / sidePersonUnitH;
  const sideDepthsCm = {
    chestCm: depthsU.chestU != null ? depthsU.chestU * sideCmPerUnit : undefined,
    waistCm: depthsU.waistU != null ? depthsU.waistU * sideCmPerUnit : undefined,
    hipCm:   depthsU.hipU   != null ? depthsU.hipU   * sideCmPerUnit : undefined,
  };

  return { sideAggKps, depthsU, maskExtentU, sideDepthsCm, capturePitchRad };
}

/** Map the profile gender label to the estimator's sex; non-binary/unset → neutral. */
function sexFromGender(gender?: string): Sex | undefined {
  const g = gender?.trim().toUpperCase();
  if (g === 'WOMAN') return 'female';
  if (g === 'MAN')   return 'male';
  return undefined;
}

/** Compute age in whole years from the app-format dob "DD/MM/YYYY". */
function ageFromDob(dob?: string): number | undefined {
  const m = dob ? /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(dob.trim()) : null;
  if (!m) return undefined;
  const day = Number(m[1]), month = Number(m[2]), year = Number(m[3]);
  const birth = new Date(year, month - 1, day);
  if (isNaN(birth.getTime())) return undefined;
  const now = new Date();
  let age = now.getFullYear() - year;
  if (now.getMonth() < month - 1 || (now.getMonth() === month - 1 && now.getDate() < day)) age--;
  return age >= 0 && age < 120 ? age : undefined;
}

export default function MeasurementsScanScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();

  // Scale + refinement inputs (see earlier rounds): height/weight from the
  // in-progress form (query param) → store fallback; sex/age from the profile.
  const params      = useLocalSearchParams<{ heightCm?: string; weightKg?: string }>();
  const storeHeight = useFitEngineStore((s) => s.bodyMeasurements.body_height);
  const storeWeight = useFitEngineStore((s) => s.bodyMeasurements.body_weight);
  const paramHeight = Number(params.heightCm);
  const paramWeight = Number(params.weightKg);
  const bodyHeight  = Number.isFinite(paramHeight) && paramHeight > 0 ? paramHeight : storeHeight;
  const bodyWeight  = Number.isFinite(paramWeight) && paramWeight > 0 ? paramWeight : storeWeight;
  const sex      = sexFromGender(useAuthStore((s) => s.gender));
  const ageYears = ageFromDob(useAuthStore((s) => s.dob));

  const setPendingEstimate = useFitEngineStore((s) => s.setPendingEstimate);

  const [permission, requestPermission] = useCameraPermissions();
  // Both facings are supported via the flip control. Default to the FRONT
  // camera: this is a self-measurement flow ("camera trước") where the user
  // frames themselves and reads the live guidance. Users who prop the phone /
  // have a helper can flip to the back camera for a sharper full-body shot.
  const [facing, setFacing] = useState<'back' | 'front'>('front');
  const [phase, setPhase] = useState<ScanPhase>(bodyHeight && bodyHeight > 0 ? 'intro' : 'height_required');
  // Which capture pass 'scanning' is currently running — see `SubPhase`.
  const [subPhase, setSubPhase] = useState<SubPhase>('front');
  const [overlay, setOverlay] = useState<{ display: Keypoint[]; ok: boolean } | null>(null);
  const [hint, setHint] = useState<PoseHint>('no_person');
  const [layout, setLayout] = useState({ w: 0, h: 0 });
  // Giant distance-readable feedback: remaining good frames before auto-capture
  // (2…1) and the 10 s self-timer. Both render as a full-screen numeral so the
  // user never has to walk up to the phone to read state.
  const [countdown, setCountdown] = useState<number | null>(null);
  const [timerLeft, setTimerLeft] = useState<number | null>(null);
  // "x/y frames processed" line under the processing spinner — the two-view
  // pipeline (front refine+segment, then side refine+segment) takes
  // noticeably longer than the front-only pipeline did, so this is a simple
  // best-effort reassurance, not a precise accounting of every internal step.
  const [processProgress, setProcessProgress] = useState<{ done: number; total: number } | null>(null);
  // Dev-only diagnostics: which quality gate is failing (keypoints present / frame fill).
  const [debugInfo, setDebugInfo] = useState('');

  const cameraRef = useRef<CameraView | null>(null);
  const readyRef = useRef(false);
  const scanningRef = useRef(false);
  const busyRef = useRef(false);
  const goodRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const backTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selfTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  // Most-recent good-pose keypoints — used only to gate "Capture now" /
  // self-timer availability (disabled state), unchanged from before.
  const lastKpRef = useRef<Keypoint[] | null>(null);
  // Ring buffer of up to BUFFER_SIZE recent good-pose frames (keypoints + the
  // temp photo uri + the frame's own pixel dimensions — needed by the
  // capture-time crop math, which is per-frame since each photo can have
  // slightly different dimensions), retained so finish() can median-aggregate
  // across several independent samples instead of trusting a single frame.
  // Each uri is deleted as soon as it is evicted, consumed by finish(), or
  // the scan ends.
  const frameBufferRef = useRef<BufferedFrame[]>([]);
  // SIDE (profile) capture's own ring buffer — same shape, separate cap
  // (SIDE_BUFFER_SIZE) and lifetime (only populated while subPhase==='side').
  const sideBufferRef = useRef<BufferedFrame[]>([]);
  // Live tilt-gate state (see the DeviceMotion effect below) — a ref (not
  // state) since the poll loop reads it synchronously every tick and a
  // re-render on every sensor sample (as fast as every 300 ms) would be
  // wasteful. Stays false (no gating) on platforms/devices without a motion
  // sensor, or while DeviceMotion hasn't reported yet.
  const tiltedRef = useRef(false);
  // Latest raw DeviceMotion pitch (radians), stamped onto each buffered
  // frame at capture time — see `BufferedFrame.pitchRad`. Independent of
  // `tiltedRef` (a boolean gate derived from this same sensor stream): this
  // keeps the actual value for the fixture-export groundwork, not just the
  // pass/fail gate.
  const betaRef = useRef<number | null>(null);

  const clearFrameBuffer = useCallback(() => {
    for (const f of frameBufferRef.current) {
      FileSystem.deleteAsync(f.uri, { idempotent: true }).catch(() => {});
    }
    frameBufferRef.current = [];
  }, []);

  const clearSideBuffer = useCallback(() => {
    for (const f of sideBufferRef.current) {
      FileSystem.deleteAsync(f.uri, { idempotent: true }).catch(() => {});
    }
    sideBufferRef.current = [];
  }, []);

  useEffect(() => () => {
    scanningRef.current = false;
    if (timerRef.current) clearTimeout(timerRef.current);
    if (backTimer.current) clearTimeout(backTimer.current);
    if (selfTimer.current) clearInterval(selfTimer.current);
    clearFrameBuffer();
    clearSideBuffer();
  }, [clearFrameBuffer, clearSideBuffer]);

  // Phone-tilt gate: while actively scanning (either sub-phase), watch
  // DeviceMotion and flag a phone that isn't held upright — a tilted phone
  // perspective-distorts the captured frame in a way pose/segmentation can't
  // correct for. Devices/platforms without a motion sensor simply never flag
  // tilt (no gating, today's behaviour unchanged) rather than blocking
  // capture on a feature that isn't available. Torn down on phase
  // change/unmount so it never fires outside the scanning phase.
  useEffect(() => {
    if (phase !== 'scanning') return;
    let cancelled = false;
    let subscription: { remove: () => void } | null = null;

    DeviceMotion.isAvailableAsync()
      .then((available) => {
        if (!available || cancelled) return;
        DeviceMotion.setUpdateInterval(300);
        subscription = DeviceMotion.addListener((data) => {
          const beta = data.rotation?.beta;
          betaRef.current = beta ?? null;
          // Upright portrait ≈ π/2 (CALIBRATION-PENDING threshold — see
          // TILT_THRESHOLD_RAD, needs on-device tuning).
          tiltedRef.current = beta != null && Math.abs(beta - Math.PI / 2) > TILT_THRESHOLD_RAD;
        });
      })
      .catch(() => { tiltedRef.current = false; });

    return () => {
      cancelled = true;
      tiltedRef.current = false;
      betaRef.current = null;
      if (subscription) subscription.remove();
    };
  }, [phase]);

  // expo-router throws "GO_BACK was not handled by any navigator" when there is
  // nothing to pop — e.g. the stack was reset by Fast Refresh or this screen was
  // deep-linked into directly. Guard every dismissal and fall back to the form
  // that owns these measurements.
  const onboardingComplete = useAuthStore((s) => s.onboardingComplete);
  const dismiss = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace(onboardingComplete ? '/measurements-edit' : '/(onboarding)/measurements');
  }, [router, onboardingComplete]);

  // Run the on-device estimate on the buffered good-pose frames and finish.
  // Reads the ring buffer internally (rather than taking a single-frame arg)
  // so all three capture paths (auto-capture, "Capture now", self-timer) share
  // identical multi-frame handling — none of them special-case frame count.
  //
  // Async: after freezing the UI into 'processing':
  //   1. LATENCY GUARD (2026-07-12): rank buffered frames by the MINIMUM
  //      score among poseQuality.ts's REQUIRED_KP landmarks (the same
  //      landmarks the live gate already requires before a frame is even
  //      buffered) and refine only the best MAX_REFINE_FRAMES — BlazePose
  //      Heavy + MODNet both cost noticeably more per frame than the
  //      Lightning/selfie-segmenter combo they augment, so refining EVERY
  //      buffered frame (the original behaviour) risked a visibly slow
  //      capture. Every buffered frame's photo uri stays UNDELETED through
  //      this step — which branch fires next depends on how many of these
  //      candidates succeed, and the fallback branch (below) needs every
  //      original photo, not just the candidates'.
  //   2. Each candidate gets the same two-pass treatment as before:
  //      `personCropRect` locates the person from its pass-1 (Lightning)
  //      keypoints; `refineKeypoints` (BlazePose Heavy, on the crop) replaces
  //      the keypoints on success; `estimateSilhouetteCropped` (MODNet-first)
  //      segments the SAME crop, with widths/extent scaled back to
  //      full-square units.
  //   3. BRANCH on how many candidates actually refined (`refined != null`):
  //      - ≥2 succeeded: the final frame set is ONLY the successfully
  //        refined candidates. Every other buffered frame — including a
  //        top-3 candidate whose OWN refine attempt failed — is discarded
  //        from aggregation entirely, never contributing even its pass-1
  //        keypoints: mixing an un-refined frame's pass-1 bias into the same
  //        median pool as BlazePose-refined frames would blend two models'
  //        distinct biases together, which is worse than just trusting the
  //        frames that actually got sharper.
  //      - <2 succeeded: revert to the pre-refinement pipeline UNIFORMLY for
  //        EVERY buffered frame — pass-1 (Lightning) keypoints +
  //        FULL-FRAME segmentation (estimateSilhouette, not cropped). A lone
  //        refined frame (or none) isn't enough to trust over the rest of
  //        the buffer, so this branch doesn't cherry-pick; it just reverts.
  // Every buffered frame's photo uri is deleted exactly once, at the point
  // its branch is done with it (privacy contract unchanged, just resolved
  // per-branch instead of unconditionally per-frame). Outlier rejection +
  // all the median aggregation (keypoints/widths/extent) still run over
  // whichever frame set the branch produced — this is still variance
  // reduction only, no bias shift (see aggregateFrames.ts).
  const finish = useCallback(async () => {
    scanningRef.current = false;
    // The auto-capture call site (inside the poll loop, below) invokes finish()
    // and returns immediately, skipping the loop's own `busyRef.current = false`.
    // Reset it here so a subsequent Start (after an 'error' phase) isn't
    // permanently blocked by a busyRef stuck at true.
    busyRef.current = false;
    if (timerRef.current) clearTimeout(timerRef.current);
    if (selfTimer.current) { clearInterval(selfTimer.current); selfTimer.current = null; }
    setTimerLeft(null);
    setCountdown(null);

    // Snapshot + clear BOTH buffers immediately so no other in-flight call
    // can race on the same frames (all capture paths, both sub-phases,
    // funnel through here). An empty side buffer (SKIP was used, or the
    // side sub-phase never captured anything) is a normal, silent front-only
    // path, NOT an error — only an empty FRONT buffer is fatal.
    const buffered = frameBufferRef.current;
    frameBufferRef.current = [];
    const sideBuffered = sideBufferRef.current;
    sideBufferRef.current = [];
    if (buffered.length === 0) { setPhase('error'); return; }
    setPhase('processing');

    // Rank by the weakest REQUIRED_KP score (higher = more complete pass-1
    // pose = the best candidate for a second, more expensive pass to sharpen).
    const requiredMinScore = (kps: Keypoint[]): number => {
      const by: Record<string, Keypoint> = {};
      for (const k of kps) by[k.name] = k;
      let min = 1;
      for (const name of REQUIRED_KP) min = Math.min(min, by[name]?.score ?? 0);
      return min;
    };
    const refineCandidates = [...buffered]
      .sort((a, b) => requiredMinScore(b.keypoints) - requiredMinScore(a.keypoints))
      .slice(0, MAX_REFINE_FRAMES);

    // "x/y frames processed" progress line — a best-effort estimate, not a
    // precise accounting (see `processProgress`'s doc comment above its
    // declaration): starts at the front refine candidates + however many
    // side candidates will be attempted; `addToTotal` below adjusts it if
    // the front fallback branch ends up reprocessing every buffered frame.
    const sideCandidateEstimate = sideBuffered.length > 0 ? Math.min(sideBuffered.length, SIDE_MAX_REFINE_FRAMES) : 0;
    setProcessProgress({ done: 0, total: refineCandidates.length + sideCandidateEstimate || 1 });
    const bumpDone = () => setProcessProgress((p) => (p ? { ...p, done: p.done + 1 } : p));
    const addToTotal = (n: number) => setProcessProgress((p) => (p ? { ...p, total: p.total + n } : p));

    const refineResults: {
      succeeded: boolean;
      keypoints: Keypoint[];
      widths: SilhouetteWidths | null;
      extent: number | null;
    }[] = [];

    for (const b of refineCandidates) {
      let finalKps = b.keypoints;
      let widthsForFrame: SilhouetteWidths | null = null;
      let extentForFrame: number | null = null;
      let succeeded = false;

      try {
        const cropRect = personCropRect(b.keypoints, b.width, b.height);
        if (cropRect) {
          const refined = await refineKeypoints(b.uri, b.width, b.height, b.keypoints);
          if (refined) { finalKps = refined; succeeded = true; }

          const mask = await estimateSilhouetteCropped(b.uri, b.width, b.height, cropRect);
          if (mask) {
            // extractWidths/maskVerticalExtent need keypoints in the SAME
            // space as the mask (crop-square) — map this frame's own final
            // keypoints (already in full-square space) back into ITS crop.
            const kpsInCropSpace = finalKps.map((k) => {
              const { u, v } = fullSquareToCropSquare(k.x, k.y, cropRect, b.width, b.height);
              return { ...k, x: u, y: v };
            });
            const { widths, extentSpan } = extractWidthsAndExtent(mask, kpsInCropSpace);
            if (widths) {
              widthsForFrame = {
                shoulderU: widths.shoulderU != null ? cropSquareLengthToFullSquare(widths.shoulderU, cropRect, b.width, b.height) : undefined,
                chestU:    widths.chestU    != null ? cropSquareLengthToFullSquare(widths.chestU,    cropRect, b.width, b.height) : undefined,
                waistU:    widths.waistU    != null ? cropSquareLengthToFullSquare(widths.waistU,    cropRect, b.width, b.height) : undefined,
                hipU:      widths.hipU      != null ? cropSquareLengthToFullSquare(widths.hipU,      cropRect, b.width, b.height) : undefined,
                // Row FRACTIONS are dimensionless ratios (fraction of the
                // shoulder→hip span) — unlike the widths above, they must
                // NOT go through cropSquareLengthToFullSquare (that scales a
                // LENGTH by Lc/L; a ratio of two lengths in the SAME space
                // already cancels that factor) — copy through unconverted.
                chestRowFrac: widths.chestRowFrac,
                waistRowFrac: widths.waistRowFrac,
                hipRowFrac:   widths.hipRowFrac,
              };
            }
            if (extentSpan != null) {
              extentForFrame = cropSquareLengthToFullSquare(extentSpan, cropRect, b.width, b.height);
            }
          }
        }
      } catch {
        // This candidate's refine/segmentation attempt failed — `succeeded`
        // stays false; the branch below decides what happens to it next.
      }

      refineResults.push({ succeeded, keypoints: finalKps, widths: widthsForFrame, extent: extentForFrame });
      bumpDone();
    }

    const refinedSuccessCount = refineResults.filter((r) => r.succeeded).length;

    const finalKpsPerFrame: Keypoint[][] = [];
    const collectedWidths: (SilhouetteWidths | null)[] = [];
    const collectedExtents: (number | null)[] = [];

    if (refinedSuccessCount >= 2) {
      // Enough refined frames to trust on their own — see the doc comment
      // above for why un-refined/failed-refine frames are dropped entirely
      // rather than folded in with their pass-1 keypoints. Every buffered
      // photo (candidate or not) is done being read at this point.
      for (const r of refineResults) {
        if (!r.succeeded) continue;
        finalKpsPerFrame.push(r.keypoints);
        collectedWidths.push(r.widths);
        collectedExtents.push(r.extent);
      }
      for (const b of buffered) {
        FileSystem.deleteAsync(b.uri, { idempotent: true }).catch(() => {});
      }
    } else {
      // Fewer than 2 candidates refined — revert to the pre-refinement
      // pipeline UNIFORMLY for every buffered frame (see the doc comment
      // above). Every buffered photo (including the attempted candidates',
      // still undeleted from the loop above) gets read exactly once here.
      // This reprocesses every buffered frame (a superset of the refine
      // candidates already counted in the initial progress total above) —
      // grow the total by the full buffer size so "x/y" never overshoots.
      addToTotal(buffered.length);
      for (const b of buffered) {
        let widthsForFrame: SilhouetteWidths | null = null;
        let extentForFrame: number | null = null;
        try {
          const mask = await estimateSilhouette(b.uri, b.width, b.height);
          if (mask) {
            const { widths, extentSpan } = extractWidthsAndExtent(mask, b.keypoints);
            widthsForFrame = widths;
            extentForFrame = extentSpan; // already full-square — no crop scale to apply
          }
        } catch {
          // Segmentation failed for this frame — it still contributes its
          // pass-1 keypoints; widths/extent stay null for this frame only.
        } finally {
          FileSystem.deleteAsync(b.uri, { idempotent: true }).catch(() => {});
        }
        finalKpsPerFrame.push(b.keypoints);
        collectedWidths.push(widthsForFrame);
        collectedExtents.push(extentForFrame);
        bumpDone();
      }
    }

    // Outlier rejection: drop any frame whose apparent scale (nose→ankle span)
    // disagrees with the rest — a single foreshortened/mis-detected frame
    // would otherwise pollute the median. scaleAgreement is an HONEST
    // stability signal (distinct from per-frame keypoint confidence): it
    // reflects whether the frames agree on scale, not just whether the
    // detector was confident about a joint. Runs over the FINAL (refined
    // where available) keypoints, not the raw pass-1 ones.
    const frames = rejectOutlierFrames(finalKpsPerFrame);
    const cv = scaleAgreement(frames);
    const aggKps = medianKeypoints(frames);

    const mergedWidths = medianWidths(collectedWidths);
    const widths: SilhouetteWidths | undefined =
      Object.keys(mergedWidths).length > 0 ? mergedWidths : undefined;
    const maskExtentU = medianExtent(collectedExtents);
    const frontCapturePitchRad = medianExtent(buffered.map((b) => b.pitchRad));

    // ── SIDE (profile) processing — bonus signal on top of the always-
    // complete front-only estimate above. `widths ?? {}` carries the front's
    // MEDIAN row fractions (chestRowFrac/waistRowFrac/hipRowFrac) — how the
    // side pass registers the SAME anatomical rows on the profile mask (see
    // sideViewMath.ts). Any failure here (thrown error, no usable depths, no
    // computable side-view scale) is a SILENT fallback to front-only —
    // exactly today's behaviour — never a user-visible error.
    let sideResult: SideProcessResult | null = null;
    if (sideBuffered.length > 0) {
      try {
        sideResult = await processSideFrames(sideBuffered, widths ?? {}, bodyHeight ?? 0, bumpDone);
      } catch {
        sideResult = null;
      }
    }

    if (__DEV__) {
      // Diagnostic only: average shoulder x-span BEFORE (pass-1 Lightning,
      // per buffered frame) vs AFTER (this frame's final — BlazePose-refined
      // where available) refinement, so a device tester can eyeball whether
      // BlazePose is actually moving the estimate. Also logs which of the
      // two latency-guard branches fired this capture (see finish()'s doc
      // comment) — `refinedSuccessCount`/`MAX_REFINE_FRAMES` say how many of
      // the ranked candidates actually got refined.
      const avgOf = (vals: number[]) => (vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : null);
      const pass1Avg = avgOf(buffered.map((b) => shoulderSpanOf(b.keypoints)).filter((v): v is number => v != null));
      const refinedAvg = avgOf(finalKpsPerFrame.map(shoulderSpanOf).filter((v): v is number => v != null));
      setDebugInfo((prev) => `${prev} · agree ${(cv * 100).toFixed(1)}%`);
      console.log(
        `[MEASURE_SCAN] frames=${buffered.length} kept=${frames.length} scaleAgreementCV=${cv.toFixed(4)}` +
        ` refined=${refinedSuccessCount}/${refineCandidates.length} (cap ${MAX_REFINE_FRAMES})` +
        ` shoulderSpan pass1=${pass1Avg?.toFixed(4) ?? 'n/a'} refined=${refinedAvg?.toFixed(4) ?? 'n/a'}` +
        ` maskExtentU=${maskExtentU?.toFixed(4) ?? 'n/a'}`
      );
      // Side-view diagnostics: only meaningful once a front cmPerUnit can be
      // computed (same `estimatePersonUnitH` the production estimate uses)
      // to turn the front widths into cm for a depth:width ratio — this is
      // an approximation for logging purposes only, not the exact value fed
      // into keypointsToMeasurements (that happens inside it, per-field).
      if (sideResult) {
        const frontPersonUnitH = estimatePersonUnitH(aggKps, maskExtentU, K);
        const frontCmPerUnit = frontPersonUnitH ? (bodyHeight ?? 0) / frontPersonUnitH : null;
        const widthCmOf = (u?: number) => (u != null && frontCmPerUnit != null ? u * frontCmPerUnit : null);
        const ratioOf = (d?: number, w?: number | null) => (d != null && w != null && w > 0 ? d / w : null);
        const chestW = widthCmOf(widths?.chestU), waistW = widthCmOf(widths?.waistU), hipW = widthCmOf(widths?.hipU);
        const { chestCm, waistCm, hipCm } = sideResult.sideDepthsCm;
        console.log(
          `[MEASURE_SCAN_SIDE] frames=${sideBuffered.length}` +
          ` depthCm chest=${chestCm?.toFixed(1) ?? 'n/a'} waist=${waistCm?.toFixed(1) ?? 'n/a'} hip=${hipCm?.toFixed(1) ?? 'n/a'}` +
          ` ratios(depth/width) chest=${ratioOf(chestCm, chestW)?.toFixed(2) ?? 'n/a'}` +
          ` waist=${ratioOf(waistCm, waistW)?.toFixed(2) ?? 'n/a'} hip=${ratioOf(hipCm, hipW)?.toFixed(2) ?? 'n/a'}` +
          ` band=[${K.sideDepthWidthRatioMin},${K.sideDepthWidthRatioMax}]`
        );
      } else if (sideBuffered.length > 0) {
        console.log(`[MEASURE_SCAN_SIDE] frames=${sideBuffered.length} produced nothing usable — front-only fallback`);
      }
    }

    // bodyHeight is guaranteed > 0 here (scanning only starts past the height
    // gate); the ?? 0 just satisfies the type — 0 would safely return null.
    const est = keypointsToMeasurements(aggKps, bodyHeight ?? 0, {
      weightKg: bodyWeight, sex, ageYears, silhouette: widths, maskExtentU,
      sideDepthsCm: sideResult?.sideDepthsCm,
    });
    const hasAny = !!est && (
      est.body_bust != null || est.body_waist != null || est.body_hip != null ||
      est.body_inseam != null || est.body_shoulder_width != null ||
      est.body_sleeve_length != null || est.body_upper_body_length != null
    );
    if (!est || !hasAny) { setPhase('error'); return; }
    // Thread the multi-frame stability signal alongside the existing
    // per-frame confidence — additive, doesn't change any existing field.
    setPendingEstimate({ ...est, stability: cv });

    // DEV-ONLY: export the raw scan as a measure-eval fixture v2 (subjectId
    // is a placeholder — rename before dropping into
    // scripts/measure-eval/fixtures/, and fill in groundTruth with real tape
    // measurements). Never runs in a production build. See
    // scripts/measure-eval/fixtures/README.md. `side` is present only when
    // this capture actually produced a usable side result — a front-only
    // scan (SKIP was used, or the side pass wholly failed) exports a v2
    // fixture with `side` simply absent, which evaluates identically to a
    // v1 fixture.
    if (__DEV__) {
      exportScanFixture({
        subjectId: 'REPLACE_ME',
        version: 2,
        inputs: { heightCm: bodyHeight ?? 0, weightKg: bodyWeight, sex, ageYears, maskExtentU },
        keypoints: aggKps,
        silhouette: widths,
        capturePitchRad: frontCapturePitchRad,
        side: sideResult
          ? {
              keypoints: sideResult.sideAggKps,
              depthsU: sideResult.depthsU,
              maskExtentU: sideResult.maskExtentU,
              capturePitchRad: sideResult.capturePitchRad,
            }
          : undefined,
        groundTruth: {},
      }).catch(() => {});
    }

    setPhase('success');
    backTimer.current = setTimeout(() => dismiss(), 1200);
  }, [bodyHeight, bodyWeight, sex, ageYears, setPendingEstimate, dismiss]);

  // Called when the FRONT sub-phase's good-frame threshold is reached (or
  // "Capture now"/the self-timer fires while subPhase==='front'). Unlike the
  // old single-pass `finish()`, this does NOT process anything yet — the
  // front buffer stays exactly as captured until the combined `finish()` at
  // the very end, so front+side share one processing pass. It just stops
  // the front loop's countdown/timer UI and shows the 'turn' interstitial,
  // which auto-advances into the side scanning loop after
  // TURN_INTERSTITIAL_MS (see the effect below).
  const finishFront = useCallback(() => {
    scanningRef.current = false;
    if (timerRef.current) clearTimeout(timerRef.current);
    if (selfTimer.current) { clearInterval(selfTimer.current); selfTimer.current = null; }
    setTimerLeft(null);
    setCountdown(null);
    goodRef.current = 0;
    lastKpRef.current = null;
    setOverlay(null);
    setPhase('turn');
  }, []);

  // 'turn' interstitial: full-screen "turn to your side" copy, no camera
  // polling — auto-advances into the SIDE scanning sub-phase after a fixed
  // delay. SKIP (see handleSkipSide below) short-circuits this straight to
  // the combined finish(), using front data only.
  useEffect(() => {
    if (phase !== 'turn') return;
    const t = setTimeout(() => {
      setSubPhase('side');
      setOverlay(null);
      setHint('no_person');
      setPhase('scanning');
    }, TURN_INTERSTITIAL_MS);
    return () => clearTimeout(t);
  }, [phase]);

  // SKIP — during 'turn' or the SIDE scanning sub-phase, abandon the side
  // capture and finish with front data only (BMI-guessed depth fallback,
  // exactly today's pre-side-view behaviour). Simply clearing the side
  // buffer before calling the combined finish() is enough: an empty side
  // buffer is finish()'s normal, silent front-only path (see its doc
  // comment) — no separate "skip" branch needed there.
  const handleSkipSide = useCallback(() => {
    scanningRef.current = false;
    if (timerRef.current) clearTimeout(timerRef.current);
    if (selfTimer.current) { clearInterval(selfTimer.current); selfTimer.current = null; }
    setTimerLeft(null);
    setCountdown(null);
    clearSideBuffer();
    finish();
  }, [finish, clearSideBuffer]);

  // Live polling loop — active only while scanning, in EITHER sub-phase.
  // `currentSubPhase` is captured once per effect run — `subPhase` is a
  // dependency, so changing it (front → side, after the 'turn' interstitial)
  // fully restarts this effect: fresh `goodRef`/timers, no stale front-phase
  // state leaking into the side loop.
  useEffect(() => {
    if (phase !== 'scanning') return;
    scanningRef.current = true;
    goodRef.current = 0;
    const currentSubPhase = subPhase;
    const buffer = currentSubPhase === 'front' ? frameBufferRef : sideBufferRef;
    const bufferCap = currentSubPhase === 'front' ? BUFFER_SIZE : SIDE_BUFFER_SIZE;
    const clearBuffer = currentSubPhase === 'front' ? clearFrameBuffer : clearSideBuffer;
    const onGoodFramesReached = currentSubPhase === 'front' ? finishFront : finish;

    const loop = async () => {
      if (!scanningRef.current) return;
      if (busyRef.current || !cameraRef.current || !readyRef.current) {
        timerRef.current = setTimeout(loop, POLL_MS);
        return;
      }
      busyRef.current = true;
      try {
        // NOTE: do NOT pass skipProcessing:true. On many Android sensors it
        // returns a JPEG carrying an EXIF orientation flag instead of upright
        // pixels; jpeg-js (in estimateKeypoints) ignores EXIF, so MoveNet would
        // see a rotated person and never detect a valid pose. Letting the OS
        // orientation-correct the still keeps the decoded pixels upright.
        // quality 0.5 (was 0.35): sharper edges for the capture-time cropped
        // segmentation pass — still comfortably fast at the 1.2 s poll cadence.
        const pic = await cameraRef.current.takePictureAsync({ quality: 0.5 });
        if (pic?.uri) {
          const res = await estimateKeypoints(pic.uri, pic.width, pic.height);
          if (res && scanningRef.current) {
            // Push this frame into the current sub-phase's ring buffer
            // (matching lastKpRef) for the multi-frame aggregation in
            // finish(); evict+delete the oldest once it exceeds that
            // buffer's cap. Frames without a pose are deleted immediately
            // below — nothing outlives the scan. `pitchRad` stamps the
            // latest DeviceMotion reading at capture time — see
            // `BufferedFrame.pitchRad`'s doc comment.
            buffer.current.push({
              keypoints: res.keypoints, uri: pic.uri, width: pic.width, height: pic.height,
              pitchRad: betaRef.current ?? undefined,
            });
            if (buffer.current.length > bufferCap) {
              const evicted = buffer.current.shift();
              if (evicted) FileSystem.deleteAsync(evicted.uri, { idempotent: true }).catch(() => {});
            }
          } else {
            FileSystem.deleteAsync(pic.uri, { idempotent: true }).catch(() => {});
          }
          if (res && scanningRef.current) {
            const q = currentSubPhase === 'front' ? assessPose(res.keypoints) : assessSidePose(res.keypoints);
            lastKpRef.current = res.keypoints;
            // A phone tilted off-upright distorts perspective in a way pose/
            // segmentation can't correct for — even a pose the quality gate
            // otherwise likes gets treated as not-ok while tilted, with its
            // own dedicated hint (never returned by assessPose/assessSidePose
            // themselves, which have no sensor input — see poseQuality.ts).
            const tilted = q.ok && tiltedRef.current;
            setOverlay({ display: res.display, ok: q.ok && !tilted });
            setHint(tilted ? 'tilt_phone' : q.hint);
            if (__DEV__) {
              setDebugInfo(`[${currentSubPhase}] kp ${q.present} · fill ${q.frameFill.toFixed(2)}${tilted ? ' · tilted' : ''}`);
            }
            if (q.ok && !tilted) {
              goodRef.current += 1;
              const remaining = Q.goodFramesToCapture - goodRef.current;
              if (remaining <= 0) { onGoodFramesReached(); return; }
              setCountdown(remaining);
            } else {
              goodRef.current = 0;
              setCountdown(null);
            }
          } else if (scanningRef.current) {
            // Pose lost this frame — drop the cached keypoints so "Capture now"
            // can't fire on a stale pose from a few frames ago (it disables
            // until a fresh pose is detected), and clear the current
            // sub-phase's buffer — frames from before the pose was lost
            // shouldn't be aggregated with whatever comes after re-acquiring
            // the subject.
            setHint('no_person');
            goodRef.current = 0;
            setCountdown(null);
            lastKpRef.current = null;
            clearBuffer();
            setOverlay(null);
            if (__DEV__) setDebugInfo(`no pose returned by MoveNet [${currentSubPhase}]`);
          }
        }
      } catch {
        /* frame/capture error — skip this tick */
      }
      busyRef.current = false;
      if (scanningRef.current) timerRef.current = setTimeout(loop, POLL_MS);
    };

    timerRef.current = setTimeout(loop, 400);
    return () => {
      scanningRef.current = false;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [phase, subPhase, finish, finishFront, clearFrameBuffer, clearSideBuffer]);

  const handleStart = useCallback(async () => {
    if (!bodyHeight || bodyHeight <= 0) { setPhase('height_required'); return; }
    if (!permission?.granted) {
      const res = await requestPermission();
      if (!res.granted) return;
    }
    setSubPhase('front');
    setProcessProgress(null);
    clearFrameBuffer();
    clearSideBuffer();
    setOverlay(null);
    setHint('no_person');
    setCountdown(null);
    setTimerLeft(null);
    setPhase('scanning');
  }, [bodyHeight, permission, requestPermission, clearFrameBuffer, clearSideBuffer]);

  const handleCaptureNow = useCallback(() => {
    if (!lastKpRef.current) return;
    if (subPhase === 'front') finishFront(); else finish();
  }, [finish, finishFront, subPhase]);

  // 10 s self-timer: tap near the phone, walk back into frame, hands-free fire.
  // At zero it captures the freshest detected pose; if the poll never saw one,
  // fall to the 'error' phase (same copy as a failed estimate). Countdown state
  // lives in a ref; setTimerLeft only mirrors it for display — no side effects
  // inside a state updater (StrictMode double-invokes updaters).
  const selfTimerLeft = useRef(0);
  const handleSelfTimer = useCallback(() => {
    if (selfTimer.current) return;
    selfTimerLeft.current = 10;
    setTimerLeft(10);
    selfTimer.current = setInterval(() => {
      selfTimerLeft.current -= 1;
      if (selfTimerLeft.current > 0) {
        setTimerLeft(selfTimerLeft.current);
        return;
      }
      if (selfTimer.current) { clearInterval(selfTimer.current); selfTimer.current = null; }
      setTimerLeft(null);
      if (lastKpRef.current) { if (subPhase === 'front') finishFront(); else finish(); }
      else setPhase('error');
    }, 1000);
  }, [finish, finishFront, subPhase]);

  // ── Overlay mapping ─────────────────────────────────────────────────────────
  // display coords are source-image normalised (0..1). Front camera preview is
  // mirrored, so flip x for the overlay to line up with what the user sees.
  const ptX = (k: Keypoint) => (facing === 'front' ? 1 - k.x : k.x) * layout.w;
  const ptY = (k: Keypoint) => k.y * layout.h;

  const renderOverlay = () => {
    if (!overlay || layout.w === 0) return null;
    const by: Record<string, Keypoint> = {};
    for (const k of overlay.display) by[k.name] = k;
    const col = overlay.ok ? OK_COLOR : ADJ_COLOR;
    return (
      <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
        {SKELETON_EDGES.map(([a, b], i) => {
          const ka = by[a], kb = by[b];
          if (!ka || !kb || ka.score < Q.minScore || kb.score < Q.minScore) return null;
          return (
            <Line key={i} x1={ptX(ka)} y1={ptY(ka)} x2={ptX(kb)} y2={ptY(kb)}
              stroke={col} strokeWidth={3} strokeOpacity={0.85} strokeLinecap="round" />
          );
        })}
        {overlay.display.map((k, i) =>
          k.score < Q.minScore ? null : (
            <Circle key={i} cx={ptX(k)} cy={ptY(k)} r={4} fill={col} fillOpacity={0.95} />
          ),
        )}
      </Svg>
    );
  };

  // ── Height-required short-circuit ───────────────────────────────────────────
  if (phase === 'height_required') {
    return (
      <View style={[styles.msgContainer, { paddingTop: insets.top + T.s(6) }]}>
        <Pressable onPress={() => dismiss()} hitSlop={8} style={styles.closeBtn}>
          <IconX size={20} strokeWidth={1.4} color={T.color.primary} />
        </Pressable>
        <Bounded style={styles.messageBox}>
          <Text style={styles.messageText}>{t('measurementsScan_heightRequired')}</Text>
          <View style={{ height: T.s(5) }} />
          <SecondaryButton onPress={() => dismiss()}>{t('measurementsScan_backToForm')}</SecondaryButton>
        </Bounded>
      </View>
    );
  }

  // ── Permission gate ─────────────────────────────────────────────────────────
  if (!permission || !permission.granted) {
    return (
      <View style={[styles.msgContainer, { paddingTop: insets.top + T.s(6) }]}>
        <Pressable onPress={() => dismiss()} hitSlop={8} style={styles.closeBtn}>
          <IconX size={20} strokeWidth={1.4} color={T.color.primary} />
        </Pressable>
        <Bounded style={styles.messageBox}>
          <Text style={styles.h1}>{t('measurementsScan_title')}</Text>
          <Text style={[styles.caption, { marginTop: T.s(3) }]}>{t('measurementsScan_permissionMessage')}</Text>
          <Text style={[styles.caption, { marginTop: T.s(4) }]}>{t('measurementsScan_privacy')}</Text>
          <View style={{ height: T.s(6) }} />
          <PrimaryButton onPress={handleStart}>{t('measurementsScan_grant')}</PrimaryButton>
        </Bounded>
      </View>
    );
  }

  // ── Live camera ─────────────────────────────────────────────────────────────
  return (
    <View style={styles.fill}>
      <View
        style={styles.fill}
        onLayout={(e) => setLayout({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
      >
        <CameraView
          ref={cameraRef}
          style={StyleSheet.absoluteFill}
          facing={facing}
          onCameraReady={() => { readyRef.current = true; }}
        />
        {phase === 'scanning' && renderOverlay()}

        {/* Distance-readable state: a colored frame border (green = pose good,
            amber = adjust) and a giant numeral for the auto-capture countdown /
            self-timer — legible from 2-3 m away, where the hint pill is not. */}
        {phase === 'scanning' && overlay && (
          <View
            pointerEvents="none"
            style={[styles.frameBorder, { borderColor: overlay.ok ? OK_COLOR : ADJ_COLOR }]}
          />
        )}
        {phase === 'scanning' && (timerLeft ?? countdown) != null && (
          <View pointerEvents="none" style={styles.countWrap}>
            <Text style={styles.countText}>{timerLeft ?? countdown}</Text>
          </View>
        )}

        {/* Top bar */}
        <View style={[styles.topBar, { paddingTop: insets.top + T.s(2) }]}>
          <Pressable onPress={() => dismiss()} hitSlop={8} style={styles.topBtn}>
            <IconX size={20} strokeWidth={1.6} color="#fff" />
          </Pressable>
          <Pressable
            onPress={() => {
              // The camera re-initialises on a facing change; mark it not-ready
              // so the poll loop skips takePictureAsync until onCameraReady fires
              // again (a capture mid-reinit throws and drops the frame).
              readyRef.current = false;
              setFacing((f) => (f === 'back' ? 'front' : 'back'));
            }}
            hitSlop={8}
            style={styles.topBtnWide}
          >
            <Text style={styles.topBtnText}>{t('measurementsScan_flip')}</Text>
          </Pressable>
        </View>

        {/* Processing / success veil */}
        {(phase === 'processing' || phase === 'success') && (
          <View style={styles.veil}>
            {phase === 'processing'
              ? (
                <>
                  <ActivityIndicator size="large" color="#fff" />
                  {processProgress && (
                    <Text style={styles.progressText}>
                      {`${Math.min(processProgress.done, processProgress.total)}/${processProgress.total}`}
                    </Text>
                  )}
                </>
              )
              : <Text style={styles.veilText}>{t('measurementsScan_success')}</Text>}
          </View>
        )}

        {/* 'turn' interstitial: full-screen "turn to your side" copy between
            the front and side capture passes — no camera polling happens
            during this phase. */}
        {phase === 'turn' && (
          <View style={styles.veil}>
            <Text style={styles.turnTitle}>{t('measurementsScan_turnTitle')}</Text>
            <View style={{ height: T.s(3) }} />
            <Text style={styles.turnSub}>{t('measurementsScan_turnSub')}</Text>
          </View>
        )}

        {/* Bottom controls */}
        <View style={[styles.bottom, { paddingBottom: insets.bottom + T.s(5) }]}>
          <Bounded>
          {phase === 'error' && (
            <Text style={[styles.hintPill, styles.hintAdjust]}>{t('measurementsScan_lowConfidence')}</Text>
          )}
          {phase === 'scanning' && (
            <Text style={[styles.hintPill, hint === 'ok' ? styles.hintOk : styles.hintAdjust]}>
              {t(`measurementsScan_hint_${hint}`)}
            </Text>
          )}
          {(phase === 'scanning' || phase === 'processing') && __DEV__ && !!debugInfo && (
            <Text style={styles.debugText}>{debugInfo}</Text>
          )}

          {phase === 'intro' || phase === 'error' ? (
            <>
              <Text style={styles.introText}>{t('measurementsScan_liveIntro')}</Text>
              <View style={{ height: T.s(3) }} />
              <Text style={styles.privacyText}>· {t('measurementsScan_privacyShort')}</Text>
              <View style={{ height: T.s(3) }} />
              <PrimaryButton onPress={handleStart}>{t('measurementsScan_start')}</PrimaryButton>
            </>
          ) : phase === 'scanning' ? (
            <>
              <View style={styles.scanControls}>
                <Pressable
                  onPress={handleSelfTimer}
                  disabled={timerLeft != null}
                  style={[styles.captureNow, timerLeft != null && { opacity: 0.4 }]}
                >
                  <Text style={styles.captureNowText}>
                    {timerLeft != null ? `${timerLeft}s` : t('measurementsScan_timer')}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={handleCaptureNow}
                  disabled={!lastKpRef.current}
                  style={[styles.captureNow, !lastKpRef.current && { opacity: 0.4 }]}
                >
                  <Text style={styles.captureNowText}>{t('measurementsScan_captureNow')}</Text>
                </Pressable>
              </View>
              {subPhase === 'side' && (
                <>
                  <View style={{ height: T.s(3) }} />
                  <Pressable onPress={handleSkipSide} style={styles.skipPill}>
                    <Text style={styles.skipPillText}>{t('measurementsScan_skipSide')}</Text>
                  </Pressable>
                </>
              )}
            </>
          ) : phase === 'turn' ? (
            <Pressable onPress={handleSkipSide} style={styles.skipPill}>
              <Text style={styles.skipPillText}>{t('measurementsScan_skipSide')}</Text>
            </Pressable>
          ) : null}
          </Bounded>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: '#000' },
  msgContainer: { flex: 1, backgroundColor: T.color.canvas, paddingHorizontal: T.s(6) },
  closeBtn: { alignSelf: 'flex-end', width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  messageBox: { flex: 1, justifyContent: 'center' },
  messageText: { ...type.body, color: T.color.secondary, textAlign: 'center', lineHeight: 22 },
  h1: { ...type.h1, color: T.color.primary, textAlign: 'center' },
  caption: { ...type.caption, color: T.color.secondary, textAlign: 'center' },

  topBar: {
    position: 'absolute', top: 0, left: 0, right: 0,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: T.s(4),
  },
  topBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  topBtnWide: { height: 44, paddingHorizontal: T.s(3), alignItems: 'center', justifyContent: 'center' },
  topBtnText: { ...type.ui, fontSize: 11, color: '#fff' },

  veil: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' },
  veilText: { ...type.body, color: '#fff', textAlign: 'center', paddingHorizontal: T.s(8) },
  // "x/y frames processed" — small, muted, sits just under the spinner.
  progressText: { ...type.caption, fontSize: 12, color: 'rgba(255,255,255,0.75)', marginTop: T.s(3) },
  // 'turn' interstitial — same serif family as the giant countdown numeral
  // (countText below), at a body-copy scale rather than billboard scale.
  turnTitle: {
    fontFamily: T.font.serif, fontSize: 30, fontWeight: '300',
    color: '#fff', textAlign: 'center', paddingHorizontal: T.s(8),
  },
  turnSub: { ...type.caption, fontSize: 13, color: 'rgba(255,255,255,0.75)', textAlign: 'center', paddingHorizontal: T.s(8) },
  skipPill: {
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.6)', borderRadius: 999,
    paddingVertical: T.s(2), paddingHorizontal: T.s(6),
  },
  skipPillText: { ...type.ui, fontSize: 11, color: 'rgba(255,255,255,0.85)' },

  bottom: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: T.s(6), alignItems: 'center' },
  hintPill: {
    ...type.ui, fontSize: 15, overflow: 'hidden',
    paddingVertical: T.s(2), paddingHorizontal: T.s(4), borderRadius: 999,
    marginBottom: T.s(4), textAlign: 'center',
  },
  frameBorder: { ...StyleSheet.absoluteFillObject, borderWidth: 4 },
  countWrap: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  countText: {
    fontFamily: T.font.serif, fontSize: 148, fontWeight: '200',
    color: 'rgba(255,255,255,0.92)',
  },
  scanControls: { flexDirection: 'row', gap: 12 },
  debugText: { ...type.ui, fontSize: 10, color: 'rgba(255,255,255,0.7)', marginBottom: T.s(2) },
  hintOk: { backgroundColor: 'rgba(91,138,107,0.92)', color: '#fff' },
  hintAdjust: { backgroundColor: 'rgba(194,133,59,0.92)', color: '#fff' },
  introText: { ...type.caption, fontSize: 12, color: '#fff', textAlign: 'center', lineHeight: 18, paddingHorizontal: T.s(2) },
  privacyText: { ...type.caption, fontSize: 11, color: 'rgba(255,255,255,0.7)', textAlign: 'center', lineHeight: 16, paddingHorizontal: T.s(2) },
  captureNow: {
    borderWidth: 1, borderColor: '#fff', borderRadius: 999,
    paddingVertical: T.s(3), paddingHorizontal: T.s(8),
  },
  captureNowText: { ...type.ui, fontSize: 12, color: '#fff' },
});
