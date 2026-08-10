import { useState, useCallback, useRef, useMemo } from 'react';
import {
  scorePersonalColorDetailed,
  type PersonalColorResult,
  type SkinOption,
  type EyeOption,
  type MetalOption,
} from './colorSeasonData';
import { applyDrapePick, nudgeTowardTone, type ToneAxes, type DrapeAxis, type ColorTone12 } from './tone12';
import { classifyUndertone, type LAB } from './colorMath';
import { useAuthStore } from '../../stores/authStore';
import { analyzeWristUndertone, analyzeFace } from './analyzePhoto';

// ─── Step types ────────────────────────────────────────────────────────────

export type DetectionStep =
  | 'intro'
  | 'prepare'      // camera path only — one-tap "before we shoot" checklist
  | 'face-scan'    // camera path only — primary skin + hair read
  | 'wrist-scan'   // camera path only — secondary undertone site
  | 'skin'         // manual path, or camera-path fallback when neither scan landed
  | 'hair'         // manual path, or camera-path fallback when the face scan's hair read didn't land
  | 'eye'          // manual path only
  | 'metal'        // manual path only
  | 'result';

// Manual path is a fixed, linear sequence. The camera path is NOT — after
// wrist-scan it branches straight to result (skin/hair auto-detected), or via
// whichever fallback question(s) are needed when a read didn't land. Eye/metal
// are optional refinements available on the result screen, not camera-path
// steps. See `next()` / `setCameraPhoto`.
const MANUAL_STEPS: DetectionStep[] = ['intro', 'skin', 'hair', 'eye', 'metal', 'result'];

// ─── State ─────────────────────────────────────────────────────────────────

interface DetectionState {
  path: 'camera' | 'manual' | null;
  step: DetectionStep;
  /** Steps already visited, most-recent last (excludes the current step).
   *  Lets `back()` retrace the camera path's branching fallback questions
   *  without needing a fixed step array. */
  history: DetectionStep[];
  /** The flash-frame selfie from the face scan — shown as the reference
   *  thumbnail on both the skin and hair fallback steps, since both now
   *  derive from this one photo (face is the primary skin site; hair comes
   *  from the same frame's hairBand). */
  facePhotoUri: string | null;
  wristPhotoUri: string | null;
  skinUndertone: SkinOption['key'] | null;
  hairKey: string | null;
  eyeKey: EyeOption['key'] | null;
  metalKey: MetalOption['key'] | null;
  saving: boolean;
  error: string | null;
  /** A face/wrist photo is being analysed on-device. */
  analyzing: boolean;
  /** The current skin / hair answer was auto-detected from a photo (UI hint;
   *  cleared when the user picks manually). */
  autoSkin: boolean;
  autoHair: boolean;
  /** False when the on-device analysis flagged its own read as low-confidence
   *  (e.g. too few skin pixels, or two hair swatches nearly tied) — the result
   *  screen shows a subtle "double-check" hint on that row. Reset to true on
   *  a manual pick, since a conscious choice needs no double-checking. */
  skinConfident: boolean;
  hairConfident: boolean;
  /** Continuous photo metrics from the camera path (null on the manual path,
   *  or when a scan failed) — feed the 12-tone axes model alongside the
   *  discrete quiz-option keys above. `skinLab`/`skinHueDeg` are face-primary,
   *  falling back to the wrist read when the face scan didn't land one (see
   *  `combineSkinReads`). `hairLab` is face-only (v3 removed the dedicated
   *  hair-scan step — see plan.md Phase A entry). */
  skinLab: LAB | null;
  hairLab: LAB | null;
  skinHueDeg: number | null;
  /** Screen-flash SNR / sclera-correction flags from the face scan — surfaced
   *  for debugging/telemetry-shaped UI later; not currently rendered. */
  faceSnrOk: boolean;
  faceScleraCorrected: boolean;
  /** Accumulated colour-drape ("which looks better") adjustments, applied on
   *  top of the quiz/photo-derived axes. */
  drape: Partial<ToneAxes>;
}

type FaceAnalysis = Awaited<ReturnType<typeof analyzeFace>>;
type WristAnalysis = { key: SkinOption['key']; confident: boolean; skinLab: LAB | null; hueDeg: number | null } | null;

interface SkinRead {
  key: SkinOption['key'];
  confident: boolean;
  skinLab: LAB | null;
  hueDeg: number | null;
}

