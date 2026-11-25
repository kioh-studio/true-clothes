// weatherIntent must honour the weatherAwareSuggestions toggle.
jest.mock('../../services/supabase', () => ({ sb: { functions: { invoke: jest.fn() }, auth: { onAuthStateChange: jest.fn() } } }));
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async () => null), setItem: jest.fn(async () => {}), removeItem: jest.fn(async () => {}),
}));

const mockApp: { weatherContext?: { temperatureBand: string }; weatherAwareSuggestions?: boolean } = {};
jest.mock('../appStore', () => ({ useAppStore: { getState: () => mockApp } }));
jest.mock('../../i18n', () => ({ __esModule: true, default: { language: 'en', t: (k: string) => k } }));
jest.mock('../../services/authService', () => ({ getCurrentUserId: jest.fn(async () => 'u1') }));
jest.mock('../../services/measurementService', () => ({ fetchMyMeasurements: jest.fn(), upsertMyMeasurements: jest.fn() }));
jest.mock('../../services/styleProfileService', () => ({ fetchMyStyleProfile: jest.fn(), upsertMyStyleProfile: jest.fn() }));
jest.mock('../../services/stylesCatalogService', () => ({ fetchStyles: jest.fn() }));
jest.mock('../../services/formulasCatalogService', () => ({ fetchFormulas: jest.fn() }));
jest.mock('../../services/outfitInteractionService', () => ({ logImpressions: jest.fn() }));

import { weatherIntent } from '../fitEngineStore';

beforeEach(() => { delete mockApp.weatherContext; delete mockApp.weatherAwareSuggestions; });

describe('weatherIntent', () => {
  it('adds a season from the temperature band', () => {
    mockApp.weatherContext = { temperatureBand: 'cold' };
    expect(weatherIntent()).toEqual({ seasonOverride: 'winter' });
  });
  it('keeps an explicit seasonOverride', () => {
    mockApp.weatherContext = { temperatureBand: 'cold' };
    expect(weatherIntent({ seasonOverride: 'summer' } as never)).toMatchObject({ seasonOverride: 'summer' });
  });
  it('returns the intent unchanged when weatherAwareSuggestions is false', () => {
    mockApp.weatherContext = { temperatureBand: 'cold' };
    mockApp.weatherAwareSuggestions = false;
    expect(weatherIntent()).toBeUndefined();
    const intent = { occasion: 'work' } as never;
    expect(weatherIntent(intent)).toBe(intent);
  });
});
