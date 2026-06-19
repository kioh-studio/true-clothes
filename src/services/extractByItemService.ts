// extractByItemService — seam for the on-device "Extract by item" wizard method.
//
// Feature 006 (AI extraction) defines this interface and ships a STUB so the wizard's
// method chooser can offer "Extract by item" today. The real on-device segmentation +
// enrichment (iOS Vision / Android ML Kit, solid-background cutout) is delivered by
// the separate `specs/extract-by-item/` feature, which replaces this implementation.

import { ExtractedItemWithImage } from './imageGenerationService';

export class ExtractByItemUnavailableError extends Error {
  constructor(message = 'On-device item extraction is not available yet') {
    super(message);
    this.name = 'ExtractByItemUnavailableError';
  }
}

/** Whether the on-device "item" method is implemented. False until extract-by-item lands. */
export const isExtractByItemAvailable = false;

/**
 * Extract a single item from a plain-background photo, fully on-device (free, private).
 * Returns the SAME shape as the AI method so both converge on the shared Review/save path.
 *
 * STUB: throws until the extract-by-item feature implements it.
 *
 * @param photoUri  local file URI or base64 of a single-item photo on a plain background
 * @param notes     optional user enrichment context
 */
export async function extractItemOnDevice(
  _photoUri: string,
  _notes?: string,
): Promise<ExtractedItemWithImage[]> {
  throw new ExtractByItemUnavailableError();
}
