import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { T, type } from '../../src/design/tokens';
import { BottomNav } from '../../src/components/ui/BottomNav';
import { Divider, TextLink } from '../../src/components/ui';
import { IconChevronLeft, IconSettings, IconChevronRight } from '../../src/components/icons';
import { useAppStore } from '../../src/stores/appStore';
import { useAuthStore } from '../../src/stores/authStore';
import { OUTFITS } from '../../src/data';
import { useTranslation } from '../../src/i18n';

const SECTIONS: Array<{ id: string; labelKey: string; route?: string }> = [
  { id: 'style', labelKey: 'tabs_profile_stylePreferences', route: '/styles-edit' },
  { id: 'formula', labelKey: 'tabs_profile_formulaPreferences', route: '/formulas-edit' },
  { id: 'color', labelKey: 'tabs_profile_colorPalette', route: '/colors-edit' },
  { id: 'colourSeason', labelKey: 'tabs_profile_colourSeason', route: '/personal-color-edit' },
  { id: 'measurements', labelKey: 'tabs_profile_bodyMeasurements', route: '/measurements-edit' },
  { id: 'location', labelKey: 'tabs_profile_locationWeather' },
  { id: 'accounts', labelKey: 'tabs_profile_connectedAccounts' },
  { id: 'notifications', labelKey: 'tabs_profile_notifications', route: '/notifications' },
  { id: 'subscription', labelKey: 'tabs_profile_subscription', route: '/paywall' },
];

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { items, collections, wardrobeItems } = useAppStore();
  const { phone, email, location, displayName: storedName, avatarUrl, colorSeason, logout } = useAuthStore();

  const itemCount = wardrobeItems.length > 0 ? wardrobeItems.length : items.length;
  const stats = [
    { num: itemCount, label: t('tabs_profile_items') },
    { num: OUTFITS.length, label: t('tabs_profile_outfits') },
    { num: collections.length, label: t('tabs_profile_collections') },
  ];

  const displayName = storedName || (phone
    ? phone.replace(/(\+\d{2,3})\d+(\d{4})$/, '$1 *** ***$2')
    : email
      ? email.split('@')[0]
      : '—');
  const avatarInitial = (storedName?.[0] || phone?.slice(-4, -3) || email?.[0] || '—').toUpperCase();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.nav}>
        <Pressable onPress={() => router.replace('/(tabs)')} style={styles.iconBtn}>
          <IconChevronLeft size={20} color={T.color.primary} strokeWidth={1.4} />
        </Pressable>
        <View style={{ width: 44 }} />
        <Pressable style={styles.iconBtn} onPress={() => router.push('/profile-edit' as any)}>
          <IconSettings size={20} color={T.color.primary} strokeWidth={1.4} />
        </Pressable>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 80 }]} showsVerticalScrollIndicator={false}>
        {/* Avatar */}
        <View style={styles.profileBlock}>
          <Pressable onPress={() => router.push('/profile-edit' as any)} style={styles.avatar}>
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={StyleSheet.absoluteFill as any} borderRadius={999} />
            ) : (
              <Text style={styles.avatarText}>{avatarInitial}</Text>
            )}
          </Pressable>
          <View style={{ height: 16 }} />
          <Text style={styles.h2}>{displayName}</Text>
          <Text style={styles.handle}>{location || t('tabs_profile_noLocationSet')}</Text>
          {colorSeason && (
            <View style={styles.seasonBadge}>
              <Text style={styles.seasonBadgeText}>{colorSeason.toUpperCase()}</Text>
            </View>
          )}
          <View style={{ height: 24 }} />
        </View>

        <View style={{ height: 24 }} />

        {/* Stats */}
        <View style={styles.stats}>
          {stats.map((s, i) => (
            <React.Fragment key={s.label}>
              {i > 0 && <Divider vertical />}
              <View style={styles.statItem}>
                <Text style={styles.statNum}>{s.num}</Text>
                <Text style={styles.statLabel}>{s.label}</Text>
              </View>
            </React.Fragment>
          ))}
        </View>

        <View style={{ height: 32 }} />
        <Divider />
        <View style={{ height: 8 }} />

        {SECTIONS.map((s, i) => (
          <Pressable
            key={s.id}
            onPress={() => { if (s.route) router.push(s.route as any); }}
            style={[styles.sectionRow, { borderBottomWidth: i === SECTIONS.length - 1 ? 0 : 0.5, borderBottomColor: T.color.hairline }]}
          >
            <Text style={styles.sectionText}>{t(s.labelKey)}</Text>
            <IconChevronRight size={12} color={T.color.tertiary} strokeWidth={1.4} />
          </Pressable>
        ))}

        <View style={{ height: 32 }} />
        <Divider />
        <View style={{ height: 24 }} />
        <View style={{ alignItems: 'center' }}>
          <TextLink onPress={() => logout().then(() => router.replace('/(onboarding)'))} color={T.color.tertiary}>{t('tabs_profile_signOut')}</TextLink>
        </View>
        <View style={{ height: 16 }} />
        <Text style={[type.micro, { color: T.color.tertiary, textAlign: 'center' }]}>{t('tabs_profile_appVersion')}</Text>
      </ScrollView>

      <BottomNav active="profile" onChange={(tab) => {
        if (tab === 'home') router.replace('/(tabs)');
        if (tab === 'wardrobe') router.replace('/(tabs)/wardrobe');
        if (tab === 'scan') router.push('/try-on');
      }} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: T.color.canvas },
  nav: { height: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  content: { paddingHorizontal: 24 },
  profileBlock: { alignItems: 'center', paddingVertical: 24 },
  avatar: {
    width: 96, height: 96, borderRadius: 999,
    backgroundColor: T.color.elevated, borderWidth: 0.5, borderColor: T.color.hairline,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontFamily: T.font.serif, fontSize: 32, fontWeight: '400', color: T.color.primary },
  h2: { ...type.h2, color: T.color.primary },
  handle: { ...type.caption, fontSize: 12, marginTop: 4 },
  stats: { flexDirection: 'row', alignItems: 'stretch' },
  statItem: { flex: 1, alignItems: 'center', paddingVertical: 12 },
  statNum: { fontFamily: T.font.serif, fontSize: 24, fontWeight: '300', color: T.color.primary },
  statLabel: { ...type.ui, fontSize: 10, color: T.color.tertiary, marginTop: 4 },
  sectionRow: { flexDirection: 'row', alignItems: 'center', height: 64 },
  sectionText: { flex: 1, fontFamily: T.font.serif, fontSize: 17, fontWeight: '400', color: T.color.primary },
  seasonBadge: {
    marginTop: 8, paddingHorizontal: 10, paddingVertical: 4,
    borderWidth: 0.5, borderColor: T.color.hairline,
  },
  seasonBadgeText: { ...type.ui, fontSize: 9, color: T.color.secondary, letterSpacing: 2 },
});
