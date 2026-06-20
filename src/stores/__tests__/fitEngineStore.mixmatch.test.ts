// T032 — unit tests for fitEngineStore.fetchMixMatchOutfits (Mix & Match, US2)
// Verifies the transient pin_item is built correctly from a ScannedItem and that
// the pinned slot id maps back to the scanned item's local cut-out image.

// ── Mock fitEngineStore's runtime dependencies ──────────────────────────────

const mockInvoke = jest.fn();
jest.mock('../../services/supabase', () => ({
  sb: { functions: { invoke: (...args: unknown[]) => mockInvoke(...args) } },
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async () => null),
  setItem: jest.fn(async () => {}),
  removeItem: jest.fn(async () => {}),
}));

// No weather context → weatherIntent passes intent through unchanged.
jest.mock('../appStore', () => ({
  useAppStore: { getState: () => ({ weatherContext: undefined, syncPendingPhotos: jest.fn() }) },
}));

jest.mock('../../i18n', () => ({ __esModule: true, default: { language: 'en' } }));

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
import { ScannedItem } from '../../types/tryOn';
import { GarmentMetadata } from '../../services/imageGenerationService';

const META: GarmentMetadata = {
  type: 'SHIRT', name: 'Olive Shirt', description: '', color: 'Olive',
  material: 'Cotton', fit: 'regular', pattern: 'solid', warmthSeason: 'all_season',
  measurements: { m_chest: 54, m_body_length: 70 },
  brand: null, graphics: null, tags: [], confidence: 0.85,
};

const SCANNED: ScannedItem = {
  id: 'scanned',
  localImageUri: 'file:///doc/wardrobe/scanned.jpg',
  metadata: META,
  method: 'ai',
  usedFallback: false,
};

function lastBody(): Record<string, any> {
  const call = mockInvoke.mock.calls.at(-1);
  return call![1].body;
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('fetchMixMatchOutfits', () => {
  it('builds a pin_item from the scanned item metadata', async () => {
    mockInvoke.mockResolvedValueOnce({ data: { outfits: [] }, error: null });

    await useFitEngineStore.getState().fetchMixMatchOutfits(SCANNED);

    expect(mockInvoke).toHaveBeenCalledWith('generate-outfits', expect.anything());
    const body = lastBody();
    expect(body.pin_item).toEqual({
      id: 'scanned',
      type: 'SHIRT',
      color: 'Olive',
      material: 'Cotton',
      fit: 'regular',
      pattern: 'solid',
      warmth_season: 'all_season',
      measurements: { m_chest: 54, m_body_length: 70 },
    });
  });

  it('uses the scanned item id as the pin id so the slot maps back to its image', async () => {
    mockInvoke.mockResolvedValueOnce({ data: { outfits: [] }, error: null });
    await useFitEngineStore.getState().fetchMixMatchOutfits(SCANNED);
    // The pin id is the synthetic ScannedItem.id — the client resolves this slot
    // back to SCANNED.localImageUri when rendering the collage.
    expect(lastBody().pin_item.id).toBe(SCANNED.id);
    expect(SCANNED.localImageUri).toBeTruthy();
  });

  it('never consumes a credit / requests curation (deterministic pairing)', async () => {
    mockInvoke.mockResolvedValueOnce({ data: { outfits: [] }, error: null });
    await useFitEngineStore.getState().fetchMixMatchOutfits(SCANNED);
    expect(lastBody().curate).toBe(false);
  });

  it('omits empty optional attributes from pin_item', async () => {
    mockInvoke.mockResolvedValueOnce({ data: { outfits: [] }, error: null });
    const bare: ScannedItem = {
      ...SCANNED,
      metadata: { ...META, material: null, fit: null, pattern: null, warmthSeason: null, measurements: {} },
    };
    await useFitEngineStore.getState().fetchMixMatchOutfits(bare);
    const pin = lastBody().pin_item;
    expect(pin).toEqual({ id: 'scanned', type: 'SHIRT', color: 'Olive' });
  });

  it('returns the outfits from the response', async () => {
    const outfits = [{ slots: { top: 'scanned', bottom: 'b1', shoes: 's1' }, totalScore: 0.8 }];
    mockInvoke.mockResolvedValueOnce({ data: { outfits }, error: null });

    const result = await useFitEngineStore.getState().fetchMixMatchOutfits(SCANNED);

    expect(result).toHaveLength(1);
    expect(result[0].slots.top).toBe('scanned'); // pinned slot → the scanned item
  });

  it('throws on edge-function error (recoverable upstream)', async () => {
    mockInvoke.mockResolvedValueOnce({ data: null, error: new Error('boom') });
    await expect(
      useFitEngineStore.getState().fetchMixMatchOutfits(SCANNED),
    ).rejects.toThrow('boom');
  });
});
