// Wardrobe Critic (feature 010) — client cache store.
//
// Server is stateless (plan.md): the report is computed on-demand and this
// store is the sole place it's cached, keyed by a hash of the current
// wardrobe. Persisted to AsyncStorage (same manual save/hydrate pattern as
// appStore/fitEngineStore — this repo does not use zustand's `persist`
// middleware) so the last report reopens instantly and survives an app
// restart, per FR-005 / SC-004.

import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { WardrobeGapReport, GapRecommendation, Localized } from '../types/wardrobeCritic';
import {
  fetchGapReport,
  WardrobeCriticRateLimitedError,
} from '../services/wardrobeCriticService';
import { useAppStore } from './appStore';
import { sb } from '../services/supabase';

const STORAGE_KEY = 'wardrobe-critic-store';

// Register the onAuthStateChange listener exactly once per app process.
// Without this, Fast Refresh / remount / re-hydrate calls stack duplicate
// listeners. Previously this store had NO auth listener at all — the cached
// report + AsyncStorage entry were never cleared on sign-out or account
// switch, so a different user signing in on the same device briefly saw the
// previous user's Wardrobe Report (cross-account leak).
let _criticAuthListenerRegistered = false;

export type WardrobeCriticStatus = 'idle' | 'loading' | 'error';

interface Persisted {
  report: WardrobeGapReport | null;
  wardrobeHash: string;
  wardrobeItemCount: number;
  dismissedIds: string[];
}

function save(data: Persisted): void {
  AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data)).catch(() => {});
}

/** Sorted-id digest of the current wardrobe. WardrobeItem has no updatedAt field,
 *  so id membership is the only stable signal available client-side — reordering
 *  or in-place edits (e.g. renaming) do not change the hash, matching the
 *  data-model note that dismissal resets track item COUNT, not arbitrary edits. */
function hashWardrobe(): { hash: string; count: number } {
  const items = useAppStore.getState().wardrobeItems;
  const ids = items.map((i) => i.id).sort();
  return { hash: ids.join(','), count: items.length };
}

interface WardrobeCriticState extends Persisted {
  status: WardrobeCriticStatus;
  error: string | null;
  hydrated: boolean;

  /** Try-On bridge (T031): archetype the user tapped "try when shopping" for,
   *  remembered so the Try-On result screen can reference it. NOT tryOnStore's
   *  concern — this is purely a Wardrobe Critic breadcrumb. */
  pendingGapArchetypeId: string | null;
  pendingGapLabel: Localized | null;

  hydrate: () => Promise<void>;
  /** Fetch a report unless the wardrobe hasn't changed since the cached one
   *  (cache hit → no-op). Pass force:true (pull-to-refresh) to always refetch. */
  fetchReport: (force?: boolean) => Promise<void>;
  /** Hide a recommendation until the wardrobe changes materially (FR-006). */
  dismiss: (archetypeId: string) => void;
  /** report.recommendations minus dismissed ones — the UI-visible set. */
  visibleRecommendations: () => GapRecommendation[];

  setPendingGap: (archetypeId: string, label: Localized) => void;
  clearPendingGap: () => void;
}

export const useWardrobeCriticStore = create<WardrobeCriticState>((set, get) => ({
  report: null,
  wardrobeHash: '',
  wardrobeItemCount: 0,
  dismissedIds: [],
  status: 'idle',
  error: null,
  hydrated: false,
  pendingGapArchetypeId: null,
  pendingGapLabel: null,

  hydrate: async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) {
        const data: Persisted = JSON.parse(raw);
        set({
          report: data.report ?? null,
          wardrobeHash: data.wardrobeHash ?? '',
          wardrobeItemCount: data.wardrobeItemCount ?? 0,
          dismissedIds: data.dismissedIds ?? [],
        });
      }
    } catch (err) {
      console.warn('[wardrobeCriticStore] hydrate failed:', err);
    } finally {
      set({ hydrated: true });
    }

    // Reset the cached report on sign-out or account switch so a different
    // user never sees the previous user's Wardrobe Report. Deduped by uid so
    // routine token refreshes (same user) don't clear anything.
    if (!_criticAuthListenerRegistered) {
      _criticAuthListenerRegistered = true;
      let lastAuthedUid: string | null = null;
      sb.auth.onAuthStateChange((_event, session) => {
        const uid = session?.user?.id ?? null;
        if (uid) {
          if (uid !== lastAuthedUid) {
            const isAccountSwitch = lastAuthedUid !== null;
            lastAuthedUid = uid;
            // Only reset on an actual switch between two signed-in users —
            // not on the very first INITIAL_SESSION event, which would wipe
            // the report we just loaded from AsyncStorage above for this
            // same user on cold start.
            if (isAccountSwitch) {
              set({
                report: null, wardrobeHash: '', wardrobeItemCount: 0, dismissedIds: [],
                status: 'idle', error: null,
                pendingGapArchetypeId: null, pendingGapLabel: null,
              });
              AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
            }
          }
        } else {
          lastAuthedUid = null;
          set({
            report: null, wardrobeHash: '', wardrobeItemCount: 0, dismissedIds: [],
            status: 'idle', error: null,
            pendingGapArchetypeId: null, pendingGapLabel: null,
          });
          AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
        }
      });
    }
  },

  fetchReport: async (force = false) => {
    const { hash, count } = hashWardrobe();
    const { report, wardrobeHash, wardrobeItemCount, dismissedIds } = get();

    // Cache hit: same wardrobe, already have a report, not a forced refresh.
    if (!force && report && hash === wardrobeHash) return;

    set({ status: 'loading', error: null });
    try {
      const nextReport = await fetchGapReport();
      // FR-006: dismissals only reset when the item COUNT changed (add/remove),
      // not on every hash change (which also fires for in-place edits).
      const nextDismissed = count !== wardrobeItemCount ? [] : dismissedIds;
      set({
        report: nextReport,
        wardrobeHash: hash,
        wardrobeItemCount: count,
        dismissedIds: nextDismissed,
        status: 'idle',
        error: null,
      });
      save({ report: nextReport, wardrobeHash: hash, wardrobeItemCount: count, dismissedIds: nextDismissed });
    } catch (err) {
      const message =
        err instanceof WardrobeCriticRateLimitedError
          ? 'rate_limited'
          : err instanceof Error
            ? err.message
            : 'Failed to load report.';
      set({ status: 'error', error: message });
    }
  },

  dismiss: (archetypeId) => {
    const { dismissedIds, report, wardrobeHash, wardrobeItemCount } = get();
    if (dismissedIds.includes(archetypeId)) return;
    const next = [...dismissedIds, archetypeId];
    set({ dismissedIds: next });
    save({ report, wardrobeHash, wardrobeItemCount, dismissedIds: next });
  },

  visibleRecommendations: () => {
    const { report, dismissedIds } = get();
    if (!report) return [];
    return report.recommendations.filter((r) => !dismissedIds.includes(r.archetypeId));
  },

  setPendingGap: (archetypeId, label) => set({ pendingGapArchetypeId: archetypeId, pendingGapLabel: label }),
  clearPendingGap: () => set({ pendingGapArchetypeId: null, pendingGapLabel: null }),
}));
