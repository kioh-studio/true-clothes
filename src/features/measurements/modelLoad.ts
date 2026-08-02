// Shared "try the GPU delegate, fall back to CPU" model loader.
//
// Used by the two heavier models this feature (BlazePose Heavy replacing
// MoveNet Thunder, MODNet replacing/augmenting the selfie segmenter) — see
// poseEstimate.ts and silhouette.ts. The two CHEAP models this feature does
// NOT touch (MoveNet Lightning, the selfie segmenter fallback) deliberately
// keep loading on the plain default (CPU) delegate: they're fast enough on
// CPU already that a GPU delegate's extra failure surface (see below) isn't
// worth it for them.
//
// react-native-fast-tflite's `loadTensorflowModel(source, delegate?)` takes an
// explicit `TensorflowModelDelegate` ('default' | 'metal' | 'core-ml' |
// 'nnapi' | 'android-gpu' — see node_modules/react-native-fast-tflite/lib/
// typescript/TensorflowLite.d.ts). The library's own doc comment on that
// function is explicit that GPU delegates are per-model/per-device gambles:
// "the core-ml or metal delegates might be faster ... but not all models
// support those delegates." A GPU delegate load failure must therefore
// degrade to the CPU delegate — never to a broken pipeline — which is the
// entire reason this helper exists instead of every call site hand-rolling
// its own try/catch.
import { Platform } from 'react-native';
import { loadTensorflowModel, type TensorflowModel, type TensorflowModelDelegate } from 'react-native-fast-tflite';

/**
 * Load `source` on the platform's GPU delegate first ('android-gpu' on
 * Android, 'metal' on iOS — both call out as GPU-accelerated in the
 * library's docs; picking 'metal' over 'core-ml' for iOS is an arbitrary
 * choice between two reasonable options, NOT verified on-device by this
 * session — see backlog.md §I), falling back to the default CPU delegate if
 * that load throws for ANY reason (unsupported op on that delegate, driver
 * quirk, delegate unavailable on this device/OS version).
 */
export function loadModelWithGpuFallback(source: number): Promise<TensorflowModel> {
  const gpuDelegate: TensorflowModelDelegate = Platform.OS === 'android' ? 'android-gpu' : 'metal';
  return loadTensorflowModel(source, gpuDelegate).catch(() => loadTensorflowModel(source));
}
