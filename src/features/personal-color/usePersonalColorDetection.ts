import { useState, useCallback, useRef, useMemo } from 'react';
import {
  scorePersonalColorDetailed,
  type PersonalColorResult,
  type SkinOption,
  type EyeOption,
  type MetalOption,
} from './colorSeasonData';
import { applyDrapePick, type ToneAxes, type DrapeAxis } from './tone12';
import type { LAB } from './colorMath';
import { useAuthStore } from '../../stores/authStore';
import { analyzeWristUndertone, analyzeHairColor } from './analyzePhoto';

// ─── Step types ────────────────────────────────────────────────────────────

export type DetectionStep =
  | 'intro'
  | 'wrist-scan'   // camera path only
  | 'hair-scan'    // camera path only
  | 'skin'         // manual path, or camera-path fallback when the wrist scan didn't land
  | 'hair'         // manual path, or camera-path fallback when the hair scan didn't land
  | 'eye'          // manual path only
  | 'metal'        // manual path only
  | 'result';

// Manual path is a fixed, linear sequence. The camera path is NOT — after
// hair-scan it branches straight to result (skin/hair auto-detected), or via
// whichever fallback question(s) are needed when a scan didn't land. Eye/metal
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
  wristPhotoUri: string | null;
  hairPhotoUri: string | null;
  skinUndertone: SkinOption['key'] | null;
  hairKey: string | null;
  eyeKey: EyeOption['key'] | null;
  metalKey: MetalOption['key'] | null;
  saving: boolean;
  error: string | null;
  /** A wrist/hair photo is being analysed on-device. */
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
   *  discrete quiz-option keys above. */
  skinLab: LAB | null;
  hairLab: LAB | null;
  wristHueDeg: number | null;
  /** Accumulated colour-drape ("which looks better") adjustments, applied on
   *  top of the quiz/photo-derived axes. */
  drape: Partial<ToneAxes>;
}

type WristAnalysis = { key: SkinOption['key']; confident: boolean; skinLab: LAB | null; hueDeg: number | null } | null;
type HairAnalysis = { key: string; confident: boolean; hairLab: LAB | null } | null;

// Reconcile a flash-on + flash-off (ambient) wrist read: agreement on the
// undertone key is a strong signal regardless of either shot's own margin;
// disagreement keeps the flash read (the controlled light source) but marks
// it low-confidence. Falls back to whichever shot analysed successfully when
// the other failed outright.
function combineWristReads(flash: WristAnalysis, ambient: WristAnalysis): WristAnalysis {
  if (!flash) return ambient;
  if (!ambient) return flash;
  return flash.key === ambient.key ? { ...flash, confident: true } : { ...flash, confident: false };
}

// ─── Hook ──────────────────────────────────────────────────────────────────

