// Live frame grabber (VisionCamera, Android). grab() asks the frame processor for ONE upright,
// unmirrored RGBA frame (long side FRAME_LONG_SIDE) and resolves it as an in-RAM RgbaImage.
// worklets-core 1.6.3 cannot move pixel buffers worklet -> JS, so the native `stashFrame` plugin
// (modules/frame-stash) converts the frame into native memory and the worklet only sends back a
// small integer id; JS then pulls the pixels via FrameStash.take(id) as a real Uint8Array.
// PRIVACY: nothing is written to disk; the frame only ever exists in RAM.

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { requireNativeModule } from 'expo-modules-core';
import { Camera, VisionCameraProxy, useCameraDevice, useCameraFormat, useFrameProcessor } from 'react-native-vision-camera';
import { Worklets, useSharedValue } from 'react-native-worklets-core';
import type { RgbaImage } from './rgbaImage';

const GRAB_TIMEOUT_MS = 2000;
const FrameStash = requireNativeModule<{ take(id: number): Uint8Array | null; clear(): void }>('FrameStash');
const stashPlugin = VisionCameraProxy.initFrameProcessorPlugin('stashFrame', {});

// Re-exported so the scan screen can require() this module on Android ONLY (an iOS build
// without the native module would throw on import of VisionCamera).
export { Camera, useCameraDevice, useCameraFormat };

export function useLiveFrameGrabber() {
  const want = useSharedValue(false);
  const pending = useRef<((img: RgbaImage | null) => void) | null>(null);

  // Stable identities: a new frameProcessor per render makes VisionCamera re-bind it natively
  // each time (and a re-bind racing an unmount crashes with ViewNotFoundError).
  const onFrame = useMemo(() => Worklets.createRunOnJS((id: number, w: number, h: number, ms: number) => {
    const buf = FrameStash.take(id);
    if (__DEV__ && buf) {
      let hash = 0; // sampled checksum: proves the buffer arrived intact and consecutive frames differ
      for (let i = 0; i < buf.length; i += 4099) hash = (hash * 31 + buf[i]) | 0;
      console.log(`[LIVE_FRAME] ${w}x${h} native=${ms}ms len=${buf.length}/${w * h * 4} hash=${hash}`);
    }
    const resolve = pending.current;
    pending.current = null;
    resolve?.(buf ? { width: w, height: h, data: buf } : null);
  }), []);

  const frameProcessor = useFrameProcessor((frame) => {
    'worklet';
    if (!want.value) return;
    want.value = false;
    const t0 = Date.now();
    const r = stashPlugin?.call(frame) as { id: number; w: number; h: number } | undefined;
    if (r) onFrame(r.id, r.w, r.h, Date.now() - t0);
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

  useEffect(() => () => { pending.current?.(null); FrameStash.clear(); }, []);

  return useMemo(() => ({ frameProcessor, grab }), [frameProcessor, grab]);
}
