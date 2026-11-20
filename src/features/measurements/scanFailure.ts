// Why a scan produced no usable measurements, and what to tell the user.
// Pure (no native imports) so poseEstimate/processScan/the screen can share it.

export type ScanFailReason = 'storage' | 'cropped' | 'no_person' | 'mask' | 'error';

/** Highest priority first — the top reasons are the ones shown to the user. */
export const RETAKE_PRIORITY: readonly ScanFailReason[] = ['storage', 'cropped', 'no_person', 'mask', 'error'];

/** Android trims cacheDirectory (deleting scan frames mid-processing) once free
 *  space drops under its own low-storage threshold: min(10% of total, 500 MB).
 *  We mirror that rule so we refuse to scan BEFORE the OS starts trimming; our
 *  own frames are only a few MB - this is about OS cache trimming, not our usage.
 *  (Emulator was trimming at ~342 MB free, so a fixed 300 MB was too low.) */
export const LOW_STORAGE_CAP_BYTES = 500 * 1024 * 1024;

export function lowStorageThreshold(totalBytes?: number | null): number {
  if (typeof totalBytes !== 'number' || !(totalBytes > 0)) return LOW_STORAGE_CAP_BYTES; // total unreadable
  return Math.min(totalBytes * 0.1, LOW_STORAGE_CAP_BYTES);
}

export const RETAKE_MAX_LINES = 2;

export interface RetakeInfo { reasons: ScanFailReason[] }

/** Deduped, priority-ordered reasons. */
export function sortReasons(reasons: readonly ScanFailReason[]): ScanFailReason[] {
  return RETAKE_PRIORITY.filter((r) => reasons.includes(r));
}

/** Front candidates' failure reasons -> retake info (empty list falls back to 'error'). */
export function buildRetake(reasons: readonly ScanFailReason[]): RetakeInfo {
  const sorted = sortReasons(reasons);
  return { reasons: sorted.length ? sorted : ['error'] };
}

/** i18n keys for the (at most 2) guidance lines. */
export function guidanceKeys(reasons: readonly ScanFailReason[]): string[] {
  return sortReasons(reasons).slice(0, RETAKE_MAX_LINES).map((r) => `measurementsScan_retake_${r}`);
}

/** True when free disk space is known and below the OS trim threshold. */
export function isLowStorage(freeBytes: number | null | undefined, totalBytes?: number | null): boolean {
  return typeof freeBytes === 'number' && freeBytes >= 0 && freeBytes < lowStorageThreshold(totalBytes);
}
