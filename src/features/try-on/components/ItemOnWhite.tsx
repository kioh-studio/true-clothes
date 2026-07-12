// Try On (feature 008) — T017
// Renders the AI-isolated garment cut-out on a clean white ground.
// Visual reference: screens/try-on-temp/scan-result-export/new/scan-result.jsx → ItemOnWhite
// Adapted from web (absolute/img) to React Native (View/Image).

import React from 'react';
import { View, Image, StyleSheet, Text } from 'react-native';
import { T, type } from '../../../design/tokens';
import { useTranslation } from '../../../i18n';

interface Props {
  /** Background-removed cut-out URI. Null → shows placeholder. */
  localImageUri: string | null;
  /** Optional label for accessibility / fallback display */
  label?: string;
}

export function ItemOnWhite({ localImageUri, label }: Props) {
  const { t } = useTranslation();
  const displayLabel = label ?? t('itemOnWhite_defaultLabel');
  return (
    <View style={styles.container}>
      {/* Faint studio vignette — "placed on white" feel */}
      <View style={styles.vignette} pointerEvents="none" />

      {localImageUri ? (
        <Image
          source={{ uri: localImageUri }}
          style={styles.image}
          resizeMode="contain"
          accessibilityLabel={displayLabel}
        />
      ) : (
        <View style={styles.placeholder}>
          <Text style={styles.placeholderLabel}>{displayLabel}</Text>
        </View>
      )}

      {/* Corner registration ticks — top-left */}
      <View style={[styles.tick, styles.tickTL]} />
      {/* top-right */}
      <View style={[styles.tick, styles.tickTR]} />
      {/* bottom-left */}
      <View style={[styles.tick, styles.tickBL]} />
      {/* bottom-right */}
      <View style={[styles.tick, styles.tickBR]} />

      {/* Extraction tag — top-left chip */}
      <View style={styles.extractionTag}>
        <Text style={styles.extractionTagText}>{t('itemOnWhite_extractionTag')}</Text>
      </View>
    </View>
  );
}

const TICK_SIZE = 14;

const styles = StyleSheet.create({
  container: {
    width: '100%',
    aspectRatio: 4 / 5,
    backgroundColor: '#FFFFFF',
    borderWidth: 0.5,
    borderColor: T.color.hairline,
    overflow: 'hidden',
    position: 'relative',
  },
  vignette: {
    ...StyleSheet.absoluteFillObject,
    // Subtle radial vignette emulated with a semi-transparent overlay at the edges
    // React Native has no radial-gradient; approximate with a thin border shadow.
  },
  image: {
    position: 'absolute',
    top: '7%',
    left: '9%',
    right: '9%',
    bottom: '7%',
    // drop-shadow not available in RN StyleSheet; handled by the white ground
  },
  placeholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: T.color.elevated,
  },
  placeholderLabel: {
    ...type.micro,
    color: T.color.tertiary,
  },
  tick: {
    position: 'absolute',
    width: TICK_SIZE,
    height: TICK_SIZE,
    opacity: 0.6,
  },
  tickTL: {
    top: 10,
    left: 10,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderTopColor: T.color.hairlineStrong,
    borderLeftColor: T.color.hairlineStrong,
  },
  tickTR: {
    top: 10,
    right: 10,
    borderTopWidth: 1,
    borderRightWidth: 1,
    borderTopColor: T.color.hairlineStrong,
    borderRightColor: T.color.hairlineStrong,
  },
  tickBL: {
    bottom: 10,
    left: 10,
    borderBottomWidth: 1,
    borderLeftWidth: 1,
    borderBottomColor: T.color.hairlineStrong,
    borderLeftColor: T.color.hairlineStrong,
  },
  tickBR: {
    bottom: 10,
    right: 10,
    borderBottomWidth: 1,
    borderRightWidth: 1,
    borderBottomColor: T.color.hairlineStrong,
    borderRightColor: T.color.hairlineStrong,
  },
  extractionTag: {
    position: 'absolute',
    top: 12,
    left: 12,
    backgroundColor: 'rgba(255,255,255,0.85)',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderWidth: 0.5,
    borderColor: T.color.hairline,
  },
  extractionTagText: {
    ...type.ui,
    fontSize: 8.5,
    color: T.color.primary,
  },
});
