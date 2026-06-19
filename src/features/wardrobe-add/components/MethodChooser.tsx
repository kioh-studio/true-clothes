// MethodChooser.tsx — Bottom-sheet two-phase chooser:
//   phase 1: method (Extract by AI [featured] | Extract by item [disabled/coming soon])
//   phase 2: source (camera | library)
// On photo pick, calls addPhoto(uri, method) for each selected image.

import React, { useState } from 'react';
import {
  View, Text, Pressable, StyleSheet, Modal,
  SafeAreaView, ScrollView,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { T, type } from '../../../design/tokens';
import { IconChevronLeft, IconChevronRight, IconCamera, IconImage, IconSparkle, IconDashedSquare, IconX } from '../../../components/icons';
import type { ExtractMethod } from '../types';
import { isExtractByItemAvailable } from '../../../services/extractByItemService';

type Phase = 'method' | 'source';

interface Props {
  visible: boolean;
  dismissable: boolean;
  onAddPhoto: (uri: string, method: ExtractMethod) => void;
  onClose: () => void;
}

export function MethodChooser({ visible, dismissable, onAddPhoto, onClose }: Props) {
  const [phase, setPhase] = useState<Phase>('method');
  const [method, setMethod] = useState<ExtractMethod>('ai');

  const reset = () => setPhase('method');

  const handleClose = () => { reset(); onClose(); };

  const pickMethod = (m: ExtractMethod) => {
    setMethod(m);
    setPhase('source');
  };

  const launchCamera = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') return;
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
      allowsEditing: false,
    });
    if (!result.canceled && result.assets[0]) {
      onAddPhoto(result.assets[0].uri, method);
      handleClose();
    }
  };

  const launchLibrary = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return;
    // multi-select supported on expo-image-picker v14+
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
      allowsMultipleSelection: true,
      selectionLimit: 10,
    });
    if (!result.canceled) {
      for (const asset of result.assets) {
        onAddPhoto(asset.uri, method);
      }
      handleClose();
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={dismissable ? handleClose : undefined}
    >
      <View style={styles.overlay}>
        {/* dim backdrop */}
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={dismissable ? handleClose : undefined}
        />

        <SafeAreaView style={styles.sheet}>
          {/* drag handle */}
          <View style={styles.handle} />

          {/* sheet header */}
          <View style={styles.headerRow}>
            {phase !== 'method' && (
              <Pressable onPress={() => setPhase('method')} hitSlop={12} style={styles.backBtn}>
                <IconChevronLeft size={18} strokeWidth={1.3} color={T.color.primary} />
              </Pressable>
            )}
            <Text style={styles.headerLabel}>
              {phase === 'method' ? 'ADD ANOTHER PHOTO' : (method === 'ai' ? 'EXTRACT BY AI' : 'EXTRACT BY ITEM')}
            </Text>
            {dismissable && (
              <Pressable onPress={handleClose} hitSlop={12} style={styles.closeBtn}>
                <IconX size={16} strokeWidth={1.4} color={T.color.tertiary} />
              </Pressable>
            )}
          </View>

          <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
            {phase === 'method' && (
              <>
                <Text style={styles.h3}>How should we read this photo?</Text>
                <Text style={styles.captionText}>
                  Pick a method for the photo you're about to add.
                </Text>
                <View style={{ height: 18 }} />

                {/* Extract by AI — featured */}
                <Pressable
                  onPress={() => pickMethod('ai')}
                  style={[styles.methodCard, styles.methodCardFeatured]}
                >
                  <View style={styles.methodCardTop}>
                    <IconSparkle size={22} strokeWidth={1.3} color={T.color.canvas} />
                    <View style={styles.aiBadge}>
                      <Text style={styles.aiBadgeText}>AI</Text>
                    </View>
                  </View>
                  <View style={{ height: 12 }} />
                  <Text style={[styles.methodTitle, { color: T.color.canvas }]}>Extract by AI</Text>
                  <Text style={styles.methodDescFeatured}>
                    Finds every piece in a full-outfit photo and fills in all the details.
                  </Text>
                  <View style={styles.methodMetaDividerFeatured} />
                  <Text style={styles.methodMetaFeatured}>Best for full looks</Text>
                </Pressable>

                <View style={{ height: 12 }} />

                {/* Extract by item — on-device (enabled when the native module is present) */}
                <Pressable
                  onPress={isExtractByItemAvailable ? () => pickMethod('item') : undefined}
                  disabled={!isExtractByItemAvailable}
                  style={[styles.methodCard, isExtractByItemAvailable ? styles.methodCardPlain : styles.methodCardDisabled]}
                >
                  <View style={styles.methodCardTop}>
                    <IconDashedSquare size={22} strokeWidth={1.3} color={T.color.primary} />
                    <View style={styles.freeBadge}>
                      <Text style={styles.freeBadgeText}>FREE</Text>
                    </View>
                  </View>
                  <View style={{ height: 12 }} />
                  <Text style={styles.methodTitle}>Extract by item</Text>
                  <Text style={styles.methodDesc}>
                    One item on a plain background, cut out and read on-device.
                  </Text>
                  <View style={styles.methodMetaDivider} />
                  <Text style={styles.methodMeta}>
                    {isExtractByItemAvailable ? 'On-device · Free' : 'On-device · Coming soon'}
                  </Text>
                </Pressable>
              </>
            )}

            {phase === 'source' && (
              <>
                <Text style={styles.h3}>Add a photo</Text>
                <Text style={styles.captionText}>
                  {method === 'ai'
                    ? 'Choose a full-outfit photo to analyse.'
                    : 'Choose a single-item photo on a plain background.'}
                </Text>
                <View style={{ height: 18 }} />

                <Pressable onPress={launchCamera} style={styles.sourceRow}>
                  <View style={styles.sourceIcon}>
                    <IconCamera size={22} strokeWidth={1.3} color={T.color.primary} />
                  </View>
                  <View style={styles.sourceText}>
                    <Text style={styles.sourceTitle}>Take a photo</Text>
                    <Text style={styles.sourceDesc}>Use your camera</Text>
                  </View>
                  <IconChevronRight
                    size={14}
                    strokeWidth={1.4}
                    color={T.color.tertiary}
                  />
                </Pressable>

                <View style={{ height: 10 }} />

                <Pressable onPress={launchLibrary} style={styles.sourceRow}>
                  <View style={styles.sourceIcon}>
                    <IconImage size={22} strokeWidth={1.3} color={T.color.primary} />
                  </View>
                  <View style={styles.sourceText}>
                    <Text style={styles.sourceTitle}>Choose from library</Text>
                    <Text style={styles.sourceDesc}>Pick one or more photos</Text>
                  </View>
                  <IconChevronRight
                    size={14}
                    strokeWidth={1.4}
                    color={T.color.tertiary}
                  />
                </Pressable>
              </>
            )}
            <View style={{ height: 32 }} />
          </ScrollView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: T.color.sheetDim,
  },
  sheet: {
    backgroundColor: T.color.canvas,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '86%',
    shadowColor: T.color.primary,
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.14,
    shadowRadius: 24,
    elevation: 16,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 999,
    backgroundColor: T.color.tertiary,
    opacity: 0.5,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 0,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 4,
    gap: 8,
  },
  backBtn: {
    width: 32,
    height: 32,
    marginLeft: -6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtn: {
    marginLeft: 'auto',
    padding: 4,
  },
  headerLabel: {
    ...type.ui,
    fontSize: 9,
    color: T.color.tertiary,
  },
  body: {
    paddingHorizontal: 24,
    paddingTop: 8,
  },
  h3: {
    fontFamily: T.font.serif,
    fontSize: 20,
    fontWeight: '400',
    color: T.color.primary,
    lineHeight: 24,
    marginBottom: 4,
  },
  captionText: {
    fontFamily: T.font.sans,
    fontSize: 12,
    color: T.color.tertiary,
    lineHeight: 18,
  },
  methodCard: {
    padding: 18,
    borderRadius: 2,
  },
  methodCardFeatured: {
    backgroundColor: T.color.accent,
    borderWidth: 0,
  },
  methodCardDisabled: {
    borderWidth: 0.5,
    borderColor: T.color.hairlineStrong,
    backgroundColor: 'transparent',
    opacity: 0.55,
  },
  methodCardPlain: {
    borderWidth: 0.5,
    borderColor: T.color.hairlineStrong,
    backgroundColor: 'transparent',
  },
  methodCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  aiBadge: {
    borderWidth: 0.5,
    borderColor: 'rgba(250,247,242,0.4)',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
  },
  aiBadgeText: {
    ...type.ui,
    fontSize: 9,
    color: T.color.canvas,
  },
  freeBadge: {
    backgroundColor: T.color.primary,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
  },
  freeBadgeText: {
    ...type.ui,
    fontSize: 9,
    color: T.color.canvas,
  },
  methodTitle: {
    fontFamily: T.font.serif,
    fontSize: 18,
    fontWeight: '400',
    color: T.color.primary,
  },
  methodDesc: {
    fontFamily: T.font.sans,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 5,
    color: T.color.secondary,
  },
  methodDescFeatured: {
    fontFamily: T.font.sans,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 5,
    color: 'rgba(250,247,242,0.7)',
  },
  methodMetaDivider: {
    marginTop: 10,
    borderTopWidth: 0.5,
    borderTopColor: T.color.hairline,
    paddingTop: 10,
  },
  methodMetaDividerFeatured: {
    marginTop: 10,
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(250,247,242,0.18)',
    paddingTop: 10,
  },
  methodMeta: {
    ...type.ui,
    fontSize: 9,
    color: T.color.tertiary,
  },
  methodMetaFeatured: {
    ...type.ui,
    fontSize: 9,
    color: 'rgba(250,247,242,0.6)',
  },
  sourceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 13,
    borderWidth: 0.5,
    borderColor: T.color.hairlineStrong,
    borderRadius: 2,
  },
  sourceIcon: {
    flexShrink: 0,
  },
  sourceText: {
    flex: 1,
    minWidth: 0,
  },
  sourceTitle: {
    fontFamily: T.font.serif,
    fontSize: 16,
    color: T.color.primary,
  },
  sourceDesc: {
    fontFamily: T.font.sans,
    fontSize: 12,
    color: T.color.tertiary,
    marginTop: 2,
  },
});
