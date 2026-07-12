import React, { useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable,
  useWindowDimensions, Image, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { T, type } from '../../src/design/tokens';
import { PrimaryButton } from '../../src/components/ui';
import { IconChevronLeft } from '../../src/components/icons';
import { usePersonalColorDetection } from '../../src/features/personal-color/usePersonalColorDetection';
import {
  SKIN_OPTIONS, HAIR_OPTIONS, EYE_OPTIONS, METAL_OPTIONS,
  SEASON_DESC, type SkinOption, type EyeOption, type MetalOption,
} from '../../src/features/personal-color/colorSeasonData';
import { weatherSeasonNow, seasonalEdit, type ToneAxes } from '../../src/features/personal-color/tone12';
import { DrapeSession } from '../../src/features/personal-color/components/DrapeSession';
import { useAuthStore } from '../../src/stores/authStore';
import { useTranslation } from '../../src/i18n';

const PAD = 24;

// Question steps that show dots — manual path only
const QUESTION_STEPS = ['skin', 'hair', 'eye', 'metal'] as const;

// Engine "avoid colour" vocabulary (see tone12.ts TONE12_AVOID) is a fixed set
// of lowercase English colour names — not screen chrome, so not duplicated
// into the i18n json. Translated here, same pattern as colorSeasonData.ts's
// labelEn/labelVi option data.
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

const SEASON_LABEL_KEYS: Record<'spring' | 'summer' | 'autumn' | 'winter', string> = {
  spring: 'personalColor_seasonSpring',
  summer: 'personalColor_seasonSummer',
  autumn: 'personalColor_seasonAutumn',
  winter: 'personalColor_seasonWinter',
};

type Lang = 'en' | 'vi';
function useLang(): Lang {
  const { i18n } = useTranslation();
  return i18n.language?.toLowerCase().startsWith('vi') ? 'vi' : 'en';
}
function avoidColorLabel(name: string, lang: Lang): string {
  const entry = AVOID_COLOR_LABEL[name];
  if (entry) return entry[lang];
  return name.charAt(0).toUpperCase() + name.slice(1);
}

export default function PersonalColorScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { width: W } = useWindowDimensions();
  const {
    path, step,
    wristPhotoUri, hairPhotoUri,
    skinUndertone, hairKey, eyeKey, metalKey, result,
    saving, analyzing, autoSkin, autoHair, skinConfident, hairConfident,
    drape, applyDrape, resetDrape,
    startCameraPath, startManualPath,
    setCameraPhoto,
    setSkin, setHair, setEye, setMetal,
    next, back, canAdvance, save,
    stepIndex,
  } = usePersonalColorDetection();

  const [permission, requestPermission] = useCameraPermissions();
  const [draping, setDraping] = useState(false);

  const handleSaveAndContinue = async () => {
    const ok = await save();
    if (ok) router.back();
  };

  const handleSkip = () => router.back();

  const handleCameraStart = async () => {
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) return;
    }
    startCameraPath();
  };

  const showDots = path === 'manual' && step !== 'intro' && step !== 'result';

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Top bar */}
      <View style={styles.topBar}>
        <Pressable
          onPress={step === 'intro' ? () => router.back() : back}
          style={styles.backBtn}
        >
          <IconChevronLeft size={20} color={T.color.primary} strokeWidth={1.2} />
        </Pressable>
        {step !== 'result' && (
          <Pressable onPress={handleSkip} style={styles.skipBtn}>
            <Text style={styles.skipText}>{t('common_skip')}</Text>
          </Pressable>
        )}
      </View>

      {/* Step dots — only for skin/hair/eye/metal */}
      {showDots && (
        <View style={styles.dotsRow}>
          {QUESTION_STEPS.map((s, i) => (
            <View
              key={s}
              style={[styles.dot, i === stepIndex && styles.dotActive]}
            />
          ))}
        </View>
      )}

      {/* Camera steps get their own full-height views outside the scroll */}
      {step === 'wrist-scan' && (
        <WristScanStep onCapture={(uri, ambientUri) => setCameraPhoto('wrist', uri, ambientUri)} />
      )}
      {step === 'hair-scan' && (
        <HairScanStep onCapture={uri => setCameraPhoto('hair', uri)} analyzing={analyzing} />
      )}
      {draping && (
        <DrapeSession onDone={() => setDraping(false)} applyDrape={applyDrape} />
      )}

      {!draping && step !== 'wrist-scan' && step !== 'hair-scan' && (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
          showsVerticalScrollIndicator={false}
        >
          {step === 'intro' && (
            <IntroStep
              width={W}
              onCamera={handleCameraStart}
              onManual={startManualPath}
              onSkip={handleSkip}
              cameraAvailable={permission == null || !!permission.canAskAgain || !!permission.granted}
            />
          )}
          {step === 'skin'  && (
            <SkinStep
              selected={skinUndertone}
              onSelect={setSkin}
              photoUri={path === 'camera' ? wristPhotoUri : null}
            />
          )}
          {step === 'hair'  && (
            <HairStep
              selected={hairKey}
              onSelect={setHair}
              width={W}
              photoUri={path === 'camera' ? hairPhotoUri : null}
            />
          )}
          {step === 'eye'   && <EyeStep selected={eyeKey} onSelect={setEye} />}
          {step === 'metal' && <MetalStep selected={metalKey} onSelect={setMetal} />}
          {step === 'result' && result && (
            <ResultStep
              result={result}
              saving={saving}
              onSave={handleSaveAndContinue}
              onSkip={handleSkip}
              skinUndertone={skinUndertone}
              hairKey={hairKey}
              eyeKey={eyeKey}
              metalKey={metalKey}
              autoSkin={autoSkin}
              autoHair={autoHair}
              skinConfident={skinConfident}
              hairConfident={hairConfident}
              setSkin={setSkin}
              setHair={setHair}
              setEye={setEye}
              setMetal={setMetal}
              drape={drape}
              onStartDrape={() => setDraping(true)}
              onResetDrape={resetDrape}
            />
          )}

          {step !== 'intro' && step !== 'result' && (
            <View style={styles.ctaRow}>
              <PrimaryButton onPress={next} disabled={!canAdvance()}>{t('onboardingPersonalColor_nextButton')}</PrimaryButton>
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

// ─── Intro ─────────────────────────────────────────────────────────────────

function IntroStep({
  onCamera, onManual, onSkip, cameraAvailable,
}: {
  width: number;
  onCamera: () => void;
  onManual: () => void;
  onSkip: () => void;
  cameraAvailable: boolean;
}) {
  const { t } = useTranslation();
  return (
    <View style={{ flex: 1 }}>
      <View style={{ height: 32 }} />
      <Text style={styles.h1}>{t('onboardingPersonalColor_introTitle')}</Text>
      <View style={{ height: 20 }} />
      <Text style={styles.caption}>
        {t('onboardingPersonalColor_introCaption')}
      </Text>
      <View style={{ height: 12 }} />
      <Text style={[styles.caption, { color: T.color.tertiary }]}>
        {t('onboardingPersonalColor_introCaption2')}
      </Text>
      <View style={{ height: 48 }} />

      {cameraAvailable && (
        <>
          <PrimaryButton onPress={onCamera}>{t('personalColor_scanButton')}</PrimaryButton>
          <View style={{ height: 10 }} />
          <Text style={[styles.caption, { color: T.color.tertiary, fontSize: 11, textAlign: 'center' }]}>
            {t('onboardingPersonalColor_scanPrivacyNote')}
          </Text>
          <View style={{ height: 24 }} />
          <View style={styles.orRow}>
            <View style={styles.orLine} />
            <Text style={styles.orText}>{t('onboarding_account_or')}</Text>
            <View style={styles.orLine} />
          </View>
          <View style={{ height: 24 }} />
          <Pressable onPress={onManual} style={styles.secondaryBtn}>
            <Text style={styles.secondaryBtnText}>{t('personalColor_manualButton')}</Text>
          </Pressable>
        </>
      )}
      {!cameraAvailable && (
        <PrimaryButton onPress={onManual}>{t('measurementsScan_start')}</PrimaryButton>
      )}

      <View style={{ height: 24 }} />
      <Pressable onPress={onSkip} style={{ alignItems: 'center' }}>
        <Text style={styles.skipInline}>{t('onboardingCommon_skipForNow')}</Text>
      </Pressable>
    </View>
  );
}

// ─── Wrist Scan ─────────────────────────────────────────────────────────────

function WristScanStep({ onCapture }: { onCapture: (uri: string, ambientUri?: string) => void }) {
  const { t } = useTranslation();
  const cameraRef = useRef<CameraView>(null);
  const insets = useSafeAreaInsets();
  const [torch, setTorch] = useState(true);
  const busyRef = useRef(false);

  // Dual-flash ambient-light cancellation: capture once with the torch on,
  // then again immediately after with it off, so the hook can reconcile the
  // two reads and cancel out the room's own lighting. Guarded against
  // double-taps since the sequence takes ~350ms+ and isn't reentrant.
  const handleCapture = async () => {
    if (!cameraRef.current || busyRef.current) return;
    busyRef.current = true;
    try {
      const flash = await cameraRef.current.takePictureAsync({ quality: 0.7, base64: false });
      setTorch(false);
      await new Promise(r => setTimeout(r, 350));
      const ambient = await cameraRef.current.takePictureAsync({ quality: 0.7, base64: false });
      if (flash?.uri) onCapture(flash.uri, ambient?.uri);
    } finally {
      busyRef.current = false;
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        facing="back"
        enableTorch={torch}
      />
      {/* Instruction overlay */}
      <View style={[styles.scanOverlay, { paddingBottom: insets.bottom + 32 }]}>
        <View style={styles.scanFrame} />
        <View style={{ height: 24 }} />
        <Text style={styles.scanTitle}>{t('onboardingPersonalColor_wristScanTitle')}</Text>
        <Text style={styles.scanCaption}>{t('onboardingPersonalColor_wristScanCaption')}</Text>
        <View style={{ height: 32 }} />
        <Pressable onPress={handleCapture} style={styles.captureBtn}>
          <View style={styles.captureBtnInner} />
        </Pressable>
      </View>
    </View>
  );
}

// ─── Hair Scan ──────────────────────────────────────────────────────────────

function HairScanStep({ onCapture, analyzing }: { onCapture: (uri: string) => void; analyzing: boolean }) {
  const { t } = useTranslation();
  const cameraRef = useRef<CameraView>(null);
  const insets = useSafeAreaInsets();

  const handleCapture = async () => {
    if (!cameraRef.current) return;
    const photo = await cameraRef.current.takePictureAsync({ quality: 0.7, base64: false });
    if (photo?.uri) onCapture(photo.uri);
  };

  return (
    <View style={{ flex: 1 }}>
      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        facing="back"
        enableTorch
      />
      <View style={[styles.scanOverlay, { paddingBottom: insets.bottom + 32 }]}>
        <View style={styles.scanFrame} />
        <View style={{ height: 24 }} />
        <Text style={styles.scanTitle}>{t('onboardingPersonalColor_hairScanTitle')}</Text>
        <Text style={styles.scanCaption}>{t('onboardingPersonalColor_hairScanCaption')}</Text>
        {analyzing && (
          <>
            <View style={{ height: 16 }} />
            <ActivityIndicator color="#FFF" />
            <Text style={[styles.scanCaption, { marginTop: 8 }]}>{t('onboardingPersonalColor_hairScanAnalyzing')}</Text>
          </>
        )}
        <View style={{ height: 32 }} />
        <Pressable onPress={handleCapture} style={styles.captureBtn} disabled={analyzing}>
          <View style={styles.captureBtnInner} />
        </Pressable>
      </View>
    </View>
  );
}

// ─── Skin ──────────────────────────────────────────────────────────────────

function SkinStep({
  selected, onSelect, photoUri,
}: {
  selected: string | null;
  onSelect: (k: 'warm' | 'cool' | 'neutral') => void;
  photoUri?: string | null;
}) {
  const { t } = useTranslation();
  const lang = useLang();
  return (
    <View>
      <View style={{ height: 32 }} />
      <Text style={styles.h1}>{t('onboardingPersonalColor_skinTitle')}</Text>
      <View style={{ height: 8 }} />
      <Text style={styles.caption}>{t('onboardingPersonalColor_skinCaption')}</Text>

      {photoUri && (
        <>
          <View style={{ height: 20 }} />
          <Image
            source={{ uri: photoUri }}
            style={styles.photoThumb}
            resizeMode="cover"
          />
          <Text style={[styles.caption, { fontSize: 11, color: T.color.tertiary, marginTop: 6 }]}>
            {t('onboardingPersonalColor_wristPhotoCaption')}
          </Text>
        </>
      )}

      <View style={{ height: 32 }} />
      {SKIN_OPTIONS.map(opt => (
        <Pressable
          key={opt.key}
          onPress={() => onSelect(opt.key)}
          style={[styles.optionRow, selected === opt.key && styles.optionRowSelected]}
        >
          <View style={[styles.swatchLarge, { backgroundColor: opt.swatchHex }]} />
          <View style={styles.optionText}>
            <Text style={styles.optionLabel}>{(lang === 'vi' ? opt.labelVi : opt.labelEn).toUpperCase()}</Text>
            <Text style={styles.optionDesc}>{lang === 'vi' ? opt.descVi : opt.descEn}</Text>
          </View>
          {selected === opt.key && <View style={styles.checkDot} />}
        </Pressable>
      ))}
    </View>
  );
}

// ─── Hair ──────────────────────────────────────────────────────────────────

function HairStep({
  selected, onSelect, width, photoUri,
}: {
  selected: string | null;
  onSelect: (k: string) => void;
  width: number;
  photoUri?: string | null;
}) {
  const { t } = useTranslation();
  const lang = useLang();
  const swatchSize = (width - PAD * 2 - 12 * 3) / 4;
  return (
    <View>
      <View style={{ height: 32 }} />
      <Text style={styles.h1}>{t('onboardingPersonalColor_hairTitle')}</Text>
      <View style={{ height: 8 }} />
      <Text style={styles.caption}>{t('onboardingPersonalColor_hairCaption')}</Text>

      {photoUri && (
        <>
          <View style={{ height: 20 }} />
          <Image
            source={{ uri: photoUri }}
            style={styles.photoThumb}
            resizeMode="cover"
          />
          <Text style={[styles.caption, { fontSize: 11, color: T.color.tertiary, marginTop: 6 }]}>
            {t('onboardingPersonalColor_hairPhotoCaption')}
          </Text>
        </>
      )}

      <View style={{ height: 32 }} />
      <View style={styles.swatchGrid}>
        {HAIR_OPTIONS.map(opt => (
          <Pressable key={opt.key} onPress={() => onSelect(opt.key)} style={{ alignItems: 'center' }}>
            <View
              style={[
                styles.hairSwatch,
                { width: swatchSize, height: swatchSize, backgroundColor: opt.swatchHex },
                selected === opt.key && styles.swatchSelected,
              ]}
            />
            <Text style={[styles.swatchLabel, { width: swatchSize }]} numberOfLines={2}>
              {lang === 'vi' ? opt.labelVi : opt.labelEn}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

// ─── Eye ───────────────────────────────────────────────────────────────────

function EyeStep({ selected, onSelect }: { selected: string | null; onSelect: (k: 'blue_grey' | 'green_hazel_cool' | 'brown_hazel_warm' | 'dark_brown_black') => void }) {
  const { t } = useTranslation();
  const lang = useLang();
  return (
    <View>
      <View style={{ height: 32 }} />
      <Text style={styles.h1}>{t('onboardingPersonalColor_eyeTitle')}</Text>
      <View style={{ height: 40 }} />
      {EYE_OPTIONS.map(opt => (
        <Pressable
          key={opt.key}
          onPress={() => onSelect(opt.key as Parameters<typeof onSelect>[0])}
          style={[styles.optionRow, selected === opt.key && styles.optionRowSelected]}
        >
          <View style={[styles.swatchLarge, { backgroundColor: opt.swatchHex, borderRadius: 999 }]} />
          <Text style={[styles.optionLabel, { flex: 1 }]}>{(lang === 'vi' ? opt.labelVi : opt.labelEn).toUpperCase()}</Text>
          {selected === opt.key && <View style={styles.checkDot} />}
        </Pressable>
      ))}
    </View>
  );
}

// ─── Metal ─────────────────────────────────────────────────────────────────

function MetalStep({ selected, onSelect }: { selected: string | null; onSelect: (k: 'gold' | 'silver' | 'both') => void }) {
  const { t } = useTranslation();
  const lang = useLang();
  return (
    <View>
      <View style={{ height: 32 }} />
      <Text style={styles.h1}>{t('onboardingPersonalColor_metalTitle')}</Text>
      <View style={{ height: 8 }} />
      <Text style={styles.caption}>{t('onboardingPersonalColor_metalCaption')}</Text>
      <View style={{ height: 40 }} />
      {METAL_OPTIONS.map(opt => (
        <Pressable
          key={opt.key}
          onPress={() => onSelect(opt.key as Parameters<typeof onSelect>[0])}
          style={[styles.optionRow, selected === opt.key && styles.optionRowSelected]}
        >
          <View style={[styles.swatchLarge, { backgroundColor: opt.swatchHex }]} />
          <Text style={[styles.optionLabel, { flex: 1 }]}>{(lang === 'vi' ? opt.labelVi : opt.labelEn).toUpperCase()}</Text>
          {selected === opt.key && <View style={styles.checkDot} />}
        </Pressable>
      ))}
    </View>
  );
}

// ─── Result ────────────────────────────────────────────────────────────────

function ResultStep({
  result, saving, onSave, onSkip,
  skinUndertone, hairKey, eyeKey, metalKey,
  autoSkin, autoHair, skinConfident, hairConfident,
  setSkin, setHair, setEye, setMetal,
  drape, onStartDrape, onResetDrape,
}: {
  result: NonNullable<ReturnType<typeof usePersonalColorDetection>['result']>;
  saving: boolean;
  onSave: () => void;
  onSkip: () => void;
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
  onResetDrape: () => void;
}) {
  const { t } = useTranslation();
  const lang = useLang();
  const desc = SEASON_DESC[result.season];
  const detected = autoSkin || autoHair;
  // Hemisphere lens: the profile's reverse-geocoded country code (null when
  // the user skipped/overrode GPS — weatherSeasonNow then defaults northern).
  const countryCode = useAuthStore(s => s.locationCountryCode);
  const weather = weatherSeasonNow(countryCode ?? undefined);
  const seasonEdit = seasonalEdit(result.palette, weather).edit;
  const hasDrape = Object.values(drape).some(v => typeof v === 'number' && v !== 0);
  return (
    <View>
      <View style={{ height: 40 }} />
      <Text style={styles.seasonLabel}>{result.label[lang].toUpperCase()}</Text>
      <Text style={styles.h1}>{t('personalColor_resultTitle')}</Text>
      <View style={{ height: 16 }} />
      <Text style={styles.caption}>{desc[lang]}</Text>

      <View style={{ height: 32 }} />
      <Text style={styles.paletteSectionLabel}>{t('onboardingPersonalColor_neutralsLabel')}</Text>
      <View style={{ height: 12 }} />
      <View style={styles.paletteRow}>
        {result.board.neutrals.map(hex => (
          <View key={hex} style={[styles.paletteSwatchSmall, { backgroundColor: hex }]} />
        ))}
      </View>

      <View style={{ height: 20 }} />
      <Text style={styles.paletteSectionLabel}>{t('onboardingPersonalColor_coreLabel')}</Text>
      <View style={{ height: 12 }} />
      <View style={styles.paletteRow}>
        {result.board.core.map(hex => (
          <View key={hex} style={[styles.paletteSwatchSmall, { backgroundColor: hex }]} />
        ))}
      </View>

      <View style={{ height: 20 }} />
      <Text style={styles.paletteSectionLabel}>{t('onboardingPersonalColor_accentsLabel')}</Text>
      <View style={{ height: 12 }} />
      <View style={styles.paletteRow}>
        {result.board.accents.map(hex => (
          <View key={hex} style={[styles.paletteSwatchSmall, { backgroundColor: hex }]} />
        ))}
      </View>

      <View style={{ height: 28 }} />
      <Text style={styles.paletteSectionLabel}>
        {t('onboardingPersonalColor_seasonEditLabel', { season: t(SEASON_LABEL_KEYS[weather]).toUpperCase() })}
      </Text>
      <View style={{ height: 12 }} />
      <View style={styles.paletteRow}>
        {seasonEdit.map(hex => (
          <View key={hex} style={[styles.seasonEditSwatch, { backgroundColor: hex }]} />
        ))}
      </View>
      <Text style={[styles.caption, { fontSize: 11, color: T.color.tertiary, marginTop: 8 }]}>
        {t('onboardingPersonalColor_seasonEditCaption')}
      </Text>

      <View style={{ height: 24 }} />
      <Text style={styles.paletteSectionLabel}>{t('onboardingPersonalColor_betterToSkipLabel')}</Text>
      <View style={{ height: 8 }} />
      <Text style={styles.skipListText}>
        {result.avoidColors.map(c => avoidColorLabel(c, lang)).join(' · ')}
      </Text>

      {/* Detected / answered inputs — editable, result recomputes live */}
      <View style={styles.answerSection}>
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
      </View>

      {/* Optional refinements */}
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

      <View style={{ height: 32 }} />
      <Pressable onPress={onStartDrape} style={styles.secondaryBtn}>
        <Text style={styles.secondaryBtnText}>{t('onboardingPersonalColor_refineWithDrapingButton')}</Text>
      </Pressable>
      {hasDrape && (
        <>
          <View style={{ height: 12 }} />
          <Pressable onPress={onResetDrape} style={{ alignItems: 'center' }}>
            <Text style={styles.skipInline}>{t('onboardingPersonalColor_resetDrapingButton')}</Text>
          </Pressable>
        </>
      )}

      <View style={{ height: 48 }} />
      <PrimaryButton onPress={onSave} disabled={saving}>
        {saving ? t('addItem_savingText') : t('onboardingPersonalColor_saveToProfileButton')}
      </PrimaryButton>
      <View style={{ height: 16 }} />
      <Pressable onPress={onSkip} style={{ alignItems: 'center' }}>
        <Text style={styles.skipInline}>{t('onboardingPersonalColor_continueWithoutSavingLink')}</Text>
      </Pressable>
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: T.color.canvas },
  topBar:      { height: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 },
  backBtn:     { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  skipBtn:     { paddingHorizontal: 12, height: 44, alignItems: 'center', justifyContent: 'center' },
  skipText:    { ...type.ui, color: T.color.tertiary },
  dotsRow:     { flexDirection: 'row', gap: 6, paddingHorizontal: PAD, marginBottom: 4 },
  dot:         { width: 18, height: 2, backgroundColor: T.color.hairline },
  dotActive:   { backgroundColor: T.color.primary },
  scroll:      { flex: 1 },
  content:     { paddingHorizontal: PAD },

  h1:          { ...type.h1, color: T.color.primary },
  caption:     { ...type.bodyL, color: T.color.secondary, lineHeight: 24 },
  ctaRow:      { marginTop: 40 },
  skipInline:  { ...type.ui, color: T.color.tertiary },

  // Intro path selection
  orRow:       { flexDirection: 'row', alignItems: 'center', gap: 12 },
  orLine:      { flex: 1, height: 0.5, backgroundColor: T.color.hairline },
  orText:      { ...type.ui, color: T.color.tertiary, fontSize: 10, letterSpacing: 1.5 },
  secondaryBtn: {
    height: 48, borderWidth: 0.5, borderColor: T.color.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  secondaryBtnText: { ...type.ui, color: T.color.primary, letterSpacing: 1.5 },

  // Camera scan
  scanOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingHorizontal: PAD,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  scanFrame: {
    width: 160, height: 100, borderWidth: 1, borderColor: 'rgba(255,255,255,0.7)',
    borderRadius: 8, position: 'absolute', top: '30%',
  },
  scanTitle:   { ...type.ui, color: '#FFF', letterSpacing: 2, fontSize: 13 },
  scanCaption: { ...type.caption, color: 'rgba(255,255,255,0.75)', textAlign: 'center', marginTop: 8, lineHeight: 18 },
  captureBtn: {
    width: 72, height: 72, borderRadius: 36,
    borderWidth: 2, borderColor: '#FFF',
    alignItems: 'center', justifyContent: 'center',
  },
  captureBtnInner: { width: 58, height: 58, borderRadius: 29, backgroundColor: '#FFF' },

  // Photo thumbnail
  photoThumb: { width: '100%', height: 140, borderRadius: 4 },

  // Answer steps
  optionRow: {
    flexDirection: 'row', alignItems: 'center', gap: 16,
    paddingVertical: 16, borderBottomWidth: 0.5, borderBottomColor: T.color.hairline,
  },
  optionRowSelected: { borderBottomColor: T.color.primary },
  swatchLarge: { width: 48, height: 48, borderRadius: 4, flexShrink: 0 },
  optionText:  { flex: 1 },
  optionLabel: { ...type.ui, color: T.color.primary, letterSpacing: 0.8 },
  optionDesc:  { ...type.caption, color: T.color.secondary, marginTop: 4 },
  checkDot:    { width: 8, height: 8, borderRadius: 4, backgroundColor: T.color.primary, flexShrink: 0 },

  swatchGrid:  { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  hairSwatch:  { borderRadius: 4 },
  swatchSelected: { borderWidth: 1.5, borderColor: T.color.primary },
  swatchLabel: { ...type.ui, fontSize: 10, color: T.color.secondary, textAlign: 'center', marginTop: 6, lineHeight: 14 },

  seasonLabel: { ...type.ui, fontSize: 10, color: T.color.tertiary, letterSpacing: 2, marginBottom: 8 },
  paletteSectionLabel: { ...type.ui, fontSize: 10, color: T.color.tertiary, letterSpacing: 1.5 },
  paletteRow:  { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  paletteSwatch: { width: 36, height: 36, borderRadius: 2 },
  paletteSwatchSmall: { width: 28, height: 28, borderRadius: 2 },
  seasonEditSwatch: { width: 44, height: 44, borderRadius: 2 },
  skipListText: { ...type.caption, color: T.color.tertiary },

  // Result — editable answers / refine sections
  answerSection: { marginTop: 40 },
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

  refineSection: { marginTop: 32 },
  refineCaption: { ...type.caption, fontSize: 11, color: T.color.tertiary, marginTop: 4, marginBottom: 16 },
});
