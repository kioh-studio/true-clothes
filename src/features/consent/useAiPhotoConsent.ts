// Settings-facing hook for the AI photo consent row.
import { useEffect } from 'react';
import { useConsentStore } from '../../stores/consentStore';

export function useAiPhotoConsent() {
  const granted = useConsentStore((s) => s.granted);
  const loaded = useConsentStore((s) => s.loaded);
  const refresh = useConsentStore((s) => s.refresh);
  const withdraw = useConsentStore((s) => s.withdraw);
  useEffect(() => { void refresh(); }, [refresh]);
  return { granted, loaded, withdraw };
}
