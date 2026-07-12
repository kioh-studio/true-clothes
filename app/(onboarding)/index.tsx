// Splash / Welcome screen
import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Pressable, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Photo } from '../../src/components/ui';
import { PrimaryButton, TextLink } from '../../src/components/ui';
import { T, type } from '../../src/design/tokens';
import { PHOTOS } from '../../src/data';
import { useTranslation } from '../../src/i18n';

export default function SplashScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(8)).current;
  const subtitleOpacity = useRef(new Animated.Value(0)).current;
  const ctaOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.delay(80),
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: 0, duration: 600, useNativeDriver: true }),
      ]),
      Animated.delay(200),
      Animated.timing(subtitleOpacity, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.delay(200),
      Animated.timing(ctaOpacity, { toValue: 1, duration: 600, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom + 32 }]}>
      {/* Top editorial image */}
      <View style={styles.imageArea}>
        <Photo src={PHOTOS.detail_1} label="EDITORIAL" tone={3} />
      </View>

      {/* Bottom brand area */}
      <View style={styles.brandArea}>
        <Animated.Image
          source={require('../../assets/logo/MIEN-wordmark.png')}
          style={[styles.brand, { opacity, transform: [{ translateY }] }]}
          resizeMode="contain"
          accessibilityRole="image"
          accessibilityLabel="MIEN"
        />
        <Animated.Text style={[styles.tagline, { opacity: subtitleOpacity }]}>
          {t('onboarding_welcome_tagline')}
        </Animated.Text>

        <View style={{ flex: 1, minHeight: 24, maxHeight: 96 }} />

        <Animated.View style={[styles.cta, { opacity: ctaOpacity }]}>
          <PrimaryButton onPress={() => router.push('/(onboarding)/account')}>
            {t('onboarding_welcome_begin')}
          </PrimaryButton>
          <View style={{ height: 16 }} />
          <View style={styles.signInRow}>
            <TextLink onPress={() => router.push('/(onboarding)/account')} color={T.color.primary}>
              {t('onboarding_welcome_signIn')}
            </TextLink>
          </View>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: T.color.canvas,
  },
  imageArea: {
    flex: 0,
    height: '55%',
  },
  brandArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    paddingTop: 48,
  },
  brand: {
    width: 220,
    height: 82,
    alignSelf: 'center',
  },
  tagline: {
    ...type.body,
    color: T.color.secondary,
    textAlign: 'center',
    marginTop: 14,
  },
  cta: {
    width: '100%',
  },
  signInRow: {
    alignItems: 'center',
  },
});