// Reconcile a face read (primary site) with a wrist read (secondary site):
// agreement on the undertone key is a strong signal regardless of either
// read's own margin; disagreement keeps the FACE read (the primary,
// makeup-affected-but-larger-sample site) but marks it low-confidence so the
// result screen's double-check hint surfaces. Falls back to whichever site
// read successfully when the other failed outright. Renamed/adapted from v2's
// `combineWristReads` (which reconciled a flash-vs-ambient pair of the SAME
// site) — v3 moved that reconciliation inside `analyzeWristUndertone` itself
// (see its `ambientUri` param) now that the wrist is the secondary site.
function combineSkinReads(face: SkinRead | null, wrist: SkinRead | null): SkinRead | null {
  if (!face) return wrist;
  if (!wrist) return face;
  return face.key === wrist.key ? { ...face, confident: true } : { ...face, confident: false };
}

function skinReadFromFace(face: FaceAnalysis): SkinRead | null {
  if (!face || !face.skinLab) return null;
  return {
    key: classifyUndertone(face.skinLab),
    confident: face.skinConfident,
    skinLab: face.skinLab,
    hueDeg: face.hueDeg,
  };
}

function skinReadFromWrist(wrist: WristAnalysis): SkinRead | null {
  if (!wrist) return null;
  return { key: wrist.key, confident: wrist.confident, skinLab: wrist.skinLab, hueDeg: wrist.hueDeg };
}

// ─── Hook ──────────────────────────────────────────────────────────────────

