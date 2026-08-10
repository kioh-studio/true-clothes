import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable,
  Image, useWindowDimensions, Alert, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Brightness from 'expo-brightness';
import { T, type } from '../src/design/tokens';
import { PrimaryButton } from '../src/components/ui';
import { IconChevronLeft, IconCheck } from '../src/components/icons';
import { usePersonalColorDetection } from '../src/features/personal-color/usePersonalColorDetection';
import {
  SKIN_OPTIONS, HAIR_OPTIONS, EYE_OPTIONS, METAL_OPTIONS, SEASON_DESC,
} from '../src/features/personal-color/colorSeasonData';
import { DrapeSession } from '../src/features/personal-color/components/DrapeSession';
import { ResultView } from '../src/features/personal-color/components/ResultView';
import { useAuthStore } from '../src/stores/authStore';
import { useTranslation } from '../src/i18n';

const PAD = 24;
const QUESTION_STEPS = ['skin', 'hair', 'eye', 'metal'] as const;

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

export default function PersonalColorEditScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const lang = useLang();
  const { width: W } = useWindowDimensions();
  const existingSeason = useAuthStore(s => s.colorSeason);
  const {
    path, step,
    facePhotoUri, wristPhotoUri,
    skinUndertone, hairKey, eyeKey, metalKey, result,
    saving, error, analyzing, autoSkin, autoHair, skinConfident, hairConfident,
    drape, applyDrape, resetDrape, applyDrapeMetal, nudgeDrapeToward,
    startCameraPath, startManualPath,
    setCameraPhoto,
    setSkin, setHair, setEye, setMetal,
    next, back, canAdvance, save,
    stepIndex,
  } = usePersonalColorDetection();
  const [permission, requestPermission] = useCameraPermissions();
  const [draping, setDraping] = useState(false);
  const [drapeStartAtGrid, setDrapeStartAtGrid] = useState(false);

  const handleSave = async () => {
    const ok = await save();
    if (ok) router.back();
  };

  const handleCameraStart = async () => {
    if (!permission?.granted) {
      const res = await requestPermission();
      if (!res.granted) {
        // Only start the manual path once the user actually confirms via the
        // "Answer manually" button — it must NOT fire unconditionally before
        // the alert is even answered (that raced ahead of the user's choice
        // and doubled up with the button's own onPress).
        Alert.alert(
          t('measurementsScan_permissionTitle'),
          t('personalColorEdit_cameraPermissionMessage'),
          [
            { text: t('personalColorEdit_answerManuallyButton'), onPress: startManualPath },
            { text: t('common_ok'), style: 'cancel' },
          ],
        );
        return;
      }
    }
    startCameraPath();
  };

  const showDots = path === 'manual' && step !== 'intro' && step !== 'result';

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Top bar */}
      <View style={styles.topBar}>
        <Pressable onPress={step === 'intro' ? () => router.back() : back} style={styles.backBtn}>
          <IconChevronLeft size={20} color={T.color.primary} strokeWidth={1.2} />
        </Pressable>
        <Text style={styles.topTitle}>{t('personalColorEdit_headerTitle')}</Text>
        <View style={{ width: 44 }} />
      </View>

      {showDots && (
        <View style={styles.dotsRow}>
          {QUESTION_STEPS.map((s, i) => (
            <View key={s} style={[styles.dot, i === stepIndex && styles.dotActive]} />
          ))}
        </View>
      )}

      {/* Camera steps */}
      {step === 'face-scan' && (
        <FaceScanStep onCapture={(uri, ambientUri) => setCameraPhoto('face', uri, ambientUri)} />
      )}
      {step === 'wrist-scan' && (
        <WristScanStep onCapture={(uri, ambientUri) => setCameraPhoto('wrist', uri, ambientUri)} analyzing={analyzing} />
      )}
      {draping && result && (
        <DrapeSession
          onDone={() => { setDraping(false); setDrapeStartAtGrid(false); }}
          applyDrape={applyDrape}
          onMetal={applyDrapeMetal}
          currentTone={result.tone12}
          onNudgeToward={nudgeDrapeToward}
          startAtGrid={drapeStartAtGrid}
        />
      )}

      {!draping && step !== 'face-scan' && step !== 'wrist-scan' && (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
          showsVerticalScrollIndicator={false}
        >
          {/* Current season badge — intro only */}
          {step === 'intro' && existingSeason && (
            <View style={styles.currentBadge}>
              <Text style={styles.currentLabel}>{t('personalColorEdit_currentLabel')}</Text>
              <Text style={styles.currentSeason}>{t(SEASON_LABEL_KEYS[existingSeason]).toUpperCase()}</Text>
              <Text style={[styles.caption, { marginTop: 6 }]}>{SEASON_DESC[existingSeason][lang]}</Text>
            </View>
          )}

          {step === 'intro' && (
            <View>
              <View style={{ height: 32 }} />
              <Text style={styles.h1}>{t('personalColorEdit_title')}</Text>
              <View style={{ height: 12 }} />
              <Text style={styles.caption}>
                {t('personalColorEdit_caption')}
              </Text>
              <View style={{ height: 48 }} />

              {(permission == null || !!permission.canAskAgain || !!permission.granted) ? (
                <>
                  <PrimaryButton onPress={handleCameraStart}>{t('personalColor_scanButton')}</PrimaryButton>
                  <View style={{ height: 10 }} />
                  <Text style={[styles.caption, { fontSize: 11, color: T.color.tertiary, textAlign: 'center' }]}>
                    {t('onboardingPersonalColor_scanPrivacyNote')}
                  </Text>
                  <View style={{ height: 24 }} />
                  <View style={styles.orRow}>
                    <View style={styles.orLine} />
                    <Text style={styles.orText}>{t('onboarding_account_or')}</Text>
                    <View style={styles.orLine} />
                  </View>
                  <View style={{ height: 24 }} />
                  <Pressable onPress={startManualPath} style={styles.secondaryBtn}>
                    <Text style={styles.secondaryBtnText}>{t('personalColor_manualButton')}</Text>
                  </Pressable>
                </>
              ) : (
                <PrimaryButton onPress={startManualPath}>{t('personalColorEdit_startQuizButton')}</PrimaryButton>
              )}
            </View>
          )}

          {step === 'prepare' && <PrepareStep onReady={next} />}

          {step === 'skin' && (
            <SkinStep
              selected={skinUndertone}
              onSelect={setSkin}
              photoUri={path === 'camera' ? facePhotoUri : null}
              auto={autoSkin}
              analyzing={analyzing}
              isFallback={path === 'camera'}
            />
          )}

          {step === 'hair' && (
            <HairStep
              selected={hairKey}
              onSelect={setHair}
              width={W}
              photoUri={path === 'camera' ? facePhotoUri : null}
              auto={autoHair}
              analyzing={analyzing}
              isFallback={path === 'camera'}
            />
          )}

          {step === 'eye' && (
            <View>
              <View style={{ height: 32 }} />
              <Text style={styles.h1}>{t('onboardingPersonalColor_eyeTitle')}</Text>
              <View style={{ height: 40 }} />
              {EYE_OPTIONS.map(opt => (
                <Pressable
                  key={opt.key}
                  onPress={() => setEye(opt.key)}
                  style={[styles.optionRow, eyeKey === opt.key && styles.optionRowSelected]}
                >
                  <View style={[styles.swatchLarge, { backgroundColor: opt.swatchHex, borderRadius: 999 }]} />
                  <Text style={[styles.optionLabel, { flex: 1 }]}>{(lang === 'vi' ? opt.labelVi : opt.labelEn).toUpperCase()}</Text>
                  {eyeKey === opt.key && <View style={styles.checkDot} />}
                </Pressable>
              ))}
            </View>
          )}

          {step === 'metal' && (
            <View>
              <View style={{ height: 32 }} />
              <Text style={styles.h1}>{t('onboardingPersonalColor_metalTitle')}</Text>
              <View style={{ height: 8 }} />
              <Text style={styles.caption}>{t('onboardingPersonalColor_metalCaption')}</Text>
              <View style={{ height: 40 }} />
              {METAL_OPTIONS.map(opt => (
                <Pressable
                  key={opt.key}
                  onPress={() => setMetal(opt.key as 'gold' | 'silver' | 'both')}
                  style={[styles.optionRow, metalKey === opt.key && styles.optionRowSelected]}
                >
                  <View style={[styles.swatchLarge, { backgroundColor: opt.swatchHex }]} />
                  <Text style={[styles.optionLabel, { flex: 1 }]}>{(lang === 'vi' ? opt.labelVi : opt.labelEn).toUpperCase()}</Text>
                  {metalKey === opt.key && <View style={styles.checkDot} />}
                </Pressable>
              ))}
            </View>
          )}

          {step === 'result' && result && (
            <ResultView
              result={result}
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
              onStartDrapeGrid={() => { setDrapeStartAtGrid(true); setDraping(true); }}
              onResetDrape={resetDrape}
              saving={saving}
              saveError={error}
              onSave={handleSave}
              saveLabel={t('common_save')}
              savingLabel={t('addItem_savingText')}
              discardLabel={t('personalColorEdit_discardChangesLink')}
              onDiscard={() => router.back()}
            />
          )}

          {step !== 'intro' && step !== 'prepare' && step !== 'result' && (
            <View style={styles.ctaRow}>
              <PrimaryButton onPress={next} disabled={!canAdvance()}>{t('onboardingPersonalColor_nextButton')}</PrimaryButton>
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

// ─── Camera steps ──────────────────────────────────────────────────────────
//
// Screen-flash dual capture (face): the phone's own screen (pushed to max
// brightness) stands in for a torch on the front camera. A full-screen white
// overlay + max brightness for the flash frame, then a near-black overlay for
// the ambient frame — same "flash then ambient" shape as the wrist's torch
// on/off, so `analyzeFace` can run the same per-pixel subtraction. Prior
// screen brightness is restored in a `finally` and on unmount.

function FaceScanStep({ onCapture }: { onCapture: (uri: string, ambientUri?: string) => void }) {
  const { t } = useTranslation();
  const cameraRef = useRef<CameraView>(null);
  const insets = useSafeAreaInsets();
  const [flashPhase, setFlashPhase] = useState<'idle' | 'bright' | 'dim'>('idle');
  const busyRef = useRef(false);
  const priorBrightnessRef = useRef<number | null>(null);

  const restoreBrightness = useCallback(async () => {
    if (priorBrightnessRef.current != null) {
      try { await Brightness.setBrightnessAsync(priorBrightnessRef.current); } catch { /* best-effort */ }
      priorBrightnessRef.current = null;
    }
  }, []);

  useEffect(() => () => { restoreBrightness(); }, [restoreBrightness]);

  const handleCapture = async () => {
    if (!cameraRef.current || busyRef.current) return;
    busyRef.current = true;
    try {
      try {
        priorBrightnessRef.current = await Brightness.getBrightnessAsync();
        await Brightness.setBrightnessAsync(1);
      } catch {
        priorBrightnessRef.current = null;
      }
      setFlashPhase('bright');
      await new Promise(r => setTimeout(r, 300));
      const flash = await cameraRef.current.takePictureAsync({ quality: 0.7 });
      setFlashPhase('dim');
      await new Promise(r => setTimeout(r, 350));
      const ambient = await cameraRef.current.takePictureAsync({ quality: 0.7 });
      setFlashPhase('idle');
      if (flash?.uri) onCapture(flash.uri, ambient?.uri);
    } finally {
      await restoreBrightness();
      busyRef.current = false;
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="front" />
      {flashPhase === 'bright' && <View style={styles.flashOverlayWhite} pointerEvents="none" />}
      {flashPhase === 'dim' && <View style={styles.flashOverlayDim} pointerEvents="none" />}
      <View style={[styles.scanOverlay, { paddingBottom: insets.bottom + 32 }]}>
        <View style={[styles.scanFrame, styles.scanFrameFace]} />
        <Text style={styles.scanStepLabel}>{t('personalColor_stepLabel', { current: 1, total: 2 })}</Text>
        <View style={{ height: 8 }} />
        <Text style={styles.scanTitle}>{t('onboardingPersonalColor_faceScanTitle')}</Text>
        <Text style={styles.scanCaption}>{t('onboardingPersonalColor_faceScanCaption')}</Text>
        <View style={{ height: 32 }} />
        <Pressable onPress={handleCapture} style={styles.captureBtn}>
          <View style={styles.captureBtnInner} />
        </Pressable>
      </View>
    </View>
  );
}

function WristScanStep({ onCapture, analyzing }: { onCapture: (uri: string, ambientUri?: string) => void; analyzing: boolean }) {
  const { t } = useTranslation();
  const cameraRef = useRef<CameraView>(null);
  const insets = useSafeAreaInsets();
  const [torch, setTorch] = useState(true);
  const busyRef = useRef(false);

  // Dual-flash ambient-light cancellation: capture once with the torch on,
  // then again immediately after with it off, so `analyzeWristUndertone` can
  // subtract them and cancel out the room's own lighting. Guarded against
  // double-taps since the sequence takes ~350ms+ and isn't reentrant. Now the
  // last scan step before the camera path branches, so it also shows the
  // analysing spinner (moved here from v2's now-removed hair-scan step).
  const handleCapture = async () => {
    if (!cameraRef.current || busyRef.current) return;
    busyRef.current = true;
    try {
      const flash = await cameraRef.current.takePictureAsync({ quality: 0.7 });
      setTorch(false);
      await new Promise(r => setTimeout(r, 350));
      const ambient = await cameraRef.current.takePictureAsync({ quality: 0.7 });
      if (flash?.uri) onCapture(flash.uri, ambient?.uri);
    } finally {
      busyRef.current = false;
    }
  };
  return (
    <View style={{ flex: 1 }}>
      <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="back" enableTorch={torch} />
      <View style={[styles.scanOverlay, { paddingBottom: insets.bottom + 32 }]}>
        <View style={styles.scanFrame} />
        <Text style={styles.scanStepLabel}>{t('personalColor_stepLabel', { current: 2, total: 2 })}</Text>
        <View style={{ height: 8 }} />
        <Text style={styles.scanTitle}>{t('onboardingPersonalColor_wristScanTitle')}</Text>
        <Text style={styles.scanCaption}>{t('onboardingPersonalColor_wristScanCaption')}</Text>
        {analyzing && (
          <>
            <View style={{ height: 16 }} />
            <ActivityIndicator color="#FFF" />
            <Text style={[styles.scanCaption, { marginTop: 8 }]}>{t('onboardingPersonalColor_wristScanAnalyzing')}</Text>
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

// ─── Prepare (camera path only, one tap) ────────────────────────────────────

const PREPARE_ITEM_KEYS = [
  'onboardingPersonalColor_prepareItem1',
  'onboardingPersonalColor_prepareItem2',
  'onboardingPersonalColor_prepareItem3',
];

function PrepareStep({ onReady }: { onReady: () => void }) {
  const { t } = useTranslation();
  return (
    <View style={{ flex: 1 }}>
      <View style={{ height: 32 }} />
      <Text style={styles.h1}>{t('onboardingPersonalColor_prepareTitle')}</Text>
      <View style={{ height: 32 }} />
      {PREPARE_ITEM_KEYS.map(key => (
        <View key={key} style={styles.prepareRow}>
          <View style={styles.prepareCheck}>
            <IconCheck size={12} color={T.color.primary} strokeWidth={1.6} />
          </View>
          <Text style={styles.prepareItemText}>{t(key)}</Text>
        </View>
      ))}
      <View style={{ height: 24 }} />
      <Text style={[styles.caption, { fontSize: 11, color: T.color.tertiary }]}>
        {t('onboardingPersonalColor_prepareCaption')}
      </Text>
      <View style={{ height: 40 }} />
      <PrimaryButton onPress={onReady}>{t('onboardingPersonalColor_prepareButton')}</PrimaryButton>
    </View>
  );
}

// ─── Shared question components ────────────────────────────────────────────

function SkinStep({
  selected, onSelect, photoUri, auto, analyzing, isFallback,
}: {
  selected: string | null;
  onSelect: (k: 'warm' | 'cool' | 'neutral') => void;
  photoUri?: string | null;
  auto?: boolean;
  analyzing?: boolean;
  isFallback?: boolean;
}) {
  const { t } = useTranslation();
  const lang = useLang();
  return (
    <View>
      <View style={{ height: 32 }} />
      {isFallback && (
        <>
          <Text style={styles.fallbackReason}>{t('onboardingPersonalColor_photoFallbackReason')}</Text>
          <View style={{ height: 8 }} />
        </>
      )}
      <Text style={styles.h1}>{t('onboardingPersonalColor_skinTitle')}</Text>
      <View style={{ height: 8 }} />
      <Text style={styles.caption}>{t('onboardingPersonalColor_skinCaption')}</Text>
      {photoUri && (
        <>
          <View style={{ height: 20 }} />
          <Image source={{ uri: photoUri }} style={styles.photoThumb} resizeMode="cover" />
          <Text style={[styles.caption, styles.photoHint]}>
            {analyzing
              ? t('personalColorEdit_wristAnalyzing')
              : auto
                ? t('personalColorEdit_autoDetectedCaption')
                : t('onboardingPersonalColor_facePhotoCaption')}
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

function HairStep({
  selected, onSelect, width, photoUri, auto, analyzing, isFallback,
}: {
  selected: string | null;
  onSelect: (k: string) => void;
  width: number;
  photoUri?: string | null;
  auto?: boolean;
  analyzing?: boolean;
  isFallback?: boolean;
}) {
  const { t } = useTranslation();
  const lang = useLang();
  const swatchSize = (width - PAD * 2 - 12 * 3) / 4;
  return (
    <View>
      <View style={{ height: 32 }} />
      {isFallback && (
        <>
          <Text style={styles.fallbackReason}>{t('onboardingPersonalColor_photoFallbackReason')}</Text>
          <View style={{ height: 8 }} />
        </>
      )}
      <Text style={styles.h1}>{t('onboardingPersonalColor_hairTitle')}</Text>
      <View style={{ height: 8 }} />
      <Text style={styles.caption}>{t('onboardingPersonalColor_hairCaption')}</Text>
      {photoUri && (
        <>
          <View style={{ height: 20 }} />
          <Image source={{ uri: photoUri }} style={styles.photoThumb} resizeMode="cover" />
          <Text style={[styles.caption, styles.photoHint]}>
            {analyzing
              ? t('personalColorEdit_hairAnalyzing')
              : auto
                ? t('personalColorEdit_autoDetectedCaption')
                : t('onboardingPersonalColor_facePhotoCaption')}
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

// ─── Styles ────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: T.color.canvas },
  topBar:       { height: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 },
  backBtn:      { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  topTitle:     { ...type.ui, fontSize: 11, color: T.color.primary, letterSpacing: 2 },
  dotsRow:      { flexDirection: 'row', gap: 6, paddingHorizontal: PAD, marginBottom: 4 },
  dot:          { width: 18, height: 2, backgroundColor: T.color.hairline },
  dotActive:    { backgroundColor: T.color.primary },
  scroll:       { flex: 1 },
  content:      { paddingHorizontal: PAD },

  currentBadge:  { marginTop: 24, paddingBottom: 24, borderBottomWidth: 0.5, borderBottomColor: T.color.hairline },
  currentLabel:  { ...type.ui, fontSize: 9, color: T.color.tertiary, letterSpacing: 2 },
  currentSeason: { fontFamily: T.font.serif, fontSize: 28, fontWeight: '400', color: T.color.primary, marginTop: 4 },

  h1:            { ...type.h1, color: T.color.primary },
  caption:       { ...type.bodyL, color: T.color.secondary, lineHeight: 24 },
  ctaRow:        { marginTop: 40 },
  skipInline:    { ...type.ui, color: T.color.tertiary },

  orRow:         { flexDirection: 'row', alignItems: 'center', gap: 12 },
  orLine:        { flex: 1, height: 0.5, backgroundColor: T.color.hairline },
  orText:        { ...type.ui, color: T.color.tertiary, fontSize: 10, letterSpacing: 1.5 },
  secondaryBtn:  { height: 48, borderWidth: 0.5, borderColor: T.color.primary, alignItems: 'center', justifyContent: 'center' },
  secondaryBtnText: { ...type.ui, color: T.color.primary, letterSpacing: 1.5 },

  scanOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center', justifyContent: 'flex-end',
    paddingHorizontal: PAD,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  scanFrame: {
    width: 160, height: 100, borderWidth: 1, borderColor: 'rgba(255,255,255,0.7)',
    borderRadius: 8, position: 'absolute', top: '30%',
  },
  scanFrameFace: { width: 190, height: 240, borderRadius: 120, top: '18%' },
  flashOverlayWhite: { ...StyleSheet.absoluteFillObject, backgroundColor: '#FFFFFF' },
  flashOverlayDim:   { ...StyleSheet.absoluteFillObject, backgroundColor: '#050505' },
  scanStepLabel: { ...type.ui, color: 'rgba(255,255,255,0.6)', letterSpacing: 2, fontSize: 9, textAlign: 'center' },
  scanTitle:   { ...type.ui, color: '#FFF', letterSpacing: 2, fontSize: 13 },
  scanCaption: { ...type.caption, color: 'rgba(255,255,255,0.75)', textAlign: 'center', marginTop: 8, lineHeight: 18 },
  captureBtn:  { width: 72, height: 72, borderRadius: 36, borderWidth: 2, borderColor: '#FFF', alignItems: 'center', justifyContent: 'center' },
  captureBtnInner: { width: 58, height: 58, borderRadius: 29, backgroundColor: '#FFF' },

  photoThumb: { width: '100%', height: 140, borderRadius: 4 },
  photoHint:  { fontSize: 11, color: T.color.tertiary, marginTop: 6 },

  optionRow:         { flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 16, borderBottomWidth: 0.5, borderBottomColor: T.color.hairline },
  optionRowSelected: { borderBottomColor: T.color.primary },
  swatchLarge:       { width: 48, height: 48, borderRadius: 4, flexShrink: 0 },
  optionText:        { flex: 1 },
  optionLabel:       { ...type.ui, color: T.color.primary, letterSpacing: 0.8 },
  optionDesc:        { ...type.caption, color: T.color.secondary, marginTop: 4 },
  checkDot:          { width: 8, height: 8, borderRadius: 4, backgroundColor: T.color.primary, flexShrink: 0 },

  swatchGrid:     { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  hairSwatch:     { borderRadius: 4 },
  swatchSelected: { borderWidth: 1.5, borderColor: T.color.primary },
  swatchLabel:    { ...type.ui, fontSize: 10, color: T.color.secondary, textAlign: 'center', marginTop: 6, lineHeight: 14 },

  fallbackReason: { ...type.ui, fontSize: 10, color: T.color.tertiary, letterSpacing: 1, lineHeight: 16 },

  // Prepare checklist
  prepareRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 20 },
  prepareCheck: {
    width: 28, height: 28, borderRadius: 14, borderWidth: 0.5, borderColor: T.color.primary,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  prepareItemText: { ...type.bodyL, color: T.color.primary, flex: 1 },
});
