// refreshWeather: uses weatherLocation; geocode-fallback from the profile string; cache invalidation.
const mockFetchWeather = jest.fn();
const mockSearch = jest.fn();
const mockAuth: { location: string } = { location: '' };

jest.mock('../../services/weatherService', () => ({ fetchCurrentWeather: (...a: unknown[]) => mockFetchWeather(...a) }));
jest.mock('../../services/locationService', () => ({ searchCities: (...a: unknown[]) => mockSearch(...a) }));
jest.mock('../authStore', () => ({ useAuthStore: { getState: () => mockAuth } }));
jest.mock('../fitEngineStore', () => ({ useFitEngineStore: { getState: () => ({ premium: false }) } }));
jest.mock('../../services/supabase', () => ({ sb: { auth: { onAuthStateChange: jest.fn() } } }));
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async () => null), setItem: jest.fn(async () => {}), removeItem: jest.fn(async () => {}),
}));
jest.mock('@react-native-community/netinfo', () => ({ addEventListener: jest.fn() }));
jest.mock('expo-localization', () => ({ getLocales: () => [{ languageCode: 'en' }] }));
jest.mock('../../i18n', () => ({ __esModule: true, default: { language: 'en', t: (k: string) => k, changeLanguage: jest.fn() } }));
jest.mock('../../data', () => ({ ITEMS: [], COLLECTIONS: [] }));
jest.mock('../../services/wardrobeService', () => ({}));
jest.mock('../../services/outfitInteractionService', () => ({}));
jest.mock('../../services/wearService', () => ({}));
jest.mock('../../services/collectionsService', () => ({}));
jest.mock('../../services/analytics', () => ({ track: jest.fn() }));

import { useAppStore } from '../appStore';
import type { WeatherContext } from '../../types/weather';

const ctx = (iso: string): WeatherContext => ({
  temperatureCelsius: 20, temperatureBand: 'warm' as const, weatherCode: 1, windspeedKmh: 3,
  fetchedAt: iso, locationCity: null,
});
const hanoi = { latitude: 21.03, longitude: 105.85, label: 'Hanoi, Vietnam', countryCode: 'VN' };

beforeEach(() => {
  jest.clearAllMocks();
  mockAuth.location = '';
  useAppStore.setState({ weatherLocation: null, weatherContext: null, weatherLastFetched: null, language: 'en' });
});

describe('refreshWeather', () => {
  it('fetches with stored weatherLocation coordinates', async () => {
    mockFetchWeather.mockResolvedValue(ctx(new Date().toISOString()));
    useAppStore.setState({ weatherLocation: hanoi });
    await useAppStore.getState().refreshWeather();
    expect(mockFetchWeather).toHaveBeenCalledWith(hanoi, 'Hanoi, Vietnam');
    expect(mockSearch).not.toHaveBeenCalled();
    expect(useAppStore.getState().weatherContext).not.toBeNull();
  });

  it('geocodes the profile location string once when weatherLocation is null', async () => {
    mockAuth.location = 'Hanoi, Vietnam';
    mockSearch.mockResolvedValue([{ ...hanoi, city: 'Hanoi', country: 'Vietnam' }]);
    mockFetchWeather.mockResolvedValue(ctx(new Date().toISOString()));
    await useAppStore.getState().refreshWeather();
    expect(mockSearch).toHaveBeenCalledWith('Hanoi', 'en');
    expect(useAppStore.getState().weatherLocation).toEqual(hanoi);
    expect(mockFetchWeather).toHaveBeenCalledTimes(1);
  });

  it('does nothing without any location, and stays silent on failure', async () => {
    await useAppStore.getState().refreshWeather();
    expect(mockFetchWeather).not.toHaveBeenCalled();
    useAppStore.setState({ weatherLocation: hanoi });
    mockFetchWeather.mockRejectedValue(new Error('net'));
    await expect(useAppStore.getState().refreshWeather()).resolves.toBeUndefined();
    expect(useAppStore.getState().weatherContext).toBeNull();
  });

  it('honours the 30-minute TTL', async () => {
    const fresh = ctx(new Date().toISOString());
    useAppStore.setState({ weatherLocation: hanoi, weatherContext: fresh, weatherLastFetched: fresh.fetchedAt });
    await useAppStore.getState().refreshWeather();
    expect(mockFetchWeather).not.toHaveBeenCalled();
  });

  it('changing location clears the cache and refetches', async () => {
    const fresh = ctx(new Date().toISOString());
    useAppStore.setState({ weatherLocation: hanoi, weatherContext: fresh, weatherLastFetched: fresh.fetchedAt });
    mockFetchWeather.mockResolvedValue(ctx(new Date(Date.now() + 1000).toISOString()));
    const paris = { latitude: 48.85, longitude: 2.35, label: 'Paris, France', countryCode: 'FR' };
    useAppStore.getState().setWeatherLocation(paris);
    expect(useAppStore.getState().weatherContext).toBeNull();
    await new Promise(r => setImmediate(r));
    expect(mockFetchWeather).toHaveBeenCalledWith(paris, 'Paris, France');
  });
});
