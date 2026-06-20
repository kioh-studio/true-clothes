// Try On (feature 008) — orchestration hook.
// Screens read state and dispatch through this hook so they stay thin
// (Constitution II). Action wiring is added per user story.

import { useTryOnStore } from '../../stores/tryOnStore';
import type { ExtractMethod } from '../../types/tryOn';

export function useTryOn() {
  const status          = useTryOnStore((s) => s.status);
  const scannedItem     = useTryOnStore((s) => s.scannedItem);
  const verdict         = useTryOnStore((s) => s.verdict);
  const mixMatchOutfits = useTryOnStore((s) => s.mixMatchOutfits);
  const mixMatchLoading = useTryOnStore((s) => s.mixMatchLoading);
  const error           = useTryOnStore((s) => s.error);
  const needsUpgrade    = useTryOnStore((s) => s.needsUpgrade);
  const reset           = useTryOnStore((s) => s.reset);
  const scan            = useTryOnStore((s) => s.scan);
  const evaluate        = useTryOnStore((s) => s.evaluate);
  const fetchMixMatch   = useTryOnStore((s) => s.fetchMixMatch);
  const addToWardrobe   = useTryOnStore((s) => s.addToWardrobe);

  return {
    status,
    scannedItem,
    verdict,
    mixMatchOutfits,
    mixMatchLoading,
    error,
    needsUpgrade,
    reset,
    /** T013: start a scan with a photo URI and preferred extraction method */
    scan: (photoUri: string, method: ExtractMethod = 'ai') => scan(photoUri, method),
    /** T015: evaluate the current scannedItem against the user's profile */
    evaluate,
    /** T028: build Mix & Match outfits pinned around the scanned item */
    fetchMixMatch,
    /** T033: commit the scanned item to the wardrobe */
    addToWardrobe,
    /** T034: discard the scanned item (deletes the temp cut-out) and reset */
    discard: reset,
  };
}
