// Cancel-all-ours + re-schedule from the current prefs. Serialized so overlapping
// triggers (pref change + app active + weather refresh) never interleave.

import i18n from '../../i18n';
import { useAppStore } from '../../stores/appStore';
import { useAuthStore } from '../../stores/authStore';
import { fetchTomorrowForecast, type TwoDayForecast } from '../../services/weatherService';
import {
  getPermission, ensureChannel, cancelAllReminders, scheduleReminder,
} from '../../services/notificationService';
import { wardrobeStats } from '../wardrobe/wardrobeStats';
import { localDateKey } from '../../utils/localDateKey';
import { planReminders, type TFn } from './planReminders';

const FORECAST_TTL_MS = 3 * 60 * 60 * 1000;
let forecastCache: { key: string; at: number; value: TwoDayForecast } | null = null;

async function cachedForecast(lat: number, lon: number): Promise<TwoDayForecast | null> {
  const key = `${lat},${lon},${localDateKey()}`;
  if (forecastCache && forecastCache.key === key && Date.now() - forecastCache.at < FORECAST_TTL_MS) {
    return forecastCache.value;
  }
  const value = await fetchTomorrowForecast({ latitude: lat, longitude: lon });
  if (value) forecastCache = { key, at: Date.now(), value };
  return value;
}

async function run(): Promise<void> {
  const app = useAppStore.getState();
  const perm = await getPermission();
  // Logged out or no OS permission: make sure nothing of ours is pending.
  if (!useAuthStore.getState().isLoggedIn || !perm.granted) {
    await cancelAllReminders();
    return;
  }
  await ensureChannel();

  const { notificationPrefs: prefs, weatherLocation: loc } = app;
  const forecast = prefs.weather && loc ? await cachedForecast(loc.latitude, loc.longitude) : null;
  const unwornCount = prefs.wardrobe
    ? wardrobeStats(app.wardrobeItems, app.wearStats, localDateKey()).unworn.length
    : 0;

  const plan = planReminders({
    prefs,
    reminderTime: app.reminderTime,
    t: i18n.getFixedT(app.language) as unknown as TFn,
    forecast,
    unwornCount,
    now: new Date(),
    weatherAlertScheduled: app.weatherAlertScheduled,
  });

  await cancelAllReminders();
  for (const r of plan) {
    const ok = await scheduleReminder(r).then(() => true, () => false);
    if (ok && r.weatherAlert) useAppStore.getState().setWeatherAlertScheduled(r.weatherAlert);
  }
}

let chain: Promise<void> = Promise.resolve();
export function syncReminders(): Promise<void> {
  chain = chain.then(run, run).catch(() => {});
  return chain;
}
