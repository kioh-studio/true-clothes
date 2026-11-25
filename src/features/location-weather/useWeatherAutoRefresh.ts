// Re-check weather when the app returns to the foreground (appStore's 30-min TTL still applies).
import { useEffect } from 'react';
import { AppState } from 'react-native';
import { useAppStore } from '../../stores/appStore';

export function useWeatherAutoRefresh() {
  useEffect(() => {
    const sub = AppState.addEventListener('change', st => {
      if (st === 'active') useAppStore.getState().refreshWeather().catch(() => {});
    });
    return () => sub.remove();
  }, []);
}
