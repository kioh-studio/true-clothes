// DEV-ONLY screen — manual verification that Sentry crash reporting is wired
// up correctly once EXPO_PUBLIC_SENTRY_DSN is filled in (see .env / eas.json
// and the init block in app/_layout.tsx). Navigate to /dev-sentry-test, fire
// one of the buttons, then check the Sentry dashboard for the event.
// Not linked from any production UI; __DEV__-guarded and excluded from the
// EAS build archive (.easignore) as defense-in-depth, matching dev-seed.tsx.

import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { T, type } from '../src/design/tokens';
import { useTranslation } from '../src/i18n';

let Sentry: typeof import('@sentry/react-native') | null = null;
try { Sentry = require('@sentry/react-native'); } catch { /* not resolvable in this runtime */ }

export default function DevSentryTestScreen() {
  const { t } = useTranslation();

  // Same guard as dev-seed.tsx: completely inert outside a dev build.
  if (!__DEV__) {
    return (
      <View style={[styles.container, { justifyContent: 'center' }]}>
        <Text style={styles.title}>{t('devSeed_unavailableTitle')}</Text>
        <Text style={styles.caption}>{t('devSeed_unavailableCaption')}</Text>
      </View>
    );
  }
  return <DevSentryTestInner />;
}

function DevSentryTestInner() {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const dsnPresent = !!process.env['EXPO_PUBLIC_SENTRY_DSN'];
  const [lastAction, setLastAction] = React.useState<string | null>(null);

  const status = !Sentry
    ? t('devSentryTest_statusUnavailable')
    : dsnPresent
      ? t('devSentryTest_statusReady')
      : t('devSentryTest_statusNoDsn');

  const throwError = () => {
    setLastAction('throw');
    // Intentionally uncaught — verifies Sentry.wrap's error boundary + native
    // crash capture path end-to-end, the same way a real crash would surface.
    throw new Error('[dev-sentry-test] intentional test error');
  };

  const captureMessage = () => {
    setLastAction('message');
    if (!Sentry) return;
    Sentry.captureMessage('[dev-sentry-test] intentional test message', 'info');
  };

  const captureHandledException = () => {
    setLastAction('handled');
    if (!Sentry) return;
    try {
      throw new Error('[dev-sentry-test] intentional handled exception');
    } catch (err) {
      Sentry.captureException(err);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}>
      <Text style={styles.title}>{t('devSentryTest_title')}</Text>
      <Text style={styles.caption}>{status}</Text>

      <View style={{ height: 24 }} />
      <Pressable onPress={captureMessage} style={styles.btn}>
        <Text style={styles.btnText}>{t('devSentryTest_messageButton')}</Text>
      </Pressable>

      <View style={{ height: 12 }} />
      <Pressable onPress={captureHandledException} style={styles.btn}>
        <Text style={styles.btnText}>{t('devSentryTest_handledButton')}</Text>
      </Pressable>

      <View style={{ height: 12 }} />
      <Pressable onPress={throwError} style={[styles.btn, styles.btnDanger]}>
        <Text style={styles.btnText}>{t('devSentryTest_throwButton')}</Text>
      </Pressable>

      {lastAction && (
        // Dev-only debug readout — left untranslated.
        <Text style={styles.progress}>last action: {lastAction}</Text>
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
  btnDanger: { backgroundColor: '#B0413E' },
  btnText: { ...type.ui, fontSize: 12, color: T.color.canvas, letterSpacing: 1 },
  progress: { ...type.ui, fontSize: 12, color: T.color.primary, marginTop: 16 },
});
