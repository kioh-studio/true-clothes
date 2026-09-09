// Responsive layout helpers.
// Always derive screen-dependent sizes from useWindowDimensions() — a
// module-level Dimensions.get('window') is frozen at import time and goes
// stale on rotation, split-screen, and foldables.

import { useWindowDimensions } from 'react-native';

/** Portrait-width breakpoints (pt). iPad mini ~744, iPad 10.9 ~820,
 *  iPad Pro 11 ~834, iPad Pro 13 ~1024. */
export const BP = { tablet: 600, tabletLg: 1024 } as const;

export type Breakpoint = 'phone' | 'tablet' | 'tabletLg';

/** Live breakpoint + raw dims. Recomputes on resize/split-screen. */
export function useResponsive() {
  const { width, height } = useWindowDimensions();
  const bp: Breakpoint =
    width >= BP.tabletLg ? 'tabletLg' : width >= BP.tablet ? 'tablet' : 'phone';
  return { width, height, bp, isTablet: bp !== 'phone' };
}

/** Adaptive grid column count. Phones keep `phone`; wider screens get more. */
export function useGridColumns(phone = 2, tablet = 3, tabletLg = 4): number {
  const { bp } = useResponsive();
  return bp === 'tabletLg' ? tabletLg : bp === 'tablet' ? tablet : phone;
}

/** Max width of a centered reading/form column on wide screens. */
export const CONTENT_MAX = 640;

/** Width of one card in an N-column grid with screen padding and gutters. */
export function useGridCardWidth(cols = 2, pad = 24, gap = 12): number {
  const { width } = useWindowDimensions();
  const bounded = Math.min(width, CONTENT_MAX * 2); // don't let cards get absurd on very wide screens
  return (bounded - pad * 2 - gap * (cols - 1)) / cols;
}
