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

import { useCallback, useEffect, useRef, useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { validatePersonPhoto, generateWearOn, classifyTryOnFailure } from '../../services/tryOnWearService';
import { checkCredit, isCreditExhausted } from '../../services/usageCreditService';
import { useCreditQuota } from '../monetization/useCreditQuota';
import { hasPremiumAccountType } from '../../services/profileService';
import { compositeFace, type CompositeReason } from './faceComposite';
import { recordFaceCompositeOutcome } from './faceCompositeStats';
import { logTriedOn } from '../../services/outfitInteractionService';
import type { WearGarment, WearProfile, WearOnResult } from '../../types/tryOn';
import i18n from '../../i18n';

export type WearPhase = 'upload' | 'validating' | 'invalid' | 'ready' | 'rendering' | 'result' | 'error';

export interface WearContext { title?: string; style?: string; occasion?: string }

export interface UseWearOnYouArgs {
  garments: WearGarment[];
  profile?: WearProfile;
  context?: WearContext;
  /**
   * Real, OWNED wardrobe item ids in this outfit — the caller (wear.tsx)
   * filters `outfit.itemIds` down to ids that actually exist in the user's
   * wardrobe, which naturally excludes any unowned scanned candidate riding
   * along as `extra` (no clothing_items.id) and any demo/static outfit ids
   * (src/data, never real DB rows). Used only to log `tried_on` after a
   * successful generation (see generate() below) — undefined/empty means no
   * real outfit id is available, so the log is skipped rather than invented.
   */
  outfitItemIds?: string[];
}

export function useWearOnYou({ garments, profile, context, outfitItemIds }: UseWearOnYouArgs) {
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

  // Mirrors `result` synchronously (unlike state, readable from the unmount
  // cleanup below without going stale) — see the cleanup effect and
  // deleteRender() for why this exists: a rendered wear-on-you image is a
  // real file (tryOnWearService.generateWearOn writes it to
  // documentDirectory/try-on/, or faceComposite.ts writes the composited
  // version to cacheDirectory/try-on/) that nothing else ever references —
  // there is no save/share/add-to-wardrobe affordance for it (see
  // src/design/try-on/design.md) — so once the user regenerates, picks a
  // different photo, or leaves the screen, the file becomes a permanent
  // orphan in the app sandbox unless something deletes it here.
  const resultRef = useRef<WearOnResult | null>(null);
  // False once the hook has unmounted (screen left) — checked by generate()
  // after its awaits so a render that finishes AFTER the user already
  // navigated away is deleted immediately instead of being set into state
  // (which would both warn on an unmounted hook and leak the file, since the
  // unmount cleanup below would already have run and seen `result: null`).
  const mountedRef = useRef(true);

  // Best-effort delete — must never throw into the UI (RN-safe pattern used
  // throughout this codebase, e.g. tryOnStore.cleanupTempImage). Takes a raw
  // uri (not a WearOnResult) so it can also clean up an intermediate file
  // (the raw pre-composite render, or a composite produced for a run that
  // turned out to be stale) that never made it into `result` at all.
  const deleteRender = useCallback((uri: string | null | undefined) => {
    if (!uri) return;
    FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {});
  }, []);

  // setResult wrapper that keeps resultRef in lockstep — every call site
  // that changes `result` goes through this, so the unmount cleanup and
  // generate()'s late-resolve guard always see the current value.
  const setResultTracked = useCallback((r: WearOnResult | null) => {
    resultRef.current = r;
    setResult(r);
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      // Leaving the screen (X, "Done", hardware back, swipe-back — an
      // unmount effect catches all of them uniformly): any render still
      // sitting in `result` was never acted on, so delete it now.
      deleteRender(resultRef.current?.localImageUri);
    };
  }, [deleteRender]);
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
    } catch (e) {
      if (id !== runId.current) return;
      // Distinguish "the AI service itself failed" (tryon-validate reached
      // Gemini and got an error back — nothing wrong with the user's
      // connection) from a genuine network failure, instead of always
      // blaming the user's connection (backlog "L. Gemini prepay credits
      // CẠN", 2026-08-07: a Gemini 429 surfaced as a 502 here and told a
      // user with a fine connection to "check your connection").
      const kind = classifyTryOnFailure(e);
      setReason(i18n.t(kind === 'service' ? 'wearOnYou_serviceUnavailable' : 'wearOnYou_validationFailed'));
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
        if (id !== runId.current) {
          // Superseded by a newer run (defensive — the `generating` guard
          // above should prevent this today, but a stale result must never
          // sit around unreferenced) — discard the file it produced.
          deleteRender(out.localImageUri);
          return;
        }

        // Face compositing (feature 010): paste the user's REAL face from
        // their source photo onto the generated studio image so identity is
        // guaranteed. Best-effort — any failure/no-detect/implausible
        // alignment falls back to the raw generated image (pre-existing
        // behaviour). Never blocks or throws into the result flow.
        let finalResult = out;
        try {
          const { uri: compositeUri, reason } = await compositeFace(photoUri, out.localImageUri);
          if (id !== runId.current) {
            deleteRender(out.localImageUri);
            deleteRender(compositeUri);
            return;
          }
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

        // Log the try-on signal (feature 010) right here: the credit was
        // actually spent and a render genuinely exists, regardless of
        // whether the user is still on the screen to see it (that only
        // affects whether the FILE is kept, handled separately below) — so
        // this fires before the mounted check, not after. Skipped when no
        // real owned-item outfit id is available (see UseWearOnYouArgs).
        if (outfitItemIds && outfitItemIds.length > 0) {
          logTriedOn({ outfitId: outfitItemIds.join('|') }).catch(() => {});
        }

        if (!mountedRef.current) {
          // The screen was left while this generation was still finishing —
          // nothing will ever reference this render (see resultRef comment
          // above, and the unmount cleanup already ran and saw `result:
          // null`), so delete it immediately instead of leaking it. Also
          // skips setState on an unmounted hook.
          deleteRender(finalResult.localImageUri);
          return;
        }
        setResultTracked(finalResult);
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
        // Same distinction as runValidation's catch above, applied to the
        // generate path (backlog explicitly calls out generateWearOn too).
        const kind = classifyTryOnFailure(err);
        setErrorMsg(i18n.t(
          kind === 'service' ? 'wearOnYou_serviceUnavailable'
            : kind === 'network' ? 'wearOnYou_generationNetworkFailed'
              : 'wearOnYou_generationFailed',
        ));
        setPhase('error');
      }
    } finally {
      generating.current = false;
      // A generation that reached the server consumed a credit; one that was
      // blocked didn't. Re-reading on both paths is cheaper than tracking which
      // happened, and keeps the counter honest after a mid-flight 402.
      refreshQuota();
    }
  }, [photoUri, garments, profile, context, refreshQuota, deleteRender, setResultTracked, outfitItemIds]);

  // Back to the upload step to choose a different photo. Whatever render was
  // showing is being abandoned in favor of a new photo — same "replacing an
  // unacted-on render" case as regenerate() below, so it must be deleted too.
  const pickAnother = useCallback(() => {
    runId.current++;
    deleteRender(resultRef.current?.localImageUri);
    setPhotoUri(null);
    setReason('');
    setErrorMsg('');
    setResultTracked(null);
    setFaceApplied(null);
    setFaceReason(null);
    setPhase('upload');
  }, [deleteRender, setResultTracked]);

  // From a result/error, generate again with the SAME photo. The result
  // about to be replaced is deleted here — generate() only ever writes a
  // NEW file, it never reuses or deletes the previous one itself.
  const regenerate = useCallback(() => {
    if (photoUri) {
      deleteRender(resultRef.current?.localImageUri);
      setResultTracked(null);
      generate();
    } else pickAnother();
  }, [photoUri, generate, pickAnother, deleteRender, setResultTracked]);

  return {
    phase, photoUri, reason, errorMsg, result,
    creditBlocked, creditsRemaining, quota, faceApplied, faceReason,
    pickFromLibrary, pickFromCamera,
    generate, regenerate, pickAnother,
  };
}
