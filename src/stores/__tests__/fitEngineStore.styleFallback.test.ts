// 2026-08-02 — unit tests for fitEngineStore.styleFallback parsing.
// Verifies the top-level `style_fallback` response envelope (wardrobe-affinity
// style fallback, see plan.md "Wardrobe-affinity style fallback in
// generate-outfits") is captured on the feed fetch path and reset to null when
// absent from a later response.

// ── Mock fitEngineStore's runtime dependencies (mirrors fitEngineStore.mixmatch.test.ts) ──

const mockInvoke = jest.fn();
jest.mock('../../services/supabase', () => ({
  sb: {
    functions: { invoke: (...args: unknown[]) => mockInvoke(...args) },
    auth: { onAuthStateChange: jest.fn() },
  },
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async () => null),
  setItem: jest.fn(async () => {}),
  removeItem: jest.fn(async () => {}),
}));

// No weather context → weatherIntent passes intent through unchanged.
jest.mock('../appStore', () => ({
  useAppStore: {
    getState: () => ({
      weatherContext: undefined,
      syncPendingPhotos: jest.fn(),
      genderAwareStyling: false,
      bodyNeutralMode: false,
    }),
  },
}));

jest.mock('../../i18n', () => ({ __esModule: true, default: { language: 'en', t: (k: string) => k } }));

jest.mock('../../services/authService', () => ({ getCurrentUserId: jest.fn(async () => 'u1') }));
jest.mock('../../services/measurementService', () => ({
  fetchMyMeasurements: jest.fn(async () => ({})), upsertMyMeasurements: jest.fn(async () => {}),
}));
jest.mock('../../services/styleProfileService', () => ({
  fetchMyStyleProfile: jest.fn(async () => null), upsertMyStyleProfile: jest.fn(async () => {}),
}));
jest.mock('../../services/stylesCatalogService', () => ({ fetchStyles: jest.fn(async () => []) }));
jest.mock('../../services/formulasCatalogService', () => ({ fetchFormulas: jest.fn(async () => []) }));
jest.mock('../../services/outfitInteractionService', () => ({ logImpressions: jest.fn(async () => {}) }));

// ── Import after mocks ───────────────────────────────────────────────────────

import { useFitEngineStore } from '../fitEngineStore';

beforeEach(() => {
  jest.clearAllMocks();
  useFitEngineStore.setState({ styleFallback: null, shownOutfitIds: [], outfits: [] });
});

describe('fitEngineStore.styleFallback', () => {
  it('fetchOutfits: response with style_fallback populates styleFallback', async () => {
    mockInvoke.mockResolvedValueOnce({
      data: {
        outfits: [],
        style_fallback: { applied: true, styles: [{ id: 'old-money', name: 'Old Money' }] },
      },
      error: null,
    });

    await useFitEngineStore.getState().fetchOutfits();

    expect(useFitEngineStore.getState().styleFallback).toEqual([{ id: 'old-money', name: 'Old Money' }]);
  });

  it('fetchOutfits: response without style_fallback nulls styleFallback', async () => {
    useFitEngineStore.setState({ styleFallback: [{ id: 'old-money', name: 'Old Money' }] });
    mockInvoke.mockResolvedValueOnce({ data: { outfits: [] }, error: null });

    await useFitEngineStore.getState().fetchOutfits();

    expect(useFitEngineStore.getState().styleFallback).toBeNull();
  });

  it('fetchMixMatchOutfits (pin path) never touches styleFallback', async () => {
    useFitEngineStore.setState({ styleFallback: [{ id: 'old-money', name: 'Old Money' }] });
    mockInvoke.mockResolvedValueOnce({
      data: {
        outfits: [],
        style_fallback: { applied: true, styles: [{ id: 'streetwear', name: 'Streetwear' }] },
      },
      error: null,
    });

    const scanned = {
      id: 'scanned',
      localImageUri: 'file:///doc/wardrobe/scanned.jpg',
      metadata: { type: 'SHIRT', name: 'Shirt', description: '', color: 'Olive', material: null, fit: null, pattern: null, warmthSeason: null, measurements: {}, brand: null, graphics: null, tags: [], confidence: 0.8 },
      method: 'ai' as const,
      usedFallback: false,
    };

    await useFitEngineStore.getState().fetchMixMatchOutfits(scanned as any);

    // Untouched — still the value set before the call, not the response's fallback.
    expect(useFitEngineStore.getState().styleFallback).toEqual([{ id: 'old-money', name: 'Old Money' }]);
  });

  it('reset() clears styleFallback', () => {
    useFitEngineStore.setState({ styleFallback: [{ id: 'old-money', name: 'Old Money' }] });
    useFitEngineStore.getState().reset();
    expect(useFitEngineStore.getState().styleFallback).toBeNull();
  });
});
