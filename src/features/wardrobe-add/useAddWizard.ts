import { useState, useCallback, useRef } from 'react';
import * as FileSystem from 'expo-file-system/legacy';
import { useAppStore } from '../../stores/appStore';
import { AddItemInput } from '../../services/wardrobeService';
import { extractItemsWithImages, ExtractedItemWithImage } from '../../services/imageGenerationService';
import { extractItemOnDevice, isExtractByItemAvailable } from '../../services/extractByItemService';
import { checkCredit, incrementCredit, CreditStatus } from '../../services/usageCreditService';
import { usePremium } from '../monetization/usePremium';
import { hasPremiumAccountType } from '../../services/profileService';
import { categoryForType } from './vocab';
import { WizardStep, PhotoEntry, ExtractMethod, ExtractedItem } from './types';

// file uri → base64 data URI (the edge function requires a data: URI)
async function toDataUri(uri: string): Promise<string> {
  if (uri.startsWith('data:')) return uri;
  const b64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
  const ext = uri.split('.').pop()?.toLowerCase();
  const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
  return `data:${mime};base64,${b64}`;
}

function toExtractedItem(r: ExtractedItemWithImage, photo: PhotoEntry): ExtractedItem {
  const m = r.metadata;
  return {
    id: crypto.randomUUID(),
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
    measurements: m.measurements ?? {},
    brand: m.brand ?? '',
    link: '',
    tags: m.tags ?? [],
    graphics: m.graphics,
    confidence: m.confidence,
    usedFallback: r.usedFallback,
  };
}

export function useAddWizard() {
  const addWardrobeItem = useAppStore((s) => s.addWardrobeItem);
  const { isPremium } = usePremium();
  const isPremiumRef = useRef(isPremium);
  isPremiumRef.current = isPremium;

  const [step, setStep] = useState<WizardStep>('upload');
  const [photos, setPhotos] = useState<PhotoEntry[]>([]);
  const [items, setItems] = useState<ExtractedItem[]>([]);
  const [processingIndex, setProcessingIndex] = useState(0);
  const [creditStatus, setCreditStatus] = useState<CreditStatus | null>(null);
  const [upgrade, setUpgrade] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // ── Upload step ─────────────────────────────────────────────────────────────
  const addPhoto = useCallback((uri: string, method: ExtractMethod) => {
    setPhotos((p) => [...p, { id: crypto.randomUUID(), uri, method, note: '' }]);
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
            if (!premium && results.length > 0) await incrementCredit('ai_extraction');
            collected.push(...results.map((r) => toExtractedItem(r, photo)));
          } else if (isExtractByItemAvailable) {
            const results = await extractItemOnDevice(photo.uri, photo.note);
            collected.push(...results.map((r) => toExtractedItem(r, photo)));
          }
          // item method unavailable → silently skipped (chooser shows it as "coming soon")
        } catch (err) {
          console.warn('[useAddWizard] photo failed:', err);
          // one bad photo doesn't sink the rest
        }
      }

      setItems(collected);
      if (collected.length === 0) {
        setError('No items detected. Try clearer photos or add manually.');
      }
      setStep('review');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Extraction failed. Please try again.');
      setStep('upload');
    }
  }, [photos]);

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
    // Every item needs a controlled type before saving (clothing_items.type is NOT NULL).
    // On-device "item" extraction may leave type blank on low confidence — user must pick.
    if (items.some((it) => !it.type)) {
      setError('Choose a type for every item before saving.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      for (const it of items) {
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
          measurements: Object.keys(it.measurements).length ? it.measurements : undefined,
          brand: it.brand || undefined,
          link: it.link || undefined,
          graphics: it.graphics,
          source: it.method === 'ai' ? 'ai' : 'item',
        };
        await addWardrobeItem(input);
      }
      const storeErr = useAppStore.getState().wardrobeError;
      if (storeErr) {
        setError(storeErr);
        setSaving(false);
        return;
      }
      setSaving(false);
      setStep('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save items.');
      setSaving(false);
    }
  }, [items, addWardrobeItem]);

  const reset = useCallback(() => {
    setStep('upload');
    setPhotos([]);
    setItems([]);
    setProcessingIndex(0);
    setUpgrade(false);
    setError(null);
    setSaving(false);
  }, []);

  return {
    step, photos, items, processingIndex, creditStatus, upgrade, error, saving,
    addPhoto, removePhoto, setMethod, setNote,
    analyse, editItem, removeItem, confirm, reset,
    savedCount: items.length,
    photoCount: photos.length,
  };
}
