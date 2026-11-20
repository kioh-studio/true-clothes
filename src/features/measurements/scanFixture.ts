// Pure: ScanResult → measure-eval fixture v2. Shared by app/dev-scan-replay.tsx
// (device) and scripts/offline-replay (Deno) so both emit the identical schema.

import type { ScanResult } from './processPure';
import type { Sex } from './landmarksToMeasurements';

export interface ReplayMeta { heightCm: number; weightKg?: number; sex?: Sex; ageYears?: number; asianWeight?: number; pitchRad?: number }

export function scanToFixture(bodyId: string, meta: ReplayMeta, groundTruth: Record<string, number>, scan: ScanResult) {
  return {
    subjectId: bodyId,
    version: 2,
    inputs: { heightCm: meta.heightCm, weightKg: meta.weightKg, sex: meta.sex, ageYears: meta.ageYears, maskExtentU: scan.maskExtentU },
    keypoints: scan.aggKps,
    silhouette: scan.widths,
    capturePitchRad: scan.frontCapturePitchRad,
    side: scan.side
      ? {
          keypoints: scan.side.sideAggKps, depthsU: scan.side.depthsU,
          maskExtentU: scan.side.maskExtentU, capturePitchRad: scan.side.capturePitchRad,
        }
      : undefined,
    groundTruth,
    weight: meta.asianWeight,
    replay: { est: scan.est, rawEst: scan.rawEst, refinedSuccessCount: scan.refinedSuccessCount, sideOk: scan.side != null },
  };
}
