import React, { useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable,
  useWindowDimensions, Image,
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
  SEASON_DESC,
} from '../../src/features/personal-color/colorSeasonData';

const PAD = 24;

// Camera-path steps that show dots
const CAMERA_QUESTION_STEPS = ['skin', 'hair', 'eye', 'metal'] as const;

export default function PersonalColorScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: W } = useWindowDimensions();
  const {
    path, step,
    wristPhotoUri, hairPhotoUri,
    skinUndertone, hairKey, eyeKey, metalKey, result,
    saving,
    startCameraPath, startManualPath,
    setCameraPhoto,
    setSkin, setHair, setEye, setMetal,
    next, back, canAdvance, save,
    stepIndex,
  } = usePersonalColorDetection();

  const [permission, requestPermission] = useCameraPermissions();

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

  const showDots = step !== 'intro' && step !== 'result'
    && step !== 'wrist-scan' && step !== 'hair-scan';

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
            <Text style={styles.skipText}>SKIP</Text>
          </Pressable>
        )}
      </View>

      {/* Step dots — only for skin/hair/eye/metal */}
      {showDots && (
        <View style={styles.dotsRow}>
          {CAMERA_QUESTION_STEPS.map((s, i) => (
            <View
              key={s}
              style={[styles.dot, i === stepIndex && styles.dotActive]}
            />
          ))}
        </View>
      )}

      {/* Camera steps get their own full-height views outside the scroll */}
      {step === 'wrist-scan' && (
        <WristScanStep onCapture={uri => setCameraPhoto('wrist', uri)} />
      )}
      {step === 'hair-scan' && (
        <HairScanStep onCapture={uri => setCameraPhoto('hair', uri)} />
      )}

      {step !== 'wrist-scan' && step !== 'hair-scan' && (
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
            />
          )}

          {step !== 'intro' && step !== 'result' && (
            <View style={styles.ctaRow}>
              <PrimaryButton onPress={next} disabled={!canAdvance()}>NEXT</PrimaryButton>
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
  return (
    <View style={{ flex: 1 }}>
      <View style={{ height: 32 }} />
      <Text style={styles.h1}>Your personal{'\n'}colour.</Text>
      <View style={{ height: 20 }} />
      <Text style={styles.caption}>
        Answer 4 quick questions about your natural colouring. We'll find the colour season
        that flatters you most — and use it to refine every outfit suggestion.
      </Text>
      <View style={{ height: 12 }} />
      <Text style={[styles.caption, { color: T.color.tertiary }]}>
        Based on seasonal colour analysis. Takes under a minute.
      </Text>
      <View style={{ height: 48 }} />

      {cameraAvailable && (
        <>
          <PrimaryButton onPress={onCamera}>SCAN MY COLOURS</PrimaryButton>
          <View style={{ height: 10 }} />
          <Text style={[styles.caption, { color: T.color.tertiary, fontSize: 11, textAlign: 'center' }]}>
            Uses rear camera + flash to read wrist & hair tone
          </Text>
          <View style={{ height: 24 }} />
          <View style={styles.orRow}>
            <View style={styles.orLine} />
            <Text style={styles.orText}>OR</Text>
            <View style={styles.orLine} />
          </View>
          <View style={{ height: 24 }} />
          <Pressable onPress={onManual} style={styles.secondaryBtn}>
            <Text style={styles.secondaryBtnText}>ANSWER QUESTIONS</Text>
          </Pressable>
        </>
      )}
      {!cameraAvailable && (
        <PrimaryButton onPress={onManual}>START</PrimaryButton>
      )}

      <View style={{ height: 24 }} />
      <Pressable onPress={onSkip} style={{ alignItems: 'center' }}>
        <Text style={styles.skipInline}>Skip for now</Text>
      </Pressable>
    </View>
  );
}

// ─── Wrist Scan ─────────────────────────────────────────────────────────────

function WristScanStep({ onCapture }: { onCapture: (uri: string) => void }) {
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
      {/* Instruction overlay */}
      <View style={[styles.scanOverlay, { paddingBottom: insets.bottom + 32 }]}>
        <View style={styles.scanFrame} />
        <View style={{ height: 24 }} />
        <Text style={styles.scanTitle}>HOLD YOUR WRIST</Text>
        <Text style={styles.scanCaption}>Position the inside of your wrist in the frame.{'\n'}Flash helps read undertone accurately.</Text>
        <View style={{ height: 32 }} />
        <Pressable onPress={handleCapture} style={styles.captureBtn}>
          <View style={styles.captureBtnInner} />
        </Pressable>
      </View>
    </View>
  );
}

// ─── Hair Scan ──────────────────────────────────────────────────────────────

