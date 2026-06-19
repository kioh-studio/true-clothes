// extractByItemService — the on-device "Extract by item" wizard method (feature 007).
//
// Fully on-device, free, offline, private: NO network call and NO ai_extraction credit.
// Calls the native module (iOS Vision / Android ML Kit) to segment one garment from a
// plain background, then snaps coarse signals to the engine's controlled vocabulary.
// Returns the SAME shape as the AI method so both converge on the shared Review/save path.

import { extractItem, isAvailable } from '../../modules/expo-item-extract';
import { ExtractedItemWithImage, GarmentMetadata } from './imageGenerationService';
import { colorMatch } from '../utils/colorMatch';
import { labelToType } from './itemTypeMap';
import { measureDefaults } from '../features/wardrobe-add/measureSchema';
import { titleCase } from '../features/wardrobe-add/vocab';

export class ExtractByItemUnavailableError extends Error {
  constructor(message = 'On-device item extraction needs a custom dev build (unavailable here).') {
    super(message);
    this.name = 'ExtractByItemUnavailableError';
  }
}

/** True when the native on-device extractor is present (dev client on device). */
export const isExtractByItemAvailable: boolean = isAvailable;

/**
 * Extract a single item from a plain-background photo, on-device.
 * Returns exactly one entry (controlled-vocab metadata + transparent cut-out).
 * `notes` is accepted to keep the seam uniform with the AI path but is unused on-device.
 */
export async function extractItemOnDevice(
  photoUri: string,
  _notes?: string,
): Promise<ExtractedItemWithImage[]> {
  if (!isAvailable) throw new ExtractByItemUnavailableError();

  const res = await extractItem(photoUri);

  const color = colorMatch(res.palette?.[0]);          // always a valid controlled colour
  const type = labelToType(res.labels);                 // controlled type, or '' (user picks)
  const ocr = (res.ocrText ?? []).map((t) => t.trim()).filter(Boolean);

  const metadata: GarmentMetadata = {
    type,
    name: type ? `${color} ${titleCase(type)}` : `${color} item`,
    description: '',
    color,
    material: null,
    fit: null,
    pattern: 'solid',
    warmthSeason: null,
    measurements: measureDefaults(type),
    brand: null,
    graphics: {
      present: ocr.length > 0,
      size: null,
      kind: null,
      text: ocr.length > 0 ? ocr.join(' ').slice(0, 120) : null,
    },
    tags: [],
    confidence: res.labels?.[0]?.confidence ?? 0.5,
  };

  return [{ localImageUri: res.cutoutUri, usedFallback: res.usedFallback, metadata }];
}
