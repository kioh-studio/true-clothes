import { useState, useCallback, useRef } from 'react';
import * as FileSystem from 'expo-file-system/legacy';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { useAppStore } from '../../stores/appStore';
import { AddItemInput } from '../../services/wardrobeService';
import { extractItemsWithImages, ExtractedItemWithImage } from '../../services/imageGenerationService';
import { extractItemOnDevice, isExtractByItemAvailable, cutoutOnDevice } from '../../services/extractByItemService';
import { checkCredit, CreditStatus, isCreditExhausted } from '../../services/usageCreditService';
import { usePremium } from '../monetization/usePremium';
import { useCreditQuota } from '../monetization/useCreditQuota';
import { hasPremiumAccountType } from '../../services/profileService';
import { categoryForType } from './vocab';
import { genId } from '../../utils/genId';
import { dominantHexesFromUri } from './colorClusterUri';
import { WizardStep, PhotoEntry, ExtractMethod, ExtractedItem } from './types';
import { useTranslation } from '../../i18n';

// file uri → base64 data URI (the edge function requires a data: URI).
// ALWAYS run through the manipulator (a no-op transform with no actions): it
// normalises platform picker URIs (Android `content://`, iOS `ph://`) into a
// readable `file://` JPEG. `readAsStringAsync` cannot read a raw `content://`
// on Android, so picking a library photo there would throw before the extract
// call ever reached the edge function.
async function toDataUri(uri: string): Promise<string> {
  if (uri.startsWith('data:')) return uri;
  const out = await manipulateAsync(uri, [], { compress: 0.92, format: SaveFormat.JPEG });
  const b64 = await FileSystem.readAsStringAsync(out.uri, { encoding: FileSystem.EncodingType.Base64 });
  return `data:image/jpeg;base64,${b64}`;
}

// The edge function keys out the background server-side (r.keyed === true) → a
// transparent PNG that needs no further work. Only when that failed (keyed false)
// and the on-device ML segmenter is present do we refine the image into a cut-out
// and drop the replaced bg file. No native module / already keyed → return as-is.
//
// Measured-hex hygiene (2026-07-06): the server computes primaryHex/secondaryHex
// on the FINAL keyed image — when keying failed (keyed:false) the chroma
// background is still in those pixels, so the server hex is unreliable (the
// magenta/green fill can win the histogram). In that case: recompute on-device
// from the refined transparent cut-out when we made one, else null the hex out
// (the backfill fills it later). keyed:true → server hex is trustworthy as-is.
async function refineAiCutout(r: ExtractedItemWithImage): Promise<ExtractedItemWithImage> {
  if (!r.localImageUri || r.keyed) return r;

  const dropHex = (x: ExtractedItemWithImage): ExtractedItemWithImage =>
    ({ ...x, metadata: { ...x.metadata, primaryHex: null, secondaryHex: null } });

  if (!isExtractByItemAvailable) return dropHex(r);
  const { uri, usedFallback } = await cutoutOnDevice(r.localImageUri);
  if (uri === r.localImageUri) return dropHex(r); // unchanged (no native / failed)
  if (r.localImageUri.startsWith('file://')) {
    FileSystem.deleteAsync(r.localImageUri, { idempotent: true }).catch(() => {});
  }
  const { primaryHex, secondaryHex } = await dominantHexesFromUri(uri);
  return { ...r, localImageUri: uri, usedFallback, metadata: { ...r.metadata, primaryHex, secondaryHex } };
}

function toExtractedItem(r: ExtractedItemWithImage, photo: PhotoEntry): ExtractedItem {
  const m = r.metadata;
  return {
    id: genId(),
    srcId: photo.id,
    method: photo.method,
    localImageUri: r.localImageUri,
    type: m.type,
    name: m.name,
    color: m.color,
    material: m.material,
    fit: m.fit,
    pattern: m.pattern,
    warmthSeason: m.warmthSeason,
    // AI extraction estimates this (server prompt.ts `can_layer`); on-device
    // extract-by-item has no source for it → stays null (AUTO). Either way
    // the user can still override in Review. (2026-08-11: previously forced
    // to null even for the AI path, silently discarding the model's estimate.)
    canLayer: m.canLayer ?? null,
    measurements: m.measurements ?? {},
    brand: m.brand ?? '',
    link: '',
    tags: m.tags ?? [],
    graphics: m.graphics,
    confidence: m.confidence,
    usedFallback: r.usedFallback,
    primaryHex: m.primaryHex ?? null,
    secondaryHex: m.secondaryHex ?? null,
    distressed: m.distressed ?? null,
    printScale: m.printScale ?? null,
    drape: m.drape ?? null,
    visualInterest: m.visualInterest ?? null,
  };
}

