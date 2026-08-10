// "BEYOND THE WARDROBE" — Phase C beauty deliverables (wow colours, metal,
// makeup families, hair/glasses direction), rendered on both personal-color
// result screens. Presentational only — ALL data selection comes from
// `TONE12_BEAUTY[tone12]` (tone12Beauty.ts); this component just lays it
// out per docs/personal-color-v3-phase-c-instruction.md §C2. Self-contained
// styles (same independence pattern as DrapeSession.tsx) rather than reusing
// either screen's private StyleSheet.
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { T, type } from '../../../design/tokens';
import { useTranslation } from '../../../i18n';
import type { ColorTone12 } from '../tone12';
import { TONE12_BEAUTY } from '../tone12Beauty';

const METAL_LINE_KEY: Record<'gold' | 'silver' | 'both', string> = {
  gold: 'onboardingPersonalColor_metalGoldLine',
  silver: 'onboardingPersonalColor_metalSilverLine',
  both: 'onboardingPersonalColor_metalBothLine',
};

function MakeupRow({ labelKey, hexes }: { labelKey: string; hexes: string[] }) {
  const { t } = useTranslation();
  return (
    <View style={styles.makeupRow}>
      <Text style={styles.makeupSublabel}>{t(labelKey)}</Text>
      <View style={{ height: 8 }} />
      <View style={styles.swatchRow}>
        {hexes.map(hex => (
          <View key={hex} style={[styles.paletteSwatchSmall, { backgroundColor: hex }]} />
        ))}
      </View>
    </View>
  );
}

export function BeyondTheWardrobeSection({
  tone12, showLabel = true,
}: {
  tone12: ColorTone12;
  /** UX-simplify (2026-08-06): ResultView.tsx now wraps this component in a
   *  collapsible section whose OWN header already reads "BEYOND THE
   *  WARDROBE" — pass false there to avoid rendering the same label twice.
   *  Defaults to true so every other existing caller is unaffected. */
  showLabel?: boolean;
}) {
  const { t } = useTranslation();
  const beauty = TONE12_BEAUTY[tone12];

  return (
    <View style={styles.section}>
      {showLabel && <Text style={styles.sectionLabel}>{t('onboardingPersonalColor_beyondWardrobeLabel')}</Text>}

      {/* WOW COLOURS */}
      <View style={{ height: 20 }} />
      <Text style={styles.sectionLabel}>{t('onboardingPersonalColor_wowColoursLabel')}</Text>
      <View style={{ height: 12 }} />
      <View style={styles.swatchRow}>
        {beauty.wow.map(hex => (
          <View key={hex} style={[styles.wowSwatch, { backgroundColor: hex }]} />
        ))}
      </View>
      <Text style={styles.caption}>{t('onboardingPersonalColor_wowColoursCaption')}</Text>

      {/* METALS */}
      <View style={{ height: 20 }} />
      <Text style={styles.sectionLabel}>{t('onboardingPersonalColor_metalsLabel')}</Text>
      <View style={{ height: 8 }} />
      <Text style={styles.skipListText}>{t(METAL_LINE_KEY[beauty.metal])}</Text>

      {/* MAKEUP */}
      <View style={{ height: 20 }} />
      <Text style={styles.sectionLabel}>{t('onboardingPersonalColor_makeupLabel')}</Text>
      <View style={{ height: 12 }} />
      <MakeupRow labelKey="onboardingPersonalColor_makeupLipsLabel" hexes={beauty.makeup.lips} />
      <MakeupRow labelKey="onboardingPersonalColor_makeupCheeksLabel" hexes={beauty.makeup.cheeks} />
      <MakeupRow labelKey="onboardingPersonalColor_makeupEyesLabel" hexes={beauty.makeup.eyes} />

      {/* HAIR */}
      <View style={{ height: 16 }} />
      <Text style={styles.sectionLabel}>{t('onboardingPersonalColor_hairLabel')}</Text>
      <View style={{ height: 6 }} />
      <Text style={styles.skipListText}>{t(`personalColor_hair_${beauty.hairKey}`)}</Text>

      {/* GLASSES */}
      <View style={{ height: 14 }} />
      <Text style={styles.sectionLabel}>{t('onboardingPersonalColor_glassesLabel')}</Text>
      <View style={{ height: 6 }} />
      <Text style={styles.skipListText}>{t(`personalColor_glasses_${beauty.glassesKey}`)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: 24 },
  sectionLabel: { ...type.ui, fontSize: 10, color: T.color.tertiary, letterSpacing: 1.5 },
  caption: { ...type.caption, fontSize: 11, color: T.color.tertiary, marginTop: 8 },
  skipListText: { ...type.caption, color: T.color.tertiary },
  swatchRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  wowSwatch: { width: 44, height: 44, borderRadius: 2 },
  paletteSwatchSmall: { width: 28, height: 28, borderRadius: 2 },
  makeupRow: { marginTop: 14 },
  makeupSublabel: { ...type.ui, fontSize: 9, color: T.color.secondary, letterSpacing: 1 },
});
