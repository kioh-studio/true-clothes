// Tier-routing behaviour for wardrobeService.addItem (feature 003-upload-image).
// Free → device only (no cloud upload). Premium → device copy + cloud upload.

// Node test env may lack global crypto.randomUUID — polyfill before import.
if (!(global as { crypto?: Crypto }).crypto) {
  (global as { crypto?: unknown }).crypto = require('node:crypto').webcrypto;
}

jest.mock('../itemPhotoService', () => ({
  optimizeImage: jest.fn(async () => ({ uri: 'opt://x', width: 800, height: 600 })),
  writeDeviceCopy: jest.fn(async (id: string) => `wardrobe-photos/${id}.jpg`),
  uploadCloudCopy: jest.fn(async (uid: string, id: string) => `${uid}/${id}.jpg`),
  removePhoto: jest.fn(async () => {}),
  relativePathFor: (id: string) => `wardrobe-photos/${id}.jpg`,
  resolveDeviceUri: jest.fn(async () => '/abs/path.jpg'),
}));

jest.mock('../supabase', () => {
  let table = '';
  let lastInsert: Record<string, unknown> | null = null;
  const builder: Record<string, unknown> = {};
  Object.assign(builder, {
    select: () => builder,
    eq: () => builder,
    order: () => builder,
    update: () => builder,
    delete: () => builder,
    insert: (payload: Record<string, unknown>) => { lastInsert = payload; return builder; },
    single: async () => {
      if (table === 'wardrobes') return { data: { id: 'w1' }, error: null };
      if (table === 'clothing_items') {
        return {
          data: {
            id: lastInsert?.id ?? 'i1', wardrobe_id: 'w1', type: lastInsert?.type ?? null,
            name: null, color: null, primary_color: null, material: null, pattern: null,
            warmth_season: null, brand: null, size: null,
            photo_url: lastInsert?.photo_url ?? null,
            photo_storage: lastInsert?.photo_storage ?? 'none',
            times_worn: 0, added_at: '2026-01-01', updated_at: '2026-01-01',
          },
          error: null,
        };
      }
      return { data: null, error: null };
    },
  });
  return {
    sb: {
      auth: { getUser: async () => ({ data: { user: { id: 'u1' } } }) },
      from: (t: string) => { table = t; return builder; },
      storage: { from: () => ({ remove: async () => ({ error: null }) }) },
    },
  };
});

import { addItem } from '../wardrobeService';
import * as photo from '../itemPhotoService';

const baseInput = { localPhotoUri: 'file://pick.jpg', category: 'top' as const, colors: ['White'] };

beforeEach(() => jest.clearAllMocks());

describe('wardrobeService.addItem tier routing', () => {
  it('free tier stores on-device only, no cloud upload', async () => {
    const item = await addItem(baseInput, 'free');
    expect(photo.writeDeviceCopy).toHaveBeenCalledTimes(1);
    expect(photo.uploadCloudCopy).not.toHaveBeenCalled();
    expect(item.photoStorage).toBe('local');
    expect(item.photoPath).toMatch(/^wardrobe-photos\/.*\.jpg$/);
  });

  it('premium tier writes device copy AND uploads to cloud', async () => {
    const item = await addItem(baseInput, 'premium');
    expect(photo.writeDeviceCopy).toHaveBeenCalledTimes(1);
    expect(photo.uploadCloudCopy).toHaveBeenCalledTimes(1);
    expect(item.photoStorage).toBe('cloud');
    expect(item.photoPath).toBe('u1/' + item.id + '.jpg');
  });

  it('premium upload failure falls back to local (pending retry)', async () => {
    (photo.uploadCloudCopy as jest.Mock).mockRejectedValueOnce(new Error('offline'));
    const item = await addItem(baseInput, 'premium');
    expect(item.photoStorage).toBe('local');
  });

  it('no photo → photoStorage none', async () => {
    const item = await addItem({ ...baseInput, localPhotoUri: null }, 'free');
    expect(photo.writeDeviceCopy).not.toHaveBeenCalled();
    expect(item.photoStorage).toBe('none');
  });
});
