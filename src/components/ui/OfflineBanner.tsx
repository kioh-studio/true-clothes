import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { T, type } from '../../design/tokens';
import { useAppStore } from '../../stores/appStore';

export function OfflineBanner() {
  const isOffline = useAppStore(s => s.isOffline);
  const [dismissed, setDismissed] = useState(false);

  if (!isOffline || dismissed) return null;

  return (
    <View style={styles.banner}>
      <Text style={styles.text}>YOU'RE OFFLINE — CHANGES WILL SYNC WHEN YOU RECONNECT</Text>
      <Pressable onPress={() => setDismissed(true)} hitSlop={8}>
        <Text style={styles.dismiss}>✕</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: T.color.canvas,
    borderBottomWidth: 0.5,
    borderBottomColor: T.color.hairline,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  text:    { ...type.ui, fontSize: 10, color: T.color.secondary, letterSpacing: 0.8, flex: 1 },
  dismiss: { ...type.ui, fontSize: 12, color: T.color.tertiary, marginLeft: 8 },
});
