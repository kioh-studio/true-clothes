// T021 — unit tests for wardrobeCriticStore
// Verifies: cache-hit (unchanged wardrobe) skips refetch; dismiss() filters
// visibleRecommendations(); an item-count change resets dismissals on the
// next fetch.

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async () => null),
  setItem: jest.fn(async () => {}),
  removeItem: jest.fn(async () => {}),
}));

// wardrobeCriticStore now self-registers an onAuthStateChange listener (audit
// 2026-07-03 cross-account leak fix) — mock the module so importing the real
// src/services/supabase.ts (which throws without EXPO_PUBLIC_SUPABASE_* env
// vars) never happens, matching the pattern in fitEngineStore.mixmatch.test.ts.
jest.mock('../../services/supabase', () => ({
  sb: {
    auth: {
      onAuthStateChange: jest.fn(() => ({ data: { subscription: { unsubscribe: jest.fn() } } })),
    },
  },
}));

// Mutable wardrobe fixture the store reads via useAppStore.getState().wardrobeItems
let _wardrobeItems: Array<{ id: string }> = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
jest.mock('../appStore', () => ({
  useAppStore: { getState: () => ({ wardrobeItems: _wardrobeItems }) },
}));

const mockFetchGapReport = jest.fn();
class MockRateLimitedError extends Error {
  constructor() { super('rate_limited'); this.name = 'WardrobeCriticRateLimitedError'; }
}
jest.mock('../../services/wardrobeCriticService', () => ({
  fetchGapReport: (...args: unknown[]) => mockFetchGapReport(...args),
  WardrobeCriticRateLimitedError: MockRateLimitedError,
}));

import { useWardrobeCriticStore } from '../wardrobeCriticStore';
import type { WardrobeGapReport } from '../../types/wardrobeCritic';

function getState() {
  return useWardrobeCriticStore.getState();
}

const REPORT_A: WardrobeGapReport = {
  mode: 'gaps',
  generatedAt: '2026-07-03T00:00:00Z',
  baselineQualified: 12,
  recommendations: [
    { archetypeId: 'white_shirt', label: { en: 'A crisp white shirt', vi: 'Một sơ mi trắng' }, unlockCount: 8, note: { en: 'n', vi: 'n' }, sampleOutfits: [['x1', 'x2']] },
    { archetypeId: 'dark_loafers', label: { en: 'Dark loafers', vi: 'Loafer tối màu' }, unlockCount: 5, note: { en: 'n', vi: 'n' }, sampleOutfits: [] },
  ],
  starterChecklist: [],
  redundancy: null,
  candidate: null,
  catalogSize: 16,
};

const REPORT_B: WardrobeGapReport = { ...REPORT_A, baselineQualified: 20 };

beforeEach(() => {
  jest.clearAllMocks();
  _wardrobeItems = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  useWardrobeCriticStore.setState({
    report: null,
    wardrobeHash: '',
    wardrobeItemCount: 0,
    dismissedIds: [],
    status: 'idle',
    error: null,
    hydrated: false,
    pendingGapArchetypeId: null,
    pendingGapLabel: null,
  });
});

