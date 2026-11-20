// Live frame grabber (VisionCamera). grab() asks the frame processor for ONE upright,
// unmirrored RGBA frame (long side FRAME_LONG_SIDE) and resolves it as an in-RAM RgbaImage.
// STATUS (2026-11-20): NO-GO on the emulator. worklets-core 1.6.3 cannot deliver the buffer to JS:
// a Uint8Array arg arrives as an opaque object (no length/fill; probing it deadlocked Hermes on the
// camera thread -> SIGABRT) and a raw ArrayBuffer throws 'Array buffers are not supported as shared
// values'. measurements-scan keeps LIVE_FRAMES=false until this is solved.
// PRIVACY: nothing is written to disk; the frame only ever exists as a Uint8Array.

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { Camera, useCameraDevice, useCameraFormat, useFrameProcessor } from 'react-native-vision-camera';
import { Worklets, useSharedValue } from 'react-native-worklets-core';
import { createResizePlugin } from 'vision-camera-resize-plugin';
import { FRAME_LONG_SIDE } from './stillToRgba';
import type { RgbaImage } from './rgbaImage';

const GRAB_TIMEOUT_MS = 2000;
const resizer = createResizePlugin();

// Re-exported so the scan screen can require() this module on Android ONLY (an iOS build
// without the native module would throw on import of VisionCamera).
export { Camera, useCameraDevice, useCameraFormat };

export function useLiveFrameGrabber() {
  const want = useSharedValue(false);
  const pending = useRef<((img: RgbaImage | null) => void) | null>(null);

  // Stable identities: a new frameProcessor per render makes VisionCamera re-bind it natively
  // each time (and a re-bind racing an unmount crashes with ViewNotFoundError).
  const onFrame = useMemo(() => Worklets.createRunOnJS(
    (buf: Uint8Array, w: number, h: number, orientation: string, mirrored: boolean, ms: number) => {
      if (__DEV__) {
        let hash = 0; // sampled checksum: proves the buffer arrived intact and consecutive frames differ
        for (let i = 0; i < buf.length; i += 4099) hash = (hash * 31 + buf[i]) | 0;
        console.log(`[LIVE_FRAME] ${w}×${h} ${orientation} ${mirrored} ${ms}ms len=${buf.length}/${w * h * 4} hash=${hash}`);
      }
      const resolve = pending.current;
      pending.current = null;
      resolve?.({ width: w, height: h, data: buf });
    },
  ), []);

  const frameProcessor = useFrameProcessor((frame) => {
    'worklet';
    if (!want.value) return;
    want.value = false;
    const t0 = Date.now();
    const s = Math.min(1, FRAME_LONG_SIDE / Math.max(frame.width, frame.height));
    const sw = Math.round(frame.width * s);
    const sh = Math.round(frame.height * s);
    const o = frame.orientation;
    const rotation = o === 'landscape-left' ? '90deg' : o === 'landscape-right' ? '270deg'
      : o === 'portrait-upside-down' ? '180deg' : '0deg';
    const swap = rotation === '90deg' || rotation === '270deg';
    // Scale runs BEFORE rotation in the plugin, so (sw, sh) are in sensor orientation.
    // mirror stays false: the raw sensor frame is already unmirrored (isMirrored only marks
    // a selfie camera whose PREVIEW is mirrored), matching the stills the old path stored.
    const out = resizer.resize(frame, {
      scale: { width: sw, height: sh },
      rotation,
      mirror: false,
      pixelFormat: 'rgba',
      dataType: 'uint8',
    });
    // The plugin reuses its buffer, so copy before leaving the worklet.
    onFrame(out.slice(), swap ? sh : sw, swap ? sw : sh, o, frame.isMirrored, Date.now() - t0);
  }, [want, onFrame]);

  const grab = useCallback((): Promise<RgbaImage | null> => new Promise((resolve) => {
    pending.current?.(null);
    const timer = setTimeout(() => {
      want.value = false;
      pending.current = null;
      resolve(null);
    }, GRAB_TIMEOUT_MS);
    pending.current = (img) => { clearTimeout(timer); resolve(img); };
    want.value = true;
  }), [want]);

  useEffect(() => () => { pending.current?.(null); }, []);

  return useMemo(() => ({ frameProcessor, grab }), [frameProcessor, grab]);
}
