// Pure resolution logic for useItemPhoto (feature 003-upload-image, T033).
// The hook delegates to resolveItemPhotoSource, which is testable without a renderer.

const resolveDeviceUri = jest.fn();
const ensureCloudCached = jest.fn();
jest.mock('../../../services/itemPhotoService', () => ({ resolveDeviceUri, ensureCloudCached }));

import { resolveItemPhotoSource } from '../useItemPhoto';

beforeEach(() => jest.clearAllMocks());

const base = { id: 'i1', photoStorage: 'none' as const, photoPath: null };

describe('resolveItemPhotoSource', () => {
  it('bundled demo png → ready', async () => {
    const r = await resolveItemPhotoSource({ ...base, png: 42 });
    expect(r).toEqual({ source: 42, status: 'ready' });
  });

  it('no photo → missing', async () => {
    expect((await resolveItemPhotoSource(base)).status).toBe('missing');
  });

  it('local present → ready with uri', async () => {
    resolveDeviceUri.mockResolvedValueOnce('/doc/wardrobe-photos/i1.jpg');
    const r = await resolveItemPhotoSource({ id: 'i1', photoStorage: 'local', photoPath: 'wardrobe-photos/i1.jpg' });
    expect(r).toEqual({ source: { uri: '/doc/wardrobe-photos/i1.jpg' }, status: 'ready' });
  });

  it('local file reclaimed → missing (FR-009)', async () => {
    resolveDeviceUri.mockResolvedValueOnce(null);
    const r = await resolveItemPhotoSource({ id: 'i1', photoStorage: 'local', photoPath: 'wardrobe-photos/i1.jpg' });
    expect(r.status).toBe('missing');
  });

  it('direct remote URL in photo_url renders as-is (not signed)', async () => {
    const r = await resolveItemPhotoSource({ id: 'i1', photoStorage: 'cloud', photoPath: 'https://img.example.com/x.jpg' });
    expect(r).toEqual({ source: { uri: 'https://img.example.com/x.jpg' }, status: 'ready' });
    expect(ensureCloudCached).not.toHaveBeenCalled();
  });

  it('cloud cached/fetched → ready', async () => {
    ensureCloudCached.mockResolvedValueOnce('/doc/wardrobe-photos/i1.jpg');
    const r = await resolveItemPhotoSource({ id: 'i1', photoStorage: 'cloud', photoPath: 'u1/i1.jpg' });
    expect(r.status).toBe('ready');
    expect(ensureCloudCached).toHaveBeenCalledWith('i1', 'u1/i1.jpg');
  });

  it('cloud offline / fetch fails → missing (auto-retry happens elsewhere)', async () => {
    ensureCloudCached.mockRejectedValueOnce(new Error('offline'));
    const r = await resolveItemPhotoSource({ id: 'i1', photoStorage: 'cloud', photoPath: 'u1/i1.jpg' });
    expect(r.status).toBe('missing');
  });
});
