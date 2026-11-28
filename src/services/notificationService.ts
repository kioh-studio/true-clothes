// Thin wrapper over expo-notifications (local notifications only: no push token,
// no server). Hooks go through this; nothing else imports expo-notifications.

import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { track } from './analytics';
import type { PlannedReminder } from '../features/notifications/planReminders';
import { REMINDER_IDS } from '../features/notifications/planReminders';

const CHANNEL_ID = 'reminders';

export interface PermissionState {
  granted: boolean;
  canAskAgain: boolean;
}

// Show reminders as a banner even if the app happens to be open.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export async function ensureChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: 'Reminders',
    importance: Notifications.AndroidImportance.DEFAULT,
  });
}

export async function getPermission(): Promise<PermissionState> {
  try {
    const p = await Notifications.getPermissionsAsync();
    return { granted: p.granted, canAskAgain: p.canAskAgain };
  } catch {
    return { granted: false, canAskAgain: false };
  }
}

export async function requestPermission(): Promise<PermissionState> {
  try {
    await ensureChannel(); // Android 13+ only prompts once a channel exists
    const p = await Notifications.requestPermissionsAsync();
    return { granted: p.granted, canAskAgain: p.canAskAgain };
  } catch {
    return { granted: false, canAskAgain: false };
  }
}

export async function cancelAllReminders(): Promise<void> {
  await Promise.all(REMINDER_IDS.map(id =>
    Notifications.cancelScheduledNotificationAsync(id).catch(() => {})));
}

export async function scheduleReminder(r: PlannedReminder): Promise<void> {
  const T = Notifications.SchedulableTriggerInputTypes;
  const trigger: Notifications.NotificationTriggerInput =
    r.trigger.type === 'daily'
      ? { type: T.DAILY, hour: r.trigger.hour, minute: r.trigger.minute, channelId: CHANNEL_ID }
      : r.trigger.type === 'weekly'
        ? { type: T.WEEKLY, weekday: r.trigger.weekday, hour: r.trigger.hour, minute: r.trigger.minute, channelId: CHANNEL_ID }
        : { type: T.DATE, date: r.trigger.date, channelId: CHANNEL_ID };
  await Notifications.scheduleNotificationAsync({
    identifier: r.id,
    content: { title: r.title, body: r.body, data: { route: r.route } },
    trigger,
  });
}

function routeFrom(resp: Notifications.NotificationResponse | null): void {
  const route = resp?.notification.request.content.data?.['route'];
  if (typeof route !== 'string') return;
  const id = resp?.notification.request.identifier;
  const type = id === 'mien.daily' ? 'daily' : id === 'mien.weather' ? 'weather' : id === 'mien.wardrobe' ? 'weekly' : 'other';
  track('notification_opened', { type });
  router.push((route === '/' ? '/(tabs)' : route) as never);
}

/** Route taps to data.route. Returns an unsubscribe. Call once the navigator is ready. */
export function listenForTaps(): () => void {
  // Cold start: the tap that launched the app.
  Notifications.getLastNotificationResponseAsync().then(routeFrom).catch(() => {});
  const sub = Notifications.addNotificationResponseReceivedListener(routeFrom);
  return () => sub.remove();
}
