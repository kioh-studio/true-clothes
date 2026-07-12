// T021 — unit tests for tryOnService.evaluateItem
// Verifies: snake_case response → Verdict mapping, unavailable criteria (score null),
// recommendation band mapping, missing-criterion fallback, error propagation.

// Polyfill crypto if running in Node
if (!(global as { crypto?: Crypto }).crypto) {
  (global as { crypto?: unknown }).crypto = require('node:crypto').webcrypto;
}

// ── Mock Supabase client ────────────────────────────────────────────────────

let _mockResponse: { data: unknown; error: unknown } = { data: null, error: null };

jest.mock('../supabase', () => ({
  sb: {
    functions: {
      invoke: jest.fn(async () => _mockResponse),
    },
  },
}));

// Avoid pulling in expo-localization (ESM, not transformed under ts-jest) via
// the real i18n module — same stub used by the store tests.
jest.mock('../../i18n', () => ({
  __esModule: true,
  default: { language: 'en', t: (key: string) => key },
}));

// Avoid pulling in the full appStore module graph (NetInfo, wardrobeService,
// weatherService, …) — same stub pattern used by fitEngineStore's tests.
jest.mock('../../stores/appStore', () => ({
  useAppStore: { getState: () => ({ bodyNeutralMode: false }) },
}));

import { evaluateItem } from '../tryOnService';
import { ScannedItem } from '../../types/tryOn';

// ── Minimal ScannedItem fixture ─────────────────────────────────────────────

const ITEM: ScannedItem = {
  id: 'scanned',
  localImageUri: null,
  method: 'ai',
  usedFallback: false,
  metadata: {
    type: 'SHIRT',
    name: 'Olive Shirt',
    description: '',
    color: 'Olive',
    material: 'Cotton',
    fit: 'regular',
    pattern: 'solid',
    warmthSeason: 'all_season',
    measurements: { m_chest: 54, m_body_length: 70 },
    brand: null,
    graphics: null,
    tags: [],
    confidence: 0.9,
  },
};

// ── Full response fixture ────────────────────────────────────────────────────

const FULL_RAW_RESPONSE = {
  overall_score: 78,
  recommendation: 'worth_it',
  criteria: [
    { key: 'color',       available: true,  score: 88, weight: 0.20, explanation: 'Olive sits inside your earth-tone palette.' },
    { key: 'style',       available: true,  score: 72, weight: 0.20, explanation: 'Reads quiet-luxury; aligns with Old Money.' },
    { key: 'fit',         available: true,  score: 80, weight: 0.25, explanation: 'Regular fit matches your preferred fit.' },
    { key: 'measurement', available: false, score: null, weight: 0.25, explanation: 'Add your chest/shoulder measurements to score this.' },
    { key: 'fabric',      available: true,  score: 70, weight: 0.10, explanation: 'Cotton is all-season and style-appropriate.' },
  ],
};

beforeEach(() => jest.clearAllMocks());

