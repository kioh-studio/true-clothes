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
import { validatePersonPhoto, generateWearOn } from '../../services/tryOnWearService';
import { checkCredit, incrementCredit } from '../../services/usageCreditService';
import { hasPremiumAccountType } from '../../services/profileService';
import type { WearGarment, WearProfile, WearOnResult } from '../../types/tryOn';

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
        setReason(v.reason || 'Ảnh chưa phù hợp. Hãy chọn ảnh khác.');
        setPhase('invalid');
      }
    } catch {
      if (id !== runId.current) return;
      setReason('Không kiểm tra được ảnh. Kiểm tra kết nối và thử lại.');
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
    const id = ++runId.current;
    setErrorMsg('');
    setCreditBlocked(false);

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
      setResult(out);
      setPhase('result');
      // Consume a credit only on success (don't charge for failures).
      try {
        const premium = await hasPremiumAccountType();
        if (!premium) {
          await incrementCredit('try_on');
          const status = await checkCredit('try_on');
          setCreditsRemaining(status.remaining);
        }
      } catch { /* best-effort accounting */ }
    } catch {
      if (id !== runId.current) return;
      setErrorMsg('Không tạo được ảnh thử đồ. Vui lòng thử lại.');
      setPhase('error');
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
