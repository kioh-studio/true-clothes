// AddWizard.tsx — Full-screen wizard shell for "Add to Wardrobe".
// Owns: header, Stepper, step router, MethodChooser overlay.
// Calls useAddWizard() once; passes slices down as props to each step.

import React, { useEffect, useState } from 'react';
import {
  View, Text, Pressable, StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { T, type } from '../../../design/tokens';
import { IconX } from '../../../components/icons';
import { useAddWizard } from '../useAddWizard';
import { Stepper } from './Stepper';
import { MethodChooser } from './MethodChooser';
import { UploadStep } from './UploadStep';
import { ProcessingStep } from './ProcessingStep';
import { ReviewStep } from './ReviewStep';
import { DoneStep } from './DoneStep';
import type { ExtractedItem, ExtractMethod } from '../types';

interface Props {
  onClose: () => void;
  onDone?: () => void;
}

export function AddWizard({ onClose, onDone }: Props) {
  const insets = useSafeAreaInsets();
  const wizard = useAddWizard();
  const [chooserVisible, setChooserVisible] = useState(false);

  // Auto-open MethodChooser on first mount when there are no photos
  useEffect(() => {
    if (wizard.photos.length === 0) {
      setChooserVisible(true);
    }
    // Only run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAddPhoto = (uri: string, method: ExtractMethod) => {
    wizard.addPhoto(uri, method);
  };

  const handleViewWardrobe = () => {
    if (onDone) {
      onDone();
    } else {
      onClose();
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        {/* left spacer / back affordance (hidden after step 0) */}
        <View style={styles.headerBtn} />
        <Text style={styles.headerTitle}>ADD TO WARDROBE</Text>
        <Pressable onPress={onClose} style={styles.headerBtn} hitSlop={8}>
          <IconX size={18} strokeWidth={1.4} color={T.color.tertiary} />
        </Pressable>
      </View>

      {/* Stepper */}
      <View style={styles.stepperWrap}>
        <Stepper step={wizard.step} />
      </View>

      {/* Step body */}
      {wizard.step === 'upload' && (
        <UploadStep
          photos={wizard.photos}
          upgrade={wizard.upgrade}
          error={wizard.error}
          onSetNote={wizard.setNote}
          onRemovePhoto={wizard.removePhoto}
          onAddPhoto={() => setChooserVisible(true)}
          onAnalyse={wizard.analyse}
        />
      )}

      {wizard.step === 'analyse' && (
        <ProcessingStep
          photos={wizard.photos}
          processingIndex={wizard.processingIndex}
        />
      )}

      {wizard.step === 'review' && (
        <ReviewStep
          items={wizard.items}
          photos={wizard.photos}
          onEditItem={(id, patch: Partial<ExtractedItem>) => wizard.editItem(id, patch)}
          onRemoveItem={wizard.removeItem}
          onConfirm={wizard.confirm}
          saving={wizard.saving}
          error={wizard.error}
        />
      )}

      {wizard.step === 'done' && (
        <DoneStep
          savedCount={wizard.savedCount}
          photoCount={wizard.photoCount}
          onViewWardrobe={handleViewWardrobe}
          onDone={onClose}
        />
      )}

      {/* Method chooser overlay */}
      <MethodChooser
        visible={chooserVisible}
        dismissable={wizard.photos.length > 0}
        onAddPhoto={handleAddPhoto}
        onClose={() => setChooserVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: T.color.canvas,
  },
  header: {
    flexShrink: 0,
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  headerTitle: {
    ...type.ui,
    fontSize: 11,
    color: T.color.primary,
  },
  headerBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperWrap: {
    flexShrink: 0,
    paddingHorizontal: 24,
    paddingBottom: 18,
    paddingTop: 4,
  },
});
