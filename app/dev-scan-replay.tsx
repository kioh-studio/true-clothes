// DEV-ONLY: replays folders of still photos through the REAL scan pipeline
// (estimateKeypoints → processScan) on-device and writes measure-eval fixtures.
// Deep link: mien://dev-scan-replay. See scripts/scan-replay/README.md.
//
//   <documentDirectory>/scan-replay/in/<bodyId>/{front_N.jpg, side_N.jpg, meta.json, gt.json}
//   <documentDirectory>/scan-replay/out/<bodyId>.json  (+ _log.txt)
//   <documentDirectory>/scan-replay/out/<bodyId>.frames.json            model outputs (metadata)
//   <documentDirectory>/scan-replay/out/<bodyId>.<view>.<i>.mask.bin    crop mask  (raw, MASK_FORMAT)
//   <documentDirectory>/scan-replay/out/<bodyId>.<view>.<i>.fmask.bin   full-frame mask (front fallback only)
// The .frames.json + .bin files let scripts/offline-replay re-run every pipeline
// stage AFTER the models offline with any constants.
//
// processScan DELETES the uris it consumes, so every image is COPIED to the
// cache dir first — the source set survives.

import React, { useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as FileSystem from 'expo-file-system/legacy';
import { manipulateAsync } from 'expo-image-manipulator';
import { T, type } from '../src/design/tokens';
import { estimateKeypoints } from '../src/features/measurements/poseEstimate';
import { assessPose, assessSidePose } from '../src/features/measurements/poseQuality';
import { processScan, type BufferedFrame, type DebugFrameInfo } from '../src/features/measurements/processScan';
import type { Sex } from '../src/features/measurements/landmarksToMeasurements';
import { scanToFixture } from '../src/features/measurements/scanFixture';

interface Meta { heightCm: number; weightKg?: number; sex?: Sex; ageYears?: number; asianWeight?: number; pitchRad?: number }

const ROOT = `${FileSystem.documentDirectory}scan-replay/`;

// Mask dump format. 'f32' = raw little-endian float32 (exact; 1 MB/mask at 512px).
// 'u8' = round(v*255) (4x smaller; offline de-quantises v/255 — results then
// differ from the device fixture by quantisation error, offline-replay --validate reports it).
const MASK_FORMAT: 'f32' | 'u8' = 'u8';

function maskToBase64(data: Float32Array): string {
  const bytes = MASK_FORMAT === 'f32'
    ? new Uint8Array(data.buffer, data.byteOffset, data.byteLength)
    : Uint8Array.from(data, (v) => Math.max(0, Math.min(255, Math.round(v * 255))));
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x2000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x2000));
  return btoa(bin);
}

/** Write frames.json + mask .bin files for one body (model outputs for offline replay). */
async function dumpFrames(
  bodyId: string, meta: Meta, groundTruth: Record<string, number>, infos: DebugFrameInfo[],
): Promise<void> {
  const writeMask = async (name: string, m: { size: number; data: Float32Array } | null | undefined) => {
    if (!m) return null;
    await FileSystem.writeAsStringAsync(`${ROOT}out/${name}`, maskToBase64(m.data), { encoding: FileSystem.EncodingType.Base64 });
    return { file: name, size: m.size };
  };
  const frames = [];
  for (const f of infos) {
    const stem = `${bodyId}.${f.view}.${f.index}`;
    frames.push({
      view: f.view, index: f.index, width: f.width, height: f.height, pitchRad: f.pitchRad,
      candidate: f.candidate, branch: f.branch, pass1: f.pass1, refined: f.refined, cropRect: f.cropRect,
      cropMask: await writeMask(`${stem}.mask.bin`, f.cropMask),
      fullMask: await writeMask(`${stem}.fmask.bin`, f.fullMask),
    });
  }
  await FileSystem.writeAsStringAsync(
    `${ROOT}out/${bodyId}.frames.json`,
    JSON.stringify({ bodyId, maskFormat: MASK_FORMAT, meta, groundTruth, frames }),
  );
}

export default function DevScanReplayScreen() {
  // DEV-ONLY GUARD (same pattern as dev-seed.tsx): inert in production builds.
  if (!__DEV__) return <View style={styles.container} />;
  return <Inner />;
}