export function usePersonalColorDetection() {
  const savePersonalColor = useAuthStore(s => s.savePersonalColor);

  const [state, setState] = useState<DetectionState>({
    path: null,
    step: 'intro',
    history: [],
    wristPhotoUri: null,
    hairPhotoUri: null,
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
    wristHueDeg: null,
    drape: {},
  });

  // Holds the in-flight (or already-settled) wrist analysis promise so the
  // hair capture can await it too — both must settle before we know whether a
  // fallback question step is needed next.
  const wristAnalysisRef = useRef<Promise<WristAnalysis> | null>(null);

  // ── Path selection ──────────────────────────────────────────────────────

  const startCameraPath = useCallback(() => {
    setState(s => ({ ...s, path: 'camera', step: 'wrist-scan', history: [...s.history, s.step] }));
  }, []);

  const startManualPath = useCallback(() => {
    setState(s => ({ ...s, path: 'manual', step: 'skin', history: [...s.history, s.step] }));
  }, []);

  // ── Camera captures ─────────────────────────────────────────────────────

  const setCameraPhoto = useCallback((type: 'wrist' | 'hair', uri: string, ambientUri?: string) => {
    if (type === 'wrist') {
      // Advance to the hair scan immediately — the result should come right
      // after both scans, not gate on this one finishing.
      setState(s => ({ ...s, wristPhotoUri: uri, step: 'hair-scan', history: [...s.history, s.step] }));

      // Dual-flash ambient-light cancellation: when a second (torch-off) shot
      // is supplied, analyse both and reconcile — a flash/ambient agreement
      // is a strong confident read regardless of either shot's own margin; a
      // disagreement keeps the flash read (closer to a controlled light
      // source) but flags it low-confidence for the result screen's
      // double-check hint. Single-uri behaviour (no ambientUri) is unchanged.
      const promise = ambientUri
        ? Promise.all([
            analyzeWristUndertone(uri).catch((): WristAnalysis => null),
            analyzeWristUndertone(ambientUri).catch((): WristAnalysis => null),
          ]).then(([flash, ambient]) => combineWristReads(flash, ambient))
        : analyzeWristUndertone(uri).catch((): WristAnalysis => null);
      wristAnalysisRef.current = promise;
      // Fill the skin answer as soon as the wrist read lands, independent of
      // the hair scan — never clobber a manual pick.
      promise.then(res => {
        if (!res) return;
        setState(s => (s.skinUndertone == null
          ? { ...s, skinUndertone: res.key, autoSkin: true, skinConfident: res.confident, skinLab: res.skinLab, wristHueDeg: res.hueDeg }
          : s));
      });
      return;
    }

    // type === 'hair' — stay on 'hair-scan' (the screen shows a spinner over
    // the live camera) until we know whether a fallback question is needed.
    setState(s => ({ ...s, hairPhotoUri: uri, analyzing: true }));

    const hairPromise = analyzeHairColor(uri).catch((): HairAnalysis => null);
    const wristPromise = wristAnalysisRef.current ?? Promise.resolve<WristAnalysis>(null);

    Promise.all([wristPromise, hairPromise]).then(([wristRes, hairRes]) => {
      setState(s => {
        // The user may have navigated away (back()) while the analyses were in
        // flight. If they backed all the way to intro the path resets to null
        // (and could even be a restarted manual quiz) — don't merge camera
        // answers into it, just clear the analyzing flag.
        if (s.path !== 'camera') return { ...s, analyzing: false };

        const skinUndertone = s.skinUndertone ?? wristRes?.key ?? null;
        const autoSkin = s.skinUndertone == null && !!wristRes ? true : s.autoSkin;
        const skinConfident = s.skinUndertone == null && wristRes ? wristRes.confident : s.skinConfident;
        const skinLab = s.skinUndertone == null && wristRes ? wristRes.skinLab : s.skinLab;
        const wristHueDeg = s.skinUndertone == null && wristRes ? wristRes.hueDeg : s.wristHueDeg;

        const hairKey = s.hairKey ?? hairRes?.key ?? null;
        const autoHair = s.hairKey == null && !!hairRes ? true : s.autoHair;
        const hairConfident = s.hairKey == null && hairRes ? hairRes.confident : s.hairConfident;
        const hairLab = s.hairKey == null && hairRes ? hairRes.hairLab : s.hairLab;

        // Only auto-advance while still waiting on 'hair-scan' — a late
        // resolution must never yank the user off a screen they backed to.
        const advance = s.step === 'hair-scan';
        const nextStep: DetectionStep =
          skinUndertone == null ? 'skin' : hairKey == null ? 'hair' : 'result';

        return {
          ...s,
          skinUndertone, autoSkin, skinConfident, skinLab, wristHueDeg,
          hairKey, autoHair, hairConfident, hairLab,
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

  // ── Navigation ──────────────────────────────────────────────────────────

  const next = useCallback(() => {
    setState(s => {
      if (s.path === 'manual') {
        const idx = MANUAL_STEPS.indexOf(s.step);
        const nextStep = MANUAL_STEPS[idx + 1] as DetectionStep | undefined;
        if (!nextStep) return s;
        return { ...s, step: nextStep, history: [...s.history, s.step] };
      }

      // Camera path: `next()` only ever fires from the two fallback question
      // steps — wrist/hair-scan advance themselves via setCameraPhoto, and
      // result has nowhere further to go.
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
      case 'wrist-scan': return false; // advanced by setCameraPhoto
      case 'hair-scan':  return false;
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
      wristHueDeg: state.wristHueDeg,
      drape: state.drape,
    });
  }, [
    state.skinUndertone, state.hairKey, state.eyeKey, state.metalKey,
    state.skinLab, state.hairLab, state.wristHueDeg, state.drape,
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
    wristPhotoUri:  state.wristPhotoUri,
    hairPhotoUri:   state.hairPhotoUri,
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
    next,
    back,
    canAdvance,
    save,
    stepIndex,      // 0–3 for question steps, -1 otherwise
  };
}
