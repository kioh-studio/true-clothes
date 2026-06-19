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
  error: string | null;
  /** True when the AI extraction was blocked by insufficient credits. */
  needsUpgrade: boolean;

  /** Clear all transient state back to idle. Temp-image cleanup is added in T034. */
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

  // ── User Story 2 placeholder (T028) ────────────────────────────────────────
  // fetchMixMatch(): Promise<void>
  // TODO(US2/T028): call `generate-outfits` with pin_item=scannedItem, store
  // mixMatchOutfits, set status 'mixMatch'.

  // ── User Story 3 placeholders (T033, T034) ─────────────────────────────────
  // addToWardrobe(): Promise<void>
  // TODO(US3/T033): build AddItemInput from scannedItem + verdict, call
  // wardrobeService.addItem, set status 'added'. Clean up temp images (T034).

  // discard(): void
  // TODO(US3/T034): delete temp image file (scannedItem.localImageUri), reset().
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

const INITIAL: Omit<
  TryOnState,
  'reset' | 'scan' | 'evaluate'
> = {
  status: 'idle',
  scannedItem: null,
  verdict: null,
  mixMatchOutfits: [],
  error: null,
  needsUpgrade: false,
};

export const useTryOnStore = create<TryOnState>((set, get) => ({
  ...INITIAL,

  reset: () => set({ ...INITIAL }),

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
}));
