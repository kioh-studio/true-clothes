jest.mock('expo-location', () => ({}));
import { searchCities, mapGeocodeResults } from '../locationService';

const realFetch = global.fetch;
afterEach(() => { global.fetch = realFetch; });

describe('mapGeocodeResults', () => {
  it('maps rows, uppercases country code, drops rows without coords/name', () => {
    expect(mapGeocodeResults({
      results: [
        { name: 'Hanoi', country: 'Vietnam', country_code: 'vn', latitude: 21.03, longitude: 105.85 },
        { name: 'NoCoords', country: 'X' },
        { country: 'NoName', latitude: 1, longitude: 2 },
        { name: 'Paris', latitude: 48.85, longitude: 2.35 },
      ],
    })).toEqual([
      { label: 'Hanoi, Vietnam', city: 'Hanoi', country: 'Vietnam', countryCode: 'VN', latitude: 21.03, longitude: 105.85 },
      { label: 'Paris', city: 'Paris', country: null, countryCode: null, latitude: 48.85, longitude: 2.35 },
    ]);
  });
  it('handles a response without results', () => {
    expect(mapGeocodeResults({})).toEqual([]);
  });
});

describe('searchCities', () => {
  it('calls Open-Meteo geocoding with language and maps the response', async () => {
    const fetchMock = jest.fn(async () => ({
      ok: true,
      json: async () => ({ results: [{ name: 'Da Nang', country: 'Viet Nam', country_code: 'VN', latitude: 16.07, longitude: 108.22 }] }),
    }));
    global.fetch = fetchMock as unknown as typeof fetch;
    const r = await searchCities('Da Nang', 'vi');
    const url = (fetchMock.mock.calls[0] as unknown as [string])[0];
    expect(url).toContain('geocoding-api.open-meteo.com/v1/search');
    expect(url).toContain('name=Da%20Nang');
    expect(url).toContain('language=vi');
    expect(r[0]?.label).toBe('Da Nang, Viet Nam');
  });
  it('returns [] on network error, non-ok, or short query (never throws)', async () => {
    global.fetch = jest.fn(async () => { throw new Error('offline'); }) as unknown as typeof fetch;
    expect(await searchCities('Hanoi', 'en')).toEqual([]);
    global.fetch = jest.fn(async () => ({ ok: false })) as unknown as typeof fetch;
    expect(await searchCities('Hanoi', 'en')).toEqual([]);
    const spy = jest.fn();
    global.fetch = spy as unknown as typeof fetch;
    expect(await searchCities('a', 'en')).toEqual([]);
    expect(spy).not.toHaveBeenCalled();
  });
});
