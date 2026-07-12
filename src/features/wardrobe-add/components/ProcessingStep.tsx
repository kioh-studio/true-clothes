// ProcessingStep.tsx — Step 2: scanning animation over the current photo,
// thumbnail strip progress, and skeleton item rows.

import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, Image, StyleSheet, Animated, Easing,
} from 'react-native';
import { T, type } from '../../../design/tokens';
import { IconCheck } from '../../../components/icons';
import type { PhotoEntry } from '../types';
import { useTranslation } from '../../../i18n';

interface Props {
  photos: PhotoEntry[];
  processingIndex: number;
}

export function ProcessingStep({ photos, processingIndex }: Props) {
  const { t } = useTranslation();
  const [dots, setDots] = useState(1);
  const scanAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(0.35)).current;

  // ellipsis dot animation
  useEffect(() => {
    const id = setInterval(() => setDots((d) => (d % 3) + 1), 420);
    return () => clearInterval(id);
  }, []);

  // slow scan line — top → bottom → top, slow/no-bounce per design philosophy
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scanAnim, {
          toValue: 1,
          duration: 2200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(scanAnim, {
          toValue: 0,
          duration: 2200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [scanAnim]);

  // skeleton pulse
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0.35, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulseAnim]);

  const current = photos[processingIndex] ?? photos[0];
  const isAI = current?.method === 'ai';

  return (
    <View style={styles.container}>
      {/* scanning photo */}
      <View style={styles.photoWrap}>
        {current?.uri ? (
          <Image source={{ uri: current.uri }} style={styles.photo} resizeMode="cover" />
        ) : (
          <View style={[styles.photo, styles.photoPlaceholder]} />
        )}
        {/* dim overlay */}
        <View style={styles.photoOverlay} />

        {/* scan line */}
        <Animated.View
          style={[
            styles.scanLine,
            {
              transform: [{
                translateY: scanAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 280], // approximate photo height range
                }),
              }],
            },
          ]}
        />
      </View>

      {/* thumbnail strip — progress */}
      {photos.length > 1 && (
        <View style={styles.strip}>
          {photos.map((p, i) => {
            const done = i < processingIndex;
            const active = i === processingIndex;
            return (
              <View
                key={p.id}
                style={[
                  styles.stripThumb,
                  { opacity: done || active ? 1 : 0.4 },
                ]}
              >
                <Image source={{ uri: p.uri }} style={styles.stripImg} resizeMode="cover" />
                {active && <View style={styles.stripActive} />}
                {done && (
                  <View style={styles.stripDone}>
                    <IconCheck size={16} color={T.color.canvas} strokeWidth={2} />
                  </View>
                )}
              </View>
            );
          })}
        </View>
      )}

      <View style={{ height: 24 }} />
      <Text style={styles.photoLabel}>
        {t('processingStep_photoLabel', {
          current: Math.min(processingIndex + 1, photos.length),
          total: photos.length,
          method: isAI ? t('methodBadge_byAi') : t('processingStep_onDevice'),
        })}
      </Text>
      <View style={{ height: 10 }} />
      <Text style={styles.h2}>
        {(isAI ? t('processingStep_findingPieces') : t('processingStep_removingBackground'))}{'.'.repeat(dots)}
      </Text>

      {/* skeleton rows */}
      <View style={styles.skeletons}>
        {[0, 1].map((i) => (
          <Animated.View
            key={i}
            style={[styles.skeletonRow, { opacity: pulseAnim }]}
          >
            <View style={styles.skeletonThumb} />
            <View style={styles.skeletonLines}>
              <View style={[styles.skeletonLine, { width: '62%' }]} />
              <View style={[styles.skeletonLine, { width: '40%', height: 9 }]} />
              <View style={[styles.skeletonLine, { width: '52%', height: 9 }]} />
            </View>
          </Animated.View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingBottom: 28,
    minHeight: 0,
  },
  photoWrap: {
    width: '100%',
    aspectRatio: 4 / 5,
    overflow: 'hidden',
    backgroundColor: T.color.elevated,
    flexShrink: 0,
    position: 'relative',
  },
  photo: {
    ...StyleSheet.absoluteFillObject,
  },
  photoPlaceholder: {
    backgroundColor: T.color.elevated,
  },
  photoOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(26,24,21,0.18)',
  },
  scanLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: 2,
    backgroundColor: 'rgba(250,247,242,0.9)',
    shadowColor: 'rgba(250,247,242,0.5)',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 2,
  },
  strip: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
  },
  stripThumb: {
    flex: 1,
    aspectRatio: 4 / 5,
    overflow: 'hidden',
    backgroundColor: T.color.elevated,
    position: 'relative',
  },
  stripImg: {
    width: '100%',
    height: '100%',
  },
  stripActive: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 1.5,
    borderColor: T.color.primary,
  },
  stripDone: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(26,24,21,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoLabel: {
    ...type.ui,
    fontSize: 10,
    color: T.color.tertiary,
  },
  h2: {
    ...type.h2,
    color: T.color.primary,
  },
  skeletons: {
    marginTop: 24,
    gap: 12,
  },
  skeletonRow: {
    flexDirection: 'row',
    gap: 14,
    padding: 14,
    borderWidth: 0.5,
    borderColor: T.color.hairline,
  },
  skeletonThumb: {
    width: 56,
    height: 68,
    backgroundColor: T.color.elevated,
    flexShrink: 0,
  },
  skeletonLines: {
    flex: 1,
    gap: 9,
    paddingTop: 6,
  },
  skeletonLine: {
    height: 12,
    backgroundColor: T.color.elevated,
  },
});
