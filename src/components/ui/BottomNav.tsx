import React from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { T } from '../../design/tokens';
import { IconHome, IconHanger, IconUser } from '../icons';

interface Props {
  active: string;
  onChange: (tab: string) => void;
  onMenu: () => void;
}

export function BottomNav({ active, onChange, onMenu }: Props) {
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
      <View style={{ width: 48 }} />
      <TabBtn icon={<IconUser size={22} color={T.color.primary} strokeWidth={1.4} />} value="profile" />

      {/* Center action button */}
      <Pressable onPress={onMenu} style={styles.centerBtn}>
        <View style={styles.dots}>
          <View style={styles.dotW} />
          <View style={styles.dotW} />
          <View style={styles.dotW} />
        </View>
      </Pressable>
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
    position: 'relative',
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
  centerBtn: {
    position: 'absolute',
    left: '50%',
    top: -8,
    marginLeft: -24,
    width: 48, height: 48, borderRadius: 999,
    backgroundColor: T.color.primary,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: T.color.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 7,
    elevation: 8,
  },
  dots: { flexDirection: 'row', gap: 3 },
  dotW: { width: 3, height: 3, borderRadius: 999, backgroundColor: T.color.canvas },
});
