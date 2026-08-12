// imageGenerationService — RawMetadata → GarmentMetadata mapping (2026-08-11,
// 2026-08-14 opacity). The server extraction schema (generate-item-image/
// prompt.ts) returns can_layer/print_scale/drape/visual_interest/opacity,
// but the client's RawMetadata/toDomain never declared or mapped them, so
// they were silently dropped at this exact boundary before useAddWizard ever
// saw them. This suite verifies extractItemsWithImages() (the public entry
// point wrapping toDomain) now carries them through, mirroring the existing
// primary_hex/secondary_hex/distressed threading.

jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: '/doc/',
  makeDirectoryAsync: jest.fn(async () => {}),
  writeAsStringAsync: jest.fn(async () => {}),
  EncodingType: { Base64: 'base64' },
}));

const mockInvoke = jest.fn();
jest.mock('../supabase', () => ({
  sb: { functions: { invoke: (...args: unknown[]) => mockInvoke(...args) } },
}));

jest.mock('../../i18n', () => ({ __esModule: true, default: { t: (k: string) => k } }));

import { extractItemsWithImages } from '../imageGenerationService';

beforeEach(() => jest.clearAllMocks());

const RAW_ITEM = {
  image_data: '', mime_type: 'image/png', keyed: false,
  metadata: {
    type: 'SKIRT', name: 'Olive Skirt', description: '', color: 'Olive',
    material: null, fit: null, pattern: 'solid', warmth_season: null,
    measurements: { m_skirt_length: 45 }, brand: null, graphics: null,
    tags: [], confidence: 0.7,
    can_layer: null,
    print_scale: 'medium',
    drape: 'fluid',
    visual_interest: 0.6,
    opacity: 'opaque',
  },
};

describe('extractItemsWithImages — visual enrichment + can_layer + opacity threading', () => {
  it('carries print_scale/drape/visual_interest/can_layer/opacity from the raw response into GarmentMetadata', async () => {
    mockInvoke.mockResolvedValueOnce({ data: { items: [RAW_ITEM] }, error: null });

    const [result] = await extractItemsWithImages('data:image/jpeg;base64,xx');

    expect(result.metadata.printScale).toBe('medium');
    expect(result.metadata.drape).toBe('fluid');
    expect(result.metadata.visualInterest).toBe(0.6);
    expect(result.metadata.canLayer).toBeNull(); // server returned null (bottom, not applicable)
    expect(result.metadata.opacity).toBe('opaque');
    // Sanity: the pre-existing m_skirt_length key survives untouched (whole
    // object passthrough, not an enumerated allowlist).
    expect(result.metadata.measurements.m_skirt_length).toBe(45);
  });

  it('defaults to null when the server omits the fields entirely (older/partial response)', async () => {
    const bare = { ...RAW_ITEM, metadata: { ...RAW_ITEM.metadata } } as typeof RAW_ITEM;
    delete (bare.metadata as Record<string, unknown>).can_layer;
    delete (bare.metadata as Record<string, unknown>).print_scale;
    delete (bare.metadata as Record<string, unknown>).drape;
    delete (bare.metadata as Record<string, unknown>).visual_interest;
    delete (bare.metadata as Record<string, unknown>).opacity;
    mockInvoke.mockResolvedValueOnce({ data: { items: [bare] }, error: null });

    const [result] = await extractItemsWithImages('data:image/jpeg;base64,xx');

    expect(result.metadata.canLayer).toBeNull();
    expect(result.metadata.printScale).toBeNull();
    expect(result.metadata.drape).toBeNull();
    expect(result.metadata.visualInterest).toBeNull();
    expect(result.metadata.opacity).toBeNull();
  });

  it('threads a true can_layer estimate through for a layerable top', async () => {
    const layerable = {
      ...RAW_ITEM,
      metadata: { ...RAW_ITEM.metadata, type: 'CARDIGAN', can_layer: true },
    };
    mockInvoke.mockResolvedValueOnce({ data: { items: [layerable] }, error: null });

    const [result] = await extractItemsWithImages('data:image/jpeg;base64,xx');

    expect(result.metadata.canLayer).toBe(true);
  });

  it('threads a sheer opacity estimate through for a see-through garment', async () => {
    const sheer = {
      ...RAW_ITEM,
      metadata: { ...RAW_ITEM.metadata, type: 'CARDIGAN', opacity: 'sheer' },
    };
    mockInvoke.mockResolvedValueOnce({ data: { items: [sheer] }, error: null });

    const [result] = await extractItemsWithImages('data:image/jpeg;base64,xx');

    expect(result.metadata.opacity).toBe('sheer');
  });
});
