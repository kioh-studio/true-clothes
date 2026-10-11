import React, { useEffect, useState } from 'react';
import { View, Image, StyleSheet, Text, ViewStyle } from 'react-native';
import { T, type } from '../../design/tokens';

interface Props {
  src?: string | null;
  alt?: string;
  label?: string;
  tone?: number;
  style?: ViewStyle;
  fit?: 'cover' | 'contain';
  children?: React.ReactNode;
}

const TONES = [
  ['#E8E0D0', '#D4CABA'],
  ['#D9D2C5', '#C8BFAE'],
  ['#EFE9DC', '#DDD4C0'],
  ['#C9C0B0', '#B5AB99'],
  ['#E2D9C7', '#D0C6B0'],
];

export function PhotoFallback({ label = 'IMAGE', tone = 0, children }: { label?: string; tone?: number; children?: React.ReactNode }) {
  const [a] = TONES[tone % TONES.length];
  return (
    <View style={[styles.fallback, { backgroundColor: a }]}>
      <View style={styles.fallbackLabelWrap}>
        <Text style={styles.fallbackLabel}>{label}</Text>
      </View>
      {children}
    </View>
  );
}

export function Photo({ src, label = 'IMAGE', tone = 0, style, fit = 'cover', children }: Props) {
  const [errored, setErrored] = useState(false);

  // Component instances get recycled inside lists (FlatList/ScrollView) — without
  // this, a new `src` on a recycled instance would keep the previous item's
  // error state and get stuck showing the fallback forever.
  useEffect(() => {
    setErrored(false);
  }, [src]);

  return (
    <View style={[styles.container, style]}>
      {src && !errored ? (
        <Image
          source={{ uri: src }}
          onError={() => setErrored(true)}
          style={StyleSheet.absoluteFill}
          resizeMode={fit}
        />
      ) : (
        <PhotoFallback label={label} tone={tone} />
      )}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: '100%',
    overflow: 'hidden',
    position: 'relative',
  },
  fallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fallbackLabelWrap: {
    backgroundColor: T.color.canvas,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  fallbackLabel: {
    ...type.micro,
    color: T.color.tertiary,
  },
});
