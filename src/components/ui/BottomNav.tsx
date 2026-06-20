import React from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { T } from '../../design/tokens';
import { IconHome, IconHanger, IconCamera, IconUser } from '../icons';

interface Props {
  active: string;
  onChange: (tab: string) => void;
}

// Four equal-weight tabs. Scan (camera) sits between Wardrobe and Profile.
// The menu lives in each screen's own header now, not the bottom nav.
export function BottomNav({ active, onChange }: Props) {
  const TabBtn = ({ icon, value }: { icon: React.ReactNode; value: string }) => {
    const isActive = active === value;
    return (
      <Pressable onPress={() => onChange(value)} style={styles.tab}>
        <View style={{ opacity: isActive ? 1 : 0.5 }}>
          {icon}
        </View>
        <View style={[styles.dot, { opacity: isActive ? 1 : 0 }]} />
      </Pressable>
    );
  };

  return (
    <View style={styles.container}>
      <TabBtn icon={<IconHome size={22} color={T.color.primary} strokeWidth={1.4} />} value="home" />
      <TabBtn icon={<IconHanger size={22} color={T.color.primary} strokeWidth={1.4} />} value="wardrobe" />
      <TabBtn icon={<IconCamera size={22} color={T.color.primary} strokeWidth={1.4} />} value="scan" />
      <TabBtn icon={<IconUser size={22} color={T.color.primary} strokeWidth={1.4} />} value="profile" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 64,
    borderTopWidth: 0.5,
    borderTopColor: T.color.hairline,
    backgroundColor: T.color.canvas,
    flexDirection: 'row',
    alignItems: 'center',
  },
  tab: {
    flex: 1, height: 64,
    alignItems: 'center', justifyContent: 'center',
  },
  dot: {
    width: 4, height: 4, borderRadius: 999,
    backgroundColor: T.color.primary,
    marginTop: 4,
  },
});
