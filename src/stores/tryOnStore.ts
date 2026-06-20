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
import { ScoredOutfit } from '../types/fitEngine';
import { extractItemOnDevice, isExtractByItemAvailable } from '../services/extractByItemService';
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
   * Picks the extraction path:
   *   1. If `isExtractByItemAvailable`, use the on-device path (free, no credit).
   *   2. Otherwise use `extractItemsWithImages` (AI path) with credit gate.
   *      If credits are insufficient, set `needsUpgrade:true` and stop — no extraction.
   *
   * Takes the FIRST returned `ExtractedItemWithImage`, builds a `ScannedItem` with
   * id "scanned", carrying method + usedFallback flag. Does NOT persist anything.
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
  'reset' | 'scan' | 'evaluate' | 'fetchMixMatch' | 'addToWardrobe'
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
    const uri = get().scannedItem?.localImageUri ?? null;
    cleanupTempImage(uri).catch(() => {});
    set({ ...INITIAL });
  },

  // ── T013: scan ─────────────────────────────────────────────────────────────

  scan: async (photoUri: string, method: ExtractMethod) => {
    set({ status: 'scanning', error: null, needsUpgrade: false, scannedItem: null, verdict: null });

    try {
      let results;
      let usedFallback = false;
      let resolvedMethod: ExtractMethod = method;

      if (isExtractByItemAvailable) {
        // On-device path: free, no credits consumed
        resolvedMethod = 'item';
        results = await extractItemOnDevice(photoUri);
        usedFallback = results[0]?.usedFallback ?? false;
      } else {
        // AI path: requires credit check (unless premium)
        resolvedMethod = 'ai';
        const isPremium = await hasPremiumAccountType();

        if (!isPremium) {
          const creditStatus = await checkCredit('ai_extraction');
          if (creditStatus.remaining < 1) {
            set({ status: 'idle', needsUpgrade: true, error: null });
            return;
          }
        }

        const dataUri = await toDataUri(photoUri);
        results = await extractItemsWithImages(dataUri);

        if (!isPremium && results.length > 0) {
          await incrementCredit('ai_extraction');
        }

        usedFallback = false;
      }

      if (!results || results.length === 0) {
        set({
          status: 'idle',
          error: 'No item detected. Try a clearer photo on a plain background.',
        });
        return;
      }

      const extracted = results[0];

      const scannedItem: ScannedItem = {
        id: 'scanned',
        localImageUri: extracted.localImageUri ?? null,
        metadata: extracted.metadata,
        method: resolvedMethod,
        usedFallback: extracted.usedFallback ?? usedFallback,
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
    await cleanupTempImage(scannedItem.localImageUri);
    set({ status: 'added' });
  },
}));
