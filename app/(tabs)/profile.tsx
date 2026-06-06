import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { T, type } from '../../src/design/tokens';
import { BottomNav } from '../../src/components/ui/BottomNav';
import { Divider, TextLink } from '../../src/components/ui';
import { IconChevronLeft, IconSettings, IconChevronRight } from '../../src/components/icons';
import { useAppStore } from '../../src/stores/appStore';
import { OUTFITS } from '../../src/data';

const SECTIONS = [
  'Style preferences', 'Formula preferences', 'Color palette', 'Body measurements',
  'Location & weather', 'Connected accounts', 'Notifications', 'Subscription',
];

const SECTION_ROUTES: Record<string, string> = {
  'Style preferences': '/styles-edit',
  'Formula preferences': '/formulas-edit',
  'Color palette': '/colors-edit',
  'Body measurements': '/measurements-edit',
};

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { items, collections } = useAppStore();

  const stats = [
    { num: items.length, label: 'ITEMS' },
    { num: OUTFITS.length, label: 'OUTFITS' },
    { num: collections.length, label: 'COLLECTIONS' },
  ];

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.nav}>
        <Pressable onPress={() => router.replace('/(tabs)')} style={styles.iconBtn}>
          <IconChevronLeft size={20} color={T.color.primary} strokeWidth={1.4} />
        </Pressable>
        <View style={{ width: 44 }} />
        <Pressable style={styles.iconBtn}>
          <IconSettings size={20} color={T.color.primary} strokeWidth={1.4} />
        </Pressable>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 80 }]} showsVerticalScrollIndicator={false}>
        {/* Avatar */}
        <View style={styles.profileBlock}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>K</Text>
          </View>
          <View style={{ height: 16 }} />
          <Text style={styles.h2}>Khoi Nguyen</Text>
          <Text style={styles.handle}>@khoi · Ho Chi Minh City</Text>
          <View style={{ height: 24 }} />
          <TextLink color={T.color.primary}>Edit profile</TextLink>
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
            key={s}
            onPress={() => { const route = SECTION_ROUTES[s]; if (route) router.push(route as any); }}
            style={[styles.sectionRow, { borderBottomWidth: i === SECTIONS.length - 1 ? 0 : 0.5, borderBottomColor: T.color.hairline }]}
          >
            <Text style={styles.sectionText}>{s}</Text>
            <IconChevronRight size={12} color={T.color.tertiary} strokeWidth={1.4} />
          </Pressable>
        ))}

        <View style={{ height: 32 }} />
        <Divider />
        <View style={{ height: 24 }} />
        <View style={{ alignItems: 'center' }}>
          <TextLink onPress={() => router.replace('/(onboarding)')} color={T.color.tertiary}>Sign out</TextLink>
        </View>
        <View style={{ height: 16 }} />
        <Text style={[type.micro, { color: T.color.tertiary, textAlign: 'center' }]}>App version 1.0.0</Text>
      </ScrollView>

      <BottomNav active="profile" onChange={(tab) => {
        if (tab === 'home') router.replace('/(tabs)');
        if (tab === 'wardrobe') router.replace('/(tabs)/wardrobe');
      }} onMenu={() => {}} />
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
});
