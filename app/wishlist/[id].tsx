import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, Image, TextInput, Alert, ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { T, type } from '../../src/design/tokens';
import { IconChevronLeft } from '../../src/components/icons';
import { PrimaryButton, TextLink, Bounded } from '../../src/components/ui';
import { VerdictPanel } from '../../src/features/try-on/components/VerdictPanel';
import { useWishlistItem, useWishlistPhoto } from '../../src/features/wishlist/useWishlist';
import { parsePrice } from '../../src/features/wishlist/parsePrice';
import { useTranslation } from '../../src/i18n';

export default function WishlistItemScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { item, loading, refreshing, busy, error, delta, setPrice, skip, remove, markBought } = useWishlistItem(id);
  const uri = useWishlistPhoto(item?.photoPath ?? null);
  const [priceText, setPriceText] = useState<string | null>(null);

  const back = () => router.back();

  const commitPrice = () => {
    if (priceText === null) return;
    const p = parsePrice(priceText);
    if (p !== undefined) setPrice(p).catch(() => {});
  };

  const confirmRemove = () => {
    Alert.alert(t('wishlist_removeTitle'), undefined, [
      { text: t('common_cancel'), style: 'cancel' },
      { text: t('wishlist_remove'), style: 'destructive', onPress: async () => { if (await remove()) back(); } },
    ]);
  };

  const nav = (
    <View style={styles.nav}>
      <Pressable onPress={back} style={styles.iconBtn}>
        <IconChevronLeft size={20} color={T.color.primary} strokeWidth={1.4} />
      </Pressable>
    </View>
  );

  if (!item) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {nav}
        <View style={styles.center}>
          {loading ? <ActivityIndicator color={T.color.primary} /> : (
            <Text style={styles.caption}>{t('wishlist_notFound')}</Text>
          )}
        </View>
      </View>
    );
  }

  const m = item.metadata;
  const priceValue = priceText ?? (item.price != null ? String(item.price) : '');
  const isSkipped = item.status === 'skipped';

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {nav}
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 48 }} showsVerticalScrollIndicator={false}>
        <Bounded>
          <View style={styles.hero}>
            {uri ? <Image source={{ uri }} style={styles.img} resizeMode="contain" /> : null}
          </View>

          <View style={styles.body}>
            <Text style={styles.name}>{m.name || m.type}</Text>
            {m.brand ? <Text style={styles.brand}>{m.brand.toUpperCase()}</Text> : null}

            {refreshing ? (
              <View style={styles.row}>
                <ActivityIndicator size="small" color={T.color.primary} />
                <Text style={styles.caption}>{t('wishlist_rescoring')}</Text>
              </View>
            ) : null}
            {delta && delta.from !== delta.to ? (
              <Text style={styles.delta}>
                {t('wishlist_scoreDelta', {
                  from: delta.from == null ? '—' : Math.round(delta.from),
                  to: delta.to == null ? '—' : Math.round(delta.to),
                })}
              </Text>
            ) : null}

            {item.verdict ? <VerdictPanel verdict={item.verdict} /> : null}

            <Text style={styles.label}>{t('wishlist_priceLabel')}</Text>
            <TextInput
              value={priceValue}
              onChangeText={setPriceText}
              onBlur={commitPrice}
              onSubmitEditing={commitPrice}
              keyboardType="decimal-pad"
              placeholder={t('wishlist_pricePlaceholder')}
              placeholderTextColor={T.color.tertiary}
              style={styles.input}
            />

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <View style={{ height: 32 }} />
            <PrimaryButton
              onPress={async () => { if (await markBought()) router.replace('/(tabs)/wardrobe'); }}
              disabled={busy}
            >
              {busy ? t('wishlist_working') : t('wishlist_bought')}
            </PrimaryButton>
            <View style={styles.links}>
              {!isSkipped ? (
                <TextLink color={T.color.secondary} onPress={async () => { if (await skip()) back(); }}>
                  {t('wishlist_skip')}
                </TextLink>
              ) : null}
              <TextLink color={T.color.error} onPress={confirmRemove}>{t('wishlist_remove')}</TextLink>
            </View>
          </View>
        </Bounded>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: T.color.canvas },
  nav: { height: 56, justifyContent: 'center', paddingHorizontal: 16 },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  hero: {
    height: 360, alignItems: 'center', justifyContent: 'center',
    borderBottomWidth: 0.5, borderBottomColor: T.color.hairline,
  },
  img: { width: '100%', height: '100%' },
  body: { padding: 24 },
  name: { fontFamily: T.font.serif, fontSize: 28, fontWeight: '300', color: T.color.primary },
  brand: { ...type.ui, fontSize: 9, color: T.color.tertiary, marginTop: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 16 },
  caption: { ...type.caption, color: T.color.secondary },
  delta: { ...type.ui, fontSize: 11, color: T.color.primary, marginTop: 16 },
  label: { ...type.ui, fontSize: 10, color: T.color.tertiary, marginTop: 32 },
  input: {
    marginTop: 8, borderBottomWidth: 0.5, borderBottomColor: T.color.hairline,
    paddingVertical: 8, fontFamily: T.font.sans, fontSize: 16, color: T.color.primary,
  },
  error: { ...type.caption, color: T.color.error, marginTop: 16 },
  links: { flexDirection: 'row', justifyContent: 'center', gap: 32, marginTop: 24 },
});
