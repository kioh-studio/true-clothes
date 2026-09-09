// DoneStep.tsx — Step 4: success summary after all items are saved.

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { T, type } from '../../../design/tokens';
import { Bounded } from '../../../components/ui/Bounded';
import { PrimaryButton } from '../../../components/ui/PrimaryButton';
import { SecondaryButton } from '../../../components/ui/SecondaryButton';
import { IconCheck } from '../../../components/icons';
import { useTranslation } from '../../../i18n';

interface Props {
  savedCount: number;
  photoCount: number;
  onViewWardrobe: () => void;
  onDone: () => void;
}

export function DoneStep({ savedCount, photoCount, onViewWardrobe, onDone }: Props) {
  const { t } = useTranslation();
  return (
    <View style={styles.container}>
      <Bounded style={{ flex: 1 }}>
        <View style={styles.body}>
          {/* check circle */}
          <View style={styles.circle}>
            <IconCheck size={32} color={T.color.canvas} strokeWidth={1.6} />
          </View>

          <View style={{ height: 28 }} />

          <Text style={styles.label}>{t('doneStep_addedLabel')}</Text>
          <View style={{ height: 12 }} />
          <Text style={styles.hero}>
            {t('doneStep_pieceCount', { count: savedCount, suffix: savedCount === 1 ? '' : 's' })}
          </Text>

          <Text style={styles.bodyText}>
            {t('doneStep_bodyText', { count: photoCount, suffix: photoCount === 1 ? '' : 's' })}
          </Text>
        </View>

        <View style={styles.actions}>
          <PrimaryButton onPress={onViewWardrobe}>
            {t('doneStep_viewWardrobe')}
          </PrimaryButton>
          <View style={{ height: 14 }} />
          <SecondaryButton onPress={onDone}>
            {t('stepper_done')}
          </SecondaryButton>
        </View>
      </Bounded>
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
