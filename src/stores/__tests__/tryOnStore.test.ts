// T022 — unit tests for tryOnStore
// Verifies: scan() populates scannedItem; evaluate() attaches verdict;
// store is not persisted; credit gating; error handling.

// Polyfill crypto if running in Node
if (!(global as { crypto?: Crypto }).crypto) {
  (global as { crypto?: unknown }).crypto = require('node:crypto').webcrypto;
}

// ── Mock all native / external dependencies ─────────────────────────────────

const mockFs = {
  documentDirectory: '/doc/',
  readAsStringAsync: jest.fn(async () => 'base64data'),
  writeAsStringAsync: jest.fn(async () => {}),
  makeDirectoryAsync: jest.fn(async () => {}),
  EncodingType: { Base64: 'base64' },
};
jest.mock('expo-file-system/legacy', () => mockFs);

// On-device extractor — starts as unavailable
let _isAvailable = false;
const mockExtractItemOnDevice = jest.fn();
jest.mock('../../services/extractByItemService', () => ({
  get isExtractByItemAvailable() { return _isAvailable; },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  extractItemOnDevice: (uri: any, notes?: any) => mockExtractItemOnDevice(uri, notes),
}));

// AI extractor
const mockExtractItemsWithImages = jest.fn();
jest.mock('../../services/imageGenerationService', () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  extractItemsWithImages: (uri: any, notes?: any) => mockExtractItemsWithImages(uri, notes),
}));

// Credit service
const mockCheckCredit = jest.fn();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockIncrementCredit = jest.fn(async (_type?: any) => {});
jest.mock('../../services/usageCreditService', () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  checkCredit: (type: any) => mockCheckCredit(type),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  incrementCredit: (type: any) => mockIncrementCredit(type),
  InsufficientCreditsError: class InsufficientCreditsError extends Error {
    constructor(public creditType: string) { super(`No credits for ${creditType}`); }
  },
}));

// Profile service — default non-premium
const mockHasPremiumAccountType = jest.fn(async () => false);
jest.mock('../../services/profileService', () => ({
  hasPremiumAccountType: () => mockHasPremiumAccountType(),
}));

// tryOnService
const mockEvaluateItem = jest.fn();
jest.mock('../../services/tryOnService', () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  evaluateItem: (item: any, locale?: any) => mockEvaluateItem(item, locale),
}));

// Supabase — not used directly in store but tryOnService mock covers it
jest.mock('../../services/supabase', () => ({
  sb: {
    auth: { getUser: async () => ({ data: { user: { id: 'u1' } } }) },
    functions: { invoke: jest.fn() },
  },
}));

// ── Import store AFTER mocks are in place ────────────────────────────────────

import { useTryOnStore } from '../tryOnStore';
import { GarmentMetadata } from '../../services/imageGenerationService';

// ── Helpers / fixtures ───────────────────────────────────────────────────────

const METADATA: GarmentMetadata = {
  type: 'SHIRT',
  name: 'Olive Shirt',
  description: '',
  color: 'Olive',
  material: 'Cotton',
  fit: 'regular',
  pattern: 'solid',
  warmthSeason: 'all_season',
  measurements: {},
  brand: null,
  graphics: null,
  tags: [],
  confidence: 0.85,
};

const EXTRACTED_ITEM = {
  localImageUri: 'file:///doc/wardrobe/ai_img.jpg',
  usedFallback: false,
  metadata: METADATA,
};

const VERDICT = {
  overallScore: 78,
  recommendation: 'worth_it' as const,
  criteria: [
    { key: 'color' as const,       available: true,  score: 88, weight: 0.20, explanation: 'Good palette match.' },
    { key: 'style' as const,       available: true,  score: 72, weight: 0.20, explanation: 'Style aligns.' },
    { key: 'fit' as const,         available: true,  score: 80, weight: 0.25, explanation: 'Regular fit.' },
    { key: 'measurement' as const, available: false, score: null, weight: 0.25, explanation: 'Add measurements.' },
    { key: 'fabric' as const,      available: true,  score: 70, weight: 0.10, explanation: 'Cotton all-season.' },
  ],
};

