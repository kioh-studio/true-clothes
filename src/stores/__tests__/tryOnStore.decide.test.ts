// T037 — unit tests for tryOnStore decide actions (US3)
// Verifies: addToWardrobe builds a correct AddItemInput and commits once;
// reset() clears state AND requests temp-file deletion; nothing is saved
// before the explicit Add (FR-013 / SC-004).

if (!(global as { crypto?: Crypto }).crypto) {
  (global as { crypto?: unknown }).crypto = require('node:crypto').webcrypto;
}

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockFs = {
  documentDirectory: '/doc/',
  readAsStringAsync: jest.fn(async () => 'base64data'),
  writeAsStringAsync: jest.fn(async () => {}),
  deleteAsync: jest.fn(async () => {}),
  EncodingType: { Base64: 'base64' },
};
jest.mock('expo-file-system/legacy', () => mockFs);

jest.mock('expo-image-manipulator', () => ({
  manipulateAsync: async (uri: string) => ({ uri: uri.startsWith('file://') ? uri : `file://${uri}` }),
  SaveFormat: { JPEG: 'jpeg', PNG: 'png' },
}));

// i18n pulls in expo-localization (ESM, untransformed by Jest) — stub it, same
// as tryOnStore.test.ts. The store only reads i18n.language for note locale.
jest.mock('../../i18n', () => ({ __esModule: true, default: { language: 'en' } }));

let _isAvailable = false;
jest.mock('../../services/extractByItemService', () => ({
  get isExtractByItemAvailable() { return _isAvailable; },
  extractItemOnDevice: jest.fn(),
  cutoutOnDevice: async (uri: string) => ({ uri, usedFallback: false }),
}));

const mockExtractItemsWithImages = jest.fn();
jest.mock('../../services/imageGenerationService', () => ({
  extractItemsWithImages: (uri: unknown, notes?: unknown) => mockExtractItemsWithImages(uri, notes),
}));

const mockCheckCredit = jest.fn();
jest.mock('../../services/usageCreditService', () => ({
  checkCredit: (t: unknown) => mockCheckCredit(t),
  isCreditExhausted: jest.fn(async () => false),
}));

jest.mock('../../services/profileService', () => ({ hasPremiumAccountType: jest.fn(async () => false) }));
jest.mock('../../services/tryOnService', () => ({ evaluateItem: jest.fn(async () => null) }));

const mockFetchMixMatchOutfits = jest.fn(async () => []);
jest.mock('../fitEngineStore', () => ({
  useFitEngineStore: { getState: () => ({ fetchMixMatchOutfits: mockFetchMixMatchOutfits }) },
}));

const mockAddWardrobeItem = jest.fn(async (_input: Record<string, unknown>) => {});
const appState = { wardrobeError: null as string | null };
jest.mock('../appStore', () => ({
  useAppStore: { getState: () => ({ addWardrobeItem: mockAddWardrobeItem, wardrobeError: appState.wardrobeError }) },
}));

jest.mock('../../features/wardrobe-add/vocab', () => ({
  categoryForType: (type: string) => (type === 'SHIRT' ? 'top' : 'accessory'),
}));

// ── Imports after mocks ──────────────────────────────────────────────────────

import { useTryOnStore } from '../tryOnStore';
import { GarmentMetadata } from '../../services/imageGenerationService';

const META: GarmentMetadata = {
  type: 'SHIRT', name: 'Olive Shirt', description: '', color: 'Olive',
  material: 'Cotton', fit: 'regular', pattern: 'solid', warmthSeason: 'all_season',
  measurements: { m_chest: 54 }, brand: 'Acme', graphics: null, tags: [], confidence: 0.85,
};
const EXTRACTED = { localImageUri: 'file:///doc/wardrobe/scanned.jpg', usedFallback: false, metadata: META };

const getState = () => useTryOnStore.getState();

async function seedScan() {
  _isAvailable = false;
  mockExtractItemsWithImages.mockResolvedValueOnce([EXTRACTED]);
  await getState().scan('file://photo.jpg', 'ai');
}

beforeEach(() => {
  jest.clearAllMocks();
  _isAvailable = false;
  appState.wardrobeError = null;
  getState().reset();
  mockCheckCredit.mockResolvedValue({ used: 1, limit: 2, remaining: 1, periodStart: '2026-06-01' });
});

// ── addToWardrobe ────────────────────────────────────────────────────────────

describe('tryOnStore.addToWardrobe()', () => {
  it('builds a correct AddItemInput and commits exactly once', async () => {
    await seedScan();
    await getState().addToWardrobe();

    expect(mockAddWardrobeItem).toHaveBeenCalledTimes(1);
    const input = mockAddWardrobeItem.mock.calls[0][0];
    expect(input).toMatchObject({
      localPhotoUri: 'file:///doc/wardrobe/scanned.jpg',
      category: 'top',
      colors: ['Olive'],
      name: 'Olive Shirt',
      type: 'SHIRT',
      primaryColor: 'Olive',
      material: 'Cotton',
      fit: 'regular',
      pattern: 'solid',
      warmthSeason: ['all_season'],
      measurements: { m_chest: 54 },
      brand: 'Acme',
      source: 'ai', // reuse extraction provenance — no DB constraint change
    });
  });

  it('cleans up the temp cut-out and advances to "added" on success', async () => {
    await seedScan();
    await getState().addToWardrobe();

    expect(mockFs.deleteAsync).toHaveBeenCalledWith(
      'file:///doc/wardrobe/scanned.jpg', { idempotent: true },
    );
    expect(getState().status).toBe('added');
  });

  it('surfaces a wardrobe error and does NOT mark added', async () => {
    await seedScan();
    appState.wardrobeError = 'Failed to save item. Please try again.';

    await getState().addToWardrobe();

    expect(getState().status).not.toBe('added');
    expect(getState().error).toContain('Failed to save');
  });

  it('does nothing when there is no scanned item', async () => {
    await getState().addToWardrobe();
    expect(mockAddWardrobeItem).not.toHaveBeenCalled();
  });
});

// ── reset() / discard ────────────────────────────────────────────────────────

describe('tryOnStore.reset() — discard', () => {
  it('clears state and requests temp-file deletion', async () => {
    await seedScan();
    expect(getState().scannedItem).not.toBeNull();

    getState().reset();

    expect(mockFs.deleteAsync).toHaveBeenCalledWith(
      'file:///doc/wardrobe/scanned.jpg', { idempotent: true },
    );
    expect(getState().scannedItem).toBeNull();
    expect(getState().status).toBe('idle');
  });
});

// ── No premature save (FR-013 / SC-004) ──────────────────────────────────────

describe('no save before Add', () => {
  it('scan does not write to the wardrobe', async () => {
    await seedScan();
    expect(mockAddWardrobeItem).not.toHaveBeenCalled();
  });
});
