// Location & weather — profile row destination. Thin: logic in useLocationWeather.
import React from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, Switch, TextInput, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { T, type } from '../src/design/tokens';
import { IconChevronLeft } from '../src/components/icons';
import { Bounded } from '../src/components/ui';
import { useLocationWeather } from '../src/features/location-weather/useLocationWeather';
import { formatTemp, toUnit, weatherExtras } from '../src/services/weatherService';
import { useTranslation } from '../src/i18n';

export default function LocationWeatherScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const w = useLocationWeather();
  const ctx = w.weatherContext;
  const extras = ctx ? weatherExtras(ctx) : null;
  const preview = ctx && extras
    ? [
        formatTemp(ctx.temperatureCelsius, w.unit),
        t(`locationWeather_band_${ctx.temperatureBand}`),
        extras.feelsLike !== undefined ? t('tabs_home_feelsLike', { temp: toUnit(extras.feelsLike, w.unit) }) : null,
        extras.rainPct !== undefined ? t('tabs_home_rain', { pct: extras.rainPct }) : null,
      ].filter(Boolean).join(' · ')
    : null;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.nav}>
        <Pressable onPress={() => router.back()} style={styles.navBtn}>
          <IconChevronLeft size={20} color={T.color.primary} strokeWidth={1.2} />
        </Pressable>
        <Text style={styles.navTitle}>{t('locationWeather_title')}</Text>
        <View style={styles.navBtn} />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 48 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Bounded>
        <Text style={styles.sectionLabel}>{t('locationWeather_currentLabel')}</Text>
        <View style={styles.section}>
          <View style={styles.row}>
            <Text style={[styles.rowTitle, { flex: 1 }]}>{w.label || t('locationWeather_notSet')}</Text>
          </View>
          <Pressable style={styles.row} onPress={w.useCurrent} disabled={w.detecting}>
            <Text style={[styles.rowTitle, { flex: 1 }]}>
              {w.detecting ? t('locationWeather_detecting') : t('locationWeather_useCurrent')}
            </Text>
            {w.detecting && <ActivityIndicator size="small" color={T.color.secondary} />}
          </Pressable>
        </View>
        {w.denied && (
          <View style={styles.note}>
            <Text style={styles.rowDesc}>{t('locationWeather_denied')}</Text>
            <Pressable onPress={w.openSettings} style={{ marginTop: 8 }}>
              <Text style={styles.link}>{t('locationWeather_openSettings')}</Text>
            </Pressable>
          </View>
        )}
        {w.error && <Text style={[styles.rowDesc, styles.note, styles.errorText]}>{t('locationWeather_error')}</Text>}

        <Text style={[styles.sectionLabel, { marginTop: 32 }]}>{t('locationWeather_searchLabel')}</Text>
        <View style={styles.section}>
          <TextInput
            style={styles.input}
            value={w.query}
            onChangeText={w.setQuery}
            placeholder={t('locationWeather_searchPlaceholder')}
            placeholderTextColor={T.color.tertiary}
            autoCorrect={false}
          />
          {w.searching && <ActivityIndicator size="small" color={T.color.secondary} style={{ marginVertical: 12 }} />}
          {w.results.map(c => (
            <Pressable key={`${c.latitude},${c.longitude}`} style={styles.row} onPress={() => w.selectCity(c)}>
              <Text style={[styles.rowTitle, { flex: 1 }]}>{c.label}</Text>
            </Pressable>
          ))}
          {!w.searching && w.query.trim().length >= 2 && w.results.length === 0 && (
            <Text style={[styles.rowDesc, { paddingVertical: 18 }]}>{t('locationWeather_noResults')}</Text>
          )}
        </View>

        <Text style={[styles.sectionLabel, { marginTop: 32 }]}>{t('locationWeather_weatherLabel')}</Text>
        <View style={styles.section}>
          <View style={styles.row}>
            <Text style={[styles.rowTitle, { flex: 1 }]}>{preview ?? t('locationWeather_weatherUnavailable')}</Text>
          </View>
          <View style={styles.row}>
            <View style={styles.rowBody}>
              <Text style={styles.rowTitle}>{t('locationWeather_toggleTitle')}</Text>
              <Text style={styles.rowDesc}>{t('locationWeather_toggleDesc')}</Text>
            </View>
            <Switch
              value={w.weatherAware}
              onValueChange={w.setWeatherAware}
              trackColor={{ false: T.color.muted, true: T.color.primary }}
              thumbColor={T.color.canvas}
            />
          </View>
        </View>

        <Text style={[type.caption, styles.footerNote]}>{t('locationWeather_footerNote')}</Text>
        </Bounded>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: T.color.canvas },
  nav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    height: 56,
    borderBottomWidth: 0.5,
    borderBottomColor: T.color.hairline,
  },
  navBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  navTitle: { fontFamily: T.font.serif, fontSize: 17, fontWeight: '400', color: T.color.primary },
  content: { paddingHorizontal: 24, paddingTop: 32 },
  sectionLabel: { ...type.ui, fontSize: 10, color: T.color.tertiary, marginBottom: 8 },
  section: { borderTopWidth: 0.5, borderTopColor: T.color.hairline },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 18,
    borderBottomWidth: 0.5,
    borderBottomColor: T.color.hairline,
    gap: 12,
  },
  rowBody: { flex: 1 },
  rowTitle: { fontFamily: T.font.serif, fontSize: 17, fontWeight: '400', color: T.color.primary },
  rowDesc: { ...type.caption, fontSize: 12, color: T.color.tertiary, marginTop: 2 },
  note: { marginTop: 12 },
  errorText: { color: '#A33' },
  link: { ...type.ui, fontSize: 12, color: T.color.primary, textDecorationLine: 'underline' },
  input: {
    fontFamily: T.font.serif,
    fontSize: 17,
    color: T.color.primary,
    paddingVertical: 18,
    borderBottomWidth: 0.5,
    borderBottomColor: T.color.hairline,
  },
  footerNote: { color: T.color.tertiary, marginTop: 24 },
});
