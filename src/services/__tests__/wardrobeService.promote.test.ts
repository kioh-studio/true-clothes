// promoteToCloud idempotency + resumability (feature 003-upload-image, T029).

if (!(global as { crypto?: Crypto }).crypto) {
  (global as { crypto?: unknown }).crypto = require('node:crypto').webcrypto;
}

const uploadCloudCopy = jest.fn(async (uid: string, id: string) => `${uid}/${id}.jpg`);
const resolveDeviceUri = jest.fn(async () => '/abs/path.jpg');
jest.mock('../itemPhotoService', () => ({
  uploadCloudCopy, resolveDeviceUri,
  optimizeImage: jest.fn(), writeDeviceCopy: jest.fn(),
  removePhoto: jest.fn(async () => {}), relativePathFor: (id: string) => `wardrobe-photos/${id}.jpg`,
}));

jest.mock('../supabase', () => {
  let row: Record<string, unknown> | null = null;
  let pendingUpdate: Record<string, unknown> | null = null;
  const builder: Record<string, unknown> = {};
  Object.assign(builder, {
    select: () => builder,
    update: (p: Record<string, unknown>) => { pendingUpdate = p; return builder; },
    eq: () => builder,
    single: async () => {
      if (pendingUpdate) {
        const merged = { ...row, ...pendingUpdate };
        pendingUpdate = null;
        return { data: merged, error: null };
      }
      return { data: row, error: null };
    },
  });
  return {
    sb: {
      auth: { getUser: async () => ({ data: { user: { id: 'u1' } } }) },
      from: () => builder,
      storage: { from: () => ({ remove: async () => ({ error: null }) }) },
    },
    __setRow: (r: Record<string, unknown>) => { row = r; },
  };
});

import { promoteToCloud } from '../wardrobeService';
const { __setRow } = jest.requireMock('../supabase') as { __setRow: (r: Record<string, unknown>) => void };

const localRow = { id: 'i1', wardrobe_id: 'w1', type: 'TEE', photo_url: 'wardrobe-photos/i1.jpg', photo_storage: 'local' };

beforeEach(() => jest.clearAllMocks());

describe('promoteToCloud', () => {
  it('uploads a local item and flips it to cloud', async () => {
    __setRow({ ...localRow });
    const item = await promoteToCloud('i1');
    expect(uploadCloudCopy).toHaveBeenCalledTimes(1);
    expect(item?.photoStorage).toBe('cloud');
    expect(item?.photoPath).toBe('u1/i1.jpg');
  });

  it('is idempotent — already-cloud items are skipped (no upload)', async () => {
    __setRow({ ...localRow, photo_url: 'u1/i1.jpg', photo_storage: 'cloud' });
    const item = await promoteToCloud('i1');
    expect(uploadCloudCopy).not.toHaveBeenCalled();
    expect(item?.photoStorage).toBe('cloud');
  });

  it('skips when the local file is gone (cannot promote)', async () => {
    resolveDeviceUri.mockResolvedValueOnce(null as never);
    __setRow({ ...localRow });
    const item = await promoteToCloud('i1');
    expect(uploadCloudCopy).not.toHaveBeenCalled();
    expect(item?.photoStorage).toBe('local');
  });
});