function HairScanStep({ onCapture }: { onCapture: (uri: string) => void }) {
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
        <Text style={styles.scanTitle}>CAPTURE YOUR ROOTS</Text>
        <Text style={styles.scanCaption}>Hold a lock of hair against a light background.{'\n'}Use your natural root colour, not treated ends.</Text>
        <View style={{ height: 32 }} />
        <Pressable onPress={handleCapture} style={styles.captureBtn}>
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
  return (
    <View>
      <View style={{ height: 32 }} />
      <Text style={styles.h1}>Your skin{'\n'}undertone.</Text>
      <View style={{ height: 8 }} />
      <Text style={styles.caption}>Look at the inside of your wrist in natural light.</Text>

      {photoUri && (
        <>
          <View style={{ height: 20 }} />
          <Image
            source={{ uri: photoUri }}
            style={styles.photoThumb}
            resizeMode="cover"
          />
          <Text style={[styles.caption, { fontSize: 11, color: T.color.tertiary, marginTop: 6 }]}>
            Your wrist photo — use as reference
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
            <Text style={styles.optionLabel}>{opt.labelEn.toUpperCase()}</Text>
            <Text style={styles.optionDesc}>{opt.descEn}</Text>
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
  const swatchSize = (width - PAD * 2 - 12 * 3) / 4;
  return (
    <View>
      <View style={{ height: 32 }} />
      <Text style={styles.h1}>Your natural{'\n'}hair colour.</Text>
      <View style={{ height: 8 }} />
      <Text style={styles.caption}>Use your roots, not treated ends.</Text>

      {photoUri && (
        <>
          <View style={{ height: 20 }} />
          <Image
            source={{ uri: photoUri }}
            style={styles.photoThumb}
            resizeMode="cover"
          />
          <Text style={[styles.caption, { fontSize: 11, color: T.color.tertiary, marginTop: 6 }]}>
            Your hair photo — use as reference
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
              {opt.labelEn}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

// ─── Eye ───────────────────────────────────────────────────────────────────

function EyeStep({ selected, onSelect }: { selected: string | null; onSelect: (k: 'blue_grey' | 'green_hazel_cool' | 'brown_hazel_warm' | 'dark_brown_black') => void }) {
  return (
    <View>
      <View style={{ height: 32 }} />
      <Text style={styles.h1}>Your eye{'\n'}colour.</Text>
      <View style={{ height: 40 }} />
      {EYE_OPTIONS.map(opt => (
        <Pressable
          key={opt.key}
          onPress={() => onSelect(opt.key as Parameters<typeof onSelect>[0])}
          style={[styles.optionRow, selected === opt.key && styles.optionRowSelected]}
        >
          <View style={[styles.swatchLarge, { backgroundColor: opt.swatchHex, borderRadius: 999 }]} />
          <Text style={[styles.optionLabel, { flex: 1 }]}>{opt.labelEn.toUpperCase()}</Text>
          {selected === opt.key && <View style={styles.checkDot} />}
        </Pressable>
      ))}
    </View>
  );
}

// ─── Metal ─────────────────────────────────────────────────────────────────

function MetalStep({ selected, onSelect }: { selected: string | null; onSelect: (k: 'gold' | 'silver' | 'both') => void }) {
  return (
    <View>
      <View style={{ height: 32 }} />
      <Text style={styles.h1}>Your preferred{'\n'}metal.</Text>
      <View style={{ height: 8 }} />
      <Text style={styles.caption}>Which looks best on you — not which you own.</Text>
      <View style={{ height: 40 }} />
      {METAL_OPTIONS.map(opt => (
        <Pressable
          key={opt.key}
          onPress={() => onSelect(opt.key as Parameters<typeof onSelect>[0])}
          style={[styles.optionRow, selected === opt.key && styles.optionRowSelected]}
        >
          <View style={[styles.swatchLarge, { backgroundColor: opt.swatchHex }]} />
          <Text style={[styles.optionLabel, { flex: 1 }]}>{opt.labelEn.toUpperCase()}</Text>
          {selected === opt.key && <View style={styles.checkDot} />}
        </Pressable>
      ))}
    </View>
  );
}

// ─── Result ────────────────────────────────────────────────────────────────

function ResultStep({
  result, saving, onSave, onSkip,
}: {
  result: NonNullable<ReturnType<typeof usePersonalColorDetection>['result']>;
  saving: boolean;
  onSave: () => void;
  onSkip: () => void;
}) {
  const desc = SEASON_DESC[result.season];
  return (
    <View>
      <View style={{ height: 40 }} />
      <Text style={styles.seasonLabel}>{result.season.toUpperCase()}</Text>
      <Text style={styles.h1}>Your season.</Text>
      <View style={{ height: 16 }} />
      <Text style={styles.caption}>{desc.en}</Text>

      <View style={{ height: 32 }} />
      <Text style={styles.paletteSectionLabel}>YOUR PALETTE</Text>
      <View style={{ height: 12 }} />
      <View style={styles.paletteRow}>
        {result.palette.map(hex => (
          <View key={hex} style={[styles.paletteSwatch, { backgroundColor: hex }]} />
        ))}
      </View>

      <View style={{ height: 48 }} />
      <PrimaryButton onPress={onSave} disabled={saving}>
        {saving ? 'SAVING…' : 'SAVE TO PROFILE'}
      </PrimaryButton>
      <View style={{ height: 16 }} />
      <Pressable onPress={onSkip} style={{ alignItems: 'center' }}>
        <Text style={styles.skipInline}>Continue without saving</Text>
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
});
