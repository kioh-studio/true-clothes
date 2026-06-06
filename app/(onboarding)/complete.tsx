import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PrimaryButton, TextLink, Photo } from '../../src/components/ui';
import { T, type } from '../../src/design/tokens';
import { PHOTOS } from '../../src/data';
import { useAuthStore } from '../../src/stores/authStore';

export default function CompleteScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { completeOnboarding } = useAuthStore();
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(opacity, { toValue: 1, duration: 600, delay: 80, useNativeDriver: true }).start();
  }, []);

  return (
    <Animated.View style={[styles.container, { paddingTop: insets.top + 80, paddingBottom: insets.bottom + 48, opacity }]}>
      <View style={styles.center}>
        <View style={styles.imageBox}>
          <Photo src={PHOTOS.detail_2} label="DETAIL" tone={3} />
        </View>
        <View style={{ height: 48 }} />
        <Text style={styles.h1}>All set.</Text>
        <Text style={styles.body}>Your feed is waiting.</Text>
      </View>
      <View style={styles.actions}>
        <PrimaryButton onPress={async () => { await completeOnboarding(); router.replace('/(tabs)'); }}>ENTER</PrimaryButton>
        <View style={{ height: 24 }} />
        <View style={{ alignItems: 'center' }}>
          <TextLink onPress={async () => { await completeOnboarding(); router.push('/(onboarding)/wardrobe-intro' as any); }} color={T.color.primary} arrow>
            Add items to wardrobe first
          </TextLink>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1, backgroundColor: T.color.canvas,
    alignItems: 'center', paddingHorizontal: 40,
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  imageBox: { width: 200, height: 280, overflow: 'hidden' },
  h1: { ...type.h1, color: T.color.primary, textAlign: 'center', marginTop: 48 },
  body: { ...type.bodyL, color: T.color.secondary, marginTop: 16, textAlign: 'center', maxWidth: 280 },
  actions: { width: '100%' },
});
