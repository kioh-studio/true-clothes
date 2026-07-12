// Try On (feature 008) — T016
// Capture/pick UI: camera or library. Dispatches scan() → navigate to result on success.
// Thin screen — all logic delegated to useTryOn (Constitution II).

import React, { useEffect, useCallback, useRef } from 'react';
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
import { useAuthStore } from '../../../stores/authStore';
import { useFitEngineStore } from '../../../stores/fitEngineStore';
import { useTranslation } from '../../../i18n';

export function ScanScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useTranslation();
  const { status, error, needsUpgrade, scan, reset } = useTryOn();

  // Profile completeness drives the wardrobe-match quality. Surface a gentle
  // prompt before scanning so the user knows the result is only as good as the
  // measurements, styles and colours they've provided.
  const measurements = useAuthStore(s => s.measurements);
  const personalPalette = useAuthStore(s => s.personalPalette);
  const selectedStyles = useFitEngineStore(s => s.styleProfile.selectedStyles);

  const missing = {
    measurements: measurements?.body_height == null || measurements?.body_weight == null,
    styles: (selectedStyles?.length ?? 0) === 0,
    colours: (personalPalette?.length ?? 0) === 0,
  };
  const profileIncomplete = missing.measurements || missing.styles || missing.colours;
  // Route the CTA to the first missing section (most impactful first).
  const completeRoute = missing.measurements
    ? '/measurements-edit'
    : missing.styles
      ? '/styles-edit'
      : '/colors-edit';

  const isScanning = status === 'scanning';

  // Locale-aware "measurements, styles and preferred colours" joiner for the
  // profile-completeness prompt below — no Oxford comma before the final item,
  // matching English convention; Vietnamese just concatenates with "và".
  const missingParts = [
    missing.measurements && t('scanScreen_missingMeasurements'),
    missing.styles && t('scanScreen_missingStyles'),
    missing.colours && t('scanScreen_missingColours'),
  ].filter(Boolean) as string[];
  const missingList = missingParts.length <= 1
    ? missingParts.join('')
    : missingParts.slice(0, -1).join(', ') + t('scanScreen_missingListAnd') + missingParts[missingParts.length - 1];

  // Navigate to result once scan completes (status moves to 'evaluating').
  // ScanScreen stays MOUNTED underneath the pushed Result screen (a stack
  // push doesn't unmount it), so it keeps observing `status`. Result screen's
  // own RETRY / applyMeasurements flows call evaluate() again, which also
  // sets status to 'evaluating' — without a guard this effect would re-fire
  // and push a SECOND Result screen on top of the first, and popping one
  // triggers the other's cleanup (discard()), leaving the remaining Result
  // screen looking at a reset store. `pushedForThisScanRef` tracks whether
  // we already navigated for the CURRENT scan; it's only cleared when a new
  // scan actually starts ('scanning') or the store goes back to 'idle', so
  // it pushes exactly once per scan.
  const pushedForThisScanRef = useRef(false);
  useEffect(() => {
    if (status === 'scanning' || status === 'idle') {
      pushedForThisScanRef.current = false;
    } else if (status === 'evaluating' && !pushedForThisScanRef.current) {
      pushedForThisScanRef.current = true;
      router.push('/try-on/result');
    }
  }, [status, router]);

  const handlePickCamera = useCallback(async () => {
    const { status: permStatus } = await ImagePicker.requestCameraPermissionsAsync();
    if (permStatus !== 'granted') {
      Alert.alert(t('scanScreen_cameraPermTitle'), t('scanScreen_cameraPermMessage'));
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
      Alert.alert(t('scanScreen_libraryPermTitle'), t('scanScreen_libraryPermMessage'));
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
      {/* Close — pushed as a stack screen, so give an explicit way back.
          While scanning, this must cancel via reset() (bumps the scan's
          generation token) so the in-flight scan()'s eventual result is
          dropped instead of silently resurrecting a scan the user cancelled. */}
      <Pressable
        onPress={() => { if (isScanning) reset(); router.back(); }}
        hitSlop={8}
        style={styles.closeBtn}
      >
        <IconX size={20} strokeWidth={1.4} color={T.color.primary} />
      </Pressable>

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.eyebrow}>{t('scanScreen_eyebrow')}</Text>
        <Text style={styles.h1}>{t('scanScreen_title')}</Text>
        <Text style={styles.caption}>
          {t('scanScreen_caption')}
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
        <Pressable
          onPress={() => router.push('/paywall')}
          style={styles.upgradeBanner}
        >
          <Text style={styles.upgradeText}>
            {t('scanScreen_upgradeText')}
          </Text>
          <Text style={styles.upgradeLink}>{t('scanScreen_upgradeLink')}</Text>
        </Pressable>
      ) : null}

      {/* Scanning progress */}
      {isScanning ? (
        <View style={styles.scanningState}>
          <ActivityIndicator size="large" color={T.color.primary} />
          <Text style={styles.scanningLabel}>{t('scanScreen_analysing')}</Text>
        </View>
      ) : (
        <>
          {/* Profile-completeness prompt. A wardrobe match is only as accurate
              as the body, style and colour data we have to compare against, so
              nudge the user to fill the gaps before they scan. */}
          {profileIncomplete ? (
            <Pressable
              onPress={() => router.push(completeRoute)}
              style={styles.profileNote}
            >
              <Text style={styles.profileNoteText}>
                {t('scanScreen_profileNoteText', { list: missingList })}
              </Text>
              <Text style={styles.profileNoteLink}>{t('verdictPanel_completeProfileCta')}</Text>
            </Pressable>
          ) : null}

          {/* Framing guide — reinforce ONE item per scan (we evaluate the item
              you frame; multi-item picker is a future enhancement). */}
          <View style={styles.frameGuide}>
            <View style={[styles.frameTick, styles.frameTickTL]} />
            <View style={[styles.frameTick, styles.frameTickTR]} />
            <View style={[styles.frameTick, styles.frameTickBL]} />
            <View style={[styles.frameTick, styles.frameTickBR]} />
            <Text style={styles.frameLabel}>{t('scanScreen_frameLabel')}</Text>
            <Text style={styles.frameSub}>{t('scanScreen_frameSub')}</Text>
          </View>

          {/* Primary: Take photo */}
          <View style={styles.actions}>
            <PrimaryButton onPress={handlePickCamera} disabled={isScanning}>
              <View style={styles.buttonInner}>
                <IconCamera size={18} strokeWidth={1.4} color={T.color.canvas} />
                <Text style={styles.buttonLabel}>{t('scanScreen_takePhoto')}</Text>
              </View>
            </PrimaryButton>

            <View style={styles.actionGap} />

            {/* Secondary: Library */}
            <SecondaryButton onPress={handlePickLibrary} disabled={isScanning}>
              <View style={styles.buttonInner}>
                <IconImage size={18} strokeWidth={1.4} color={T.color.primary} />
                <Text style={styles.buttonLabelSecondary}>{t('scanScreen_chooseFromLibrary')}</Text>
              </View>
            </SecondaryButton>
          </View>

          {/* Hint */}
          <Text style={styles.hint}>
            {t('scanScreen_hint')}
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
  upgradeLink: {
    ...type.ui,
    fontSize: 10,
    color: T.color.warning,
    marginTop: T.s(2),
  },
  profileNote: {
    backgroundColor: T.color.elevated,
    borderWidth: 0.5,
    borderColor: T.color.hairline,
    paddingHorizontal: T.s(4),
    paddingVertical: T.s(3),
    marginBottom: T.s(5),
  },
  profileNoteText: {
    ...type.caption,
    color: T.color.secondary,
  },
  profileNoteLink: {
    ...type.ui,
    fontSize: 10,
    color: T.color.primary,
    marginTop: T.s(2),
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
