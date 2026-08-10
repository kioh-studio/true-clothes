// useWearOnYou — state machine for the AI "wear on you" try-on (feature 009).
//
// Phases:
//   upload     → no photo yet; user takes/chooses one
//   validating → tryon-validate is checking the photo
//   invalid    → photo rejected (reason shown); user picks another
//   ready      → photo valid; user can GENERATE
//   rendering  → tryon-generate is composing the look
//   result     → generated image + assessment shown
//   error      → generation failed; user can retry
//
// Credit-gated (try_on) unless premium, mirroring the scan flow.

import { useCallback, useRef, useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { validatePersonPhoto, generateWearOn } from '../../services/tryOnWearService';
import { checkCredit, isCreditExhausted } from '../../services/usageCreditService';
import { useCreditQuota } from '../monetization/useCreditQuota';
import { hasPremiumAccountType } from '../../services/profileService';
import { compositeFace, type CompositeReason } from './faceComposite';
import { recordFaceCompositeOutcome } from './faceCompositeStats';
import type { WearGarment, WearProfile, WearOnResult } from '../../types/tryOn';
import i18n from '../../i18n';

export type WearPhase = 'upload' | 'validating' | 'invalid' | 'ready' | 'rendering' | 'result' | 'error';

export interface WearContext { title?: string; style?: string; occasion?: string }

export interface UseWearOnYouArgs {
  garments: WearGarment[];
  profile?: WearProfile;
  context?: WearContext;
}

export function useWearOnYou({ garments, profile, context }: UseWearOnYouArgs) {
  const [phase, setPhase] = useState<WearPhase>('upload');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [reason, setReason] = useState('');           // why a photo was rejected
  const [errorMsg, setErrorMsg] = useState('');        // generation failure
  const [creditBlocked, setCreditBlocked] = useState(false);
  const [creditsRemaining, setCreditsRemaining] = useState<number | null>(null);
  const [result, setResult] = useState<WearOnResult | null>(null);
  // Composite outcome (feature: try-on fixes, 2026-08-06) — was previously
  // __DEV__ console-only, so nobody outside a dev build could tell whether
  // the face composite is actually working. null = not attempted yet this
  // generation, true = composited, false = attempted and fell back to the
  // raw generated image.
  const [faceApplied, setFaceApplied] = useState<boolean | null>(null);
  // Specific outcome reason from the last compositeFace() call (diagnostics,
  // 2026-08-07) — null until a generation has run. See faceComposite.ts's
  // CompositeReason for the full set of causes.
  const [faceReason, setFaceReason] = useState<CompositeReason | null>(null);

  // Display-only monthly allowance. Distinct from `creditsRemaining` above,
  // which is only ever set for a non-premium user at the moment they're
  // blocked or right after a generation — this one loads on mount and covers
  // premium accounts too, which now have a real cap of their own.
  const { status: quota, refresh: refreshQuota } = useCreditQuota('try_on');

  // Guards against a stale validate/generate resolving after the user moved on.
  const runId = useRef(0);
  // In-flight guard for generate(): checked SYNCHRONOUSLY as the very first
  // thing, before the premium/credit `await`s. Without it, a double-tap on
  // "WEAR ON" fires generate() twice while the first call is still awaiting
  // the premium check — both calls pass the credit gate and both call the
  // server, consuming 2 credits for 1 user action. `phase !== 'rendering'`
  // isn't enough on its own because `setPhase('rendering')` only happens
  // AFTER the awaited premium/credit check, i.e. after the window this needs
  // to close.
  const generating = useRef(false);

  const runValidation = useCallback(async (uri: string) => {
    const id = ++runId.current;
    setPhotoUri(uri);
    setReason('');
    setErrorMsg('');
    setPhase('validating');
    try {
      const v = await validatePersonPhoto(uri);
      if (id !== runId.current) return;
      if (v.valid) {
        setPhase('ready');
      } else {
        setReason(v.reason || i18n.t('wearOnYou_photoNotSuitable'));
        setPhase('invalid');
      }
    } catch {
      if (id !== runId.current) return;
      setReason(i18n.t('wearOnYou_validationFailed'));
      setPhase('invalid');
    }
  }, []);

  const pickFromLibrary = useCallback(async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.9,
    });
    if (res.canceled || !res.assets[0]?.uri) return;
    await runValidation(res.assets[0].uri);
  }, [runValidation]);

  const pickFromCamera = useCallback(async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return;
    const res = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.9,
    });
    if (res.canceled || !res.assets[0]?.uri) return;
    await runValidation(res.assets[0].uri);
  }, [runValidation]);

  const generate = useCallback(async () => {
    if (!photoUri || garments.length === 0) return;
    // In-flight guard FIRST, before any await — closes the double-tap window
    // during the premium/credit check (see comment on `generating` above).
    if (generating.current) return;
    generating.current = true;

    const id = ++runId.current;
    setErrorMsg('');
    setCreditBlocked(false);
    setFaceApplied(null);
    setFaceReason(null);

    try {
      // Credit gate (skip for premium).
      try {
        const premium = await hasPremiumAccountType();
        if (!premium) {
          const status = await checkCredit('try_on');
          if (id !== runId.current) return;
          if (status.remaining < 1) {
            setCreditsRemaining(0);
            setCreditBlocked(true);
            return;
          }
        }
      } catch {
        // Credit check failure shouldn't hard-block; proceed (best-effort like scan).
      }

      setPhase('rendering');
      try {
        const out = await generateWearOn({
          personUri: photoUri,
          garments,
          profile,
          context,
        });
        if (id !== runId.current) return;

        // Face compositing (feature 010): paste the user's REAL face from
        // their source photo onto the generated studio image so identity is
        // guaranteed. Best-effort — any failure/no-detect/implausible
        // alignment falls back to the raw generated image (pre-existing
        // behaviour). Never blocks or throws into the result flow.
        let finalResult = out;
        try {
          const { uri: compositeUri, reason } = await compositeFace(photoUri, out.localImageUri);
          if (id !== runId.current) return;
          setFaceReason(reason);
          if (compositeUri) {
            finalResult = { ...out, localImageUri: compositeUri };
            // The raw generated file is superseded by the composite — drop it
            // so we don't leak a duplicate image per generation.
            FileSystem.deleteAsync(out.localImageUri, { idempotent: true }).catch(() => {});
            setFaceApplied(true);
            void recordFaceCompositeOutcome(true, reason);
            if (__DEV__) console.log('[wearOnYou] face composite applied');
          } else {
            setFaceApplied(false);
            void recordFaceCompositeOutcome(false, reason);
            if (__DEV__) console.log(`[wearOnYou] face composite skipped (${reason}) — using raw generated image`);
          }
        } catch (compositeErr) {
          // compositeFace() itself is documented to never throw, but this
          // guard is kept as a last resort so a surprise error still
          // degrades to the raw generated image instead of breaking the flow.
          setFaceApplied(false);
          setFaceReason('error');
          void recordFaceCompositeOutcome(false, 'error');
          if (__DEV__) console.log('[wearOnYou] face composite failed, using raw generated image:', compositeErr);
        }

        setResult(finalResult);
        setPhase('result');
        // Re-check remaining credits so the UI stays up-to-date after the server consumed one.
        try {
          const premium = await hasPremiumAccountType();
          if (!premium) {
            const status = await checkCredit('try_on');
            setCreditsRemaining(status.remaining);
          }
        } catch { /* best-effort */ }
      } catch (err) {
        if (id !== runId.current) return;
        if (await isCreditExhausted(err)) {
          setCreditsRemaining(0);
          setCreditBlocked(true);
          setPhase('ready');
          return;
        }
        setErrorMsg(i18n.t('wearOnYou_generationFailed'));
        setPhase('error');
      }
    } finally {
      generating.current = false;
      // A generation that reached the server consumed a credit; one that was
      // blocked didn't. Re-reading on both paths is cheaper than tracking which
      // happened, and keeps the counter honest after a mid-flight 402.
      refreshQuota();
    }
  }, [photoUri, garments, profile, context, refreshQuota]);

  // Back to the upload step to choose a different photo.
  const pickAnother = useCallback(() => {
    runId.current++;
    setPhotoUri(null);
    setReason('');
    setErrorMsg('');
    setResult(null);
    setFaceApplied(null);
    setFaceReason(null);
    setPhase('upload');
  }, []);

  // From a result/error, generate again with the SAME photo.
  const regenerate = useCallback(() => {
    if (photoUri) { setResult(null); generate(); }
    else pickAnother();
  }, [photoUri, generate, pickAnother]);

  return {
    phase, photoUri, reason, errorMsg, result,
    creditBlocked, creditsRemaining, quota, faceApplied, faceReason,
    pickFromLibrary, pickFromCamera,
    generate, regenerate, pickAnother,
  };
}
