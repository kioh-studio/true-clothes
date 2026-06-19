import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { T, type } from '../../src/design/tokens';
import { TextLink } from '../../src/components/ui';
import { BottomNav } from '../../src/components/ui/BottomNav';
import {
  IconX, IconDashedSquare, IconBookmark, IconLayers, IconCalendar,
  IconPin, IconBook, IconUser, IconSparkle, IconDot, IconEdit,
  IconSettings, IconChat, IconChevronRight, IconClock,
} from '../../src/components/icons';
import { useAuthStore } from '../../src/stores/authStore';

type NavDestination =
  | 'BUILDER' | 'SAVED' | 'COLLECTIONS'
  | 'SCHEDULE' | 'HISTORY' | 'PROFILE'
  | 'STYLES_EDIT' | 'COLORS_EDIT' | 'MEASUREMENTS_EDIT' | 'FORMULAS_EDIT'
  | 'SETTINGS' | 'HELP';

const SECTIONS: Array<{
  label: string;
  items: Array<{
    icon: React.ReactNode;
    title: string;
    desc: string;
    go?: NavDestination;
    soon?: boolean;
  }>;
}> = [
  {
    label: 'CREATE',
    items: [
      { icon: <IconDashedSquare size={20} strokeWidth={1.4} />, title: 'Build an outfit',    desc: 'Compose from your wardrobe',       go: 'BUILDER' },
      { icon: <IconBookmark size={20} strokeWidth={1.4} />,      title: 'Saved outfits',      desc: 'Bookmarks from your feed',         go: 'SAVED' },
      { icon: <IconLayers size={20} strokeWidth={1.4} />,        title: 'Collections',        desc: 'Wardrobe items grouped by theme',  go: 'COLLECTIONS' },
      { icon: <IconCalendar size={20} strokeWidth={1.4} />,      title: 'Schedule outfits',   desc: 'Plan the week ahead',              go: 'SCHEDULE' },
      { icon: <IconClock size={20} strokeWidth={1.4} />,         title: 'Outfit history',     desc: 'What you wore and when',           go: 'HISTORY' },
    ],
  },
  {
    label: 'DISCOVER',
    items: [
      { icon: <IconPin size={20} strokeWidth={1.4} />,  title: 'Trending in your area', desc: 'What people are wearing nearby', soon: true },
      { icon: <IconBook size={20} strokeWidth={1.4} />, title: 'Style guide',            desc: 'Notes on rules worth keeping',  soon: true },
    ],
  },
  {
    label: 'YOU',
    items: [
      { icon: <IconUser size={20} strokeWidth={1.4} />,    title: 'Profile',            desc: 'Your account and stats',   go: 'PROFILE' },
      { icon: <IconSparkle size={20} strokeWidth={1.4} />, title: 'Style preferences',  desc: 'Edit your style picks',    go: 'STYLES_EDIT' },
      { icon: <IconDot size={20} />,                       title: 'Color palette',       desc: 'Edit your color choices',  go: 'COLORS_EDIT' },
      { icon: <IconEdit size={20} strokeWidth={1.4} />,    title: 'Size & measurements', desc: 'Edit your sizing',         go: 'MEASUREMENTS_EDIT' },
      { icon: <IconSparkle size={20} strokeWidth={1.4} />, title: 'Outfit formulas',     desc: 'How outfits are built',    go: 'FORMULAS_EDIT' },
    ],
  },
  {
    label: 'SUPPORT',
    items: [
      { icon: <IconSettings size={20} strokeWidth={1.4} />, title: 'Settings',       desc: 'Notifications, units, account', go: 'SETTINGS' as NavDestination },
      { icon: <IconChat size={20} strokeWidth={1.4} />,     title: 'Help & feedback', desc: 'Reach the team',               go: 'HELP' as NavDestination },
    ],
  },
];

