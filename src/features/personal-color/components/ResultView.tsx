// ResultView — the SHARED personal-colour result screen, rendered by both
// app/(onboarding)/personal-color.tsx and app/personal-color-edit.tsx
// (docs/personal-color-ux-simplify-instruction.md §7). Extracted from the
// two screens' near-identical `ResultStep` JSX so there is exactly one
// implementation of the result UI; callers parameterise only what's
// genuinely different between the two contexts (save/continue button
// labels, the discard/skip link, the save callback).
//
// Section order (top to bottom): hero (tone + leaning + one-liner) → axis
// meters → WEAR THESE (core swatches) → BETTER TO SKIP → collapsible FULL
// PALETTE (neutrals / accents / this season's edit) → collapsible BEYOND THE
// WARDROBE → collapsible ADJUST THE RESULT (detected/answered inputs +
// optional refinements) → drape/grid buttons → save/discard.
//
// Live-recompute behaviour is unchanged: setSkin/setHair/setEye/setMetal are
// the same callbacks the caller's `usePersonalColorDetection` hook already
// exposes — picking a chip here still updates the hook's state, whose
// `result` useMemo recomputes immediately.
import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, LayoutAnimation } from 'react-native';
import { T, type } from '../../../design/tokens';
import { IconChevronRight } from '../../../components/icons';
import { PrimaryButton } from '../../../components/ui';
import { useTranslation } from '../../../i18n';
import { useAuthStore } from '../../../stores/authStore';
import {
  SKIN_OPTIONS, HAIR_OPTIONS, EYE_OPTIONS, METAL_OPTIONS,
  type SkinOption, type EyeOption, type MetalOption, type PersonalColorResult,
} from '../colorSeasonData';
import { weatherSeasonNow, seasonalEdit, TONE12_DESC_KEY, type ToneAxes } from '../tone12';
import { AxisMeters } from './AxisMeters';
import { BeyondTheWardrobeSection } from './BeyondTheWardrobeSection';

type Lang = 'en' | 'vi';
function useLang(): Lang {
  const { i18n } = useTranslation();
  return i18n.language?.toLowerCase().startsWith('vi') ? 'vi' : 'en';
}

// Engine "avoid colour" vocabulary (see tone12.ts TONE12_AVOID) is a fixed
// set of lowercase English colour names — not screen chrome, so not
// duplicated into the i18n json. Translated here, same pattern as
// colorSeasonData.ts's labelEn/labelVi option data.
const AVOID_COLOR_LABEL: Record<string, { en: string; vi: string }> = {
  black:    { en: 'Black',    vi: 'Đen' },
  charcoal: { en: 'Charcoal', vi: 'Than chì' },
  burgundy: { en: 'Burgundy', vi: 'Đỏ burgundy' },
  navy:     { en: 'Navy',     vi: 'Xanh navy' },
  olive:    { en: 'Olive',    vi: 'Xanh ô liu' },
  beige:    { en: 'Beige',    vi: 'Be' },
  brown:    { en: 'Brown',    vi: 'Nâu' },
  orange:   { en: 'Orange',   vi: 'Cam' },
  rust:     { en: 'Rust',     vi: 'Cam gỉ' },
  mustard:  { en: 'Mustard',  vi: 'Vàng mù tạt' },
  camel:    { en: 'Camel',    vi: 'Nâu lạc đà' },
  fuchsia:  { en: 'Fuchsia',  vi: 'Hồng cánh sen' },
  pink:     { en: 'Pink',     vi: 'Hồng' },
  gray:     { en: 'Gray',     vi: 'Xám' },
};
function avoidColorLabel(name: string, lang: Lang): string {
  const entry = AVOID_COLOR_LABEL[name];
  if (entry) return entry[lang];
  return name.charAt(0).toUpperCase() + name.slice(1);
}

