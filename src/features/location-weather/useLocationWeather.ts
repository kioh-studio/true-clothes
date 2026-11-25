// Logic for app/location-weather.tsx: current location, GPS, city search, weather preview.
import { useCallback, useEffect, useRef, useState } from 'react';
import { Linking } from 'react-native';
import * as Location from 'expo-location';
import { useAppStore } from '../../stores/appStore';
import { useAuthStore } from '../../stores/authStore';
import { detectCurrentLocation, searchCities, type CityResult } from '../../services/locationService';

const DEBOUNCE_MS = 350;

export function useLocationWeather() {
  const language = useAppStore(s => s.language);
  const weatherLocation = useAppStore(s => s.weatherLocation);
  const setWeatherLocation = useAppStore(s => s.setWeatherLocation);
  const weatherContext = useAppStore(s => s.weatherContext);
  const refreshWeather = useAppStore(s => s.refreshWeather);
  const weatherAware = useAppStore(s => s.weatherAwareSuggestions);
  const setWeatherAware = useAppStore(s => s.setWeatherAwareSuggestions);
  const unit = useAppStore(s => s.unitPreference);
  const profileLocation = useAuthStore(s => s.location);
  const updateProfile = useAuthStore(s => s.updateProfile);

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<CityResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [denied, setDenied] = useState(false);
  const [error, setError] = useState(false);
  const seq = useRef(0);

  useEffect(() => { refreshWeather().catch(() => {}); }, [refreshWeather]);

  // Debounced search; `seq` drops out-of-order responses.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) { setResults([]); setSearching(false); return; }
    setSearching(true);
    const my = ++seq.current;
    const id = setTimeout(async () => {
      const r = await searchCities(q, language);
      if (my !== seq.current) return;
      setResults(r);
      setSearching(false);
    }, DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [query, language]);

  const apply = useCallback(async (c: { label: string; countryCode: string | null; latitude: number; longitude: number }) => {
    setError(false);
    const res = await updateProfile({ location: c.label, locationCountryCode: c.countryCode });
    if (!res.ok) { setError(true); return; }
    setWeatherLocation({ latitude: c.latitude, longitude: c.longitude, label: c.label, countryCode: c.countryCode });
    setQuery('');
    setResults([]);
  }, [updateProfile, setWeatherLocation]);

  const useCurrent = useCallback(async () => {
    setDenied(false);
    setError(false);
    setDetecting(true);
    try {
      const det = await detectCurrentLocation();
      if (det) { await apply(det); return; }
      const perm = await Location.getForegroundPermissionsAsync();
      if (perm.status !== 'granted') setDenied(true); else setError(true);
    } finally {
      setDetecting(false);
    }
  }, [apply]);

  const openSettings = useCallback(() => {
    Linking.openSettings().catch(() => {});
  }, []);

  return {
    label: weatherLocation?.label || profileLocation || '',
    query, setQuery, results, searching,
    detecting, denied, error,
    useCurrent, selectCity: apply, openSettings,
    weatherContext, unit,
    weatherAware, setWeatherAware,
  };
}
