// Try On (feature 008) — orchestration hook.
// Screens read state and dispatch through this hook so they stay thin
// (Constitution II). Action wiring is added per user story.

import { useTryOnStore } from '../../stores/tryOnStore';
import type { ExtractMethod } from '../../types/tryOn';

export function useTryOn() {
  const status        = useTryOnStore((s) => s.status);
  const scannedItem   = useTryOnStore((s) => s.scannedItem);
  const verdict       = useTryOnStore((s) => s.verdict);
  const mixMatchOutfits = useTryOnStore((s) => s.mixMatchOutfits);
  const error         = useTryOnStore((s) => s.error);
  const needsUpgrade  = useTryOnStore((s) => s.needsUpgrade);
  const reset         = useTryOnStore((s) => s.reset);
  const scan          = useTryOnStore((s) => s.scan);
  const evaluate      = useTryOnStore((s) => s.evaluate);

  return {
    status,
    scannedItem,
    verdict,
    mixMatchOutfits,
    error,
    needsUpgrade,
    reset,
    /** T013: start a scan with a photo URI and preferred extraction method */
    scan: (photoUri: string, method: ExtractMethod = 'ai') => scan(photoUri, method),
    /** T015: evaluate the current scannedItem against the user's profile */
    evaluate,
    // TODO(US2/T028): expose fetchMixMatch
    // TODO(US3/T033): expose addToWardrobe
    // TODO(US3/T034): expose discard
  };
}
