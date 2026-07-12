// Self-contained "draping" refinement flow, rendered full-screen by the
// personal-color result screens in place of their normal scroll content.
// One selfie (front camera, no torch) + three side-by-side colour-drape
// picks, each nudging one axis of the 12-tone model (`applyDrapePick` in
// `tone12.ts`) via the caller-supplied `applyDrape`.
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
import { IconX } from '../../../components/icons';
import type { DrapeAxis } from '../tone12';
import { useTranslation } from '../../../i18n';

interface DrapeRound {
  axis: DrapeAxis;
  /** Backing panel colour for the left card — picking it applies direction +1. */
  left: string;
  /** Backing panel colour for the right card — picking it applies direction -1. */
  right: string;
}

// CALIBRATION-PENDING: draft drape colours, not colourist-approved swatches.
// The question is the same across all three rounds — translated via
// drapeSession_question below rather than duplicated per round.
const ROUNDS: DrapeRound[] = [
  { axis: 'warmth', left: '#D4A24C', right: '#9AB2C8' },
  { axis: 'value',  left: '#E8DCC8', right: '#2E2A3A' },
  { axis: 'chroma', left: '#C2185B', right: '#A89AA4' },
];

interface Props {
  onDone: () => void;
  applyDrape: (axis: DrapeAxis, direction: 1 | -1) => void;
}

export function DrapeSession({ onDone, applyDrape }: Props) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const requestedRef = useRef(false);

  const [selfieUri, setSelfieUri] = useState<string | null>(null);
  const [roundIndex, setRoundIndex] = useState(0);

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

  const handlePick = useCallback((direction: 1 | -1 | null) => {
    const round = ROUNDS[roundIndex];
    if (direction !== null) applyDrape(round.axis, direction);
    if (roundIndex + 1 >= ROUNDS.length) {
      handleClose();
    } else {
      setRoundIndex(i => i + 1);
    }
  }, [roundIndex, applyDrape, handleClose]);

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

  // ── Step 2: three side-by-side drape rounds ──────────────────────────────

  const round = ROUNDS[roundIndex];
  return (
    <View style={[styles.veil, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 24 }]}>
      <Pressable onPress={handleClose} style={styles.closeBtnStatic}>
        <IconX size={20} color="#FFF" strokeWidth={1.2} />
      </Pressable>
      <Text style={styles.roundLabel}>{t('drapeSession_roundLabel', { current: roundIndex + 1, total: ROUNDS.length })}</Text>
      <View style={{ height: 10 }} />
      <Text style={styles.question}>{t('drapeSession_question')}</Text>
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

  roundLabel: { ...type.ui, color: 'rgba(255,255,255,0.6)', letterSpacing: 2, fontSize: 10 },
  question: {
    fontFamily: T.font.serifLight, fontSize: 22, fontWeight: '300',
    color: '#FFF', textAlign: 'center',
  },
  cardsRow: { flexDirection: 'row', gap: 12 },
  drapeCard: {
    width: 150, padding: 14,
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center', justifyContent: 'center',
  },
  drapeImage: { width: '100%', height: 160, borderRadius: 2 },
  skipLink: { ...type.ui, color: 'rgba(255,255,255,0.6)', letterSpacing: 1.5, fontSize: 11 },
});