describe('wardrobeCriticStore.fetchReport()', () => {
  it('fetches and populates the report on first call', async () => {
    mockFetchGapReport.mockResolvedValueOnce(REPORT_A);

    await getState().fetchReport();

    expect(mockFetchGapReport).toHaveBeenCalledTimes(1);
    expect(getState().report).toEqual(REPORT_A);
    expect(getState().status).toBe('idle');
    expect(getState().wardrobeItemCount).toBe(3);
  });

  it('cache hit: does NOT refetch when the wardrobe is unchanged', async () => {
    mockFetchGapReport.mockResolvedValueOnce(REPORT_A);
    await getState().fetchReport();

    await getState().fetchReport(); // same wardrobe, no force

    expect(mockFetchGapReport).toHaveBeenCalledTimes(1);
    expect(getState().report).toEqual(REPORT_A);
  });

  it('force:true always refetches even when the wardrobe is unchanged', async () => {
    mockFetchGapReport.mockResolvedValueOnce(REPORT_A);
    await getState().fetchReport();

    mockFetchGapReport.mockResolvedValueOnce(REPORT_B);
    await getState().fetchReport(true);

    expect(mockFetchGapReport).toHaveBeenCalledTimes(2);
    expect(getState().report).toEqual(REPORT_B);
  });

  it('refetches when the wardrobe hash changes (item added)', async () => {
    mockFetchGapReport.mockResolvedValueOnce(REPORT_A);
    await getState().fetchReport();

    _wardrobeItems = [..._wardrobeItems, { id: 'd' }];
    mockFetchGapReport.mockResolvedValueOnce(REPORT_B);
    await getState().fetchReport();

    expect(mockFetchGapReport).toHaveBeenCalledTimes(2);
    expect(getState().report).toEqual(REPORT_B);
  });

  it('sets error:"rate_limited" on a 429', async () => {
    mockFetchGapReport.mockRejectedValueOnce(new MockRateLimitedError());

    await getState().fetchReport();

    expect(getState().status).toBe('error');
    expect(getState().error).toBe('rate_limited');
  });

  it('sets a generic error message on other failures', async () => {
    mockFetchGapReport.mockRejectedValueOnce(new Error('Network down'));

    await getState().fetchReport();

    expect(getState().status).toBe('error');
    expect(getState().error).toBe('Network down');
  });
});

describe('wardrobeCriticStore.dismiss() / visibleRecommendations()', () => {
  it('visibleRecommendations() returns all recommendations before any dismissal', async () => {
    mockFetchGapReport.mockResolvedValueOnce(REPORT_A);
    await getState().fetchReport();

    expect(getState().visibleRecommendations().map((r) => r.archetypeId)).toEqual([
      'white_shirt', 'dark_loafers',
    ]);
  });

  it('dismiss() filters the dismissed archetype out of visibleRecommendations()', async () => {
    mockFetchGapReport.mockResolvedValueOnce(REPORT_A);
    await getState().fetchReport();

    getState().dismiss('white_shirt');

    const visible = getState().visibleRecommendations();
    expect(visible.map((r) => r.archetypeId)).toEqual(['dark_loafers']);
    // The underlying report is untouched — only the UI-facing selector filters.
    expect(getState().report!.recommendations).toHaveLength(2);
  });

  it('dismiss() is idempotent for the same id', () => {
    getState().dismiss('white_shirt');
    getState().dismiss('white_shirt');
    expect(getState().dismissedIds).toEqual(['white_shirt']);
  });
});

describe('wardrobeCriticStore — dismissal reset on item-count change (FR-006)', () => {
  it('clears dismissedIds when the wardrobe item COUNT changes vs the cached report', async () => {
    mockFetchGapReport.mockResolvedValueOnce(REPORT_A);
    await getState().fetchReport();
    getState().dismiss('white_shirt');
    expect(getState().dismissedIds).toEqual(['white_shirt']);

    // Item added → count changes (3 → 4) → next fetch resets dismissals.
    _wardrobeItems = [..._wardrobeItems, { id: 'd' }];
    mockFetchGapReport.mockResolvedValueOnce(REPORT_B);
    await getState().fetchReport();

    expect(getState().dismissedIds).toEqual([]);
  });

  it('keeps dismissedIds when forced to refetch with the SAME item count', async () => {
    mockFetchGapReport.mockResolvedValueOnce(REPORT_A);
    await getState().fetchReport();
    getState().dismiss('white_shirt');

    // Same 3 items, just a forced refresh (e.g. pull-to-refresh) — no reason to reset.
    mockFetchGapReport.mockResolvedValueOnce(REPORT_B);
    await getState().fetchReport(true);

    expect(getState().dismissedIds).toEqual(['white_shirt']);
  });
});

describe('wardrobeCriticStore — Try-On bridge (T031)', () => {
  it('setPendingGap()/clearPendingGap() round-trip', () => {
    getState().setPendingGap('white_shirt', { en: 'A crisp white shirt', vi: 'Một sơ mi trắng' });
    expect(getState().pendingGapArchetypeId).toBe('white_shirt');
    expect(getState().pendingGapLabel).toEqual({ en: 'A crisp white shirt', vi: 'Một sơ mi trắng' });

    getState().clearPendingGap();
    expect(getState().pendingGapArchetypeId).toBeNull();
    expect(getState().pendingGapLabel).toBeNull();
  });
});
