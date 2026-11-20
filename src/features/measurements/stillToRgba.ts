// Adapter: image file (camera still / replay JPEG) -> in-RAM RgbaImage.
// Non-pure (expo-image-manipulator + expo-file-system) so it lives apart from rgbaImage.ts.
// The live-frame path (VisionCamera) will produce RgbaImages directly and not need this.
//
// PRIVACY: manipulateAsync writes its output to the cache dir; both temp outputs are
// deleted here. Deleting the SOURCE uri is the caller's job.

import * as FileSystem from 'expo-file-system/legacy';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { decodeJpegBase64, type RgbaImage } from './rgbaImage';

/** Long side of a buffered frame (px). Comfortably above the largest model input
 *  (MODNet 512) so crops of the person still carry >= model resolution. */
export const FRAME_LONG_SIDE = 960;

const rm = (uri: string) => FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {});

export async function stillToRgba(uri: string, longSide: number = FRAME_LONG_SIDE): Promise<RgbaImage> {
  // No-op manipulate: applies EXIF rotation, so width/height are the upright size.
  const probe = await manipulateAsync(uri, []);
  if (probe.uri !== uri) void rm(probe.uri);
  const scale = Math.min(1, longSide / Math.max(probe.width, probe.height)); // no upscale
  const actions = scale < 1
    ? [{ resize: { width: Math.round(probe.width * scale), height: Math.round(probe.height * scale) } }]
    : [];
  const out = await manipulateAsync(uri, actions, { base64: true, format: SaveFormat.JPEG, compress: 1 });
  if (out.uri !== uri) void rm(out.uri);
  if (!out.base64) throw new Error('stillToRgba: no base64');
  return decodeJpegBase64(out.base64);
}
