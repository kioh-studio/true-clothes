// useCreditQuota — read-only monthly quota for display, NOT a gate.
//
// The paywall stopped naming any numbers (see src/design/paywall/design.md,
// "Value copy 2026-08-08"), so the only honest place left to tell a user what
// their allowance actually is, is the screen that spends it. This hook fetches
// the credit status once when the screen mounts and again whenever the caller
// says something was consumed.
//
// It deliberately never blocks anything: every gate keeps calling checkCredit()
// itself at action time. A stale or missing reading here must degrade to
// "show nothing", never to "you have 0 left".

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  checkCredit,
  type CreditStatus,
  type CreditType,
} from '../../services/usageCreditService';

export interface CreditQuota {
  /** Latest usable reading, or null while loading / when it must stay hidden. */
  status: CreditStatus | null;
  /** Re-read after an action that consumed credit. Safe to call unconditionally. */
  refresh: () => void;
}

export function useCreditQuota(type: CreditType, enabled = true): CreditQuota {
  const [status, setStatus] = useState<CreditStatus | null>(null);

  // Guards a fetch resolving after unmount, and drops an earlier in-flight
  // read that a refresh() has already superseded (a refresh fired right after
  // an action must not be overwritten by the slower pre-action read).
  const mounted = useRef(true);
  const runId = useRef(0);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const load = useCallback(async () => {
    if (!enabled) return;
    const id = ++runId.current;
    try {
      const next = await checkCredit(type);
      if (!mounted.current || id !== runId.current) return;
      // Hide rather than mislead:
      //  - degraded  → the query failed; its remaining:0 is a fail-closed
      //                placeholder for the gate, not a real reading.
      //  - demo      → unmetered server-side; the free limit checkCredit()
      //                resolves for it is a placeholder, not their cap.
      setStatus(next.degraded || next.accountType === 'demo' ? null : next);
    } catch {
      // Signed out, offline, etc. — leave whatever we last had; a counter is
      // never important enough to surface an error for.
    }
  }, [type, enabled]);

  useEffect(() => { void load(); }, [load]);

  const refresh = useCallback(() => { void load(); }, [load]);

  return { status, refresh };
}
