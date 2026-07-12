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
// retained (a small ring buffer) only until capture, when the silhouette pass
// reads each of them once and every buffered frame is deleted (see finish()).
// Nothing is uploaded or persisted.
//
// ACCURACY: capture no longer trusts a single frame. Up to BUFFER_SIZE good
// frames are median-aggregated (see aggregateFrames.ts) — this is a variance
// reduction only (no bias shift): the median of several independent samples
// of the same pose cancels per-frame detector jitter without moving the
// expected value.
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
import Svg, { Line, Circle } from 'react-native-svg';
import { T, type } from '../src/design/tokens';
import { PrimaryButton, SecondaryButton } from '../src/components/ui';
import { IconX } from '../src/components/icons';
import { useFitEngineStore } from '../src/stores/fitEngineStore';
import { useAuthStore } from '../src/stores/authStore';
import { estimateKeypoints, type Keypoint } from '../src/features/measurements/poseEstimate';
import { estimateSilhouette, extractWidths, type SilhouetteWidths } from '../src/features/measurements/silhouette';
import { keypointsToMeasurements, type Sex } from '../src/features/measurements/landmarksToMeasurements';
import { exportScanFixture } from '../src/features/measurements/scanExport';
import { medianKeypoints, medianWidths, scaleAgreement, rejectOutlierFrames } from '../src/features/measurements/aggregateFrames';
import { assessPose, SKELETON_EDGES, Q, type PoseHint } from '../src/features/measurements/poseQuality';
import { useTranslation } from '../src/i18n';

type ScanPhase = 'intro' | 'scanning' | 'processing' | 'success' | 'height_required' | 'error';

