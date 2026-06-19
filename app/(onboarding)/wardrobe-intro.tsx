import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { T, type } from '../../src/design/tokens';
import { PrimaryButton, TextLink } from '../../src/components/ui';
import { useAuthStore } from '../../src/stores/authStore';

const STEPS = [
  { n: '01', label: 'SNAP A PHOTO' },
  { n: '02', label: 'WE EXTRACT DETAILS' },
  { n: '03', label: 'OUTFITS APPEAR' },
];

export default function WardrobeIntroScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { completeOnboarding } = useAuthStore();
  const [show, setShow] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setShow(true), 80);
    return () => clearTimeout(t);
  }, []);

  return (
    <View style={[styles.container, { paddingTop: insets.top, opacity: show ? 1 : 0 }]}>
      {/* Illustration block */}
      <View style={styles.illustrationBlock}>
        <View style={styles.illustrationInner}>
          <Svg width={240} height={180} viewBox="0 0 240 180">
            {[0, 1, 2].map((i) => (
              <React.Fragment key={i}>
                <Path
                  d={`M${40 + i * 80 + 40} ${18 + 30}a3 3 0 11.5-5.9c2 .5 2.5 2 2.5 4v3L${40 + i * 80 + 18} ${36 + 30}h44L${40 + i * 80 + 48} ${18.5 + 30}`}
                  stroke={T.color.tertiary}
                  strokeOpacity={0.35}
                  strokeWidth={1}
                  strokeLinecap="round"
                  fill="none"
                />
                <Rect
                  x={40 + i * 80 + 22}
                  y={42 + 30}
                  width={36}
                  height={60}
                  fill={T.color.hairline}
                  opacity={0.5}
                />
              </React.Fragment>
            ))}
          </Svg>
          <Text style={styles.illustrationLabel}>YOUR CLOSET · EMPTY</Text>
        </View>
      </View>

      {/* Content */}
      <View style={[styles.content, { paddingBottom: insets.bottom + 32 }]}>
        <Text style={styles.h1}>Your wardrobe.</Text>
        <Text style={styles.body}>
          Add what you already own. We'll build outfits from real pieces — not generic suggestions.
        </Text>

        <View style={{ height: 24 }} />
        <View style={styles.stepsRow}>
          {STEPS.map((s) => (
            <View key={s.n} style={styles.step}>
              <Text style={styles.stepNum}>{s.n}</Text>
              <View style={{ height: 8 }} />
              <Text style={styles.stepLabel}>{s.label}</Text>
            </View>
          ))}
        </View>

        <View style={{ flex: 1, minHeight: 32 }} />
        <PrimaryButton onPress={async () => { await completeOnboarding(); router.push('/add-item' as any); }}>
          ADD FIRST ITEM
        </PrimaryButton>
        <View style={{ height: 16 }} />
        <View style={{ alignItems: 'center' }}>
          <TextLink onPress={async () => { await completeOnboarding(); router.replace('/(tabs)'); }} color={T.color.tertiary} arrow>
            Skip for now
          </TextLink>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: T.color.canvas,
  },
  illustrationBlock: {
    height: '46%',
    padding: 24,
    paddingBottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  illustrationInner: {
    flex: 1,
    width: '100%',
    backgroundColor: T.color.elevated,
    borderWidth: 0.5,
    borderColor: T.color.hairline,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  illustrationLabel: {
    ...type.micro,
    color: T.color.tertiary,
    position: 'absolute',
    bottom: 16,
    right: 16,
  },
  content: {
    flex: 1,
    padding: 32,
    paddingTop: 40,
  },
  h1: {
    ...type.h1,
    color: T.color.primary,
  },
  body: {
    ...type.bodyL,
    color: T.color.secondary,
    marginTop: 16,
  },
  stepsRow: {
    flexDirection: 'row',
    gap: 24,
    paddingVertical: 16,
  },
  step: {
    flex: 1,
  },
  stepNum: {
    fontFamily: T.font.serif,
    fontSize: 22,
    fontWeight: '300',
    color: T.color.primary,
    lineHeight: 22,
  },
  stepLabel: {
    ...type.micro,
    color: T.color.tertiary,
    lineHeight: 14,
  },
});
