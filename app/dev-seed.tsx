// DEV-ONLY screen — runs the local-photo seeder (see seedLocalPhotos.dev.ts).
// Navigate to /dev-seed in the app, tap "Seed local photos", then reopen the
// Wardrobe. Delete this file + seedLocalPhotos.dev.ts once you're done testing.

import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, ScrollView, ActivityIndicator, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { T, type } from '../src/design/tokens';
import {
  seedLocalPhotos, SEED_COUNT, type SeedProgress, type SeedResult,
} from '../src/features/wardrobe-photos/seedLocalPhotos.dev';
import { useTranslation } from '../src/i18n';

export default function DevSeedScreen() {
  const { t } = useTranslation();
  // DEV-ONLY GUARD. In a production/standalone build (__DEV__ === false) this
  // screen must be completely inert: running the seeder flips item photos back
  // to photo_storage='local', which reverts the Supabase cloud-image migration
  // and breaks dev/prod parity. The route is also excluded from the EAS build
  // archive via .easignore — this guard is defense-in-depth for any build that
  // still includes the file (e.g. preview/dev-client).
  if (!__DEV__) {
    return (
      <View style={[styles.container, { justifyContent: 'center' }]}>
        <Text style={styles.title}>{t('devSeed_unavailableTitle')}</Text>
        <Text style={styles.caption}>{t('devSeed_unavailableCaption')}</Text>
      </View>
    );
  }
  return <DevSeedInner />;
}

function DevSeedInner() {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<SeedProgress | null>(null);
  const [result, setResult] = useState<SeedResult | null>(null);

  const run = async () => {
    setRunning(true);
    setResult(null);
    setProgress({ done: 0, total: SEED_COUNT, last: '' });
    try {
      const res = await seedLocalPhotos(setProgress);
      setResult(res);
    } finally {
      setRunning(false);
    }
  };

  // Auto-run once on mount so opening /dev-seed (e.g. via deep link) triggers it.
  const ran = useRef(false);
  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={[styles.container, { paddingTop: insets.top + 24 }]}>
      <Text style={styles.title}>{t('devSeed_title')}</Text>
      <Text style={styles.caption}>
        {t('devSeed_caption', { count: SEED_COUNT })}
      </Text>

      <View style={{ height: 24 }} />
      <Pressable onPress={run} disabled={running} style={[styles.btn, running && { opacity: 0.5 }]}>
        {running
          ? <ActivityIndicator color={T.color.canvas} />
          : <Text style={styles.btnText}>{t('devSeed_seedButton')}</Text>}
      </Pressable>

      {progress && (
        // Dev-only debug readout — id fragment isn't user-facing copy, left untranslated.
        <Text style={styles.progress}>
          {progress.done} / {progress.total}{progress.last ? `  ·  ${progress.last.slice(0, 8)}` : ''}
        </Text>
      )}

      {result && (
        <ScrollView style={{ marginTop: 16 }} contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
          <Text style={styles.resultOk}>{t('devSeed_resultOk', { count: result.ok })}</Text>
          {result.failed.length > 0 && (
            <>
              <Text style={styles.resultFail}>{t('devSeed_resultFail', { count: result.failed.length })}</Text>
              {/* Dev-only debug output — raw backend error text, left untranslated. */}
              {result.failed.map(f => (
                <Text key={f.id} style={styles.failLine}>{f.id.slice(0, 8)} — {f.error}</Text>
              ))}
            </>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: T.color.canvas, paddingHorizontal: 24 },
  title: { fontFamily: T.font.serif, fontSize: 24, color: T.color.primary },
  caption: { ...type.caption, marginTop: 12, color: T.color.tertiary, lineHeight: 18 },
  btn: {
    height: 52, borderRadius: 2, backgroundColor: T.color.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  btnText: { ...type.ui, fontSize: 12, color: T.color.canvas, letterSpacing: 1 },
  progress: { ...type.ui, fontSize: 12, color: T.color.primary, marginTop: 16 },
  resultOk: { ...type.body, color: '#2E7D52', marginTop: 8 },
  resultFail: { ...type.body, color: '#B0413E', marginTop: 8 },
  failLine: { ...type.caption, fontSize: 11, color: T.color.tertiary, marginTop: 4 },
});
