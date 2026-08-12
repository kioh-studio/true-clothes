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
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { ScannedItem, Verdict } from '../types/tryOn';
import { ScoredOutfit, WardrobeItem, MKey } from '../types/fitEngine';
import { GarmentMetadata } from '../services/imageGenerationService';
import { cutoutOnDevice } from '../services/extractByItemService';
import { extractItemsWithImages } from '../services/imageGenerationService';
import { checkCredit, isCreditExhausted } from '../services/usageCreditService';
import { hasPremiumAccountType } from '../services/profileService';
import { evaluateItem } from '../services/tryOnService';
import i18n from '../i18n';
import { AddItemInput } from '../services/wardrobeService';
import { categoryForType } from '../features/wardrobe-add/vocab';
import { dominantHexesFromUri } from '../features/wardrobe-add/colorClusterUri';
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

  /**
   * Feature 009 — Replace the current scannedItem's garment measurements with
   * `next` and re-evaluate so the Verdict's Measurement criterion reflects the new
   * values. No-op when there is no scannedItem. The caller passes the FULL next map
   * of canonical m_* keys (cm; EU number for shoe size) — used both by manual
   * per-field edits (which may also clear a key) and by the AI mapper (which merges
   * its result over the current map before calling this).
   */
  applyMeasurements: (next: Partial<Record<MKey, number>>) => Promise<void>;

  /**
   * Populate mixMatchOutfits in the background WITHOUT changing status, so the
   * Result screen can show a "wardrobe fit" signal and the Mix & Match feed opens
   * instantly. Best-effort: failures are swallowed (the verdict is the primary
   * content). No credit consumed (curate:false, same as fetchMixMatch).
   */
  prefetchMixMatch: () => Promise<void>;
}

// ─── file uri → base64 data URI (same helper as useAddWizard) ─────────────────

