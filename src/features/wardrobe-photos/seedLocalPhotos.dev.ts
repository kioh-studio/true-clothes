// DEV-ONLY seeder — populates the "user local store" photo flow for the signed-in
// demo wardrobe. For each item it copies the bundled cutout from assets/items/
// into the app sandbox at documentDirectory/wardrobe-photos/<itemId>.<ext>, then
// flips the DB row to photo_storage='local' with that relative path.
//
// Why this can't be done with adb: on a production Expo Go build the app sandbox
// is not writable from outside the process, so the copy must happen in-app.
//
// This file hardcodes the demo user's clothing_items UUIDs and is intended to be
// deleted once the local-store flow has been exercised. Reach it via /dev-seed.

import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system/legacy';
import { sb } from '../../services/supabase';

const SUBDIR = 'wardrobe-photos/'; // under documentDirectory (matches itemPhotoService)

// itemId -> bundled cutout module + on-disk extension. `ext` preserves the source
// format so transparent PNGs keep their alpha (a JPEG re-encode would fill it).
type Seed = { id: string; module: number; ext: string };

const SEEDS: Seed[] = [
  // ── already-local demo items (currently asset:<key> refs) ──
  { id: '52844c69-0967-4b88-8c86-ee2bceb7e27b', module: require('../../../assets/items/jeans-blue.png'),        ext: 'png' },
  { id: 'cfc560be-c6a4-4e31-95f2-03ae487c92bd', module: require('../../../assets/items/jeans-dark.png'),        ext: 'png' },
  { id: 'cf299883-c963-4736-b672-9ba9b1c1917f', module: require('../../../assets/items/tee-airism.png'),        ext: 'png' },
  { id: '3bce18f7-9087-42d7-af32-bd582d3e76e9', module: require('../../../assets/items/tee-burgundy.png'),      ext: 'png' },
  { id: '97521e25-9ba1-4738-a2b6-03e72286364b', module: require('../../../assets/items/tee-yellow.png'),        ext: 'png' },
  { id: '4f21ed25-b11e-42cf-962e-6b788b4e4c60', module: require('../../../assets/items/tee-beige.jpeg'),        ext: 'jpeg' },
  { id: '0af4ed98-c0f7-40a1-8608-7af0c775c134', module: require('../../../assets/items/tee-white.png'),         ext: 'png' },
  { id: 'ff2530a1-5894-4935-9c52-e805d941ae1d', module: require('../../../assets/items/tee-grey.png'),          ext: 'png' },
  { id: 'dd79f071-e736-4fcc-acbc-e8fd5dc7cf24', module: require('../../../assets/items/shirt-denim.png'),       ext: 'png' },
  { id: '5f82f6e8-2914-4493-a346-c856f4b448e0', module: require('../../../assets/items/polo-olive.png'),        ext: 'png' },
  { id: '77ef199f-a7f8-490c-85dd-40c10ea5c144', module: require('../../../assets/items/jacket-harrington.png'), ext: 'png' },
  { id: '77b879db-5d82-49bf-b5d1-3b5945129627', module: require('../../../assets/items/loafers-black.png'),     ext: 'png' },
  { id: '51dece9d-91f8-4a04-9544-8924c3949fac', module: require('../../../assets/items/mule-tan.png'),          ext: 'png' },
  { id: '0438e152-e4e1-4ae3-ada3-58ea6ee88b1e', module: require('../../../assets/items/cap-plaid.png'),         ext: 'png' },
  { id: 'f3137996-8598-4da1-bf4f-e5234f822dc7', module: require('../../../assets/items/white-sneaker.png'),     ext: 'png' },
  { id: 'c47fdb0a-dcaa-41c6-bde2-c473b5d4ee94', module: require('../../../assets/items/bag-black.png'),         ext: 'png' },
  { id: '4a7cc859-267d-445f-8563-3a0bcbb3e9a3', module: require('../../../assets/items/trousers-wide.png'),     ext: 'png' },
  { id: 'a42b21f2-b0bd-403a-b35b-4e7ec03c17ae', module: require('../../../assets/items/sweater-black.png'),     ext: 'png' },
  // ── items that were pointing at external retailer URLs ──
  { id: 'a3d597d6-c518-43f4-ad65-c4411eeacdac', module: require('../../../assets/items/jeans-levis-black.png'),     ext: 'png' },
  { id: '8507be8d-db9f-4693-8b94-be34de9e704f', module: require('../../../assets/items/polo-white.png'),            ext: 'png' },
  { id: 'ae85c4a5-62b2-4a99-b787-1b82bfb3c6e7', module: require('../../../assets/items/polo-black.png'),            ext: 'png' },
  { id: 'a7d65c15-2829-4aff-9fc1-6d0f88df65d0', module: require('../../../assets/items/jacket-ma1-black.png'),      ext: 'png' },
  { id: '54cf07fe-aac6-432f-acf9-f9e290945b61', module: require('../../../assets/items/jacket-ma1-navy.png'),       ext: 'png' },
  { id: '9552f04b-0bb5-4228-a62b-d1a81d00565c', module: require('../../../assets/items/jacket-ma1-olive.png'),      ext: 'png' },
  { id: '86a53a61-633f-4e7f-8da2-ca578b2ca4a0', module: require('../../../assets/items/chino-olive.png'),           ext: 'png' },
  { id: '283a864a-ad1a-4693-ab26-f9b7e0baf054', module: require('../../../assets/items/chino-beige.png'),           ext: 'png' },
  { id: '62ac4355-717a-46b3-b554-14212fce5f30', module: require('../../../assets/items/chino-black.png'),           ext: 'png' },
  { id: '8d043fbc-6584-4a10-a639-b644ff077526', module: require('../../../assets/items/tee-supima-black.png'),      ext: 'png' },
  { id: '81d04277-85c9-4e49-a4af-3c621e270ef9', module: require('../../../assets/items/tee-supima-grey.png'),       ext: 'png' },
  { id: 'b82f5b33-3915-4a73-9734-d1ab12d0aa9e', module: require('../../../assets/items/jacket-utility-brown.png'),  ext: 'png' },
  { id: '9182f59c-351a-4d3f-badf-d491ba0a4525', module: require('../../../assets/items/jacket-utility-olive.png'),  ext: 'png' },
  { id: '25759910-9f40-4eac-a7b8-95f7d73505b7', module: require('../../../assets/items/henley-navy.png'),           ext: 'png' },
];

