// AxisMeters — the de-black-boxing element of the personal-colour result
// (docs/personal-color-ux-simplify-instruction.md §6). Renders the three
// continuous axes (`ToneAxes` from tone12.ts — warmth/value/chroma, each in
// [-1, 1]) as plain hairline meters instead of raw numbers or colourist
// jargon. Pure presentation — no classification math here, the axes are
// computed upstream (`computeAxes`/`classifyTone12`) and simply passed in.
// Self-contained styles, same independence pattern as DrapeSession.tsx /
// BeyondTheWardrobeSection.tsx.
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { T, type } from '../../../design/tokens';
import { useTranslation } from '../../../i18n';
import type { ToneAxes } from '../tone12';

interface AxisRowSpec {
  key: keyof ToneAxes;
  negativeKey: string;
  positiveKey: string;
}

const ROWS: AxisRowSpec[] = [
  { key: 'warmth', negativeKey: 'onboardingPersonalColor_axisWarmthCool', positiveKey: 'onboardingPersonalColor_axisWarmthWarm' },
  { key: 'value',  negativeKey: 'onboardingPersonalColor_axisValueDeep',  positiveKey: 'onboardingPersonalColor_axisValueLight' },
  { key: 'chroma', negativeKey: 'onboardingPersonalColor_axisChromaSoft', positiveKey: 'onboardingPersonalColor_axisChromaClear' },
];

function AxisRow({ axisValue, negativeKey, positiveKey }: { axisValue: number; negativeKey: string; positiveKey: string }) {
  const { t } = useTranslation();
  const clamped = Math.max(-1, Math.min(1, axisValue));
  const dotLeftPct = ((clamped + 1) / 2) * 100;
  return (
    <View style={styles.row}>
      <View style={styles.endLabels}>
        <Text style={styles.endLabel}>{t(negativeKey)}</Text>
        <Text style={styles.endLabel}>{t(positiveKey)}</Text>
      </View>
      <View style={{ height: 10 }} />
      <View style={styles.track}>
        <View style={[styles.dot, { left: `${dotLeftPct}%` }]} />
      </View>
    </View>
  );
}

export function AxisMeters({ axes }: { axes: ToneAxes }) {
  const { t } = useTranslation();
  return (
    <View style={styles.container}>
      {ROWS.map((row, i) => (
        <React.Fragment key={row.key}>
          {i > 0 && <View style={{ height: 18 }} />}
          <AxisRow axisValue={axes[row.key]} negativeKey={row.negativeKey} positiveKey={row.positiveKey} />
        </React.Fragment>
      ))}
      <View style={{ height: 12 }} />
      <Text style={styles.caption}>{t('onboardingPersonalColor_axisCaption')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {},
  row: {},
  endLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  endLabel: { ...type.ui, fontSize: 9, color: T.color.tertiary, letterSpacing: 1.5 },
  track: { height: 1, backgroundColor: T.color.hairline, position: 'relative' },
  dot: {
    position: 'absolute', top: -3, width: 7, height: 7, borderRadius: 3.5,
    backgroundColor: T.color.primary, marginLeft: -3.5,
  },
  caption: { ...type.caption, fontSize: 11, color: T.color.tertiary },
});
