// Logic for app/notifications.tsx: permission state + prefs + reminder time.
import { useCallback, useEffect, useState } from 'react';
import { AppState, Linking } from 'react-native';
import { useAppStore } from '../../stores/appStore';
import { getPermission, requestPermission, type PermissionState } from '../../services/notificationService';
import { syncReminders } from './syncReminders';

export const REMINDER_TIME_PRESETS = ['06:30', '07:00', '07:30', '08:00', '08:30'] as const;

export function useNotificationSettings() {
  const prefs = useAppStore(s => s.notificationPrefs);
  const setPref = useAppStore(s => s.setNotificationPref);
  const reminderTime = useAppStore(s => s.reminderTime);
  const setReminderTime = useAppStore(s => s.setReminderTime);
  const [perm, setPerm] = useState<PermissionState | null>(null);

  const refresh = useCallback(() => { getPermission().then(setPerm); }, []);

  useEffect(() => {
    refresh();
    // User may flip the OS switch in Settings and come back.
    const sub = AppState.addEventListener('change', st => { if (st === 'active') refresh(); });
    return () => sub.remove();
  }, [refresh]);

  const enable = useCallback(async () => {
    if (perm && !perm.granted && !perm.canAskAgain) {
      Linking.openSettings().catch(() => {});
      return;
    }
    const res = await requestPermission();
    setPerm(res);
    if (res.granted) syncReminders();
  }, [perm]);

  return {
    prefs, setPref, reminderTime, setReminderTime,
    granted: perm?.granted ?? false,
    permissionKnown: perm !== null,
    blocked: perm !== null && !perm.granted && !perm.canAskAgain, // only the OS Settings can fix it
    enable,
  };
}