export type SeedProgress = { done: number; total: number; last: string };
export type SeedResult = { ok: number; failed: { id: string; error: string }[] };

async function ensureDir(): Promise<void> {
  const dir = `${FileSystem.documentDirectory}${SUBDIR}`;
  const info = await FileSystem.getInfoAsync(dir);
  if (!info.exists) await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
}

/** Copy each bundled cutout into the sandbox and flip its DB row to local. */
export async function seedLocalPhotos(onProgress?: (p: SeedProgress) => void): Promise<SeedResult> {
  await ensureDir();
  const result: SeedResult = { ok: 0, failed: [] };

  for (let i = 0; i < SEEDS.length; i++) {
    const { id, module, ext } = SEEDS[i];
    try {
      // Resolve the bundled asset to a readable file uri (downloads from Metro in dev).
      const asset = Asset.fromModule(module);
      await asset.downloadAsync();
      const src = asset.localUri ?? asset.uri;
      if (!src) throw new Error('asset has no localUri');

      const relativePath = `${SUBDIR}${id}.${ext}`;
      const dest = `${FileSystem.documentDirectory}${relativePath}`;
      await FileSystem.deleteAsync(dest, { idempotent: true });
      await FileSystem.copyAsync({ from: src, to: dest });

      const { error } = await sb
        .from('clothing_items')
        .update({ photo_url: relativePath, photo_storage: 'local' })
        .eq('id', id);
      if (error) throw new Error(error.message);

      result.ok += 1;
    } catch (e: any) {
      result.failed.push({ id, error: e?.message ?? String(e) });
    }
    onProgress?.({ done: i + 1, total: SEEDS.length, last: id });
  }

  return result;
}

export const SEED_COUNT = SEEDS.length;