/** Load one view's images → BufferedFrames (copies in cache; 1 image is reused 3×). */
async function loadView(
  dir: string, prefix: 'front' | 'side', pitchRad: number | undefined, log: (s: string) => void,
): Promise<BufferedFrame[]> {
  const names = (await FileSystem.readDirectoryAsync(dir))
    .filter((n) => new RegExp(`^${prefix}_\\d+\\.jpe?g$`, 'i').test(n)).sort();
  const gate = prefix === 'front' ? assessPose : assessSidePose;
  const frames: BufferedFrame[] = [];
  const copyOf = async (src: string, i: number): Promise<string> => {
    // documentDirectory, NOT cacheDirectory: Android trims cache files when /data is
    // low on space (emulator!), deleting frames mid-scan -> random refine failures.
    await FileSystem.makeDirectoryAsync(`${ROOT}tmp/`, { intermediates: true }).catch(() => {});
    const dst = `${ROOT}tmp/replay-${prefix}-${Date.now()}-${i}.jpg`;
    await FileSystem.copyAsync({ from: src, to: dst });
    return dst;
  };
  for (const name of names) {
    const probeUri = await copyOf(dir + name, 0);
    // Same dimension probe estimateKeypoints itself uses when w/h are absent
    // (camera photos get theirs from takePictureAsync; manipulateAsync applies EXIF).
    const probe = await manipulateAsync(probeUri, []);
    FileSystem.deleteAsync(probe.uri, { idempotent: true }).catch(() => {});
    const res = await estimateKeypoints(probeUri, probe.width, probe.height);
    if (!res) {
      log(`  ${name}: NO POSE from estimateKeypoints — skipped (live loop would drop it too)`);
      FileSystem.deleteAsync(probeUri, { idempotent: true }).catch(() => {});
      continue;
    }
    const q = gate(res.keypoints);
    if (!q.ok) log(`  ${name}: live pose gate FAILED (${q.hint}, present ${q.present}, fill ${q.frameFill.toFixed(2)}) — included anyway`);
    frames.push({ keypoints: res.keypoints, uri: probeUri, width: probe.width, height: probe.height, pitchRad });
  }
  // Single source image → reuse 3× (fresh copies; processScan deletes each uri).
  if (frames.length === 1) {
    const f = frames[0];
    for (let i = 1; i < 3; i++) frames.push({ ...f, uri: await copyOf(f.uri, i) });
  }
  return frames;
}

async function replayBody(bodyId: string, log: (s: string) => void): Promise<string> {
  const dir = `${ROOT}in/${bodyId}/`;
  const meta = JSON.parse(await FileSystem.readAsStringAsync(dir + 'meta.json')) as Meta;
  const groundTruth = JSON.parse(await FileSystem.readAsStringAsync(dir + 'gt.json')) as Record<string, number>;
  const t0 = Date.now();
  const front = await loadView(dir, 'front', meta.pitchRad, log);
  const side = await loadView(dir, 'side', meta.pitchRad, log);
  if (front.length === 0) throw new Error('no usable front frames');
  const infos: DebugFrameInfo[] = [];
  const scan = await processScan(
    front, side,
    { heightCm: meta.heightCm, weightKg: meta.weightKg, sex: meta.sex, ageYears: meta.ageYears },
    // Masks are not mutated after capture (the pure stage clones before eraseDisk).
    { addToTotal: () => {}, frameDone: () => {}, debug: { onFrame: (i) => infos.push(i) } },
  );
  if (!scan) throw new Error('processScan returned null');
  await dumpFrames(bodyId, meta, groundTruth, infos);
  const fixture = scanToFixture(bodyId, meta, groundTruth, scan);
  await FileSystem.writeAsStringAsync(`${ROOT}out/${bodyId}.json`, JSON.stringify(fixture, null, 2));
  return `${bodyId} ok ${((Date.now() - t0) / 1000).toFixed(1)}s front=${front.length} side=${side.length} refined=${scan.refinedSuccessCount} sideOk=${scan.side != null}`;
}

function Inner() {
  const insets = useSafeAreaInsets();
  const [running, setRunning] = useState(false);
  const [lines, setLines] = useState<string[]>([]);
  const log = (s: string) => { console.log(`[SCAN_REPLAY] ${s}`); setLines((p) => [...p, s]); };

  const run = async () => {
    setRunning(true);
    setLines([]);
    try {
      await FileSystem.makeDirectoryAsync(`${ROOT}out/`, { intermediates: true });
      const bodies = (await FileSystem.readDirectoryAsync(`${ROOT}in/`)).sort();
      log(`${bodies.length} bodies in ${ROOT}in/`);
      let logTxt = '';
      for (const [i, id] of bodies.entries()) {
        log(`[${i + 1}/${bodies.length}] ${id}`);
        let line: string;
        try {
          line = await replayBody(id, log);
        } catch (e) {
          line = `${id} FAILED ${e instanceof Error ? e.message : String(e)}`;
        }
        log(line);
        logTxt += line + '\n';
        await FileSystem.writeAsStringAsync(`${ROOT}out/_log.txt`, logTxt); // rewritten each body so a crash keeps progress
      }
      log('DONE');
    } catch (e) {
      log(`ABORT ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setRunning(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + 24 }]}>
      <Text style={styles.title}>Scan replay (dev)</Text>
      <Pressable style={styles.btn} disabled={running} onPress={run}>
        <Text style={styles.btnText}>{running ? 'RUNNING…' : 'RUN'}</Text>
      </Pressable>
      <ScrollView style={{ flex: 1 }}>
        {lines.map((l, i) => <Text key={i} style={styles.line}>{l}</Text>)}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: T.color.canvas, paddingHorizontal: 24 },
  title: { fontFamily: T.font.serif, fontSize: 24, color: T.color.primary, marginBottom: 16 },
  btn: { height: 52, backgroundColor: T.color.primary, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  btnText: { ...type.ui, fontSize: 12, color: T.color.canvas, letterSpacing: 1 },
  line: { ...type.caption, fontSize: 11, color: T.color.tertiary, marginBottom: 2 },
});
