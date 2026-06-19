// DoneStep.tsx — Step 4: success summary after all items are saved.

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { T, type } from '../../../design/tokens';
import { PrimaryButton } from '../../../components/ui/PrimaryButton';
import { SecondaryButton } from '../../../components/ui/SecondaryButton';
import { IconCheck } from '../../../components/icons';

interface Props {
  savedCount: number;
  photoCount: number;
  onViewWardrobe: () => void;
  onDone: () => void;
}

export function DoneStep({ savedCount, photoCount, onViewWardrobe, onDone }: Props) {
  return (
    <View style={styles.container}>
      <View style={styles.body}>
        {/* check circle */}
        <View style={styles.circle}>
          <IconCheck size={32} color={T.color.canvas} strokeWidth={1.6} />
        </View>

        <View style={{ height: 28 }} />

        <Text style={styles.label}>ADDED TO WARDROBE</Text>
        <View style={{ height: 12 }} />
        <Text style={styles.hero}>
          {savedCount} {savedCount === 1 ? 'piece' : 'pieces'}
        </Text>

        <Text style={styles.bodyText}>
          Extracted from {photoCount} {photoCount === 1 ? 'photo' : 'photos'} and saved with their colours and brands. Find them anytime in your wardrobe.
        </Text>
      </View>

      <View style={styles.actions}>
        <PrimaryButton onPress={onViewWardrobe}>
          VIEW MY WARDROBE
        </PrimaryButton>
        <View style={{ height: 14 }} />
        <SecondaryButton onPress={onDone}>
          DONE
        </SecondaryButton>
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
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
  },
  circle: {
    width: 72,
    height: 72,
    borderRadius: 999,
    backgroundColor: T.color.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    ...type.ui,
    fontSize: 10,
    color: T.color.tertiary,
    textAlign: 'center',
  },
  hero: {
    ...type.hero,
    color: T.color.primary,
    textAlign: 'center',
  },
  bodyText: {
    ...type.bodyL,
    color: T.color.secondary,
    marginTop: 18,
    textAlign: 'center',
    maxWidth: 300,
    lineHeight: 26,
  },
  actions: {
    flexShrink: 0,
  },
});
