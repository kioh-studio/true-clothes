// Try On (feature 008) — transient session store.
//
// Deliberately NOT persisted (no AsyncStorage persist middleware): the scanned
// item and its verdict live only for the duration of the flow. Nothing here is
// written to the wardrobe until the explicit Add action (FR-013, SC-004).
//
// Action implementations:
//   scan()/evaluate()       → User Story 1 (T013, T015) — implemented below
//   fetchMixMatch()         → User Story 2 (T028)        — placeholder
//   addToWardrobe()/discard → User Story 3 (T033, T034)  — placeholder

import { create } from 'zustand';
import * as FileSystem from 'expo-file-system/legacy';
import { ScannedItem, Verdict } from '../types/tryOn';
import { ScoredOutfit, WardrobeItem } from '../types/fitEngine';
import { GarmentMetadata } from '../services/imageGenerationService';
import { cutoutOnDevice } from '../services/extractByItemService';
import { extractItemsWithImages } from '../services/imageGenerationService';
import { checkCredit, incrementCredit } from '../services/usageCreditService';
import { hasPremiumAccountType } from '../services/profileService';
import { evaluateItem } from '../services/tryOnService';
import { AddItemInput } from '../services/wardrobeService';
import { categoryForType } from '../features/wardrobe-add/vocab';
import { useFitEngineStore } from './fitEngineStore';
import { useAppStore } from './appStore';
import type { ExtractMethod } from '../types/tryOn';

export type TryOnStatus =
  | 'idle'        // nothing scanned
  | 'scanning'    // extraction in progress
  | 'evaluating'  // verdict in progress
  | 'result'      // verdict ready
  | 'mixMatch'    // mix & match outfits ready
  | 'added';      // committed to wardrobe

export interface TryOnState {
  status: TryOnStatus;
  scannedItem: ScannedItem | null;
  verdict: Verdict | null;
  mixMatchOutfits: ScoredOutfit[];
  /** Mix & Match outfits are being fetched (US2). */
  mixMatchLoading: boolean;
  error: string | null;
  /** True when the AI extraction was blocked by insufficient credits. */
  needsUpgrade: boolean;

  /**
   * Clear all transient state back to idle AND delete the temporary cut-out
   * image (T034). Doubles as the "No / discard" action (FR-015, SC-004):
   * nothing is ever persisted, and the temp file does not leak.
   */
  reset: () => void;

  /**
   * T013 — Scan action.
   * Try On ALWAYS uses the AI path (`extractItemsWithImages` → `generate-item-image`)
   * so the Verdict has rich, controlled-vocab metadata (color/material/fit/pattern/
   * measurement). Credit-gated unless premium; if credits are insufficient, set
   * `needsUpgrade:true` and stop — no extraction.
   *
   * The AI returns the item on a WHITE background; we then run the on-device ML
   * segmenter (`cutoutOnDevice`) to turn it into a transparent cut-out so the
   * Result screen and Mix & Match render it as a clean "cut off background" item
   * (no-op when native ML is unavailable → graceful white-bg fallback).
   *
   * Takes the FIRST returned `ExtractedItemWithImage`, builds a `ScannedItem` with
   * id "scanned". Does NOT persist anything.
   */
  scan: (photoUri: string, method: ExtractMethod) => Promise<void>;

  /**
   * T015 — Evaluate action.
   * Calls tryOnService.evaluateItem for the current scannedItem, stores the
   * resulting Verdict, and advances status to 'result'. Recoverable on failure.
   */
  evaluate: () => Promise<void>;

  /**
   * T028 — Mix & Match action.
   * Asks fitEngineStore to build outfits pinned around the scanned item, stores
   * them, and advances status to 'mixMatch'. Recoverable on failure (FR-017).
   * Consumes no credit; never persists the scanned item.
   */
  fetchMixMatch: () => Promise<void>;

  /**
   * T033 — Add action.
   * Maps the ScannedItem to an AddItemInput (category via categoryForType,
   * source = the extraction method to avoid a DB constraint change), commits it
   * through appStore.addWardrobeItem, then deletes the temp cut-out file and
   * advances status to 'added'. The only point anything is persisted (FR-013).
   */
  addToWardrobe: () => Promise<void>;

  /**
   * Build outfits around an item the user ALREADY owns (from item detail).
   * Maps the wardrobe item into a transient pin (`ScannedItem`) so the existing
   * Mix & Match path (`fetchMixMatch` → `generate-outfits` pin_item) works
   * unchanged. The wardrobe photo is reused with `keepImage:true` so cleanup
   * never deletes the durable file. Caller then navigates to /try-on/mix-match.
   * Does NOT persist or re-add anything.
   *
   * `imageUri` is the caller's already-resolved display image (via useItemPhoto):
   * WardrobeItem.photoLocalUri/photoUrl are in-memory-only and usually null in the
   * store, so the screen resolves the photo and passes the uri in for the card.
   */
  pinWardrobeItem: (item: WardrobeItem, imageUri?: string | null) => void;
}