const SEASON_LABEL_KEYS: Record<'spring' | 'summer' | 'autumn' | 'winter', string> = {
  spring: 'personalColor_seasonSpring',
  summer: 'personalColor_seasonSummer',
  autumn: 'personalColor_seasonAutumn',
  winter: 'personalColor_seasonWinter',
};

// ─── Collapsible section — hairline top border, label + rotating chevron,
//     slow ease-in-ease-out (same LayoutAnimation idiom as app/help.tsx's
//     FAQ rows). Default collapsed unless `defaultOpen`. ───────────────────
function CollapsibleSection({
  title, defaultOpen = false, children,
}: { title: string; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  const toggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpen(v => !v);
  };
  return (
    <View style={styles.collapsible}>
      <Pressable onPress={toggle} style={styles.collapsibleHeader}>
        <Text style={styles.paletteSectionLabel}>{title}</Text>
        <IconChevronRight
          size={12}
          color={T.color.tertiary}
          strokeWidth={1.4}
          style={{ transform: [{ rotate: open ? '90deg' : '0deg' }] }}
        />
      </Pressable>
      {open && <View style={styles.collapsibleBody}>{children}</View>}
    </View>
  );
}

export interface ResultViewProps {
  result: PersonalColorResult;
  skinUndertone: SkinOption['key'] | null;
  hairKey: string | null;
  eyeKey: EyeOption['key'] | null;
  metalKey: MetalOption['key'] | null;
  autoSkin: boolean;
  autoHair: boolean;
  skinConfident: boolean;
  hairConfident: boolean;
  setSkin: (k: SkinOption['key']) => void;
  setHair: (k: string) => void;
  setEye: (k: EyeOption['key']) => void;
  setMetal: (k: MetalOption['key']) => void;
  drape: Partial<ToneAxes>;
  onStartDrape: () => void;
  onStartDrapeGrid: () => void;
  onResetDrape: () => void;
  saving: boolean;
  saveError: string | null;
  onSave: () => void;
  saveLabel: string;
  savingLabel: string;
  discardLabel: string;
  onDiscard: () => void;
}

