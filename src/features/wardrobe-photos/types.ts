// Feature-local types for wardrobe item photo rendering (003-upload-image).
import type { ImageSourcePropType } from 'react-native';
import type { WardrobeItem } from '../../types/fitEngine';

/** Resolution state for an item's photo. */
export type PhotoStatus = 'ready' | 'loading' | 'missing';

/** Minimal shape `useItemPhoto` needs — works for both remote wardrobe items
 *  (photoStorage/photoPath) and bundled demo items (png require-asset). */
export type PhotoInput = Pick<WardrobeItem, 'id' | 'photoStorage' | 'photoPath'> & { png?: number };

export interface ResolvedPhoto {
  /** Ready-to-use RN <Image source>, or null when missing/loading. */
  source: ImageSourcePropType | null;
  status: PhotoStatus;
}
