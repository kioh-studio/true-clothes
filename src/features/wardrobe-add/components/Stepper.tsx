// Stepper.tsx — 4-dot step indicator for the Add to Wardrobe wizard.
// Steps: Upload · Analyse · Review · Done

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { T, type } from '../../../design/tokens';
import { IconCheck } from '../../../components/icons';
import type { WizardStep } from '../types';
import { useTranslation } from '../../../i18n';

const STEPS: { key: WizardStep; labelKey: string }[] = [
  { key: 'upload', labelKey: 'stepper_upload' },
  { key: 'analyse', labelKey: 'stepper_analyse' },
  { key: 'review', labelKey: 'stepper_review' },
  { key: 'done', labelKey: 'stepper_done' },
];

const STEP_INDEX: Record<WizardStep, number> = {
  upload: 0,
  analyse: 1,
  review: 2,
  done: 3,
};

interface Props {
  step: WizardStep;
}

export function Stepper({ step }: Props) {
  const { t } = useTranslation();
  const activeIndex = STEP_INDEX[step];

  return (
    <View style={styles.row}>
      {STEPS.map(({ key, labelKey }, i) => {
        const done = i < activeIndex;
        const cur = i === activeIndex;
        return (
          <React.Fragment key={key}>
            <View style={styles.stepCol}>
              <View style={[
                styles.dot,
                (done || cur) && styles.dotActive,
              ]}>
                {done ? (
                  <IconCheck size={13} color={T.color.canvas} strokeWidth={1.8} />
                ) : (
                  <Text style={[styles.dotNum, cur && styles.dotNumActive]}>
                    {i + 1}
                  </Text>
                )}
              </View>
              <Text style={[styles.label, cur && styles.labelActive]}>
                {t(labelKey)}
              </Text>
            </View>
            {i < STEPS.length - 1 && (
              <View style={[styles.connector, i < activeIndex && styles.connectorActive]} />
            )}
          </React.Fragment>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 4,
  },
  stepCol: {
    flexShrink: 0,
    width: 44,
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    width: 26,
    height: 26,
    borderRadius: 999,
    borderWidth: 0.5,
    borderColor: T.color.hairlineStrong,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotActive: {
    backgroundColor: T.color.primary,
    borderWidth: 0,
  },
  dotNum: {
    ...type.micro,
    fontSize: 10,
    color: T.color.tertiary,
    lineHeight: 12,
  },
  dotNumActive: {
    color: T.color.canvas,
  },
  label: {
    ...type.micro,
    fontSize: 8,
    color: T.color.tertiary,
    textAlign: 'center',
    lineHeight: 11,
  },
  labelActive: {
    color: T.color.primary,
  },
  connector: {
    flex: 1,
    height: 0.5,
    backgroundColor: T.color.hairlineStrong,
    marginTop: 13,
  },
  connectorActive: {
    backgroundColor: T.color.primary,
  },
});
