// expo-item-extract — JS bindings for the on-device item-extraction native module
// (feature 007-extract-by-item). The native module runs iOS Vision / Android ML Kit
// to segment ONE garment from a plain background and read coarse signals from it.
//
// Native module name: "ExpoItemExtract". Absent in Expo Go / iOS simulator → callers
// must degrade gracefully (isAvailable === false).

import { requireOptionalNativeModule } from 'expo-modules-core';

export interface RGB {
  r: number;
  g: number;
  b: number;
}

export interface ItemLabel {
  text: string;
  confidence: number; // 0..1
}

export interface ItemExtractionResult {
  /** file uri of the transparent PNG cut-out (~1K). Original photo uri when usedFallback. */
  cutoutUri: string;
  /** true when segmentation was unavailable/low-confidence and keying/original was used. */
  usedFallback: boolean;
  /** dominant FOREGROUND colours (transparent/background excluded), most-dominant first. */
  palette: RGB[];
  /** image labels, highest confidence first. */
  labels: ItemLabel[];
  /** recognised text blocks on the cut-out ([] if none). */
  ocrText: string[];
}

interface ExpoItemExtractNativeModule {
  extractItem(uri: string): Promise<ItemExtractionResult>;
}

const Native = requireOptionalNativeModule<ExpoItemExtractNativeModule>('ExpoItemExtract');

/** Whether the native on-device extractor is present (false in Expo Go / iOS simulator). */
export const isAvailable: boolean = Native != null;

/**
 * Segment one garment from a plain-background photo on-device and return the cut-out
 * plus coarse signals (colour palette, labels, OCR text). Throws when the native module
 * is unavailable — callers should check `isAvailable` first.
 */
export async function extractItem(uri: string): Promise<ItemExtractionResult> {
  if (!Native) {
    throw new Error('ExpoItemExtract native module unavailable (requires a custom dev build).');
  }
  return Native.extractItem(uri);
}
