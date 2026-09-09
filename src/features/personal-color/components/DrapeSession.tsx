// Self-contained "draping" refinement flow, rendered full-screen by the
// personal-color result screens in place of their normal scroll content.
// One selfie (front camera, no torch) + THREE phases built on the
// professional draping sequence (docs/personal-color-v3-research.md §2):
//   1. selfie capture
//   2. five side-by-side comparative drape rounds (`drapeRounds.ts`), each
//      nudging one axis of the 12-tone model (`applyDrapePick` in
//      `tone12.ts`) via the caller-supplied `applyDrape`
//   3. "SEE ALL 12 TONES" — a 3×4 grid of every tone's signature drape colour
//      behind the same selfie, tap-to-compare against the currently
//      classified tone (`nudgeTowardTone`, via the caller-supplied
//      `onNudgeToward`)
//
// Privacy: the selfie never leaves local component state and is deleted the
// moment the session ends — on completion, on the user backing out via the
// X, or on unmount (belt-and-braces, e.g. the parent navigating away) —
// whichever happens first. `FileSystem.deleteAsync` is idempotent so a
// double-delete across those paths is harmless.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Image, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as FileSystem from 'expo-file-system/legacy';
import { T, type } from '../../../design/tokens';
import { useGridColumns, useGridCardWidth } from '../../../design/layout';
import { IconX } from '../../../components/icons';
import type { DrapeAxis, ColorTone12 } from '../tone12';
import { TONE12_DRAPE_HEX, TONE12_LABELS } from '../tone12';
import { DRAPE_ROUNDS } from '../drapeRounds';
import { useTranslation } from '../../../i18n';

const GRID_PAD = 24;
const GRID_COLS = 3;
const GRID_GAP = 8;

// Stable draw order for the 12-tone grid — the same season-grouped order
// TONE12_LABELS is defined in (light/true/bright spring, light/true/soft
// summer, …) reads naturally as 4 rows of 3 (one row per season family).
const GRID_TONES = Object.keys(TONE12_LABELS) as ColorTone12[];

type Phase = 'rounds' | 'grid' | 'compare';

interface Props {
  onDone: () => void;
  applyDrape: (axis: DrapeAxis, direction: 1 | -1) => void;
  /** Round 5's gold/silver pick — guarded upstream (hook) so it never
   *  clobbers an existing manual metal answer. Optional so any future/other
   *  caller can omit it without a metal-confirmation round. */
  onMetal?: (metal: 'gold' | 'silver') => void;
  /** The live classified tone (`result.tone12`), so the grid can mark the
   *  current cell and the compare view knows which card is "current". */
  currentTone: ColorTone12;
  /** Nudges the drape axes toward a tapped grid tone (`nudgeTowardTone`). */
  onNudgeToward: (from: ColorTone12, to: ColorTone12) => void;
  /** Enter straight into the grid phase after the selfie capture, skipping
   *  the 5 comparative rounds — used by the result screen's "SEE ALL 12
   *  TONES" secondary button. */
  startAtGrid?: boolean;
}

// UX-simplify (2026-08-06): the 12-tone grid/compare labels used to hard-code
// TONE12_LABELS[tone].en regardless of the active app language — this
// resolves the active language with an English fallback (same pattern as
// every other personal-color screen's local `useLang`).
type Lang = 'en' | 'vi';
function useLang(): Lang {
  const { i18n } = useTranslation();
  return i18n.language?.toLowerCase().startsWith('vi') ? 'vi' : 'en';
}
function toneLabel(tone: ColorTone12, lang: Lang): string {
  return TONE12_LABELS[tone][lang] ?? TONE12_LABELS[tone].en;
}

