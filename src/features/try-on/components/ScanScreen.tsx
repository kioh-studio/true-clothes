// Try On (feature 008) — T016
// Capture/pick UI: camera or library. Dispatches scan() → navigate to result on success.
// Thin screen — all logic delegated to useTryOn (Constitution II).

import React, { useEffect, useCallback } from 'react';
import {
  View, Text, Pressable, StyleSheet, ActivityIndicator, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { T, type } from '../../../design/tokens';
import { PrimaryButton, SecondaryButton } from '../../../components/ui';
import { IconCamera, IconImage, IconX } from '../../../components/icons';
import { useTryOn } from '../useTryOn';

export function ScanScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { status, error, needsUpgrade, scan, reset } = useTryOn();

  const isScanning = status === 'scanning';

  // Navigate to result once scan completes (status moves to 'evaluating')
  useEffect(() => {
    if (status === 'evaluating') {
      router.push('/try-on/result');
    }
  }, [status, router]);

  const handlePickCamera = useCallback(async () => {
    const { status: permStatus } = await ImagePicker.requestCameraPermissionsAsync();
    if (permStatus !== 'granted') {
      Alert.alert('Camera access needed', 'Please allow camera access in Settings.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
      allowsEditing: false,
    });
    if (!result.canceled && result.assets[0]) {
      await scan(result.assets[0].uri, 'ai');
    }
  }, [scan]);

  const handlePickLibrary = useCallback(async () => {
    const { status: permStatus } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permStatus !== 'granted') {
      Alert.alert('Photo library access needed', 'Please allow access in Settings.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
      allowsMultipleSelection: false,
    });
    if (!result.canceled && result.assets[0]) {
      await scan(result.assets[0].uri, 'ai');
    }
  }, [scan]);

  return (
    <View style={[styles.container, { paddingTop: insets.top + T.s(6) }]}>
      {/* Close — pushed as a stack screen, so give an explicit way back */}
      <Pressable onPress={() => router.back()} hitSlop={8} style={styles.closeBtn}>
        <IconX size={20} strokeWidth={1.4} color={T.color.primary} />
      </Pressable>

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.eyebrow}>TRY ON</Text>
        <Text style={styles.h1}>Scan an item</Text>
        <Text style={styles.caption}>
          Point your camera at a single clothing item — or pick a photo from your library.
        </Text>
      </View>

      {/* Error / upgrade banner */}
      {error ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable onPress={reset} hitSlop={8} style={styles.errorDismiss}>
            <IconX size={14} strokeWidth={1.4} color={T.color.error} />
          </Pressable>
        </View>
      ) : null}

      {needsUpgrade ? (
        <View style={styles.upgradeBanner}>
          <Text style={styles.upgradeText}>
            You've used your free AI scans this month. Upgrade to scan more.
          </Text>
        </View>
      ) : null}

      {/* Scanning progress */}
      {isScanning ? (
        <View style={styles.scanningState}>
          <ActivityIndicator size="large" color={T.color.primary} />
          <Text style={styles.scanningLabel}>Analysing item…</Text>
        </View>
      ) : (
        <>
          {/* Framing guide — reinforce ONE item per scan (we evaluate the item
              you frame; multi-item picker is a future enhancement). */}
          <View style={styles.frameGuide}>
            <View style={[styles.frameTick, styles.frameTickTL]} />
            <View style={[styles.frameTick, styles.frameTickTR]} />
            <View style={[styles.frameTick, styles.frameTickBL]} />
            <View style={[styles.frameTick, styles.frameTickBR]} />
            <Text style={styles.frameLabel}>ONE ITEM</Text>
            <Text style={styles.frameSub}>centre a single piece · plain background</Text>
          </View>

          {/* Primary: Take photo */}
          <View style={styles.actions}>
            <PrimaryButton onPress={handlePickCamera} disabled={isScanning}>
              <View style={styles.buttonInner}>
                <IconCamera size={18} strokeWidth={1.4} color={T.color.canvas} />
                <Text style={styles.buttonLabel}>TAKE A PHOTO</Text>
              </View>
            </PrimaryButton>

            <View style={styles.actionGap} />

            {/* Secondary: Library */}
            <SecondaryButton onPress={handlePickLibrary} disabled={isScanning}>
              <View style={styles.buttonInner}>
                <IconImage size={18} strokeWidth={1.4} color={T.color.primary} />
                <Text style={styles.buttonLabelSecondary}>CHOOSE FROM LIBRARY</Text>
              </View>
            </SecondaryButton>
          </View>

          {/* Hint */}
          <Text style={styles.hint}>
            For best results, photograph one item on a plain background.
          </Text>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: T.color.canvas,
    paddingHorizontal: T.s(6),
  },
  closeBtn: {
    alignSelf: 'flex-end',
    width: 44, height: 44,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: T.s(2),
  },
  header: {
    marginBottom: T.s(8),
  },
  eyebrow: {
    ...type.ui,
    fontSize: 9,
    color: T.color.tertiary,
    marginBottom: T.s(2),
  },
  h1: {
    ...type.h1,
    color: T.color.primary,
  },
  caption: {
    ...type.caption,
    marginTop: T.s(3),
    color: T.color.secondary,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: T.color.elevated,
    borderWidth: 0.5,
    borderColor: T.color.error,
    paddingHorizontal: T.s(4),
    paddingVertical: T.s(3),
    marginBottom: T.s(4),
    gap: T.s(2),
  },
  errorText: {
    ...type.body,
    color: T.color.error,
    flex: 1,
  },
  errorDismiss: {
    flexShrink: 0,
  },
  upgradeBanner: {
    backgroundColor: T.color.elevated,
    borderWidth: 0.5,
    borderColor: T.color.warning,
    paddingHorizontal: T.s(4),
    paddingVertical: T.s(3),
    marginBottom: T.s(4),
  },
  upgradeText: {
    ...type.body,
    color: T.color.warning,
  },
  scanningState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: T.s(4),
  },
  scanningLabel: {
    ...type.body,
    color: T.color.secondary,
  },
  frameGuide: {
    aspectRatio: 4 / 5,
    marginBottom: T.s(6),
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0.5,
    borderColor: T.color.hairline,
    position: 'relative',
  },
  frameLabel: {
    ...type.ui,
    fontSize: 10,
    color: T.color.tertiary,
  },
  frameSub: {
    ...type.caption,
    fontSize: 11,
    color: T.color.muted,
    marginTop: T.s(1),
  },
  frameTick: {
    position: 'absolute',
    width: 16,
    height: 16,
    opacity: 0.7,
  },
  frameTickTL: { top: 10, left: 10, borderTopWidth: 1, borderLeftWidth: 1, borderTopColor: T.color.hairlineStrong, borderLeftColor: T.color.hairlineStrong },
  frameTickTR: { top: 10, right: 10, borderTopWidth: 1, borderRightWidth: 1, borderTopColor: T.color.hairlineStrong, borderRightColor: T.color.hairlineStrong },
  frameTickBL: { bottom: 10, left: 10, borderBottomWidth: 1, borderLeftWidth: 1, borderBottomColor: T.color.hairlineStrong, borderLeftColor: T.color.hairlineStrong },
  frameTickBR: { bottom: 10, right: 10, borderBottomWidth: 1, borderRightWidth: 1, borderBottomColor: T.color.hairlineStrong, borderRightColor: T.color.hairlineStrong },
  actions: {
    marginTop: T.s(2),
  },
  actionGap: {
    height: T.s(3),
  },
  buttonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: T.s(2),
  },
  buttonLabel: {
    ...type.ui,
    color: T.color.canvas,
  },
  buttonLabelSecondary: {
    ...type.ui,
    color: T.color.primary,
  },
  hint: {
    ...type.caption,
    fontSize: 11,
    color: T.color.muted,
    textAlign: 'center',
    marginTop: T.s(5),
  },
});
