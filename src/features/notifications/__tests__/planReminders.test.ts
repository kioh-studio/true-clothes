import { planReminders, weatherSendTime, weatherCondition, parseTime, type PlanInput } from '../planReminders';

const t = (k: string, o?: Record<string, unknown>) => (o ? `${k}:${JSON.stringify(o)}` : k);
const fc = (t0: number, t1: number, p1 = 0) => ({
  today: { feelsLikeMaxC: t0, precipProbMax: 0 },
  tomorrow: { feelsLikeMaxC: t1, precipProbMax: p1 },
});
const base: PlanInput = {
  prefs: { dailyOutfit: true, weather: true, wardrobe: true, marketing: false },
  reminderTime: '07:30',
  t,
  forecast: null,
  unwornCount: 0,
  now: new Date(2026, 10, 26, 12, 0, 0),
};

describe('weatherCondition', () => {
  it('rain at >=60%', () => {
    expect(weatherCondition(fc(25, 25, 60))).toBe('rain');
    expect(weatherCondition(fc(25, 25, 59))).toBeNull();
  });
  it('temperature swing >=6C', () => {
    expect(weatherCondition(fc(30, 24))).toBe('cooler');
    expect(weatherCondition(fc(15, 21.5))).toBe('warmer');
  });
  it('band change without a big swing', () => {
    expect(weatherCondition(fc(20.5, 19))).toBe('cooler'); // warm -> mild
    expect(weatherCondition(fc(27, 29))).toBe('warmer');   // warm -> hot
  });
  it('nothing notable', () => {
    expect(weatherCondition(fc(24, 25))).toBeNull();
  });
});

describe('planReminders', () => {
  it('daily at the chosen time, route home', () => {
    const [d] = planReminders({ ...base, reminderTime: '08:30' });
    expect(d).toMatchObject({ id: 'mien.daily', route: '/', trigger: { type: 'daily', hour: 8, minute: 30 } });
  });
  it('respects prefs', () => {
    const out = planReminders({
      ...base, prefs: { dailyOutfit: false, weather: false, wardrobe: false, marketing: true },
      forecast: fc(30, 20, 90), unwornCount: 9,
    });
    expect(out).toEqual([]);
  });
  it('weather reminder is a one-shot at 20:00 today, only when notable', () => {
    expect(planReminders({ ...base, forecast: fc(24, 25) }).map(r => r.id)).toEqual(['mien.daily']);
    const w = planReminders({ ...base, forecast: fc(24, 25, 80) }).find(r => r.id === 'mien.weather');
    expect(w?.body).toBe('notifReminder_weather_rain');
    expect(w?.trigger).toEqual({ type: 'date', date: new Date(2026, 10, 26, 20, 0, 0, 0) });
  });
  it('no weather reminder without a forecast (no location)', () => {
    expect(planReminders(base).some(r => r.id === 'mien.weather')).toBe(false);
  });
  it('wardrobe weekly Sunday 19:00 only when >=3 unworn, with count', () => {
    expect(planReminders({ ...base, unwornCount: 2 }).some(r => r.id === 'mien.wardrobe')).toBe(false);
    const w = planReminders({ ...base, unwornCount: 5 }).find(r => r.id === 'mien.wardrobe');
    expect(w).toMatchObject({
      route: '/wardrobe-stats',
      trigger: { type: 'weekly', weekday: 1, hour: 19, minute: 0 },
    });
    expect(w?.body).toContain('"count":5');
  });
});

describe('weather alert dedupe', () => {
  const rainy = fc(24, 25, 80);
  const find = (i: Partial<PlanInput>) =>
    planReminders({ ...base, forecast: rainy, ...i }).find(r => r.id === 'mien.weather');

  it('already fired for tomorrow -> skip', () => {
    const now = new Date(2026, 10, 26, 21, 0);
    const at = new Date(2026, 10, 26, 20, 0).toISOString();
    expect(find({ now, weatherAlertScheduled: { forDate: '2026-11-27', at } })).toBeUndefined();
  });
  it('scheduled but not yet fired -> same slot is rescheduled', () => {
    const now = new Date(2026, 10, 26, 12, 0);
    const at = new Date(2026, 10, 26, 20, 0).toISOString();
    const w = find({ now, weatherAlertScheduled: { forDate: '2026-11-27', at } });
    expect(w?.trigger).toEqual({ type: 'date', date: new Date(at) });
    expect(w?.weatherAlert).toEqual({ forDate: '2026-11-27', at });
  });
  it('different forDate -> schedules normally and returns the new record', () => {
    const now = new Date(2026, 10, 26, 12, 0);
    const w = find({ now, weatherAlertScheduled: { forDate: '2026-11-26', at: new Date(2026, 10, 25, 20, 0).toISOString() } });
    expect(w?.weatherAlert).toEqual({ forDate: '2026-11-27', at: new Date(2026, 10, 26, 20, 0).toISOString() });
  });
});

describe('weatherSendTime', () => {
  it('today 20:00 before then', () => {
    expect(weatherSendTime(new Date(2026, 10, 26, 12, 0))).toEqual(new Date(2026, 10, 26, 20, 0));
  });
  it('now+30min after 20:00 while still before 22:00', () => {
    expect(weatherSendTime(new Date(2026, 10, 26, 20, 10))).toEqual(new Date(2026, 10, 26, 20, 40));
    expect(weatherSendTime(new Date(2026, 10, 26, 21, 29))).toEqual(new Date(2026, 10, 26, 21, 59));
  });
  it('skips when +30min would reach 22:00', () => {
    expect(weatherSendTime(new Date(2026, 10, 26, 21, 30))).toBeNull();
    expect(weatherSendTime(new Date(2026, 10, 26, 23, 0))).toBeNull();
  });
});

describe('parseTime', () => {
  it('parses and falls back', () => {
    expect(parseTime('06:30')).toEqual({ hour: 6, minute: 30 });
    expect(parseTime('garbage')).toEqual({ hour: 7, minute: 30 });
    expect(parseTime('25:00')).toEqual({ hour: 7, minute: 30 });
  });
});
