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
import { hasPremiumAccountType } from '../../services/profileService';
import { compositeFace } from './faceComposite';
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
          const compositeUri = await compositeFace(photoUri, out.localImageUri);
          if (id !== runId.current) return;
          if (compositeUri) {
            finalResult = { localImageUri: compositeUri };
            // The raw generated file is superseded by the composite — drop it
            // so we don't leak a duplicate image per generation.
            FileSystem.deleteAsync(out.localImageUri, { idempotent: true }).catch(() => {});
            if (__DEV__) console.log('[wearOnYou] face composite applied');
          } else if (__DEV__) {
            console.log('[wearOnYou] face composite skipped (no face / implausible alignment) — using raw generated image');
          }
        } catch (compositeErr) {
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
    }
  }, [photoUri, garments, profile, context]);

  // Back to the upload step to choose a different photo.
  const pickAnother = useCallback(() => {
    runId.current++;
    setPhotoUri(null);
    setReason('');
    setErrorMsg('');
    setResult(null);
    setPhase('upload');
  }, []);

  // From a result/error, generate again with the SAME photo.
  const regenerate = useCallback(() => {
    if (photoUri) { setResult(null); generate(); }
    else pickAnother();
  }, [photoUri, generate, pickAnother]);

  return {
    phase, photoUri, reason, errorMsg, result,
    creditBlocked, creditsRemaining,
    pickFromLibrary, pickFromCamera,
    generate, regenerate, pickAnother,
  };
}