export default function MenuScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { logout } = useAuthStore();

  const navigate = (dest: NavDestination) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const push = (p: string) => router.push(p as any);
    switch (dest) {
      case 'BUILDER':          return push('/build');
      case 'SAVED':            return push('/saved');
      case 'COLLECTIONS':      return push('/collections');
      case 'SCHEDULE':         return push('/schedule');
      case 'HISTORY':          return push('/history');
      case 'PROFILE':          return push('/(tabs)/profile');
      case 'STYLES_EDIT':      return push('/styles-edit');
      case 'COLORS_EDIT':      return push('/colors-edit');
      case 'MEASUREMENTS_EDIT':return push('/measurements-edit');
      case 'FORMULAS_EDIT':    return push('/formulas-edit');
      case 'SETTINGS':         return push('/settings');
      case 'HELP':             return push('/help');
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 80 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Subtle close affordance */}
        <View style={styles.topRow}>
          <Pressable onPress={() => router.push('/(tabs)')} style={styles.iconBtn}>
            <IconX size={20} color={T.color.primary} strokeWidth={1.4} />
          </Pressable>
        </View>

        <View style={styles.titleBlock}>
          <Text style={styles.h1}>Menu</Text>
          <Text style={styles.caption}>Everything that doesn't live on the home feed.</Text>
        </View>

        {SECTIONS.map((sec) => (
          <View key={sec.label} style={styles.section}>
            <Text style={styles.sectionLabel}>{sec.label}</Text>
            <View style={styles.sectionList}>
              {sec.items.map((it, i) => (
                <Pressable
                  key={i}
                  onPress={() => it.go ? navigate(it.go) : undefined}
                  style={[styles.row, it.soon && styles.rowSoon]}
                  disabled={it.soon}
                >
                  <View style={styles.rowIcon}>{it.icon}</View>
                  <View style={styles.rowBody}>
                    <Text style={styles.rowTitle}>{it.title}</Text>
                    <Text style={styles.rowDesc}>{it.desc}</Text>
                  </View>
                  {it.soon ? (
                    <Text style={styles.soonBadge}>SOON</Text>
                  ) : (
                    <IconChevronRight size={12} color={T.color.tertiary} strokeWidth={1.4} />
                  )}
                </Pressable>
              ))}
            </View>
          </View>
        ))}

        <View style={{ height: 8 }} />
        <View style={{ alignItems: 'center' }}>
          <TextLink onPress={logout} color={T.color.tertiary}>Sign out</TextLink>
        </View>
        <View style={{ height: 16 }} />
        <Text style={styles.version}>MIEN · v1.0.0</Text>
      </ScrollView>

      <BottomNav
        active="menu"
        onChange={(tab) => {
          if (tab === 'home')     router.replace('/(tabs)');
          if (tab === 'wardrobe') router.replace('/(tabs)/wardrobe');
          if (tab === 'profile')  router.replace('/(tabs)/profile');
        }}
        onMenu={() => {}}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: T.color.canvas },
  content: { paddingHorizontal: 24 },
  topRow: {
    height: 56,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  titleBlock: { paddingBottom: 32 },
  h1: { ...type.h1, color: T.color.primary },
  caption: { ...type.caption, marginTop: 12 },
  section: { marginBottom: 32 },
  sectionLabel: { ...type.ui, fontSize: 10, color: T.color.tertiary, marginBottom: 12 },
  sectionList: { borderTopWidth: 0.5, borderTopColor: T.color.hairline },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingVertical: 18,
    borderBottomWidth: 0.5,
    borderBottomColor: T.color.hairline,
  },
  rowSoon: { opacity: 0.55 },
  rowIcon: { width: 24, alignItems: 'center', justifyContent: 'center' },
  rowBody: { flex: 1 },
  rowTitle: {
    fontFamily: T.font.serif,
    fontSize: 17,
    fontWeight: '400',
    color: T.color.primary,
  },
  rowDesc: { ...type.caption, fontSize: 12, color: T.color.tertiary, marginTop: 2 },
  soonBadge: { ...type.ui, fontSize: 9, color: T.color.tertiary },
  version: { ...type.micro, color: T.color.tertiary, textAlign: 'center', opacity: 0.6 },
});
