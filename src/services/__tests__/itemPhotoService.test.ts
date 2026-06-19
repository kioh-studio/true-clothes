// itemPhotoService device + cloud mechanics (feature 003-upload-image).

const fs = {
  documentDirectory: '/doc/',
  getInfoAsync: jest.fn(async () => ({ exists: false })),
  makeDirectoryAsync: jest.fn(async () => {}),
  deleteAsync: jest.fn(async () => {}),
  copyAsync: jest.fn(async () => {}),
  readAsStringAsync: jest.fn(async () => btoa('bytes')),
  downloadAsync: jest.fn(async () => ({ uri: '/doc/wardrobe-photos/x.jpg' })),
};
jest.mock('expo-file-system/legacy', () => fs);

const manipulateAsync = jest.fn(
  (_uri: string, _actions?: unknown[], _opts?: unknown) =>
    Promise.resolve({ uri: 'opt://x', width: 1600, height: 1200 }),
);
jest.mock('expo-image-manipulator', () => ({ manipulateAsync, SaveFormat: { JPEG: 'jpeg' } }));

jest.mock('react-native', () => ({
  Image: { getSize: (_uri: string, ok: (w: number, h: number) => void) => ok(4000, 3000) },
}));

const createSignedUrl = jest.fn(async () => ({ data: { signedUrl: 'https://signed/x?token=1' }, error: null }));
const remove = jest.fn(async () => ({ error: null }));
const upload = jest.fn(async () => ({ error: null }));
jest.mock('../supabase', () => ({ sb: { storage: { from: () => ({ createSignedUrl, remove, upload }) } } }));

// btoa/atob polyfill for node
if (typeof (global as { btoa?: unknown }).btoa === 'undefined') {
  (global as { btoa?: unknown }).btoa = (s: string) => Buffer.from(s, 'binary').toString('base64');
  (global as { atob?: unknown }).atob = (s: string) => Buffer.from(s, 'base64').toString('binary');
}

import {
  relativePathFor, optimizeImage, writeDeviceCopy, resolveDeviceUri,
  signedUrl, removePhoto,
} from '../itemPhotoService';

beforeEach(() => jest.clearAllMocks());

describe('itemPhotoService', () => {
  it('relativePathFor builds a stable relative path', () => {
    expect(relativePathFor('abc')).toBe('wardrobe-photos/abc.jpg');
  });

  it('optimizeImage caps the long edge at 1600px', async () => {
    await optimizeImage('file://huge.jpg');
    expect(manipulateAsync).toHaveBeenCalledTimes(1);
    const actions = manipulateAsync.mock.calls[0][1] as { resize: { width: number; height: number } }[];
    expect(actions[0].resize.width).toBe(1600);   // 4000 long edge → scaled to 1600
    expect(actions[0].resize.height).toBe(1200);
  });

  it('writeDeviceCopy returns a relative path and copies the file', async () => {
    const rel = await writeDeviceCopy('item1', 'opt://x');
    expect(rel).toBe('wardrobe-photos/item1.jpg');
    expect(fs.copyAsync).toHaveBeenCalledWith({ from: 'opt://x', to: '/doc/wardrobe-photos/item1.jpg' });
  });

  it('resolveDeviceUri returns null when the file is absent', async () => {
    fs.getInfoAsync.mockResolvedValueOnce({ exists: false });
    expect(await resolveDeviceUri('wardrobe-photos/gone.jpg')).toBeNull();
  });

  it('resolveDeviceUri returns the absolute uri when present', async () => {
    fs.getInfoAsync.mockResolvedValueOnce({ exists: true });
    expect(await resolveDeviceUri('wardrobe-photos/here.jpg')).toBe('/doc/wardrobe-photos/here.jpg');
  });

  it('signedUrl returns an expiring URL (never public)', async () => {
    const url = await signedUrl('u1/item1.jpg');
    expect(createSignedUrl).toHaveBeenCalledWith('u1/item1.jpg', 3600);
    expect(url).toContain('token=');
  });

  it('signedUrl throws on error', async () => {
    createSignedUrl.mockResolvedValueOnce({ data: null, error: { message: 'no' } } as never);
    await expect(signedUrl('u1/item1.jpg')).rejects.toThrow();
  });

  it('removePhoto is idempotent and cleans both device + cloud', async () => {
    await removePhoto({ relativePath: 'wardrobe-photos/a.jpg', storagePath: 'u1/a.jpg' });
    expect(fs.deleteAsync).toHaveBeenCalled();
    expect(remove).toHaveBeenCalledWith(['u1/a.jpg']);
    await expect(removePhoto({})).resolves.toBeUndefined(); // nothing to remove → no throw
  });
});
