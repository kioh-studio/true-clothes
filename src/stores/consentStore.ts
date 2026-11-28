// Consent store — caches per-consent state (keyed by ConsentId) and drives the consent modal.
// Every flow that sends a photo to Gemini must `await requireAiPhotoConsent()` first.
import { create } from 'zustand';
import { sb } from '../services/supabase';
import { getConsent, grant, withdraw } from '../services/consentService';
import { isConsentValid } from '../features/consent/consentLogic';
import type { ConsentId } from '../types/consent';

// Register the auth listener once per process (same pattern as fitEngineStore).
let _listenerRegistered = false;
// Callers waiting on the open modal (concurrent flows share one prompt).
let _waiters: Array<(ok: boolean) => void> = [];

type ByConsent<T> = Partial<Record<ConsentId, T>>;

interface ConsentState {
  granted: ByConsent<boolean>;
  loaded: ByConsent<boolean>;
  pending: ConsentId | null; // consent the open modal is asking for
  modalOpen: boolean;
  submitting: boolean;
  submitError: boolean;

  refresh: (id: ConsentId) => Promise<void>;
  require: (id: ConsentId) => Promise<boolean>;
  accept: () => Promise<void>;
  decline: () => void;
  withdraw: (id: ConsentId) => Promise<void>;
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
      set({ granted: {}, loaded: {}, pending: null, modalOpen: false, submitting: false, submitError: false });
      settle(false);
    });
  }

  return {
    granted: {},
    loaded: {},
    pending: null,
    modalOpen: false,
    submitting: false,
    submitError: false,

    refresh: async (id) => {
      ensureAuthListener();
      try {
        const row = await getConsent(id);
        set((st) => ({
          granted: { ...st.granted, [id]: isConsentValid(row, id) },
          loaded: { ...st.loaded, [id]: true },
        }));
      } catch (err) {
        // Fail closed: unknown state counts as not consented.
        console.warn('[consentStore] refresh failed:', err);
        set((st) => ({ granted: { ...st.granted, [id]: false }, loaded: { ...st.loaded, [id]: false } }));
      }
    },

    require: async (id) => {
      if (!get().loaded[id]) await get().refresh(id);
      if (get().granted[id]) return true;
      return new Promise<boolean>((resolve) => {
        _waiters.push(resolve);
        set({ modalOpen: true, pending: id, submitError: false });
      });
    },

    accept: async () => {
      const id = get().pending;
      if (!id || get().submitting) return;
      set({ submitting: true, submitError: false });
      try {
        await grant(id);
        set((st) => ({
          granted: { ...st.granted, [id]: true },
          loaded: { ...st.loaded, [id]: true },
          modalOpen: false,
          pending: null,
          submitting: false,
        }));
        settle(true);
      } catch (err) {
        console.warn('[consentStore] grant failed:', err);
        set({ submitting: false, submitError: true });
      }
    },

    decline: () => {
      set({ modalOpen: false, pending: null, submitError: false });
      settle(false);
    },

    withdraw: async (id) => {
      await withdraw(id);
      set((st) => ({ granted: { ...st.granted, [id]: false }, loaded: { ...st.loaded, [id]: true } }));
    },
  };
});

/** The single gate. Resolves true only when valid consent exists (asks once if not). */
export function requireAiPhotoConsent(): Promise<boolean> {
  return useConsentStore.getState().require('ai_photo');
}
