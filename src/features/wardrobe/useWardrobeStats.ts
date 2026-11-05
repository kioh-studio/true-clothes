import { useMemo } from 'react';
import { useAppStore } from '../../stores/appStore';
import { localDateKey } from '../../utils/localDateKey';
import { wardrobeStats } from './wardrobeStats';

export function useWardrobeStats() {
  const wardrobeItems = useAppStore(s => s.wardrobeItems);
  const wearStats = useAppStore(s => s.wearStats);
  return useMemo(() => wardrobeStats(wardrobeItems, wearStats, localDateKey()), [wardrobeItems, wearStats]);
}
