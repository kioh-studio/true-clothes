// Mounted once in the root layout: keeps scheduled reminders in step with prefs,
// time, language, weather refreshes, wardrobe changes and app foregrounding.
// Never prompts for permission (that only happens from the Notifications screen).
import { useEffect } from 'react';
import { AppState } from 'react-native';
import { useAppStore } from '../../stores/appStore';
import { useAuthStore } from '../../stores/authStore';
import { listenForTaps } from '../../services/notificationService';
import { syncReminders } from './syncReminders';

export function useReminderSync(navReady: boolean) {
  const isLoggedIn = useAuthStore(s => s.isLoggedIn);
  const hydrated = useAppStore(s => s.hydrated);
  const prefs = useAppStore(s => s.notificationPrefs);
  const reminderTime = useAppStore(s => s.reminderTime);
  const language = useAppStore(s => s.language);
  const weatherFetchedAt = useAppStore(s => s.weatherLastFetched); // changes on each successful refresh
  const weatherLocation = useAppStore(s => s.weatherLocation);
  const wardrobeItems = useAppStore(s => s.wardrobeItems);
  const wearStats = useAppStore(s => s.wearStats);

  useEffect(() => {
    if (!hydrated) return;
    const id = setTimeout(() => { syncReminders(); }, 600); // coalesce bursts
    return () => clearTimeout(id);
  }, [hydrated, isLoggedIn, prefs, reminderTime, language, weatherFetchedAt, weatherLocation, wardrobeItems, wearStats]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', st => {
      if (st === 'active' && useAppStore.getState().hydrated) syncReminders();
    });
    return () => sub.remove();
  }, []);

  useEffect(() => (navReady ? listenForTaps() : undefined), [navReady]);
}
