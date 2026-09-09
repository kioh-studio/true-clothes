// Notifications preferences screen — profile "Notifications" row destination.
// Local-only: persists user preferences in appStore. No push delivery infra.
import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Switch } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { T, type } from '../src/design/tokens';
import { IconChevronLeft } from '../src/components/icons';
import { Bounded } from '../src/components/ui';
import { useAppStore } from '../src/stores/appStore';
import { useTranslation } from '../src/i18n';

export default function NotificationsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { notificationPrefs, setNotificationPref } = useAppStore();

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
        <Text style={styles.sectionLabel}>{t('notifications_sectionLabel')}</Text>
        <View style={styles.section}>
          <View style={styles.row}>
            <View style={styles.rowBody}>
              <Text style={styles.rowTitle}>{t('notifications_dailyOutfit')}</Text>
              <Text style={styles.rowDesc}>{t('notifications_dailyOutfitDesc')}</Text>
            </View>
            <Switch
              value={notificationPrefs.dailyOutfit}
              onValueChange={(v) => setNotificationPref('dailyOutfit', v)}
              trackColor={{ false: T.color.muted, true: T.color.primary }}
              thumbColor={T.color.canvas}
            />
          </View>

          <View style={styles.row}>
            <View style={styles.rowBody}>
              <Text style={styles.rowTitle}>{t('notifications_weather')}</Text>
              <Text style={styles.rowDesc}>{t('notifications_weatherDesc')}</Text>
            </View>
            <Switch
              value={notificationPrefs.weather}
              onValueChange={(v) => setNotificationPref('weather', v)}
              trackColor={{ false: T.color.muted, true: T.color.primary }}
              thumbColor={T.color.canvas}
            />
          </View>

          <View style={styles.row}>
            <View style={styles.rowBody}>
              <Text style={styles.rowTitle}>{t('notifications_wardrobe')}</Text>
              <Text style={styles.rowDesc}>{t('notifications_wardrobeDesc')}</Text>
            </View>
            <Switch
              value={notificationPrefs.wardrobe}
              onValueChange={(v) => setNotificationPref('wardrobe', v)}
              trackColor={{ false: T.color.muted, true: T.color.primary }}
              thumbColor={T.color.canvas}
            />
          </View>

          <View style={styles.row}>
            <View style={styles.rowBody}>
              <Text style={styles.rowTitle}>{t('notifications_marketing')}</Text>
              <Text style={styles.rowDesc}>{t('notifications_marketingDesc')}</Text>
            </View>
            <Switch
              value={notificationPrefs.marketing}
              onValueChange={(v) => setNotificationPref('marketing', v)}
              trackColor={{ false: T.color.muted, true: T.color.primary }}
              thumbColor={T.color.canvas}
            />
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
  footerNote: {
    color: T.color.tertiary,
    marginTop: 24,
  },
});
