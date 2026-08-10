// Hook: the user's real wardrobe, adapted for the manual outfit builder
// (app/build.tsx). Replaces the old `useAppStore().items` read, which
// resolved to the bundled 14-item mock catalog (src/data ITEMS) and never the
// user's own wardrobe (2026-08-10, see backlog.md).

import { useMemo } from 'react';
import { useAppStore } from '../../stores/appStore';
import { toBuilderItem, type BuilderItem } from './toBuilderItem';

export function useBuilderItems(): BuilderItem[] {
  const wardrobeItems = useAppStore(s => s.wardrobeItems);
  return useMemo(() => wardrobeItems.map(toBuilderItem), [wardrobeItems]);
}
