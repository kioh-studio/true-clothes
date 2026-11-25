// Notifications screen — profile "Notifications" row destination.
// Real local notifications (no push server): permission + prefs + reminder time here,
// scheduling lives in src/features/notifications (syncReminders).
import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Switch } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { T, type } from '../src/design/tokens';
import { IconChevronLeft } from '../src/components/icons';
import { Bounded } from '../src/components/ui';
import { useNotificationSettings, REMINDER_TIME_PRESETS } from '../src/features/notifications/useNotificationSettings';
import type { NotificationPrefs } from '../src/stores/appStore';
import { useTranslation } from '../src/i18n';

// `marketing` is intentionally absent: no delivery infra (pref field kept for compatibility).
const ROWS: Array<{ key: Exclude<keyof NotificationPrefs, 'marketing'>; title: string; desc: string }> = [
  { key: 'dailyOutfit', title: 'notifications_dailyOutfit', desc: 'notifications_dailyOutfitDesc' },
  { key: 'weather', title: 'notifications_weather', desc: 'notifications_weatherDesc' },
  { key: 'wardrobe', title: 'notifications_wardrobe', desc: 'notifications_wardrobeDesc' },
];

export default function NotificationsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { prefs, setPref, reminderTime, setReminderTime, granted, permissionKnown, blocked, enable } = useNotificationSettings();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.nav}>
        <Pressable onPress={() => router.back()} style={styles.navBtn}>
          <IconChevronLeft size={20} color={T.color.primary} strokeWidth={1.2} />
        </Pressable>
        <Text style={styles.navTitle}>{t('notifications_title')}</Text>
        <View style={styles.navBtn} />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 48 }]}
        showsVerticalScrollIndicator={false}
      >
        <Bounded>
        {permissionKnown && !granted && (
          <Pressable style={[styles.section, styles.row, { marginBottom: 32 }]} onPress={enable}>
            <View style={styles.rowBody}>
              <Text style={styles.rowTitle}>{t('notifications_enableTitle')}</Text>
              <Text style={styles.rowDesc}>{t(blocked ? 'notifications_enableDescBlocked' : 'notifications_enableDesc')}</Text>
            </View>
          </Pressable>
        )}

        <Text style={styles.sectionLabel}>{t('notifications_sectionLabel')}</Text>
        <View style={styles.section}>
          {ROWS.map(r => (
            <View key={r.key} style={styles.row}>
              <View style={styles.rowBody}>
                <Text style={styles.rowTitle}>{t(r.title)}</Text>
                <Text style={styles.rowDesc}>{t(r.desc)}</Text>
              </View>
              <Switch
                value={granted && prefs[r.key]}
                disabled={!granted}
                onValueChange={(v) => setPref(r.key, v)}
                trackColor={{ false: T.color.muted, true: T.color.primary }}
                thumbColor={T.color.canvas}
              />
            </View>
          ))}
        </View>

        <Text style={[styles.sectionLabel, { marginTop: 32 }]}>{t('notifications_timeSection')}</Text>
        <View style={styles.section}>
          <View style={styles.row}>
            <View style={styles.rowBody}>
              <View style={styles.chips}>
                {REMINDER_TIME_PRESETS.map(tm => {
                  const active = tm === reminderTime;
                  return (
                    <Pressable
                      key={tm}
                      onPress={() => setReminderTime(tm)}
                      style={[styles.chip, active && styles.chipActive]}
                    >
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>{tm}</Text>
                    </Pressable>
                  );
                })}
              </View>
              <Text style={[styles.rowDesc, { marginTop: 12 }]}>{t('notifications_timeDesc')}</Text>
            </View>
          </View>
        </View>

        <Text style={[type.caption, styles.footerNote]}>{t('notifications_footerNote')}</Text>
        </Bounded>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: T.color.canvas },
  nav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    height: 56,
    borderBottomWidth: 0.5,
    borderBottomColor: T.color.hairline,
  },
  navBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  navTitle: {
    fontFamily: T.font.serif,
    fontSize: 17,
    fontWeight: '400',
    color: T.color.primary,
  },
  content: { paddingHorizontal: 24, paddingTop: 32 },
  sectionLabel: {
    ...type.ui,
    fontSize: 10,
    color: T.color.tertiary,
    marginBottom: 8,
  },
  section: {
    borderTopWidth: 0.5,
    borderTopColor: T.color.hairline,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 18,
    borderBottomWidth: 0.5,
    borderBottomColor: T.color.hairline,
    gap: 12,
  },
  rowBody: { flex: 1 },
  rowTitle: {
    fontFamily: T.font.serif,
    fontSize: 17,
    fontWeight: '400',
    color: T.color.primary,
  },
  rowDesc: {
    ...type.caption,
    fontSize: 12,
    color: T.color.tertiary,
    marginTop: 2,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 8,
    borderWidth: 0.5, borderColor: T.color.hairlineStrong, borderRadius: 2,
  },
  chipActive: { backgroundColor: T.color.primary, borderColor: T.color.primary },
  chipText: { ...type.ui, fontSize: 12, color: T.color.secondary },
  chipTextActive: { color: T.color.canvas },
  footerNote: {
    color: T.color.tertiary,
    marginTop: 24,
  },
});