describe('tryOnService.evaluateItem — response mapping', () => {
  it('maps a full response to the domain Verdict correctly', async () => {
    _mockResponse = { data: FULL_RAW_RESPONSE, error: null };
    const verdict = await evaluateItem(ITEM);

    expect(verdict.overallScore).toBe(78);
    expect(verdict.recommendation).toBe('worth_it');
    expect(verdict.criteria).toHaveLength(5);
  });

  it('preserves fixed criterion order: color, style, fit, measurement, fabric', async () => {
    _mockResponse = { data: FULL_RAW_RESPONSE, error: null };
    const verdict = await evaluateItem(ITEM);
    const keys = verdict.criteria.map((c) => c.key);
    expect(keys).toEqual(['color', 'style', 'fit', 'measurement', 'fabric']);
  });

  it('maps criterion fields: available:true has a score', async () => {
    _mockResponse = { data: FULL_RAW_RESPONSE, error: null };
    const verdict = await evaluateItem(ITEM);

    const color = verdict.criteria.find((c) => c.key === 'color')!;
    expect(color.available).toBe(true);
    expect(color.score).toBe(88);
    expect(color.weight).toBe(0.20);
    expect(color.explanation).toContain('earth-tone');
  });

  it('maps unavailable criterion: score is null and available is false', async () => {
    _mockResponse = { data: FULL_RAW_RESPONSE, error: null };
    const verdict = await evaluateItem(ITEM);

    const measurement = verdict.criteria.find((c) => c.key === 'measurement')!;
    expect(measurement.available).toBe(false);
    expect(measurement.score).toBeNull();
    expect(measurement.explanation).toContain('measurements');
  });

  it('maps all four recommendation values', async () => {
    const bands: Array<[string, string]> = [
      ['great', 'great'],
      ['worth_it', 'worth_it'],
      ['maybe', 'maybe'],
      ['skip', 'skip'],
    ];
    for (const [raw, expected] of bands) {
      _mockResponse = {
        data: { ...FULL_RAW_RESPONSE, recommendation: raw },
        error: null,
      };
      const verdict = await evaluateItem(ITEM);
      expect(verdict.recommendation).toBe(expected);
    }
  });

  it('returns recommendation:null for an unknown band string', async () => {
    _mockResponse = {
      data: { ...FULL_RAW_RESPONSE, recommendation: 'excellent' },
      error: null,
    };
    const verdict = await evaluateItem(ITEM);
    expect(verdict.recommendation).toBeNull();
  });

  it('returns overallScore:null when overall_score is null', async () => {
    _mockResponse = {
      data: { ...FULL_RAW_RESPONSE, overall_score: null },
      error: null,
    };
    const verdict = await evaluateItem(ITEM);
    expect(verdict.overallScore).toBeNull();
  });

  it('falls back to unavailable/empty for a criterion missing from the response', async () => {
    const partialCriteria = FULL_RAW_RESPONSE.criteria.filter((c) => c.key !== 'fabric');
    _mockResponse = {
      data: { ...FULL_RAW_RESPONSE, criteria: partialCriteria },
      error: null,
    };
    const verdict = await evaluateItem(ITEM);

    // Should still have 5 entries, fabric filled in as unavailable
    expect(verdict.criteria).toHaveLength(5);
    const fabric = verdict.criteria.find((c) => c.key === 'fabric')!;
    expect(fabric.available).toBe(false);
    expect(fabric.score).toBeNull();
  });

  it('passes locale to the edge function invocation', async () => {
    _mockResponse = { data: FULL_RAW_RESPONSE, error: null };
    const { sb } = require('../supabase');

    await evaluateItem(ITEM, 'vi');

    expect(sb.functions.invoke).toHaveBeenCalledWith(
      'evaluate-item',
      expect.objectContaining({
        body: expect.objectContaining({ locale: 'vi' }),
      }),
    );
  });

  it('sends snake_case item body to the edge function', async () => {
    _mockResponse = { data: FULL_RAW_RESPONSE, error: null };
    const { sb } = require('../supabase');

    await evaluateItem(ITEM);

    const callBody = sb.functions.invoke.mock.calls[0][1].body;
    expect(callBody.item).toMatchObject({
      type: 'SHIRT',
      color: 'Olive',
      material: 'Cotton',
      fit: 'regular',
      pattern: 'solid',
      warmth_season: 'all_season',
      measurements: { m_chest: 54, m_body_length: 70 },
    });
  });
});

describe('tryOnService.evaluateItem — error handling', () => {
  it('throws when the edge function returns an error', async () => {
    _mockResponse = { data: null, error: new Error('401 Unauthorized') };
    await expect(evaluateItem(ITEM)).rejects.toThrow('401 Unauthorized');
  });

  it('throws when the response shape is unexpected (no criteria array)', async () => {
    _mockResponse = { data: { overall_score: 50, recommendation: 'maybe' }, error: null };
    await expect(evaluateItem(ITEM)).rejects.toThrow('tryOnStore_evaluationFailed');
  });
});
