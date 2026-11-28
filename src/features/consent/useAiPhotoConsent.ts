// Settings-facing hook for the AI photo consent row.
import { useEffect } from 'react';
import { useConsentStore } from '../../stores/consentStore';

export function useAiPhotoConsent() {
  const granted = useConsentStore((s) => s.granted.ai_photo === true);
  const loaded = useConsentStore((s) => s.loaded.ai_photo === true);
  const refresh = useConsentStore((s) => s.refresh);
  const withdrawFor = useConsentStore((s) => s.withdraw);
  useEffect(() => { void refresh('ai_photo'); }, [refresh]);
  const withdraw = () => withdrawFor('ai_photo');
  return { granted, loaded, withdraw };
}
