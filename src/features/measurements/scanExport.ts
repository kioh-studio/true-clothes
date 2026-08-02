// DEV-ONLY helper: export a captured on-device scan (keypoints + silhouette
// widths + the inputs given at scan time) as a measure-eval fixture, so it
// can be replayed offline against a tape-measure ground truth via
// scripts/measure-eval. See scripts/measure-eval/fixtures/README.md for the
// schema and the full capture → fill groundTruth → drop-in workflow.
//
// This module performs no __DEV__ gating itself (so it stays trivially
// unit-testable) — the call site (app/measurements-scan.tsx) gates every
// call behind `if (__DEV__)`. Never invoke this from a production build.

// NOTE: 'expo-file-system/legacy', not the bare 'expo-file-system' — the new
// top-level API's documentDirectory/deleteAsync/writeAsStringAsync are
// deprecated no-op stubs that throw at runtime (see legacyWarnings.d.ts in
// the package); this matches the pattern already used by itemPhotoService.ts,
// tryOnWearService.ts, and seedLocalPhotos.dev.ts.
import * as FileSystem from 'expo-file-system/legacy';
import type { Keypoint } from './poseEstimate';
import type { SilhouetteWidths } from './silhouetteMath';
import type { SideDepths } from './sideViewMath';
import type { Sex } from './landmarksToMeasurements';

export interface ScanFixturePayload {
  /** Placeholder — rename to a real subject id before dropping into fixtures/. */
  subjectId: string;
  /** Fixture schema version — 2 now that the side-view (profile) capture
   *  pass exists. See `Fixture.version`'s doc comment in accuracyEval.ts. */
  version: 2;
  inputs: {
    heightCm: number;
    weightKg?: number;
    sex?: Sex;
    ageYears?: number;
    /** Person-mask crown→sole vertical extent (FULL-square units), or absent
     *  when the scan had no cropped-segmentation pass. See
     *  `EstimateInputs.maskExtentU` in landmarksToMeasurements.ts. */
    maskExtentU?: number;
  };
  keypoints: Keypoint[];
  silhouette?: SilhouetteWidths;
  /** FRONT capture's median DeviceMotion pitch (radians) — see
   *  `Fixture.capturePitchRad`'s doc comment in accuracyEval.ts. */
  capturePitchRad?: number;
  /** SIDE (profile) capture data, absent for a front-only scan (SKIP was
   *  used, or the side pass produced nothing usable). See `Fixture.side`'s
   *  doc comment in accuracyEval.ts. */
  side?: {
    keypoints: Keypoint[];
    depthsU?: SideDepths;
    maskExtentU?: number;
    capturePitchRad?: number;
  };
  /** Empty — the whole point is to fill this by hand from a real tape measurement. */
  groundTruth: Record<string, never>;
}

// Numbers the exported files within a single app session (measure-eval-1.json,
// measure-eval-2.json, ...) — simpler and less failure-prone than a
// timestamp-derived name, and collisions across sessions just overwrite,
// which is fine for a dev-only debug artifact.
let fileCounter = 0;

/**
 * Write the fixture payload to a numbered file in the app's document
 * directory AND log it as a single JSON line. The log line is the reliable
 * path — the Metro console is always reachable, whereas pulling a file off a
 * physical device is not always convenient.
 */
export async function exportScanFixture(payload: ScanFixturePayload): Promise<void> {
  fileCounter += 1;
  const path = `${FileSystem.documentDirectory}measure-eval-${fileCounter}.json`;
  const json = JSON.stringify(payload, null, 2);
  try {
    await FileSystem.writeAsStringAsync(path, json);
    console.log(`[MEASURE_EVAL] wrote ${path}`);
  } catch (err) {
    console.log(`[MEASURE_EVAL] failed to write file (${err instanceof Error ? err.message : String(err)}) — use the JSON line below instead`);
  }
  console.log(`[MEASURE_EVAL_JSON]${json}`);
}