export function DrapeSession({ onDone, applyDrape, onMetal, currentTone, onNudgeToward, startAtGrid = false }: Props) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const lang = useLang();
  // 12-tone grid gains a column on tablets — 3 fixed columns off a 1024pt
  // screen made each swatch 320pt, so the four rows ran off the bottom.
  const gridCols = useGridColumns(GRID_COLS, 4, 4);
  const cellWidth = useGridCardWidth(gridCols, GRID_PAD, GRID_GAP);
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const requestedRef = useRef(false);

  const [selfieUri, setSelfieUri] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>(startAtGrid ? 'grid' : 'rounds');
  const [roundIndex, setRoundIndex] = useState(0);
  const [compareTarget, setCompareTarget] = useState<ColorTone12 | null>(null);

  // Mirrors selfieUri into a ref so the unmount cleanup below always sees the
  // latest value (an effect closure captured at mount time would only ever
  // see the initial null).
  const selfieUriRef = useRef<string | null>(null);
  useEffect(() => { selfieUriRef.current = selfieUri; }, [selfieUri]);

  useEffect(() => () => {
    if (selfieUriRef.current) {
      FileSystem.deleteAsync(selfieUriRef.current, { idempotent: true }).catch(() => {});
    }
  }, []);

  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain && !requestedRef.current) {
      requestedRef.current = true;
      requestPermission();
    }
  }, [permission, requestPermission]);

  const handleClose = useCallback(() => {
    if (selfieUriRef.current) {
      FileSystem.deleteAsync(selfieUriRef.current, { idempotent: true }).catch(() => {});
      selfieUriRef.current = null;
    }
    onDone();
  }, [onDone]);

  const handleCapture = useCallback(async () => {
    if (!cameraRef.current) return;
    const photo = await cameraRef.current.takePictureAsync({ quality: 0.7, base64: false });
    if (photo?.uri) setSelfieUri(photo.uri);
  }, []);

  // ── Phase 2: comparative drape rounds ────────────────────────────────────

  const handlePick = useCallback((direction: 1 | -1 | null) => {
    const round = DRAPE_ROUNDS[roundIndex];
    if (direction !== null) {
      applyDrape(round.axis, direction);
      const metal = direction === 1 ? round.leftMetal : round.rightMetal;
      if (metal) onMetal?.(metal);
    }
    if (roundIndex + 1 >= DRAPE_ROUNDS.length) {
      handleClose();
    } else {
      setRoundIndex(i => i + 1);
    }
  }, [roundIndex, applyDrape, onMetal, handleClose]);

  const handleSeeAllTones = useCallback(() => setPhase('grid'), []);

  // ── Phase 3: 12-tone grid compare ────────────────────────────────────────

  const handleGridTap = useCallback((tone: ColorTone12) => {
    if (tone === currentTone) return; // already the current read — nothing to compare
    setCompareTarget(tone);
    setPhase('compare');
  }, [currentTone]);

  const handleCompareKeepCurrent = useCallback(() => {
    setCompareTarget(null);
    setPhase('grid');
  }, []);

  const handleComparePickChallenger = useCallback(() => {
    if (compareTarget) onNudgeToward(currentTone, compareTarget);
    setCompareTarget(null);
    setPhase('grid');
  }, [compareTarget, currentTone, onNudgeToward]);

  // ── Permission gate ──────────────────────────────────────────────────────

  if (!permission || (!permission.granted && permission.canAskAgain)) {
    return (
      <View style={styles.veil}>
        <ActivityIndicator color="#FFF" />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.veil}>
        <Pressable onPress={handleClose} style={[styles.closeBtn, { top: insets.top + 12 }]}>
          <IconX size={20} color="#FFF" strokeWidth={1.2} />
        </Pressable>
        <Text style={styles.fallbackText}>{t('drapeSession_cameraNeeded')}</Text>
        <View style={{ height: 24 }} />
        <Pressable onPress={handleClose} style={styles.fallbackBtn}>
          <Text style={styles.fallbackBtnText}>{t('drapeSession_close')}</Text>
        </Pressable>
      </View>
    );
  }

  // ── Step 1: selfie capture ───────────────────────────────────────────────

  if (!selfieUri) {
    return (
      <View style={{ flex: 1 }}>
        <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="front" />
        <Pressable onPress={handleClose} style={[styles.closeBtn, { top: insets.top + 12 }]}>
          <IconX size={20} color="#FFF" strokeWidth={1.2} />
        </Pressable>
        <View style={[styles.captureOverlay, { paddingBottom: insets.bottom + 32 }]}>
          <Text style={styles.overlayTitle}>{t('drapeSession_oneSelfie')}</Text>
          <Text style={styles.overlayCaption}>
            {t('drapeSession_selfieCaption')}
          </Text>
          <View style={{ height: 32 }} />
          <Pressable onPress={handleCapture} style={styles.captureBtn}>
            <View style={styles.captureBtnInner} />
          </Pressable>
        </View>
      </View>
    );
  }

  // ── Step 3: 12-tone grid ─────────────────────────────────────────────────

  if (phase === 'grid') {
    return (
      <View style={[styles.veil, styles.gridVeil, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 24 }]}>
        <Pressable onPress={handleClose} style={styles.closeBtnStatic}>
          <IconX size={20} color="#FFF" strokeWidth={1.2} />
        </Pressable>
        <Text style={styles.roundLabel}>{t('drapeSession_gridTitle')}</Text>
        <View style={{ height: 6 }} />
        <Text style={styles.subCaption}>{t('drapeSession_gridCaption')}</Text>
        <View style={{ height: 20 }} />
        <View style={styles.gridWrap}>
          {GRID_TONES.map(tone => (
            <Pressable
              key={tone}
              onPress={() => handleGridTap(tone)}
              style={[styles.gridCard, { width: cellWidth, backgroundColor: TONE12_DRAPE_HEX[tone] }]}
            >
              <Image source={{ uri: selfieUri }} style={styles.gridImage} resizeMode="cover" />
              {tone === currentTone && <View style={styles.gridMarker} />}
              <Text style={styles.gridLabel} numberOfLines={1}>{toneLabel(tone, lang)}</Text>
            </Pressable>
          ))}
        </View>
      </View>
    );
  }

  // ── Step 3b: grid compare ────────────────────────────────────────────────

  if (phase === 'compare' && compareTarget) {
    return (
      <View style={[styles.veil, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 24 }]}>
        <Pressable onPress={handleClose} style={styles.closeBtnStatic}>
          <IconX size={20} color="#FFF" strokeWidth={1.2} />
        </Pressable>
        <Text style={styles.question}>{t('drapeSession_gridComparePrompt')}</Text>
        <View style={{ height: 28 }} />
        <View style={styles.cardsRow}>
          <Pressable onPress={handleCompareKeepCurrent} style={[styles.drapeCard, { backgroundColor: TONE12_DRAPE_HEX[currentTone] }]}>
            <Image source={{ uri: selfieUri }} style={styles.drapeImage} resizeMode="cover" />
            <Text style={styles.gridLabel}>{toneLabel(currentTone, lang)}</Text>
          </Pressable>
          <Pressable onPress={handleComparePickChallenger} style={[styles.drapeCard, { backgroundColor: TONE12_DRAPE_HEX[compareTarget] }]}>
            <Image source={{ uri: selfieUri }} style={styles.drapeImage} resizeMode="cover" />
            <Text style={styles.gridLabel}>{toneLabel(compareTarget, lang)}</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // ── Step 2: five side-by-side drape rounds ───────────────────────────────

  const round = DRAPE_ROUNDS[roundIndex];
  const isLastRound = roundIndex === DRAPE_ROUNDS.length - 1;
  return (
    <View style={[styles.veil, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 24 }]}>
      <Pressable onPress={handleClose} style={styles.closeBtnStatic}>
        <IconX size={20} color="#FFF" strokeWidth={1.2} />
      </Pressable>
      <Text style={styles.roundLabel}>{t('drapeSession_roundLabel', { current: roundIndex + 1, total: DRAPE_ROUNDS.length })}</Text>
      <View style={{ height: 10 }} />
      <Text style={styles.question}>{t(`drapeSession_round${roundIndex + 1}Question`)}</Text>
      <View style={{ height: 6 }} />
      <Text style={styles.subCaption}>{t('drapeSession_lookAtFace')}</Text>
      <View style={{ height: 28 }} />
      <View style={styles.cardsRow}>
        <Pressable onPress={() => handlePick(1)} style={[styles.drapeCard, { backgroundColor: round.left }]}>
          <Image source={{ uri: selfieUri }} style={styles.drapeImage} resizeMode="cover" />
        </Pressable>
        <Pressable onPress={() => handlePick(-1)} style={[styles.drapeCard, { backgroundColor: round.right }]}>
          <Image source={{ uri: selfieUri }} style={styles.drapeImage} resizeMode="cover" />
        </Pressable>
      </View>
      <View style={{ height: 28 }} />
      <Pressable onPress={() => handlePick(null)}>
        <Text style={styles.skipLink}>{t('drapeSession_skip')}</Text>
      </Pressable>
      {isLastRound && (
        <>
          <View style={{ height: 16 }} />
          <Pressable onPress={handleSeeAllTones}>
            <Text style={styles.skipLink}>{t('drapeSession_seeAllTonesLink')}</Text>
          </Pressable>
        </>
      )}
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  veil: {
    flex: 1,
    backgroundColor: '#0E0D0C',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  gridVeil: { justifyContent: 'flex-start' },
  captureOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingHorizontal: 24,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  closeBtn: {
    position: 'absolute', left: 16, width: 40, height: 40,
    alignItems: 'center', justifyContent: 'center', zIndex: 10,
  },
  closeBtnStatic: {
    position: 'absolute', top: 12, left: 16, width: 40, height: 40,
    alignItems: 'center', justifyContent: 'center', zIndex: 10,
  },
  overlayTitle:   { ...type.ui, color: '#FFF', letterSpacing: 2, fontSize: 13 },
  overlayCaption: { ...type.caption, color: 'rgba(255,255,255,0.75)', textAlign: 'center', marginTop: 8, lineHeight: 18 },
  captureBtn: {
    width: 72, height: 72, borderRadius: 36,
    borderWidth: 2, borderColor: '#FFF',
    alignItems: 'center', justifyContent: 'center',
  },
  captureBtnInner: { width: 58, height: 58, borderRadius: 29, backgroundColor: '#FFF' },

  fallbackText: { ...type.caption, color: 'rgba(255,255,255,0.85)', textAlign: 'center' },
  fallbackBtn: {
    height: 48, borderWidth: 0.5, borderColor: '#FFF',
    paddingHorizontal: 32, alignItems: 'center', justifyContent: 'center',
  },
  fallbackBtnText: { ...type.ui, color: '#FFF', letterSpacing: 1.5 },

  roundLabel: { ...type.ui, color: 'rgba(255,255,255,0.6)', letterSpacing: 2, fontSize: 10, textAlign: 'center' },
  question: {
    fontFamily: T.font.serifLight, fontSize: 22, fontWeight: '300',
    color: '#FFF', textAlign: 'center',
  },
  subCaption: { ...type.caption, color: 'rgba(255,255,255,0.55)', textAlign: 'center', fontSize: 11 },
  cardsRow: { flexDirection: 'row', gap: 12 },
  drapeCard: {
    width: 150, padding: 14,
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center', justifyContent: 'center',
  },
  drapeImage: { width: '100%', height: 160, borderRadius: 2 },
  skipLink: { ...type.ui, color: 'rgba(255,255,255,0.6)', letterSpacing: 1.5, fontSize: 11 },

  // 12-tone grid
  gridWrap: {
    flexDirection: 'row', flexWrap: 'wrap', gap: GRID_GAP,
    paddingHorizontal: GRID_PAD, width: '100%',
  },
  gridCard: {
    padding: 6, borderWidth: 2, borderColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center', justifyContent: 'center',
  },
  gridImage: { width: '100%', height: 92, borderRadius: 2 },
  gridMarker: {
    position: 'absolute', top: 10, right: 10,
    width: 8, height: 8, borderRadius: 4, backgroundColor: '#FFF',
  },
  gridLabel: {
    ...type.ui, color: '#FFF', fontSize: 9, letterSpacing: 0.5,
    textAlign: 'center', marginTop: 6,
  },
});
