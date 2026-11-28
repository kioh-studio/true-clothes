// AI photo consent store — caches the per-user consent state and drives the consent modal.
// Every flow that sends a photo to Gemini must `await requireAiPhotoConsent()` first.
import { create } from 'zustand';
import { sb } from '../services/supabase';
import {
  getAiPhotoConsent, grantAiPhotoConsent, withdrawAiPhotoConsent,
} from '../services/consentService';
import { isConsentValid } from '../features/consent/consentLogic';

// Register the auth listener once per process (same pattern as fitEngineStore).
let _listenerRegistered = false;
// Callers waiting on the open modal (concurrent flows share one prompt).
let _waiters: Array<(ok: boolean) => void> = [];

interface ConsentState {
  granted: boolean;
  loaded: boolean;
  modalOpen: boolean;
  submitting: boolean;
  submitError: boolean;

  refresh: () => Promise<void>;
  require: () => Promise<boolean>;
  accept: () => Promise<void>;
  decline: () => void;
  withdraw: () => Promise<void>;
}

function settle(ok: boolean) {
  const w = _waiters;
  _waiters = [];
  w.forEach((fn) => fn(ok));
}

export const useConsentStore = create<ConsentState>((set, get) => {
  function ensureAuthListener() {
    if (_listenerRegistered) return;
    _listenerRegistered = true;
    let lastUid: string | null | undefined;
    sb.auth.onAuthStateChange((_event, session) => {
      const uid = session?.user?.id ?? null;
      if (uid === lastUid) return; // token refresh etc.
      lastUid = uid;
      // Another account / signed out: drop the cache; next require()/refresh() re-reads the server.
      set({ granted: false, loaded: false, modalOpen: false, submitting: false, submitError: false });
      settle(false);
    });
  }

  return {
    granted: false,
    loaded: false,
    modalOpen: false,
    submitting: false,
    submitError: false,

    refresh: async () => {
      ensureAuthListener();
      try {
        const row = await getAiPhotoConsent();
        set({ granted: isConsentValid(row), loaded: true });
      } catch (err) {
        // Fail closed: unknown state counts as not consented.
        console.warn('[consentStore] refresh failed:', err);
        set({ granted: false, loaded: false });
      }
    },

    require: async () => {
      if (!get().loaded) await get().refresh();
      if (get().granted) return true;
      return new Promise<boolean>((resolve) => {
        _waiters.push(resolve);
        set({ modalOpen: true, submitError: false });
      });
    },

    accept: async () => {
      if (get().submitting) return;
      set({ submitting: true, submitError: false });
      try {
        await grantAiPhotoConsent();
        set({ granted: true, loaded: true, modalOpen: false, submitting: false });
        settle(true);
      } catch (err) {
        console.warn('[consentStore] grant failed:', err);
        set({ submitting: false, submitError: true });
      }
    },

    decline: () => {
      set({ modalOpen: false, submitError: false });
      settle(false);
    },

    withdraw: async () => {
      await withdrawAiPhotoConsent();
      set({ granted: false, loaded: true });
    },
  };
});

/** The single gate. Resolves true only when valid consent exists (asks once if not). */
export function requireAiPhotoConsent(): Promise<boolean> {
  return useConsentStore.getState().require();
}
