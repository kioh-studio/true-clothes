// Local-only debug counter for the on-device face-composite step (try-on
// fixes, 2026-08-06). compositeFace() runs entirely on-device and previously
// only logged to __DEV__ console (useWearOnYou.ts) — nobody could tell
// whether the feature actually works across real devices/photos. This keeps
// a tiny running tally in AsyncStorage (the app's existing lightweight
// persistence pattern — see appStore.ts / fitEngineStore.ts) so the counts
// survive app restarts for later inspection. No server calls, no photo data
// — just small integer counters, now including a per-reason breakdown
// (2026-08-07) so a __DEV__ caption can show WHY compositing keeps falling
// back, not just that it did.

import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'try-on-face-composite-stats';

export interface FaceCompositeStats {
  attempts: number;
  applied: number;
  fallbacks: number;
  /** Count per CompositeReason (see faceComposite.ts) — e.g. how many times
   *  compositing fell back because of 'no_face_source' vs 'decode_failed'
   *  etc. Added 2026-08-07 alongside the compositeFace() diagnostics
   *  overhaul; keyed by string (not the CompositeReason type) so this module
   *  doesn't need to import from faceComposite.ts. */
  byReason: Record<string, number>;
}

const EMPTY_STATS: FaceCompositeStats = { attempts: 0, applied: 0, fallbacks: 0, byReason: {} };

export async function getFaceCompositeStats(): Promise<FaceCompositeStats> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...EMPTY_STATS, byReason: {} };
    const parsed = JSON.parse(raw) as Partial<FaceCompositeStats> | null;
    // byReason is new (2026-08-07) — payloads written before this change
    // won't have it; default to {} so old stored stats keep parsing cleanly.
    const byReason = parsed?.byReason && typeof parsed.byReason === 'object' ? parsed.byReason : {};
    return {
      attempts: typeof parsed?.attempts === 'number' ? parsed.attempts : 0,
      applied: typeof parsed?.applied === 'number' ? parsed.applied : 0,
      fallbacks: typeof parsed?.fallbacks === 'number' ? parsed.fallbacks : 0,
      byReason,
    };
  } catch {
    return { ...EMPTY_STATS, byReason: {} };
  }
}

/**
 * Record the outcome of one compositeFace() attempt. `applied` keeps its
 * existing meaning (true = pasted, false = fell back); `reason` is the
 * specific CompositeReason string (e.g. 'ok', 'no_face_source',
 * 'implausible_alignment') tallied under `byReason`. Best-effort — never
 * throws, so a storage hiccup can't disrupt the try-on flow.
 */
export async function recordFaceCompositeOutcome(applied: boolean, reason: string): Promise<void> {
  try {
    const stats = await getFaceCompositeStats();
    stats.attempts += 1;
    if (applied) stats.applied += 1;
    else stats.fallbacks += 1;
    stats.byReason[reason] = (stats.byReason[reason] ?? 0) + 1;
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(stats));
  } catch {
    // best-effort debug counter — never blocks the try-on flow
  }
}