export function useAddWizard() {
  const { t } = useTranslation();
  const addWardrobeItem = useAppStore((s) => s.addWardrobeItem);
  const { isPremium } = usePremium();
  const isPremiumRef = useRef(isPremium);
  isPremiumRef.current = isPremium;

  // Display-only monthly allowance shown on the upload step. Separate from the
  // `creditStatus` below, which is only ever populated by the pre-flight gate
  // inside analyse() and only for non-premium accounts.
  const { status: quota, refresh: refreshQuota } = useCreditQuota('ai_extraction');

  const [step, setStep] = useState<WizardStep>('upload');
  const [photos, setPhotos] = useState<PhotoEntry[]>([]);
  const [items, setItems] = useState<ExtractedItem[]>([]);
  const [processingIndex, setProcessingIndex] = useState(0);
  const [creditStatus, setCreditStatus] = useState<CreditStatus | null>(null);
  const [upgrade, setUpgrade] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // Item ids that have already been persisted by a previous confirm() attempt.
  // Lets a retry (after a mid-batch failure) skip re-saving items that already
  // made it into the DB, instead of duplicating them.
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());

  // ── Upload step ─────────────────────────────────────────────────────────────
  const addPhoto = useCallback((uri: string, method: ExtractMethod) => {
    setPhotos((p) => [...p, { id: genId(), uri, method, note: '' }]);
  }, []);
  const removePhoto = useCallback((id: string) => {
    setPhotos((p) => p.filter((x) => x.id !== id));
  }, []);
  const setMethod = useCallback((id: string, method: ExtractMethod) => {
    setPhotos((p) => p.map((x) => (x.id === id ? { ...x, method } : x)));
  }, []);
  const setNote = useCallback((id: string, note: string) => {
    setPhotos((p) => p.map((x) => (x.id === id ? { ...x, note } : x)));
  }, []);

  // ── Analyse ──────────────────────────────────────────────────────────────────
  const analyse = useCallback(async () => {
    if (photos.length === 0) return;
    setError(null);
    setUpgrade(false);
    setProcessingIndex(0);
    setStep('analyse');

    try {
      const aiCount = photos.filter((p) => p.method === 'ai').length;
      const premium = isPremiumRef.current || (await hasPremiumAccountType());

      // Cost gate: each AI photo costs one credit. Premium is unlimited.
      if (aiCount > 0 && !premium) {
        const status = await checkCredit('ai_extraction');
        setCreditStatus(status);
        if (status.remaining < aiCount) {
          setUpgrade(true);
          setStep('upload');
          return;
        }
      }

      const collected: ExtractedItem[] = [];
      for (let i = 0; i < photos.length; i++) {
        const photo = photos[i];
        setProcessingIndex(i);
        try {
          if (photo.method === 'ai') {
            const dataUri = await toDataUri(photo.uri);
            const results = await extractItemsWithImages(dataUri, photo.note);
            // White-bg AI image → transparent cut-out via on-device ML when present.
            const refined = await Promise.all(results.map((r) => refineAiCutout(r)));
            collected.push(...refined.map((r) => toExtractedItem(r, photo)));
          } else if (isExtractByItemAvailable) {
            const results = await extractItemOnDevice(photo.uri, photo.note);
            collected.push(...results.map((r) => toExtractedItem(r, photo)));
          }
          // item method unavailable → silently skipped (chooser shows it as "coming soon")
        } catch (err) {
          // Server consumes the AI credit atomically via consume_usage_credit; a 402
          // mid-batch means the pre-check above (stale) undercounted or credits ran
          // out between photos. Don't silently skip this and every remaining AI
          // photo — stop the batch and tell the user clearly.
          if (photo.method === 'ai' && (await isCreditExhausted(err))) {
            setUpgrade(true);
            setError(t('extraction_outOfCreditsMessage'));
            setStep('upload');
            return;
          }
          console.warn('[useAddWizard] photo failed:', err);
          // one bad photo doesn't sink the rest
        }
      }

      setItems(collected);
      if (collected.length === 0) {
        setError(t('extraction_noItemsDetected'));
      }
      setStep('review');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('extraction_extractionFailed'));
      setStep('upload');
    } finally {
      // Every exit path above can have consumed credit server-side (the batch
      // loop consumes per photo, so even a mid-batch failure spent some).
      // Re-read once here rather than at each return.
      refreshQuota();
    }
  }, [photos, t, refreshQuota]);

  // ── Review edits ──────────────────────────────────────────────────────────────
  const editItem = useCallback((id: string, patch: Partial<ExtractedItem>) => {
    setItems((list) => list.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  }, []);
  const removeItem = useCallback((id: string) => {
    setItems((list) => list.filter((it) => it.id !== id));
  }, []);

  // ── Confirm (batch save) ──────────────────────────────────────────────────────
  const confirm = useCallback(async () => {
    if (items.length === 0) return;
    // Retry-safe: skip items a previous confirm() attempt already persisted,
    // so a mid-batch failure + retry can't duplicate the ones that succeeded.
    const pending = items.filter((it) => !savedIds.has(it.id));
    if (pending.length === 0) {
      setStep('done');
      return;
    }
    // Every item needs a controlled type before saving (clothing_items.type is NOT NULL).
    // On-device "item" extraction may leave type blank on low confidence — user must pick.
    if (pending.some((it) => !it.type)) {
      setError(t('extraction_chooseTypeRequired'));
      return;
    }
    setSaving(true);
    // Clear once, before the batch starts — NOT per item. addWardrobeItem
    // clears the store's wardrobeError at the start of its own call, so if we
    // relied on its final state only, a failure on item 2 would be wiped out
    // by item 3 starting and the batch would look fully successful.
    setError(null);
    const failures: string[] = [];
    try {
      for (const it of pending) {
        const input: AddItemInput = {
          localPhotoUri: it.localImageUri,
          category: categoryForType(it.type),
          colors: [it.color],
          name: it.name || undefined,
          type: it.type,
          primaryColor: it.color,
          material: it.material ?? undefined,
          fit: it.fit ?? undefined,
          pattern: it.pattern ?? undefined,
          warmthSeason: it.warmthSeason ? [it.warmthSeason] : undefined,
          canLayer: it.canLayer,
          measurements: Object.keys(it.measurements).length ? it.measurements : undefined,
          brand: it.brand || undefined,
          link: it.link || undefined,
          graphics: it.graphics,
          source: it.method === 'ai' ? 'ai' : 'item',
          primaryHex: it.primaryHex,
          secondaryHex: it.secondaryHex,
          distressed: it.distressed,
          printScale: it.printScale,
          drape: it.drape,
          visualInterest: it.visualInterest,
        };
        await addWardrobeItem(input);
        // Read the result of THIS call right away — the next iteration's
        // addWardrobeItem will clear wardrobeError at its own start, so this
        // is the only window where the flag reflects this specific item.
        const storeErr = useAppStore.getState().wardrobeError;
        if (storeErr) {
          failures.push(`${it.name || it.type}: ${storeErr}`);
        } else {
          setSavedIds((prev) => {
            const next = new Set(prev);
            next.add(it.id);
            return next;
          });
        }
      }
      setSaving(false);
      if (failures.length > 0) {
        setError(
          failures.length === pending.length
            ? t('extraction_saveAllFailed', { count: failures.length, suffix: failures.length === 1 ? '' : 's', details: failures.join('; ') })
            : t('extraction_savePartialFailed', { saved: pending.length - failures.length, total: pending.length, details: failures.join('; ') })
        );
        return;
      }
      setStep('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('addItem_errorMessage'));
      setSaving(false);
    }
  }, [items, addWardrobeItem, savedIds, t]);

  const reset = useCallback(() => {
    setStep('upload');
    setPhotos([]);
    setItems([]);
    setProcessingIndex(0);
    setUpgrade(false);
    setError(null);
    setSaving(false);
    setSavedIds(new Set());
  }, []);

  return {
    step, photos, items, processingIndex, creditStatus, quota, upgrade, error, saving,
    addPhoto, removePhoto, setMethod, setNote,
    analyse, editItem, removeItem, confirm, reset,
    savedCount: savedIds.size,
    photoCount: photos.length,
  };
}
