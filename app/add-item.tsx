// add-item.tsx — "Add to Wardrobe" wizard screen (feature 006).
// Renders AddWizard full-screen. The old manual single-item form is available
// within the wizard itself (Upload step → edit a blank extracted item in Review).
//
// Manual-add fallback: users can still add items manually by tapping ADD A PHOTO →
// selecting any image → confirming zero-extraction (if AI fails) and manually filling
// all fields in the Review ItemCard before confirming.

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { AddWizard } from '../src/features/wardrobe-add/components/AddWizard';

export default function AddItemScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <AddWizard
        onClose={() => router.back()}
        onDone={() => router.replace('/(tabs)/wardrobe' as any)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