const POLL_MS = 1200;
const OK_COLOR = '#5B8A6B';   // muted green — pose good
const ADJ_COLOR = '#C2853B';  // muted amber — needs adjusting
// Ring-buffer capacity for multi-frame median aggregation (aggregateFrames.ts).
const BUFFER_SIZE = 3;

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
  const [overlay, setOverlay] = useState<{ display: Keypoint[]; ok: boolean } | null>(null);
  const [hint, setHint] = useState<PoseHint>('no_person');
  const [layout, setLayout] = useState({ w: 0, h: 0 });
  // Giant distance-readable feedback: remaining good frames before auto-capture
  // (2…1) and the 10 s self-timer. Both render as a full-screen numeral so the
  // user never has to walk up to the phone to read state.
  const [countdown, setCountdown] = useState<number | null>(null);
  const [timerLeft, setTimerLeft] = useState<number | null>(null);
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
  // temp photo uri), retained so finish() can median-aggregate across several
  // independent samples instead of trusting a single frame. Each uri is
  // deleted as soon as it is evicted, consumed by finish(), or the scan ends.
  const frameBufferRef = useRef<{ keypoints: Keypoint[]; uri: string }[]>([]);

  const clearFrameBuffer = useCallback(() => {
    for (const f of frameBufferRef.current) {
      FileSystem.deleteAsync(f.uri, { idempotent: true }).catch(() => {});
    }
    frameBufferRef.current = [];
  }, []);

  useEffect(() => () => {
    scanningRef.current = false;
    if (timerRef.current) clearTimeout(timerRef.current);
    if (backTimer.current) clearTimeout(backTimer.current);
    if (selfTimer.current) clearInterval(selfTimer.current);
    clearFrameBuffer();
  }, [clearFrameBuffer]);

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
  // Async: after freezing the UI into 'processing' it runs outlier rejection,
  // then median-aggregates keypoints across the surviving frames, then runs
  // the person-segmentation model on EACH buffered frame — contour widths
  // replace the keypoint-span heuristics for shoulder/chest/waist/hip
  // (silhouette.ts) — and medians the per-frame widths too. This is variance
  // reduction only: median aggregation narrows per-frame noise without
  // shifting the expected value (see aggregateFrames.ts). Segmentation
  // failing on some/all frames degrades silently (per-frame, then to the
  // keypoint-only estimate if every frame fails).
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

    // Snapshot + clear the buffer immediately so no other in-flight call can
    // race on the same frames (all three capture paths funnel through here).
    const buffered = frameBufferRef.current;
    frameBufferRef.current = [];
    if (buffered.length === 0) { setPhase('error'); return; }
    setPhase('processing');

    // Outlier rejection: drop any frame whose apparent scale (nose→ankle span)
    // disagrees with the rest — a single foreshortened/mis-detected frame
    // would otherwise pollute the median. scaleAgreement is an HONEST
    // stability signal (distinct from per-frame keypoint confidence): it
    // reflects whether the frames agree on scale, not just whether the
    // detector was confident about a joint.
    const rawFrames = buffered.map((b) => b.keypoints);
    const frames = rejectOutlierFrames(rawFrames);
    const cv = scaleAgreement(frames);
    const aggKps = medianKeypoints(frames);
    if (__DEV__) {
      setDebugInfo((prev) => `${prev} · agree ${(cv * 100).toFixed(1)}%`);
      console.log(`[MEASURE_SCAN] frames=${buffered.length} kept=${frames.length} scaleAgreementCV=${cv.toFixed(4)}`);
    }

    // Silhouette pass on EACH buffered frame — band placement uses the
    // steadier aggregated keypoints, widths are medianed across frames below.
    const collectedWidths: (SilhouetteWidths | null)[] = [];
    for (const b of buffered) {
      try {
        const mask = await estimateSilhouette(b.uri);
        collectedWidths.push(mask ? (extractWidths(mask, aggKps) ?? null) : null);
      } catch {
        collectedWidths.push(null);
      } finally {
        // PRIVACY: each buffered frame is deleted as soon as segmentation ran.
        FileSystem.deleteAsync(b.uri, { idempotent: true }).catch(() => {});
      }
    }
    const mergedWidths = medianWidths(collectedWidths);
    const widths: SilhouetteWidths | undefined =
      Object.keys(mergedWidths).length > 0 ? mergedWidths : undefined;

    // bodyHeight is guaranteed > 0 here (scanning only starts past the height
    // gate); the ?? 0 just satisfies the type — 0 would safely return null.
    const est = keypointsToMeasurements(aggKps, bodyHeight ?? 0, {
      weightKg: bodyWeight, sex, ageYears, silhouette: widths,
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

    // DEV-ONLY: export the raw scan as a measure-eval fixture (subjectId is a
    // placeholder — rename before dropping into scripts/measure-eval/fixtures/,
    // and fill in groundTruth with real tape measurements). Never runs in a
    // production build. See scripts/measure-eval/fixtures/README.md.
    if (__DEV__) {
      exportScanFixture({
        subjectId: 'REPLACE_ME',
        inputs: { heightCm: bodyHeight ?? 0, weightKg: bodyWeight, sex, ageYears },
        keypoints: aggKps,
        silhouette: widths,
        groundTruth: {},
      }).catch(() => {});
    }

    setPhase('success');
    backTimer.current = setTimeout(() => dismiss(), 1200);
  }, [bodyHeight, bodyWeight, sex, ageYears, setPendingEstimate, dismiss]);

  // Live polling loop — active only while scanning.
  useEffect(() => {
    if (phase !== 'scanning') return;
    scanningRef.current = true;
    goodRef.current = 0;

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
        const pic = await cameraRef.current.takePictureAsync({ quality: 0.35 });
        if (pic?.uri) {
          const res = await estimateKeypoints(pic.uri, pic.width, pic.height);
          if (res && scanningRef.current) {
            // Push this frame into the ring buffer (matching lastKpRef) for
            // the multi-frame aggregation in finish(); evict+delete the
            // oldest once it exceeds BUFFER_SIZE. Frames without a pose are
            // deleted immediately below — nothing outlives the scan.
            frameBufferRef.current.push({ keypoints: res.keypoints, uri: pic.uri });
            if (frameBufferRef.current.length > BUFFER_SIZE) {
              const evicted = frameBufferRef.current.shift();
              if (evicted) FileSystem.deleteAsync(evicted.uri, { idempotent: true }).catch(() => {});
            }
          } else {
            FileSystem.deleteAsync(pic.uri, { idempotent: true }).catch(() => {});
          }
          if (res && scanningRef.current) {
            const q = assessPose(res.keypoints);
            lastKpRef.current = res.keypoints;
            setOverlay({ display: res.display, ok: q.ok });
            setHint(q.hint);
            if (__DEV__) {
              setDebugInfo(`kp ${q.present}/7${q.missing.length ? ` · missing ${q.missing.join(',')}` : ''} · fill ${q.frameFill.toFixed(2)}`);
            }
            if (q.ok) {
              goodRef.current += 1;
              const remaining = Q.goodFramesToCapture - goodRef.current;
              if (remaining <= 0) { finish(); return; }
              setCountdown(remaining);
            } else {
              goodRef.current = 0;
              setCountdown(null);
            }
          } else if (scanningRef.current) {
            // Pose lost this frame — drop the cached keypoints so "Capture now"
            // can't fire on a stale pose from a few frames ago (it disables
            // until a fresh pose is detected), and clear the whole buffer —
            // frames from before the pose was lost shouldn't be aggregated
            // with whatever comes after re-acquiring the subject.
            setHint('no_person');
            goodRef.current = 0;
            setCountdown(null);
            lastKpRef.current = null;
            clearFrameBuffer();
            setOverlay(null);
            if (__DEV__) setDebugInfo('no pose returned by MoveNet');
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
  }, [phase, finish, clearFrameBuffer]);

  const handleStart = useCallback(async () => {
    if (!bodyHeight || bodyHeight <= 0) { setPhase('height_required'); return; }
    if (!permission?.granted) {
      const res = await requestPermission();
      if (!res.granted) return;
    }
    setOverlay(null);
    setHint('no_person');
    setCountdown(null);
    setTimerLeft(null);
    setPhase('scanning');
  }, [bodyHeight, permission, requestPermission]);

  const handleCaptureNow = useCallback(() => {
    if (lastKpRef.current) finish();
  }, [finish]);

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
      if (lastKpRef.current) finish();
      else setPhase('error');
    }, 1000);
  }, [finish]);

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
        <View style={styles.messageBox}>
          <Text style={styles.messageText}>{t('measurementsScan_heightRequired')}</Text>
          <View style={{ height: T.s(5) }} />
          <SecondaryButton onPress={() => dismiss()}>{t('measurementsScan_backToForm')}</SecondaryButton>
        </View>
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
        <View style={styles.messageBox}>
          <Text style={styles.h1}>{t('measurementsScan_title')}</Text>
          <Text style={[styles.caption, { marginTop: T.s(3) }]}>{t('measurementsScan_permissionMessage')}</Text>
          <Text style={[styles.caption, { marginTop: T.s(4) }]}>{t('measurementsScan_privacy')}</Text>
          <View style={{ height: T.s(6) }} />
          <PrimaryButton onPress={handleStart}>{t('measurementsScan_grant')}</PrimaryButton>
        </View>
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
              ? <ActivityIndicator size="large" color="#fff" />
              : <Text style={styles.veilText}>{t('measurementsScan_success')}</Text>}
          </View>
        )}

        {/* Bottom controls */}
        <View style={[styles.bottom, { paddingBottom: insets.bottom + T.s(5) }]}>
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
          ) : null}
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