export function ResultView({
  result, skinUndertone, hairKey, eyeKey, metalKey,
  autoSkin, autoHair, skinConfident, hairConfident,
  setSkin, setHair, setEye, setMetal,
  drape, onStartDrape, onStartDrapeGrid, onResetDrape,
  saving, saveError, onSave, saveLabel, savingLabel, discardLabel, onDiscard,
}: ResultViewProps) {
  const { t } = useTranslation();
  const lang = useLang();
  const detected = autoSkin || autoHair;
  // Hemisphere lens: the profile's reverse-geocoded country code (null when
  // the user skipped/overrode GPS — weatherSeasonNow then defaults northern).
  const countryCode = useAuthStore(s => s.locationCountryCode);
  const weather = weatherSeasonNow(countryCode ?? undefined);
  const seasonEdit = seasonalEdit(result.palette, weather).edit;
  const hasDrape = Object.values(drape).some(v => typeof v === 'number' && v !== 0);

  return (
    <View>
      {/* ── Hero: tone + leaning + one-liner ────────────────────────────── */}
      <View style={{ height: 40 }} />
      <Text style={styles.seasonLabel}>{result.label[lang].toUpperCase()}</Text>
      {result.secondaryLabel && (
        <Text style={styles.seasonLabel}>
          {t('onboardingPersonalColor_leaningLabel', { tone: result.secondaryLabel[lang].toUpperCase() })}
        </Text>
      )}
      <Text style={styles.h1}>{t('personalColor_resultTitle')}</Text>
      <View style={{ height: 16 }} />
      <Text style={styles.caption}>{t(TONE12_DESC_KEY[result.tone12])}</Text>

      {/* ── Axis meters — the de-black-boxing element ───────────────────── */}
      <View style={{ height: 32 }} />
      <AxisMeters axes={result.axes} />

      {/* ── WEAR THESE — the core swatches, above the fold ──────────────── */}
      <View style={{ height: 32 }} />
      <Text style={styles.paletteSectionLabel}>{t('onboardingPersonalColor_wearTheseLabel')}</Text>
      <View style={{ height: 12 }} />
      <View style={styles.paletteRow}>
        {result.board.core.map(hex => (
          <View key={hex} style={[styles.paletteSwatchSmall, { backgroundColor: hex }]} />
        ))}
      </View>

      {/* ── BETTER TO SKIP — moved up, right after the wear-these list ──── */}
      <View style={{ height: 24 }} />
      <Text style={styles.paletteSectionLabel}>{t('onboardingPersonalColor_betterToSkipLabel')}</Text>
      <View style={{ height: 8 }} />
      <Text style={styles.skipListText}>
        {result.avoidColors.map(c => avoidColorLabel(c, lang)).join(' · ')}
      </Text>

      {/* ── Collapsible: FULL PALETTE (neutrals / accents / season's edit) ── */}
      <CollapsibleSection title={t('onboardingPersonalColor_fullPaletteLabel')}>
        <Text style={styles.paletteSectionLabel}>{t('onboardingPersonalColor_neutralsLabel')}</Text>
        <View style={{ height: 12 }} />
        <View style={styles.paletteRow}>
          {result.board.neutrals.map(hex => (
            <View key={hex} style={[styles.paletteSwatchSmall, { backgroundColor: hex }]} />
          ))}
        </View>
        <Text style={[styles.caption, styles.smallCaption, { marginTop: 8 }]}>
          {t('onboardingPersonalColor_neutralsCaption')}
        </Text>

        <View style={{ height: 20 }} />
        <Text style={styles.paletteSectionLabel}>{t('onboardingPersonalColor_accentsLabel')}</Text>
        <View style={{ height: 12 }} />
        <View style={styles.paletteRow}>
          {result.board.accents.map(hex => (
            <View key={hex} style={[styles.paletteSwatchSmall, { backgroundColor: hex }]} />
          ))}
        </View>
        <Text style={[styles.caption, styles.smallCaption, { marginTop: 8 }]}>
          {t('onboardingPersonalColor_accentsCaption')}
        </Text>

        <View style={{ height: 24 }} />
        <Text style={styles.paletteSectionLabel}>
          {t('onboardingPersonalColor_seasonEditLabel', { season: t(SEASON_LABEL_KEYS[weather]).toUpperCase() })}
        </Text>
        <View style={{ height: 12 }} />
        <View style={styles.paletteRow}>
          {seasonEdit.map(hex => (
            <View key={hex} style={[styles.seasonEditSwatch, { backgroundColor: hex }]} />
          ))}
        </View>
        <Text style={[styles.caption, styles.smallCaption, { marginTop: 8 }]}>
          {t('onboardingPersonalColor_seasonEditCaption')}
        </Text>
      </CollapsibleSection>

      {/* ── Collapsible: BEYOND THE WARDROBE (unchanged inner component) ── */}
      <CollapsibleSection title={t('onboardingPersonalColor_beyondWardrobeLabel')}>
        <BeyondTheWardrobeSection tone12={result.tone12} showLabel={false} />
      </CollapsibleSection>

      {/* ── Collapsible: ADJUST THE RESULT (detected inputs + refinements) ── */}
      <CollapsibleSection title={t('onboardingPersonalColor_adjustResultLabel')}>
        <Text style={styles.paletteSectionLabel}>
          {detected ? t('onboardingPersonalColor_detectedFromScan') : t('onboardingPersonalColor_yourAnswers')}
        </Text>

        <View style={styles.answerRow}>
          <View style={styles.answerRowHeader}>
            <Text style={styles.answerRowLabel}>{t('onboardingPersonalColor_skinUndertoneLabel')}</Text>
            {autoSkin && <Text style={styles.autoTag}>{t('onboardingCommon_autoTag')}</Text>}
          </View>
          <View style={styles.chipRow}>
            {SKIN_OPTIONS.map(opt => (
              <Pressable key={opt.key} onPress={() => setSkin(opt.key)} style={styles.chipCol}>
                <View style={[
                  styles.skinChip, { backgroundColor: opt.swatchHex },
                  skinUndertone === opt.key && styles.swatchSelected,
                ]} />
                <Text style={styles.chipLabel}>{lang === 'vi' ? opt.labelVi : opt.labelEn}</Text>
              </Pressable>
            ))}
          </View>
          {!skinConfident && (
            <Text style={styles.lowConfidenceCaption}>{t('onboardingPersonalColor_lowConfidenceCaption')}</Text>
          )}
        </View>

        <View style={styles.answerRow}>
          <View style={styles.answerRowHeader}>
            <Text style={styles.answerRowLabel}>{t('onboardingPersonalColor_hairColourLabel')}</Text>
            {autoHair && <Text style={styles.autoTag}>{t('onboardingCommon_autoTag')}</Text>}
          </View>
          <View style={styles.chipRow}>
            {HAIR_OPTIONS.map(opt => (
              <Pressable key={opt.key} onPress={() => setHair(opt.key)} style={styles.chipCol}>
                <View style={[
                  styles.hairChip, { backgroundColor: opt.swatchHex },
                  hairKey === opt.key && styles.swatchSelected,
                ]} />
              </Pressable>
            ))}
          </View>
          {!hairConfident && (
            <Text style={styles.lowConfidenceCaption}>{t('onboardingPersonalColor_lowConfidenceCaption')}</Text>
          )}
        </View>

        <View style={styles.refineSection}>
          <Text style={styles.paletteSectionLabel}>{t('onboardingPersonalColor_refineOptionalLabel')}</Text>
          <Text style={styles.refineCaption}>{t('onboardingPersonalColor_refineCaption')}</Text>

          <View style={styles.answerRow}>
            <Text style={styles.answerRowLabel}>{t('onboardingPersonalColor_eyeColourLabel')}</Text>
            <View style={{ height: 10 }} />
            <View style={styles.chipRow}>
              {EYE_OPTIONS.map(opt => (
                <Pressable key={opt.key} onPress={() => setEye(opt.key)} style={styles.chipCol}>
                  <View style={[
                    styles.eyeChip, { backgroundColor: opt.swatchHex },
                    eyeKey === opt.key && styles.swatchSelected,
                  ]} />
                </Pressable>
              ))}
            </View>
          </View>

          <View style={styles.answerRow}>
            <Text style={styles.answerRowLabel}>{t('onboardingPersonalColor_metalLabel')}</Text>
            <View style={{ height: 10 }} />
            <View style={styles.chipRow}>
              {METAL_OPTIONS.map(opt => (
                <Pressable key={opt.key} onPress={() => setMetal(opt.key)} style={styles.chipCol}>
                  <View style={[
                    styles.metalChip, { backgroundColor: opt.swatchHex },
                    metalKey === opt.key && styles.swatchSelected,
                  ]} />
                </Pressable>
              ))}
            </View>
          </View>
        </View>
      </CollapsibleSection>

      {/* ── Drape / grid entry points ────────────────────────────────────── */}
      <View style={{ height: 32 }} />
      <Pressable onPress={onStartDrape} style={styles.secondaryBtn}>
        <Text style={styles.secondaryBtnText}>{t('onboardingPersonalColor_refineWithDrapingButton')}</Text>
      </Pressable>
      <View style={{ height: 10 }} />
      <Pressable onPress={onStartDrapeGrid} style={styles.secondaryBtn}>
        <Text style={styles.secondaryBtnText}>{t('onboardingPersonalColor_seeAll12TonesButton')}</Text>
      </Pressable>
      {result.confidence === 'low' && (
        <>
          <View style={{ height: 10 }} />
          <Text style={[styles.caption, styles.smallCaption, { textAlign: 'center' }]}>
            {t('onboardingPersonalColor_lowConfidenceNudge')}
          </Text>
        </>
      )}
      {hasDrape && (
        <>
          <View style={{ height: 12 }} />
          <Pressable onPress={onResetDrape} style={{ alignItems: 'center' }}>
            <Text style={styles.skipInline}>{t('onboardingPersonalColor_resetDrapingButton')}</Text>
          </Pressable>
        </>
      )}

      {/* ── Save / discard ───────────────────────────────────────────────── */}
      <View style={{ height: 48 }} />
      <PrimaryButton onPress={onSave} disabled={saving}>
        {saving ? savingLabel : saveLabel}
      </PrimaryButton>
      {saveError != null && (
        <>
          <View style={{ height: 10 }} />
          <Pressable onPress={onSave} style={{ alignItems: 'center' }}>
            <Text style={styles.saveErrorCaption}>{t('onboardingPersonalColor_saveErrorCaption')}</Text>
          </Pressable>
        </>
      )}
      <View style={{ height: 16 }} />
      <Pressable onPress={onDiscard} style={{ alignItems: 'center' }}>
        <Text style={styles.skipInline}>{discardLabel}</Text>
      </Pressable>
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  h1:          { ...type.h1, color: T.color.primary },
  caption:     { ...type.bodyL, color: T.color.secondary, lineHeight: 24 },
  smallCaption: { fontSize: 11, color: T.color.tertiary, lineHeight: 18 },
  skipInline:  { ...type.ui, color: T.color.tertiary },

  secondaryBtn: {
    height: 48, borderWidth: 0.5, borderColor: T.color.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  secondaryBtnText: { ...type.ui, color: T.color.primary, letterSpacing: 1.5 },

  seasonLabel: { ...type.ui, fontSize: 10, color: T.color.tertiary, letterSpacing: 2, marginBottom: 8 },
  paletteSectionLabel: { ...type.ui, fontSize: 10, color: T.color.tertiary, letterSpacing: 1.5 },
  paletteRow:  { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  paletteSwatchSmall: { width: 28, height: 28, borderRadius: 2 },
  seasonEditSwatch: { width: 44, height: 44, borderRadius: 2 },
  skipListText: { ...type.caption, color: T.color.tertiary },
  saveErrorCaption: { ...type.caption, fontSize: 11, color: T.color.tertiary, textAlign: 'center' },

  // Collapsible sections
  collapsible: { marginTop: 8, borderTopWidth: 0.5, borderTopColor: T.color.hairline },
  collapsibleHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 18,
  },
  collapsibleBody: { paddingBottom: 8 },

  // Detected / answered inputs — editable, result recomputes live
  answerRow:     { marginTop: 20 },
  answerRowHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  answerRowLabel:  { ...type.ui, fontSize: 11, color: T.color.secondary, letterSpacing: 1 },
  autoTag: {
    ...type.ui, fontSize: 9, color: T.color.primary, letterSpacing: 1,
    borderWidth: 0.5, borderColor: T.color.primary, paddingHorizontal: 6, paddingVertical: 2,
  },
  lowConfidenceCaption: { ...type.caption, fontSize: 11, color: T.color.tertiary, marginTop: 8 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  chipCol: { alignItems: 'center' },
  skinChip:  { width: 32, height: 32, borderRadius: 4 },
  hairChip:  { width: 28, height: 28, borderRadius: 4 },
  eyeChip:   { width: 32, height: 32, borderRadius: 999 },
  metalChip: { width: 32, height: 32, borderRadius: 4 },
  chipLabel: { ...type.ui, fontSize: 9, color: T.color.secondary, textAlign: 'center', marginTop: 4, maxWidth: 48 },
  swatchSelected: { borderWidth: 1.5, borderColor: T.color.primary },

  refineSection: { marginTop: 32 },
  refineCaption: { ...type.caption, fontSize: 11, color: T.color.tertiary, marginTop: 4, marginBottom: 16 },
});
