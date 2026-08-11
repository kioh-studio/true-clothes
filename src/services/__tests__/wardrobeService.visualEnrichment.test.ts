// Ingest-threading for print_scale/drape/visual_interest/can_layer (2026-08-11).
// The server extraction schema (generate-item-image/prompt.ts) already returns
// these fields, but AddItemInput never carried them into the insert, so a
// fresh item's columns stayed NULL until backfill-item-metadata re-derived
// them (a second paid Gemini pass for data already extracted). This suite
// verifies addItem() writes the columns and rowToItem() reads them back,
// mirroring the precedent test coverage for primary_hex/secondary_hex.

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
            // Echo back exactly what addItem() inserted, same as a real round-trip,
            // so rowToItem's mapping of the new columns is actually exercised.
            can_layer: lastInsert?.can_layer ?? null,
            print_scale: lastInsert?.print_scale ?? null,
            drape: lastInsert?.drape ?? null,
            visual_interest: lastInsert?.visual_interest ?? null,
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

const baseInput = { localPhotoUri: null, category: 'top' as const, colors: ['White'] };

beforeEach(() => jest.clearAllMocks());

describe('wardrobeService.addItem — visual enrichment threading', () => {
  it('writes print_scale/drape/visual_interest/can_layer to the insert and reads them back', async () => {
    const item = await addItem({
      ...baseInput,
      canLayer: true,
      printScale: 'large',
      drape: 'structured',
      visualInterest: 0.82,
    });

    expect(item.canLayer).toBe(true);
    expect(item.printScale).toBe('large');
    expect(item.drape).toBe('structured');
    expect(item.visualInterest).toBe(0.82);
  });

  it('omits the fields (writes NULL) when the caller has no value — never fabricates one', async () => {
    const item = await addItem(baseInput);

    expect(item.canLayer).toBeNull();
    expect(item.printScale).toBeNull();
    expect(item.drape).toBeNull();
    expect(item.visualInterest).toBeNull();
  });

  it('narrows an unexpected DB string back to null instead of trusting it blindly', async () => {
    // Simulates a row whose print_scale/drape somehow holds a value outside the
    // controlled vocabulary (e.g. legacy data) — toPrintScale/toDrape must not
    // pass it through unchecked.
    const item = await addItem({ ...baseInput, printScale: 'huge' as never, drape: 'silky' as never });
    expect(item.printScale).toBeNull();
    expect(item.drape).toBeNull();
  });
});
