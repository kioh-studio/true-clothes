import { useState, useCallback } from 'react';
import {
  scorePersonalColor,
  type PersonalColorAnswers,
  type PersonalColorResult,
  type SkinOption,
  type EyeOption,
  type MetalOption,
} from './colorSeasonData';
import { useAuthStore } from '../../stores/authStore';
import { analyzeWristUndertone, analyzeHairColor } from './analyzePhoto';

// ─── Step types ────────────────────────────────────────────────────────────

export type DetectionStep =
  | 'intro'
  | 'wrist-scan'   // camera path only
  | 'hair-scan'    // camera path only
  | 'skin'
  | 'hair'
  | 'eye'
  | 'metal'
  | 'result';

const CAMERA_STEPS: DetectionStep[] = ['intro', 'wrist-scan', 'hair-scan', 'skin', 'hair', 'eye', 'metal', 'result'];
const MANUAL_STEPS: DetectionStep[] = ['intro', 'skin', 'hair', 'eye', 'metal', 'result'];

// ─── State ─────────────────────────────────────────────────────────────────

interface DetectionState {
  path: 'camera' | 'manual' | null;
  step: DetectionStep;
  wristPhotoUri: string | null;
  hairPhotoUri: string | null;
  skinUndertone: SkinOption['key'] | null;
  hairKey: string | null;
  eyeKey: EyeOption['key'] | null;
  metalKey: MetalOption['key'] | null;
  result: PersonalColorResult | null;
  saving: boolean;
  error: string | null;
  /** A wrist/hair photo is being analysed on-device. */
  analyzing: boolean;
  /** The current skin / hair answer was auto-detected from a photo (UI hint;
   *  cleared when the user picks manually). */
  autoSkin: boolean;
  autoHair: boolean;
}

// ─── Hook ──────────────────────────────────────────────────────────────────

export function usePersonalColorDetection() {
  const savePersonalColor = useAuthStore(s => s.savePersonalColor);

  const [state, setState] = useState<DetectionState>({
    path: null,
    step: 'intro',
    wristPhotoUri: null,
    hairPhotoUri: null,
    skinUndertone: null,
    hairKey: null,
    eyeKey: null,
    metalKey: null,
    result: null,
    saving: false,
    error: null,
    analyzing: false,
    autoSkin: false,
    autoHair: false,
  });

  // ── Path selection ──────────────────────────────────────────────────────

  const startCameraPath = useCallback(() => {
    setState(s => ({ ...s, path: 'camera', step: 'wrist-scan' }));
  }, []);

  const startManualPath = useCallback(() => {
    setState(s => ({ ...s, path: 'manual', step: 'skin' }));
  }, []);

  // ── Camera captures ─────────────────────────────────────────────────────

  const setCameraPhoto = useCallback(async (type: 'wrist' | 'hair', uri: string) => {
    // Record the photo, advance to the next step, and flag analysis in progress.
    setState(s => {
      const idx = CAMERA_STEPS.indexOf(s.step);
      const nextStep = CAMERA_STEPS[idx + 1] ?? s.step;
      return {
        ...s,
        wristPhotoUri: type === 'wrist' ? uri : s.wristPhotoUri,
        hairPhotoUri:  type === 'hair'  ? uri : s.hairPhotoUri,
        step: nextStep,
        analyzing: true,
      };
    });

    // Analyse on-device and pre-fill the matching answer (only when not already
    // set, so we never clobber a manual choice). Any failure → leave it manual.
    try {
      if (type === 'wrist') {
        const undertone = await analyzeWristUndertone(uri);
        setState(s => (undertone && s.skinUndertone == null
          ? { ...s, skinUndertone: undertone, autoSkin: true, analyzing: false }
          : { ...s, analyzing: false }));
      } else {
        const hairKey = await analyzeHairColor(uri);
        setState(s => (hairKey && s.hairKey == null
          ? { ...s, hairKey, autoHair: true, analyzing: false }
          : { ...s, analyzing: false }));
      }
    } catch {
      setState(s => ({ ...s, analyzing: false }));
    }
  }, []);

  // ── Answer setters (a manual pick clears the "auto-detected" flag) ─────────

  const setSkin  = useCallback((key: SkinOption['key']) => setState(s => ({ ...s, skinUndertone: key, autoSkin: false })), []);
  const setHair  = useCallback((key: string)             => setState(s => ({ ...s, hairKey: key, autoHair: false })), []);
  const setEye   = useCallback((key: EyeOption['key'])   => setState(s => ({ ...s, eyeKey: key })), []);
  const setMetal = useCallback((key: MetalOption['key']) => setState(s => ({ ...s, metalKey: key })), []);

  // ── Navigation ──────────────────────────────────────────────────────────

  const steps = state.path === 'camera' ? CAMERA_STEPS : MANUAL_STEPS;

  const next = useCallback(() => {
    setState(s => {
      const seq = s.path === 'camera' ? CAMERA_STEPS : MANUAL_STEPS;
      const idx = seq.indexOf(s.step);
      const nextStep = seq[idx + 1] as DetectionStep | undefined;
      if (!nextStep) return s;

      if (nextStep === 'result') {
        if (!s.skinUndertone || !s.hairKey || !s.eyeKey || !s.metalKey) return s;
        const answers: PersonalColorAnswers = {
          skinUndertone: s.skinUndertone,
          hairKey: s.hairKey,
          eyeKey: s.eyeKey,
          metalKey: s.metalKey,
        };
        return { ...s, step: nextStep, result: scorePersonalColor(answers) };
      }

      return { ...s, step: nextStep };
    });
  }, []);

  const back = useCallback(() => {
    setState(s => {
      const seq = s.path === 'camera' ? CAMERA_STEPS : MANUAL_STEPS;
      const idx = seq.indexOf(s.step);
      // Stepping back to intro resets the path choice
      if (idx <= 1) return { ...s, step: 'intro', path: null };
      return { ...s, step: seq[idx - 1] };
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

  // ── Save ────────────────────────────────────────────────────────────────

  const save = useCallback(async (): Promise<boolean> => {
    if (!state.result) return false;
    setState(s => ({ ...s, saving: true, error: null }));
    try {
      await savePersonalColor({ season: state.result.season, palette: state.result.palette });
      setState(s => ({ ...s, saving: false }));
      return true;
    } catch (err) {
      setState(s => ({ ...s, saving: false, error: err instanceof Error ? err.message : 'Failed to save' }));
      return false;
    }
  }, [state.result, savePersonalColor]);

  // ── Step progress (excludes intro + result + camera-only scan steps from dots) ──

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
    result:         state.result,
    saving:         state.saving,
    error:          state.error,
    analyzing:      state.analyzing,
    autoSkin:       state.autoSkin,
    autoHair:       state.autoHair,
    startCameraPath,
    startManualPath,
    setCameraPhoto,
    setSkin,
    setHair,
    setEye,
    setMetal,
    next,
    back,
    canAdvance,
    save,
    stepIndex,      // 0–3 for question steps, -1 otherwise
  };
}