function getState() {
  return useTryOnStore.getState();
}

beforeEach(() => {
  jest.clearAllMocks();
  _isAvailable = false;
  // Reset store to idle between tests
  useTryOnStore.getState().reset();
  // Default credit: 1 remaining
  mockCheckCredit.mockResolvedValue({ used: 1, limit: 2, remaining: 1, periodStart: '2026-06-01' });
});

// ─────────────────────────────────────────────────────────────────────────────
// scan() — T013
// ─────────────────────────────────────────────────────────────────────────────

describe('tryOnStore.scan()', () => {
  it('starts in idle state', () => {
    expect(getState().status).toBe('idle');
    expect(getState().scannedItem).toBeNull();
  });

  it('uses AI path when on-device extractor is unavailable', async () => {
    _isAvailable = false;
    mockExtractItemsWithImages.mockResolvedValueOnce([EXTRACTED_ITEM]);

    await getState().scan('file://photo.jpg', 'ai');

    expect(mockExtractItemsWithImages).toHaveBeenCalledTimes(1);
    expect(mockExtractItemOnDevice).not.toHaveBeenCalled();
  });

  it('uses on-device path when isExtractByItemAvailable is true', async () => {
    _isAvailable = true;
    mockExtractItemOnDevice.mockResolvedValueOnce([{ ...EXTRACTED_ITEM, usedFallback: false }]);

    await getState().scan('file://photo.jpg', 'item');

    expect(mockExtractItemOnDevice).toHaveBeenCalledTimes(1);
    expect(mockExtractItemsWithImages).not.toHaveBeenCalled();
  });

  it('populates scannedItem after a successful AI scan', async () => {
    _isAvailable = false;
    mockExtractItemsWithImages.mockResolvedValueOnce([EXTRACTED_ITEM]);

    await getState().scan('file://photo.jpg', 'ai');

    const { scannedItem, status } = getState();
    expect(scannedItem).not.toBeNull();
    expect(scannedItem!.id).toBe('scanned');
    expect(scannedItem!.method).toBe('ai');
    expect(scannedItem!.metadata.type).toBe('SHIRT');
    expect(scannedItem!.localImageUri).toBe('file:///doc/wardrobe/ai_img.jpg');
    // Status advances to evaluating (ready for evaluate() to run)
    expect(status).toBe('evaluating');
  });

  it('populates scannedItem after a successful on-device scan', async () => {
    _isAvailable = true;
    mockExtractItemOnDevice.mockResolvedValueOnce([{ ...EXTRACTED_ITEM, usedFallback: true }]);

    await getState().scan('file://photo.jpg', 'item');

    const { scannedItem, status } = getState();
    expect(scannedItem).not.toBeNull();
    expect(scannedItem!.id).toBe('scanned');
    expect(scannedItem!.method).toBe('item');
    expect(scannedItem!.usedFallback).toBe(true);
    expect(status).toBe('evaluating');
  });

  it('checks credits before AI extraction (non-premium)', async () => {
    _isAvailable = false;
    mockExtractItemsWithImages.mockResolvedValueOnce([EXTRACTED_ITEM]);

    await getState().scan('file://photo.jpg', 'ai');

    expect(mockCheckCredit).toHaveBeenCalledWith('ai_extraction');
  });

  it('increments credit after successful AI extraction (non-premium)', async () => {
    _isAvailable = false;
    mockExtractItemsWithImages.mockResolvedValueOnce([EXTRACTED_ITEM]);

    await getState().scan('file://photo.jpg', 'ai');

    expect(mockIncrementCredit).toHaveBeenCalledWith('ai_extraction');
  });

  it('sets needsUpgrade:true and does NOT extract when credits exhausted', async () => {
    _isAvailable = false;
    mockCheckCredit.mockResolvedValueOnce({ used: 2, limit: 2, remaining: 0, periodStart: '2026-06-01' });

    await getState().scan('file://photo.jpg', 'ai');

    expect(mockExtractItemsWithImages).not.toHaveBeenCalled();
    expect(getState().needsUpgrade).toBe(true);
    expect(getState().status).toBe('idle');
    expect(getState().scannedItem).toBeNull();
  });

  it('skips credit gate for premium users', async () => {
    _isAvailable = false;
    mockHasPremiumAccountType.mockResolvedValueOnce(true);
    mockExtractItemsWithImages.mockResolvedValueOnce([EXTRACTED_ITEM]);

    await getState().scan('file://photo.jpg', 'ai');

    expect(mockCheckCredit).not.toHaveBeenCalled();
    expect(mockIncrementCredit).not.toHaveBeenCalled();
    expect(getState().scannedItem).not.toBeNull();
  });

  it('sets error and stays idle when extraction returns no items', async () => {
    _isAvailable = false;
    mockExtractItemsWithImages.mockResolvedValueOnce([]);

    await getState().scan('file://photo.jpg', 'ai');

    expect(getState().status).toBe('idle');
    expect(getState().error).toBeTruthy();
    expect(getState().scannedItem).toBeNull();
  });

  it('sets error and stays idle when extraction throws', async () => {
    _isAvailable = false;
    mockExtractItemsWithImages.mockRejectedValueOnce(new Error('Network error'));

    await getState().scan('file://photo.jpg', 'ai');

    expect(getState().status).toBe('idle');
    expect(getState().error).toContain('Network error');
    expect(getState().scannedItem).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// evaluate() — T015
// ─────────────────────────────────────────────────────────────────────────────

describe('tryOnStore.evaluate()', () => {
  async function seedScannedItem() {
    _isAvailable = false;
    mockExtractItemsWithImages.mockResolvedValueOnce([EXTRACTED_ITEM]);
    await getState().scan('file://photo.jpg', 'ai');
  }

  it('attaches verdict to store after successful evaluation', async () => {
    await seedScannedItem();
    mockEvaluateItem.mockResolvedValueOnce(VERDICT);

    await getState().evaluate();

    const { verdict, status } = getState();
    expect(verdict).not.toBeNull();
    expect(verdict!.overallScore).toBe(78);
    expect(verdict!.recommendation).toBe('worth_it');
    expect(verdict!.criteria).toHaveLength(5);
    expect(status).toBe('result');
  });

  it('does nothing when scannedItem is null', async () => {
    // Store is idle with no scannedItem
    await getState().evaluate();
    expect(mockEvaluateItem).not.toHaveBeenCalled();
    expect(getState().verdict).toBeNull();
  });

  it('sets error on failure but transitions status to result (recoverable)', async () => {
    await seedScannedItem();
    mockEvaluateItem.mockRejectedValueOnce(new Error('Edge function 500'));

    await getState().evaluate();

    expect(getState().verdict).toBeNull();
    expect(getState().status).toBe('result');
    expect(getState().error).toContain('Edge function 500');
  });

  it('stores all five criteria in the fixed order', async () => {
    await seedScannedItem();
    mockEvaluateItem.mockResolvedValueOnce(VERDICT);

    await getState().evaluate();

    const keys = getState().verdict!.criteria.map((c) => c.key);
    expect(keys).toEqual(['color', 'style', 'fit', 'measurement', 'fabric']);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// reset() — transient / no persistence
// ─────────────────────────────────────────────────────────────────────────────

describe('tryOnStore.reset()', () => {
  it('clears all state back to idle after a scan + evaluate', async () => {
    _isAvailable = false;
    mockExtractItemsWithImages.mockResolvedValueOnce([EXTRACTED_ITEM]);
    await getState().scan('file://photo.jpg', 'ai');
    mockEvaluateItem.mockResolvedValueOnce(VERDICT);
    await getState().evaluate();

    getState().reset();

    const state = getState();
    expect(state.status).toBe('idle');
    expect(state.scannedItem).toBeNull();
    expect(state.verdict).toBeNull();
    expect(state.mixMatchOutfits).toEqual([]);
    expect(state.error).toBeNull();
    expect(state.needsUpgrade).toBe(false);
  });

  it('store has no persist middleware (not a persisted store)', () => {
    // zustand/middleware/persist attaches a `persist` property on the store API
    const storeApi = useTryOnStore as unknown as { persist?: unknown };
    expect(storeApi.persist).toBeUndefined();
  });
});
