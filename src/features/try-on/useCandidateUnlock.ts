// useCandidateUnlock — Try-On → Wardrobe Critic bridge (feature 010, 2026-08-11).
//
// The Scan Result screen's "Fills your gap: {label}" line (ResultScreen.tsx)
// is pure presentation: it echoes the archetype label the user already saw
// on the Wardrobe Report, without ever re-scoring the item actually scanned.
// `wardrobe-critic`'s edge function already accepts an optional
// `candidate_item: { type, color, material, fit }` and returns
// `candidate: { unlockCount, matchedArchetypeId }` (server-side done and
// deployed) — this hook is the missing client wiring: it sends the scanned
// item's own attributes and surfaces the REAL unlock count.
//
// Deliberately independent of wardrobeCriticStore: that store caches the
// no-argument gap report keyed by a wardrobe-content hash (see
// stores/wardrobeCriticStore.ts hashWardrobe/fetchReport) — mixing a
// per-scanned-item candidate_item re-score into that cache would either
// stomp the general report's own `candidate: null` or get silently skipped
// by the cache-hit check when the wardrobe hasn't changed. This is a one-off,
// secondary lookup scoped to a single Result-screen visit, so it calls the
// service directly from local state instead — the same pattern
// MeasurementAIMap.tsx already uses for its own one-off AI call.
//
// Fails soft, by design: the gap-fill line is a secondary detail on a screen
// whose primary job is the verdict. `result` simply stays null on any
// failure/timeout — the caller keeps showing today's label-only line
// unchanged, never blocks on this, and never renders a loading spinner.

import { useEffect, useState } from 'react';
import { fetchGapReport } from '../../services/wardrobeCriticService';
import type { GarmentMetadata } from '../../services/imageGenerationService';

export interface CandidateUnlock {
  unlockCount: number;
  matchedArchetypeId: string | null;
}

/**
 * @param meta Scanned item's metadata (ScannedItem.metadata) — GarmentMetadata's
 *   type/color/material/fit map 1:1 onto the edge function's candidate_item.
 * @param enabled Only fetch while true — the caller gates this on the exact
 *   same condition that shows the "Fills your gap" banner
 *   (`pendingGapArchetypeId && pendingGapLabel`), so this never spends the
 *   shared wardrobe-critic rate-limit budget on an ordinary scan.
 */
export function useCandidateUnlock(meta: GarmentMetadata | null, enabled: boolean): CandidateUnlock | null {
  const [result, setResult] = useState<CandidateUnlock | null>(null);

  useEffect(() => {
    setResult(null);
    if (!enabled || !meta || !meta.type || !meta.type.trim()) return;

    let cancelled = false;
    fetchGapReport({
      type: meta.type,
      color: meta.color || undefined,
      material: meta.material ?? undefined,
      fit: meta.fit ?? undefined,
    })
      .then((report) => {
        if (cancelled || !report.candidate) return;
        setResult({
          unlockCount: report.candidate.unlockCount,
          matchedArchetypeId: report.candidate.matchedArchetypeId,
        });
      })
      .catch(() => {
        // Best-effort — the existing label-only line stays exactly as-is.
      });
    return () => { cancelled = true; };
  }, [enabled, meta?.type, meta?.color, meta?.material, meta?.fit]);

  return result;
}
