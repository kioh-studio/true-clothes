// Pure planner: prefs + inputs -> the local notifications we want scheduled.
// No I/O, no expo-notifications import — unit-tested; syncReminders.ts executes the plan.

import type { NotificationPrefs } from '../../stores/appStore';
import type { TwoDayForecast } from '../../services/weatherService';
import { getTemperatureBand } from '../../services/weatherService';
import { localDateKey } from '../../utils/localDateKey';

/** Last weather alert we scheduled: the local date it is about (tomorrow) and when it fires. */
export interface WeatherAlertRecord { forDate: string; at: string }

export type ReminderId = 'mien.daily' | 'mien.weather' | 'mien.wardrobe';
export const REMINDER_IDS: ReminderId[] = ['mien.daily', 'mien.weather', 'mien.wardrobe'];

export type ReminderTrigger =
  | { type: 'daily'; hour: number; minute: number }
  | { type: 'weekly'; weekday: number; hour: number; minute: number } // 1 = Sunday
  | { type: 'date'; date: Date };

export interface PlannedReminder {
  id: ReminderId;
  title: string;
  body: string;
  route: string;
  trigger: ReminderTrigger;
  weatherAlert?: WeatherAlertRecord; // set on the weather reminder: persist this after scheduling
}

export type TFn = (key: string, opts?: Record<string, unknown>) => string;

export interface PlanInput {
  prefs: NotificationPrefs;
  reminderTime: string;            // "HH:MM" local
  t: TFn;                          // already bound to the user's language
  forecast: TwoDayForecast | null; // null = no location / fetch failed -> no weather reminder
  unwornCount: number;
  now: Date;
  weatherAlertScheduled?: WeatherAlertRecord | null;
}

export const WARDROBE_MIN_ITEMS = 3;
export const PRECIP_THRESHOLD = 60;
export const TEMP_DELTA_C = 6;

export function parseTime(hhmm: string): { hour: number; minute: number } {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm);
  const hour = m ? Number(m[1]) : 7;
  const minute = m ? Number(m[2]) : 30;
  return hour <= 23 && minute <= 59 ? { hour, minute } : { hour: 7, minute: 30 };
}

/** Which message (if any) tomorrow's forecast warrants. */
export function weatherCondition(f: TwoDayForecast): 'rain' | 'cooler' | 'warmer' | null {
  if (f.tomorrow.precipProbMax >= PRECIP_THRESHOLD) return 'rain';
  const delta = f.tomorrow.feelsLikeMaxC - f.today.feelsLikeMaxC;
  if (delta <= -TEMP_DELTA_C) return 'cooler';
  if (delta >= TEMP_DELTA_C) return 'warmer';
  const b0 = getTemperatureBand(f.today.feelsLikeMaxC);
  const b1 = getTemperatureBand(f.tomorrow.feelsLikeMaxC);
  if (b0 === b1) return null;
  return delta < 0 ? 'cooler' : 'warmer';
}

/** Evening-before send time: today 20:00; if past, now+30min when still before 22:00; else null. */
export function weatherSendTime(now: Date): Date | null {
  const evening = new Date(now);
  evening.setHours(20, 0, 0, 0);
  if (now.getTime() < evening.getTime()) return evening;
  const later = new Date(now.getTime() + 30 * 60 * 1000);
  const cutoff = new Date(now);
  cutoff.setHours(22, 0, 0, 0);
  return later.getTime() < cutoff.getTime() ? later : null;
}

export function planReminders(input: PlanInput): PlannedReminder[] {
  const { prefs, reminderTime, t, forecast, unwornCount, now, weatherAlertScheduled } = input;
  const { hour, minute } = parseTime(reminderTime);
  const out: PlannedReminder[] = [];

  if (prefs.dailyOutfit) {
    out.push({
      id: 'mien.daily',
      title: t('notifReminder_dailyTitle'),
      body: t('notifReminder_dailyBody'),
      route: '/',
      trigger: { type: 'daily', hour, minute },
    });
  }

  if (prefs.weather && forecast) {
    const cond = weatherCondition(forecast);
    if (cond) {
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const forDate = localDateKey(tomorrow);
      const prev = weatherAlertScheduled?.forDate === forDate ? Date.parse(weatherAlertScheduled.at) : NaN;
      const alreadyFired = prev <= now.getTime();   // NaN -> false
      // Not fired yet: keep the same slot; fired: skip (no second alert the same evening).
      const date = alreadyFired ? null : prev > now.getTime() ? new Date(prev) : weatherSendTime(now);
      if (date) {
      out.push({
        id: 'mien.weather',
        title: t('notifReminder_weatherTitle'),
        body: t(`notifReminder_weather_${cond}`),
        route: '/',
        trigger: { type: 'date', date },
        weatherAlert: { forDate, at: date.toISOString() },
      });
      }
    }
  }

  if (prefs.wardrobe && unwornCount >= WARDROBE_MIN_ITEMS) {
    out.push({
      id: 'mien.wardrobe',
      title: t('notifReminder_wardrobeTitle'),
      body: t('notifReminder_wardrobeBody', { count: unwornCount }),
      route: '/wardrobe-stats',
      trigger: { type: 'weekly', weekday: 1, hour: 19, minute: 0 },
    });
  }

  return out;
}