// ─── file uri → base64 data URI (same helper as useAddWizard) ─────────────────

async function toDataUri(uri: string): Promise<string> {
  if (uri.startsWith('data:')) return uri;
  const b64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const ext = uri.split('.').pop()?.toLowerCase();
  const mime =
    ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
  return `data:${mime};base64,${b64}`;
}

// Best-effort deletion of the transient cut-out file. On Add, wardrobeService
// has already made its own durable copy, so removing our temp file is safe; on
// discard, this prevents leaked images (R7 / FR-015).
async function cleanupTempImage(uri: string | null): Promise<void> {
  if (!uri || !uri.startsWith('file://')) return;
  try {
    await FileSystem.deleteAsync(uri, { idempotent: true });
  } catch {
    // best-effort — a leftover temp file must never block the flow
  }
}

const INITIAL: Omit<
  TryOnState,
  'reset' | 'scan' | 'evaluate' | 'fetchMixMatch' | 'addToWardrobe' | 'pinWardrobeItem'
> = {
  status: 'idle',
  scannedItem: null,
  verdict: null,
  mixMatchOutfits: [],
  mixMatchLoading: false,
  error: null,
  needsUpgrade: false,
};

export const useTryOnStore = create<TryOnState>((set, get) => ({
  ...INITIAL,

  // T034 — discard/cleanup. Fire-and-forget the temp-file delete so the UI can
  // reset synchronously; nothing is ever persisted before Add (FR-013/FR-015).
  reset: () => {
    const current = get().scannedItem;
    // Never delete an image we don't own (e.g. a wardrobe item reused as a pin).
    const uri = current && !current.keepImage ? current.localImageUri : null;
    cleanupTempImage(uri).catch(() => {});
    set({ ...INITIAL });
  },

  // ── T013: scan ─────────────────────────────────────────────────────────────

  scan: async (photoUri: string, _method: ExtractMethod) => {
    set({ status: 'scanning', error: null, needsUpgrade: false, scannedItem: null, verdict: null });

    try {
      // Try On ALWAYS uses the AI path so the Verdict gets rich metadata
      // (color/material/fit/pattern/measurement). Credit-gated unless premium.
      const isPremium = await hasPremiumAccountType();

      if (!isPremium) {
        const creditStatus = await checkCredit('ai_extraction');
        if (creditStatus.remaining < 1) {
          set({ status: 'idle', needsUpgrade: true, error: null });
          return;
        }
      }

      const dataUri = await toDataUri(photoUri);
      const results = await extractItemsWithImages(dataUri);

      if (!isPremium && results.length > 0) {
        await incrementCredit('ai_extraction');
      }

      if (!results || results.length === 0) {
        set({
          status: 'idle',
          error: 'No item detected. Try a clearer photo on a plain background.',
        });
        return;
      }

      const extracted = results[0];

      // The edge function keys out the background server-side → a transparent PNG
      // (extracted.keyed === true). Only when that wasn't possible (keyed false,
      // e.g. a non-uniform AI bg) do we fall back to the on-device ML segmenter
      // (no-op when native ML is absent → graceful background-kept fallback).
      let localImageUri = extracted.localImageUri ?? null;
      let resolvedUsedFallback = extracted.usedFallback ?? false;
      if (localImageUri && !extracted.keyed) {
        const cut = await cutoutOnDevice(localImageUri);
        if (cut.uri !== localImageUri) {
          if (localImageUri.startsWith('file://')) {
            FileSystem.deleteAsync(localImageUri, { idempotent: true }).catch(() => {});
          }
          localImageUri = cut.uri;
          resolvedUsedFallback = cut.usedFallback;
        }
      }

      const scannedItem: ScannedItem = {
        id: 'scanned',
        localImageUri,
        metadata: extracted.metadata,
        method: 'ai',
        usedFallback: resolvedUsedFallback,
      };

      // 'evaluating' is set by evaluate(); here we land at a pre-result state
      // so the screen can navigate and trigger evaluate() on mount.
      set({ status: 'evaluating', scannedItem, error: null });
    } catch (err) {
      set({
        status: 'idle',
        error: err instanceof Error ? err.message : 'Scan failed. Please try again.',
      });
    }
  },

  // ── T015: evaluate ─────────────────────────────────────────────────────────

  evaluate: async () => {
    const { scannedItem } = get();
    if (!scannedItem) return;

    set({ status: 'evaluating', error: null });

    try {
      const verdict = await evaluateItem(scannedItem);
      set({ status: 'result', verdict });
    } catch (err) {
      // Recoverable: user stays on result screen and can retry
      set({
        status: 'result',
        error: err instanceof Error ? err.message : 'Evaluation failed. Try again.',
      });
    }
  },

  // ── T028: fetchMixMatch ──────────────────────────────────────────────────────

  fetchMixMatch: async () => {
    const { scannedItem } = get();
    if (!scannedItem) return;

    set({ mixMatchLoading: true, error: null });

    try {
      const outfits = await useFitEngineStore.getState().fetchMixMatchOutfits(scannedItem);
      set({ mixMatchOutfits: outfits, status: 'mixMatch', mixMatchLoading: false });
    } catch (err) {
      // Recoverable: the feed shows a retry; the scanned item stays unsaved.
      set({
        mixMatchLoading: false,
        error: err instanceof Error ? err.message : 'Mix & match failed. Try again.',
      });
    }
  },

  // ── T033: addToWardrobe ──────────────────────────────────────────────────────

  addToWardrobe: async () => {
    const { scannedItem } = get();
    if (!scannedItem) return;

    const meta = scannedItem.metadata;
    const input: AddItemInput = {
      localPhotoUri: scannedItem.localImageUri,
      category: categoryForType(meta.type),
      colors: meta.color ? [meta.color] : [],
      name: meta.name || undefined,
      type: meta.type,
      primaryColor: meta.color || undefined,
      material: meta.material ?? undefined,
      fit: meta.fit ?? undefined,
      pattern: meta.pattern ?? undefined,
      warmthSeason: meta.warmthSeason ? [meta.warmthSeason] : undefined,
      measurements:
        meta.measurements && Object.keys(meta.measurements).length
          ? meta.measurements
          : undefined,
      brand: meta.brand || undefined,
      graphics: meta.graphics,
      // Reuse the existing extraction provenance ('ai' | 'item') so we don't have
      // to touch the possibly-constrained clothing_items.source column (plan/R).
      source: scannedItem.method,
    };

    set({ error: null });

    await useAppStore.getState().addWardrobeItem(input);

    const wardrobeError = useAppStore.getState().wardrobeError;
    if (wardrobeError) {
      // Recoverable: nothing committed cleanly; surface and let the user retry.
      set({ error: wardrobeError });
      return;
    }

    // Saved — wardrobeService owns a durable copy now, so drop our temp cut-out.
    // (Skip when the image is owned elsewhere, e.g. a reused wardrobe photo.)
    if (!scannedItem.keepImage) await cleanupTempImage(scannedItem.localImageUri);
    set({ status: 'added' });
  },

  // ── pinWardrobeItem: build outfits around an item the user already owns ───────

  pinWardrobeItem: (item: WardrobeItem, imageUri?: string | null) => {
    // Drop any prior transient scan first so its temp cut-out doesn't leak.
    const prev = get().scannedItem;
    if (prev && !prev.keepImage) cleanupTempImage(prev.localImageUri).catch(() => {});

    const type = (item.type || categoryToType(item.category)).toUpperCase();
    const metadata: GarmentMetadata = {
      type,
      name: item.name ?? '',
      description: '',
      color: item.primaryColor || item.colors[0] || 'Natural',
      material: item.material ?? null,
      fit: item.fit ?? null,
      pattern: item.pattern ?? null,
      warmthSeason: item.warmthSeason?.[0] ?? null,
      measurements: item.measurements ?? {},
      brand: item.brand ?? null,
      graphics: item.graphics ?? null,
      tags: [],
      confidence: 1,
    };

    const scannedItem: ScannedItem = {
      id: 'scanned',          // synthetic pin id the engine + MatchFeedCard expect
      // Prefer the caller's resolved uri; photoLocalUri/photoUrl are usually null
      // in the store (resolved per-component via useItemPhoto, never persisted).
      localImageUri: imageUri ?? item.photoLocalUri ?? item.photoUrl ?? null,
      metadata,
      method: 'ai',
      usedFallback: false,
      keepImage: true,        // durable wardrobe photo — never delete on cleanup
    };

    set({
      ...INITIAL,
      status: 'evaluating',   // a non-idle pre-result state; the feed fetches on mount
      scannedItem,
    });
  },
}));

// Reverse of categoryForType: a sensible default garment type when a wardrobe
// item has no granular `type` (older/manual items). The engine slots the pin by
// type, so it must be a controlled value.
function categoryToType(category: WardrobeItem['category']): string {
  switch (category) {
    case 'top':       return 'TEE';
    case 'bottom':    return 'TROUSERS';
    case 'outerwear': return 'JACKET';
    case 'footwear':  return 'SNEAKERS';
    case 'dress':     return 'DRESS';
    case 'headwear':  return 'CAP';
    case 'accessory':
    default:          return 'BAG';
  }
}