export function usePersonalColorDetection() {
  const savePersonalColor = useAuthStore(s => s.savePersonalColor);

  const [state, setState] = useState<DetectionState>({
    path: null,
    step: 'intro',
    history: [],
    facePhotoUri: null,
    wristPhotoUri: null,
    skinUndertone: null,
    hairKey: null,
    eyeKey: null,
    metalKey: null,
    saving: false,
    error: null,
    analyzing: false,
    autoSkin: false,
    autoHair: false,
    skinConfident: true,
    hairConfident: true,
    skinLab: null,
    hairLab: null,
    skinHueDeg: null,
    faceSnrOk: false,
    faceScleraCorrected: false,
    drape: {},
  });

  // Holds the in-flight (or already-settled) face analysis promise so the
  // wrist capture can await it too — both must settle before we know whether
  // a fallback question step is needed next.
  const faceAnalysisRef = useRef<Promise<FaceAnalysis> | null>(null);

  // ── Path selection ──────────────────────────────────────────────────────

  const startCameraPath = useCallback(() => {
    // UX-simplify (2026-08-06): camera path now stops at a one-tap "prepare"
    // checklist before the first camera opens — see `next()`'s 'prepare' case
    // for the tap that advances to 'face-scan'.
    setState(s => ({ ...s, path: 'camera', step: 'prepare', history: [...s.history, s.step] }));
  }, []);

  const startManualPath = useCallback(() => {
    setState(s => ({ ...s, path: 'manual', step: 'skin', history: [...s.history, s.step] }));
  }, []);

  // ── Camera captures ─────────────────────────────────────────────────────

  const setCameraPhoto = useCallback((type: 'face' | 'wrist', uri: string, ambientUri?: string) => {
    if (type === 'face') {
      // Advance to the wrist scan immediately — the result should come right
      // after both scans, not gate on this one finishing (analysis in flight).
      setState(s => ({ ...s, facePhotoUri: uri, step: 'wrist-scan', history: [...s.history, s.step] }));

      const promise = analyzeFace(uri, ambientUri ?? null).catch((): FaceAnalysis => null);
      faceAnalysisRef.current = promise;
      return;
    }

    // type === 'wrist' — stay on 'wrist-scan' (the screen shows a spinner
    // over the live camera) until we know whether a fallback question is
    // needed. This mirrors v2's hair-scan gating point, just moved to the
    // last scan step now that hair is read from the face photo instead of a
    // dedicated hair-scan step.
    setState(s => ({ ...s, wristPhotoUri: uri, analyzing: true }));

    const wristPromise = analyzeWristUndertone(uri, ambientUri ?? null).catch((): WristAnalysis => null);
    const facePromise = faceAnalysisRef.current ?? Promise.resolve<FaceAnalysis>(null);

    Promise.all([facePromise, wristPromise]).then(([faceRes, wristRes]) => {
      setState(s => {
        // The user may have navigated away (back()) while the analyses were in
        // flight. If they backed all the way to intro the path resets to null
        // (and could even be a restarted manual quiz) — don't merge camera
        // answers into it, just clear the analyzing flag.
        if (s.path !== 'camera') return { ...s, analyzing: false };

        const combined = s.skinUndertone == null
          ? combineSkinReads(skinReadFromFace(faceRes), skinReadFromWrist(wristRes))
          : null;
        const skinUndertone = s.skinUndertone ?? combined?.key ?? null;
        const autoSkin = s.skinUndertone == null && !!combined ? true : s.autoSkin;
        const skinConfident = s.skinUndertone == null && combined ? combined.confident : s.skinConfident;
        const skinLab = s.skinUndertone == null && combined ? combined.skinLab : s.skinLab;
        const skinHueDeg = s.skinUndertone == null && combined ? combined.hueDeg : s.skinHueDeg;

        const hairKey = s.hairKey ?? faceRes?.hairKey ?? null;
        const autoHair = s.hairKey == null && !!faceRes?.hairKey ? true : s.autoHair;
        const hairConfident = s.hairKey == null && faceRes?.hairKey ? faceRes.hairConfident : s.hairConfident;
        const hairLab = s.hairKey == null && faceRes?.hairKey ? faceRes.hairLab : s.hairLab;

        const faceSnrOk = faceRes?.snrOk ?? s.faceSnrOk;
        const faceScleraCorrected = faceRes?.scleraCorrected ?? s.faceScleraCorrected;

        // Only auto-advance while still waiting on 'wrist-scan' — a late
        // resolution must never yank the user off a screen they backed to.
        const advance = s.step === 'wrist-scan';
        const nextStep: DetectionStep =
          skinUndertone == null ? 'skin' : hairKey == null ? 'hair' : 'result';

        return {
          ...s,
          skinUndertone, autoSkin, skinConfident, skinLab, skinHueDeg,
          hairKey, autoHair, hairConfident, hairLab,
          faceSnrOk, faceScleraCorrected,
          step: advance ? nextStep : s.step,
          history: advance ? [...s.history, s.step] : s.history,
          analyzing: false,
        };
      });
    });
  }, []);

  // ── Answer setters (a manual pick clears the "auto-detected" flag and is
  //     inherently confident — nothing to double-check on a conscious pick) ──

  const setSkin  = useCallback((key: SkinOption['key']) => setState(s => ({ ...s, skinUndertone: key, autoSkin: false, skinConfident: true })), []);
  const setHair  = useCallback((key: string)             => setState(s => ({ ...s, hairKey: key, autoHair: false, hairConfident: true })), []);
  const setEye   = useCallback((key: EyeOption['key'])   => setState(s => ({ ...s, eyeKey: key })), []);
  const setMetal = useCallback((key: MetalOption['key']) => setState(s => ({ ...s, metalKey: key })), []);

  // ── Colour-drape refinement ("which looks better" picks on the result
  //     screen) — nudges the axes model directly, on top of the quiz/photo-
  //     derived signal. ──────────────────────────────────────────────────────

  const applyDrape = useCallback((axis: DrapeAxis, direction: 1 | -1) => {
    setState(s => ({ ...s, drape: applyDrapePick(s.drape, axis, direction) }));
  }, []);

  const resetDrape = useCallback(() => {
    setState(s => ({ ...s, drape: {} }));
  }, []);

  // Round 5 of DrapeSession ("gold vs silver lamé") both nudges warmth like
  // any other round AND reports a metal preference — but must never clobber
  // an existing manual metal answer (the guard lives here, not in
  // DrapeSession, since only the hook knows the current `metalKey`).
  const applyDrapeMetal = useCallback((metal: 'gold' | 'silver') => {
    setState(s => ({
      ...s,
      drape: applyDrapePick(s.drape, 'warmth', metal === 'gold' ? 1 : -1),
      metalKey: s.metalKey ?? metal,
    }));
  }, []);

  // The 12-tone grid compare (DrapeSession's "SEE ALL 12 TONES" phase) picks
  // a challenger tone directly rather than an axis+direction — nudges the
  // drape axes toward it via `nudgeTowardTone` (tone12.ts), reusing the same
  // `applyDrapePick` step size as an ordinary round pick.
  const nudgeDrapeToward = useCallback((from: ColorTone12, to: ColorTone12) => {
    setState(s => ({ ...s, drape: nudgeTowardTone(s.drape, from, to) }));
  }, []);

  // ── Navigation ──────────────────────────────────────────────────────────

  const next = useCallback(() => {
    setState(s => {
      if (s.path === 'manual') {
        const idx = MANUAL_STEPS.indexOf(s.step);
        const nextStep = MANUAL_STEPS[idx + 1] as DetectionStep | undefined;
        if (!nextStep) return s;
        return { ...s, step: nextStep, history: [...s.history, s.step] };
      }

      // Camera path: `next()` fires from the one-tap 'prepare' checklist
      // (advances to 'face-scan') and from the two fallback question steps —
      // face/wrist-scan otherwise advance themselves via setCameraPhoto, and
      // result has nowhere further to go.
      if (s.step === 'prepare') {
        return { ...s, step: 'face-scan', history: [...s.history, s.step] };
      }
      if (s.step === 'skin') {
        return { ...s, step: s.hairKey == null ? 'hair' : 'result', history: [...s.history, s.step] };
      }
      if (s.step === 'hair') {
        return { ...s, step: 'result', history: [...s.history, s.step] };
      }
      return s;
    });
  }, []);

  const back = useCallback(() => {
    setState(s => {
      const history = [...s.history];
      const prev = history.pop();
      if (!prev) return s;
      // Stepping back to intro resets the path choice.
      if (prev === 'intro') return { ...s, step: 'intro', path: null, history };
      return { ...s, step: prev, history };
    });
  }, []);

  const canAdvance = useCallback((): boolean => {
    switch (state.step) {
      case 'intro':      return false;
      case 'prepare':    return true;  // single-tap "I'M READY" CTA, no data gate
      case 'face-scan':  return false; // advanced by setCameraPhoto
      case 'wrist-scan': return false;
      case 'skin':       return state.skinUndertone !== null;
      case 'hair':       return state.hairKey !== null;
      case 'eye':        return state.eyeKey !== null;
      case 'metal':      return state.metalKey !== null;
      case 'result':     return false;
    }
  }, [state]);

  // ── Result (derived, not stored — recomputes live as answers change on the
  //     result screen; skin + hair are the minimum, eye/metal only refine) ──

  const result = useMemo<PersonalColorResult | null>(() => {
    if (state.skinUndertone == null || state.hairKey == null) return null;
    return scorePersonalColorDetailed({
      skinUndertone: state.skinUndertone,
      hairKey: state.hairKey,
      eyeKey: state.eyeKey ?? undefined,
      metalKey: state.metalKey ?? undefined,
      skinLab: state.skinLab,
      hairLab: state.hairLab,
      skinHueDeg: state.skinHueDeg,
      drape: state.drape,
    });
  }, [
    state.skinUndertone, state.hairKey, state.eyeKey, state.metalKey,
    state.skinLab, state.hairLab, state.skinHueDeg, state.drape,
  ]);

  // ── Save ────────────────────────────────────────────────────────────────

  const save = useCallback(async (): Promise<boolean> => {
    if (!result) return false;
    setState(s => ({ ...s, saving: true, error: null }));
    try {
      await savePersonalColor({ season: result.season, palette: result.palette, tone12: result.tone12 });
      setState(s => ({ ...s, saving: false }));
      return true;
    } catch (err) {
      setState(s => ({ ...s, saving: false, error: err instanceof Error ? err.message : 'Failed to save' }));
      return false;
    }
  }, [result, savePersonalColor]);

  // ── Step progress (excludes intro + result + camera-only scan steps from
  //     dots; screens only render dots on the manual path) ─────────────────

  const questionSteps: DetectionStep[] = ['skin', 'hair', 'eye', 'metal'];
  const stepIndex = questionSteps.indexOf(state.step); // -1 when on intro/scan/result

  return {
    path:           state.path,
    step:           state.step,
    facePhotoUri:   state.facePhotoUri,
    wristPhotoUri:  state.wristPhotoUri,
    skinUndertone:  state.skinUndertone,
    hairKey:        state.hairKey,
    eyeKey:         state.eyeKey,
    metalKey:       state.metalKey,
    result,
    saving:         state.saving,
    error:          state.error,
    analyzing:      state.analyzing,
    autoSkin:       state.autoSkin,
    autoHair:       state.autoHair,
    skinConfident:  state.skinConfident,
    hairConfident:  state.hairConfident,
    drape:          state.drape,
    startCameraPath,
    startManualPath,
    setCameraPhoto,
    setSkin,
    setHair,
    setEye,
    setMetal,
    applyDrape,
    resetDrape,
    applyDrapeMetal,
    nudgeDrapeToward,
    next,
    back,
    canAdvance,
    save,
    stepIndex,      // 0–3 for question steps, -1 otherwise
  };
}
