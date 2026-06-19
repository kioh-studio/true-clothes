// Responsive layout helpers.
// Always derive screen-dependent sizes from useWindowDimensions() — a
// module-level Dimensions.get('window') is frozen at import time and goes
// stale on rotation, split-screen, and foldables.

import { useWindowDimensions } from 'react-native';

/** Width of one card in an N-column grid with screen padding and gutters. */
export function useGridCardWidth(cols = 2, pad = 24, gap = 12): number {
  const { width } = useWindowDimensions();
  return (width - pad * 2 - gap * (cols - 1)) / cols;
}