async function toDataUri(uri: string): Promise<string> {
  if (uri.startsWith('data:')) return uri;
  // ALWAYS run through the manipulator (a no-op transform with no actions):
  // it normalises the platform picker URIs (Android `content://`, iOS `ph://`)
  // into a readable `file://` JPEG. `readAsStringAsync` cannot read a raw
  // `content://` on Android, so picking a library photo there would throw
  // before the scan ever reached the edge function (same class of bug fixed
  // in tryOnWearService.toScaledDataUri).
  const out = await manipulateAsync(uri, [], { compress: 0.92, format: SaveFormat.JPEG });
  const b64 = await FileSystem.readAsStringAsync(out.uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return `data:image/jpeg;base64,${b64}`;
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
  'reset' | 'scan' | 'evaluate' | 'fetchMixMatch' | 'addToWardrobe' | 'pinWardrobeItem' | 'applyMeasurements' | 'prefetchMixMatch'
> = {
  status: 'idle',
  scannedItem: null,
  verdict: null,
  mixMatchOutfits: [],
  mixMatchLoading: false,
  error: null,
  needsUpgrade: false,
};

export const useTryOnStore = create<TryOnState>((set, get) => {
  // Bumped by reset(), pinWardrobeItem() and every new scan() call — i.e.
  // whenever the CURRENT ITEM identity changes. A scan() invocation captures
  // the value at its start and checks it before every `set(...)` — if reset()
  // or a newer scan() ran in the meantime, this run is stale and must not
  // clobber the (possibly already-idle) store, nor leak the file it
  // generated. Fixes: cancelling mid-scan (back button) then re-opening Try On
  // no longer resurrects a scan the user already discarded.
  //
  // evaluate()/fetchMixMatch()/prefetchMixMatch() do NOT bump this counter
  // themselves (they act on the CURRENT item, they don't start a new one) —
  // they only CAPTURE it at call start and compare at resolve time, so a
  // late-resolving call is dropped if the item changed underneath it (e.g.
  // evaluate() for item A resolving after scan()/pinWardrobeItem() already
  // moved on to item B). Bumping it from those three would be wrong: they
  // can legitimately run concurrently for the SAME item (e.g. evaluate() and
  // prefetchMixMatch() both fire on Result-screen mount) and must not
  // invalidate each other.
  let scanGeneration = 0;

  return {
  ...INITIAL,

  // T034 — discard/cleanup. Fire-and-forget the temp-file delete so the UI can
  // reset synchronously; nothing is ever persisted before Add (FR-013/FR-015).
  reset: () => {
    scanGeneration++;
    const current = get().scannedItem;
    // Never delete an image we don't own (e.g. a wardrobe item reused as a pin).
    const uri = current && !current.keepImage ? current.localImageUri : null;
    cleanupTempImage(uri).catch(() => {});
    set({ ...INITIAL });
  },

  // ── T013: scan ─────────────────────────────────────────────────────────────

  scan: async (photoUri: string, _method: ExtractMethod) => {
    const myGeneration = ++scanGeneration;
    const isStale = () => myGeneration !== scanGeneration;
    set({ status: 'scanning', error: null, needsUpgrade: false, scannedItem: null, verdict: null });

    try {
      // Try On ALWAYS uses the AI path so the Verdict gets rich metadata
      // (color/material/fit/pattern/measurement). Credit-gated unless premium.
      const isPremium = await hasPremiumAccountType();

      if (!isPremium) {
        const creditStatus = await checkCredit('ai_extraction');
        if (creditStatus.remaining < 1) {
          if (!isStale()) set({ status: 'idle', needsUpgrade: true, error: null });
          return;
        }
      }

      const dataUri = await toDataUri(photoUri);
      let results: Awaited<ReturnType<typeof extractItemsWithImages>>;
      try {
        results = await extractItemsWithImages(dataUri);
      } catch (invokeErr) {
        if (await isCreditExhausted(invokeErr)) {
          if (!isStale()) set({ status: 'idle', needsUpgrade: true, error: null });
          return;
        }
        throw invokeErr;
      }

      if (!results || results.length === 0) {
        if (!isStale()) {
          set({
            status: 'idle',
            error: i18n.t('tryOnStore_noItemDetected'),
          });
        }
        return;
      }

      const extracted = results[0];

      // The edge function keys out the background server-side → a transparent PNG
      // (extracted.keyed === true). Only when that wasn't possible (keyed false,
      // e.g. a non-uniform AI bg) do we fall back to the on-device ML segmenter
      // (no-op when native ML is absent → graceful background-kept fallback).
      let localImageUri = extracted.localImageUri ?? null;
      let resolvedUsedFallback = extracted.usedFallback ?? false;
      let metadata = extracted.metadata;
      if (localImageUri && !extracted.keyed) {
        const cut = await cutoutOnDevice(localImageUri);
        if (cut.uri !== localImageUri) {
          if (localImageUri.startsWith('file://')) {
            FileSystem.deleteAsync(localImageUri, { idempotent: true }).catch(() => {});
          }
          localImageUri = cut.uri;
          resolvedUsedFallback = cut.usedFallback;
        }
        // Measured-hex hygiene (2026-07-06, same rationale as useAddWizard's
        // refineAiCutout): the server computed primaryHex/secondaryHex on the
        // FINAL keyed image — keyed:false means the chroma background is still
        // in those pixels, so its hex is unreliable. Recompute from the refined
        // transparent cut-out when we made one, else null the hex out.
        if (localImageUri && localImageUri !== extracted.localImageUri) {
          const hexes = await dominantHexesFromUri(localImageUri);
          metadata = { ...metadata, primaryHex: hexes.primaryHex, secondaryHex: hexes.secondaryHex };
        } else {
          metadata = { ...metadata, primaryHex: null, secondaryHex: null };
        }
      }

      if (isStale()) {
        // Superseded by reset()/a newer scan() while this one was in flight —
        // drop the result and clean up the file it produced so it doesn't leak.
        if (localImageUri && localImageUri.startsWith('file://')) {
          FileSystem.deleteAsync(localImageUri, { idempotent: true }).catch(() => {});
        }
        return;
      }

      const scannedItem: ScannedItem = {
        id: 'scanned',
        localImageUri,
        metadata,
        method: 'ai',
        usedFallback: resolvedUsedFallback,
      };

      // 'evaluating' is set by evaluate(); here we land at a pre-result state
      // so the screen can navigate and trigger evaluate() on mount.
      set({ status: 'evaluating', scannedItem, error: null });
    } catch (err) {
      if (!isStale()) {
        set({
          status: 'idle',
          error: err instanceof Error ? err.message : i18n.t('tryOnStore_scanFailed'),
        });
      }
    }
  },

  // ── T015: evaluate ─────────────────────────────────────────────────────────

  evaluate: async () => {
    const { scannedItem } = get();
    if (!scannedItem) return;

    // Capture (not bump — see comment on `scanGeneration` above) so a late
    // resolution after the item changed (scan()/pinWardrobeItem()/reset())
    // is dropped instead of stomping the newer item's verdict.
    const myGeneration = scanGeneration;
    const isStale = () => myGeneration !== scanGeneration;

    set({ status: 'evaluating', error: null });

    try {
      const locale = i18n.language?.startsWith('vi') ? 'vi' : 'en';
      const verdict = await evaluateItem(scannedItem, locale);
      if (!isStale()) set({ status: 'result', verdict });
    } catch (err) {
      // Recoverable: user stays on result screen and can retry
      if (!isStale()) {
        set({
          status: 'result',
          error: err instanceof Error ? err.message : i18n.t('tryOnStore_evaluationFailed'),
        });
      }
    }
  },

  // ── T028: fetchMixMatch ──────────────────────────────────────────────────────

  fetchMixMatch: async () => {
    const { scannedItem } = get();
    if (!scannedItem) return;

    // Capture (not bump — see comment on `scanGeneration` above): drop this
    // result if the item changed underneath it while the fetch was in flight.
    const myGeneration = scanGeneration;
    const isStale = () => myGeneration !== scanGeneration;

    set({ mixMatchLoading: true, error: null });

    try {
      const outfits = await useFitEngineStore.getState().fetchMixMatchOutfits(scannedItem);
      if (!isStale()) set({ mixMatchOutfits: outfits, status: 'mixMatch', mixMatchLoading: false });
    } catch (err) {
      // Recoverable: the feed shows a retry; the scanned item stays unsaved.
      if (!isStale()) {
        set({
          mixMatchLoading: false,
          error: err instanceof Error ? err.message : i18n.t('tryOnStore_mixMatchFailed'),
        });
      }
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
      // Measured-hex color layer (2026-07-06): carried from the scan metadata
      // (server-computed for keyed images; recomputed/nulled in scan() otherwise).
      primaryHex: meta.primaryHex ?? null,
      secondaryHex: meta.secondaryHex ?? null,
      // Distressed finish + dual-role layering + visual enrichment đợt 2
      // (2026-08-11 threading fix): this path was the odd one out — the AI
      // add-wizard already carried these into its AddItemInput, but Try-On's
      // addToWardrobe built its own object from scratch and simply never
      // copied them over, so an item saved via Try-On silently lost data the
      // same scan already extracted. Try-On always uses the AI method
      // (scan()'s comment above), so `meta` here is the same GarmentMetadata
      // shape the add-wizard gets — no on-device "no source" case to worry
      // about on this path.
      distressed: meta.distressed ?? null,
      opacity: meta.opacity ?? null,
      canLayer: meta.canLayer ?? null,
      printScale: meta.printScale ?? null,
      drape: meta.drape ?? null,
      visualInterest: meta.visualInterest ?? null,
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
    // Invalidate any in-flight scan() (this replaces the whole store state
    // below, same as reset()) and drop any prior transient scan's cut-out.
    scanGeneration++;
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
      // Measured-hex color layer (2026-07-06): carry the stored hex through so
      // downstream consumers of the pinned metadata see the same colour signal.
      primaryHex: item.primaryHex ?? null,
      secondaryHex: item.secondaryHex ?? null,
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
      sourceItemId: item.id,  // real id → wear-on-you can use the real photo
    };

    set({
      ...INITIAL,
      status: 'evaluating',   // a non-idle pre-result state; the feed fetches on mount
      scannedItem,
    });
  },
  // ── applyMeasurements: merge shop measurements + re-evaluate (feature 009) ─────

  applyMeasurements: async (next: Partial<Record<MKey, number>>) => {
    const { scannedItem } = get();
    if (!scannedItem) return;

    const updated: ScannedItem = {
      ...scannedItem,
      metadata: { ...scannedItem.metadata, measurements: { ...next } },
    };

    set({ scannedItem: updated });
    await get().evaluate();
  },

  // ── prefetchMixMatch: background wardrobe-fit signal (feature 008) ─────────────

  prefetchMixMatch: async () => {
    const { scannedItem, mixMatchOutfits, mixMatchLoading } = get();
    if (!scannedItem || mixMatchOutfits.length > 0 || mixMatchLoading) return;

    // Capture (not bump — see comment on `scanGeneration` above): if the item
    // changes (new scan/pin/reset) before this resolves, drop the result
    // instead of stuffing the OLD item's Mix & Match into the CURRENT state.
    const myGeneration = scanGeneration;
    const isStale = () => myGeneration !== scanGeneration;

    set({ mixMatchLoading: true });
    try {
      const outfits = await useFitEngineStore.getState().fetchMixMatchOutfits(scannedItem);
      if (!isStale()) set({ mixMatchOutfits: outfits, mixMatchLoading: false });
    } catch (err) {
      console.warn('[tryOnStore] prefetchMixMatch failed:', err);
      // leave outfits empty → band weak/none; no error surfaced
      if (!isStale()) set({ mixMatchLoading: false });
    }
  },
  };
});

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
