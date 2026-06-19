// Try On — Mix & Match swipe feed. Full implementation in US2 (T030).
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { T, type } from '../../../design/tokens';

export function MixMatchFeed() {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.container, { paddingTop: insets.top + T.s(6) }]}>
      <Text style={styles.h2}>Mix & match</Text>
      <Text style={styles.caption}>Outfits built around this item appear here.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: T.color.canvas, paddingHorizontal: T.s(6) },
  h2: { ...type.h2, color: T.color.primary },
  caption: { ...type.caption, marginTop: T.s(3) },
});
