// AI Try-On "Wear on you" screen (feature 009)
// Opened from outfit detail. Flow: upload a photo → validate (clear person?) →
// generate the user wearing the outfit → show result + fit score. Thin screen;
// all logic lives in useWearOnYou. Visual language follows the design artifact.
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Image, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { OUTFITS, itemById } from '../../src/data';
import { PrimaryButton, SecondaryButton, TextLink } from '../../src/components/ui';
import { IconX, IconImage } from '../../src/components/icons';
import { T, type } from '../../src/design/tokens';
import { useAppStore } from '../../src/stores/appStore';
import { useAuthStore } from '../../src/stores/authStore';
import { buildWearGarments } from '../../src/services/tryOnWearService';
import { useWearOnYou } from '../../src/features/try-on/useWearOnYou';
import type { WearGarment, WearFrame, WearProfile } from '../../src/types/tryOn';

// "DD/MM/YYYY" → age in years (best-effort; undefined when unparseable).
function ageFromDob(dob: string | undefined, now: Date): number | undefined {
  if (!dob) return undefined;
  const [d, m, y] = dob.split('/').map(Number);
  if (!y || !m || !d) return undefined;
  let age = now.getFullYear() - y;
  const beforeBirthday = now.getMonth() + 1 < m || (now.getMonth() + 1 === m && now.getDate() < d);
  if (beforeBirthday) age -= 1;
  return age > 0 && age < 120 ? age : undefined;
}

// Map body_* measurement keys → clean labels for the generator (excludes
// height/weight which are sent separately, and non-numeric/meta fields).
const MEASUREMENT_LABELS: Record<string, string> = {
  body_bust: 'chest', body_waist: 'waist', body_hip: 'hips',
  body_shoulder_width: 'shoulder_width', body_sleeve_length: 'sleeve_length',
  body_upper_body_length: 'upper_body_length', body_upper_arm: 'upper_arm',
  body_neck: 'neck', body_inseam: 'inseam', body_thigh: 'thigh',
  body_rise: 'rise', body_foot_length: 'foot_length', body_foot_width: 'foot_width',
};

export default function WearOnYouScreen() {
  const { id, data } = useLocalSearchParams<{ id: string; data?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const wardrobeItems = useAppStore(s => s.wardrobeItems);
  const measurements = useAuthStore(s => s.measurements);
  const gender = useAuthStore(s => s.gender);
  const dob = useAuthStore(s => s.dob);

  const outfit = useMemo(
    () => (data ? JSON.parse(data) : null) ?? OUTFITS.find(o => o.id === id) ?? OUTFITS[0],
    [data, id],
  );

  // The user's frame, from real measurements (cm/kg) — shown on the intro card.
  const frame: WearFrame = useMemo(() => ({
    height: measurements?.body_height ? `${measurements.body_height} cm` : undefined,
    weight: measurements?.body_weight ? `${measurements.body_weight} kg` : undefined,
  }), [measurements?.body_height, measurements?.body_weight]);

  // Detailed profile sent to the generator for accurate proportions & fit.
  const profile: WearProfile = useMemo(() => {
    const measurementsCm: Record<string, number> = {};
    if (measurements) {
      for (const [key, label] of Object.entries(MEASUREMENT_LABELS)) {
        const v = (measurements as Record<string, unknown>)[key];
        if (typeof v === 'number' && v > 0) measurementsCm[label] = v;
      }
    }
    return {
      gender: gender || undefined,
      age: ageFromDob(dob, new Date()),
      heightCm: measurements?.body_height,
      weightKg: measurements?.body_weight,
      bodyShape: measurements?.bodyShape,
      preferredFit: measurements?.preferredFit,
      measurementsCm: Object.keys(measurementsCm).length ? measurementsCm : undefined,
    };
  }, [measurements, gender, dob]);

  // Resolve garments (with signed image URLs) for the edge function. Async because
  // cloud items need signing; until ready, GENERATE is disabled.
  const [garments, setGarments] = useState<WearGarment[]>([]);
  // Tracks whether garment resolution has finished, so the "no items" notice only
  // shows after the async resolve completes (never flashes while it's still loading).
  const [garmentsReady, setGarmentsReady] = useState(false);
  useEffect(() => {
    let cancelled = false;
    setGarmentsReady(false);
    const byId = new Map(wardrobeItems.map(w => [w.id, w]));
    const sources = (outfit.itemIds as string[]).map((iid) => {
      const w = byId.get(iid);
      if (w) return { type: w.type, category: w.category, name: w.name, primaryColor: w.primaryColor, colors: w.colors, material: w.material, fit: w.fit, photoStorage: w.photoStorage, photoPath: w.photoPath };
      const m = itemById(iid);
      return m ? { type: m.type, name: m.name, primaryColor: m.color, material: m.material, fit: m.fit, photoStorage: 'none' as const, photoPath: null } : null;
    }).filter(Boolean) as Parameters<typeof buildWearGarments>[0];
    buildWearGarments(sources).then((g) => { if (!cancelled) { setGarments(g); setGarmentsReady(true); } });
    return () => { cancelled = true; };
  }, [outfit.itemIds, wardrobeItems]);

  // No garment in this outfit resolved to a wardrobe item → WEAR ON would stay
  // greyed out with no explanation. Surface a clear reason instead.
  const noGarments = garmentsReady && garments.length === 0;

  const w = useWearOnYou({
    garments,
    profile,
    context: { title: outfit.title, style: outfit.style, occasion: outfit.context },
  });

  const itemCount = (outfit.itemIds as string[]).length;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Nav */}
      <View style={styles.nav}>
        <Pressable onPress={() => router.back()} style={styles.iconBtn}>
          <IconX size={20} color={T.color.primary} strokeWidth={1.4} />
        </Pressable>
        <Text style={styles.navTitle}>AI TRY-ON</Text>
        <View style={styles.iconBtn} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}>
        <View style={styles.body}>
          {/* ── Header copy (hidden on result for a cleaner reveal) ── */}
          {w.phase !== 'result' && (
            <>
              <Text style={styles.label}>SEE IT ON YOU</Text>
              <View style={{ height: 8 }} />
              <Text style={styles.h2}>{outfit.title}</Text>
              <Text style={[type.caption, { marginTop: 12 }]}>
                Tải lên ảnh của bạn, chúng tôi sẽ ghép bộ trang phục này lên người bạn theo số đo thật.
              </Text>
              <View style={{ height: 24 }} />
            </>
          )}

          {/* ── Your frame ── */}
          {w.phase !== 'result' && (
            <View style={styles.card}>
              <Text style={styles.label}>YOUR FRAME</Text>
              <View style={{ height: 12 }} />
              <View style={{ flexDirection: 'row', gap: 16 }}>
                {[
                  { label: 'HEIGHT', value: frame.height ?? '—' },
                  { label: 'WEIGHT', value: frame.weight ?? '—' },
                  { label: 'ITEMS', value: String(itemCount) },
                ].map(s => (
                  <View key={s.label} style={{ flex: 1 }}>
                    <Text style={styles.miniLabel}>{s.label}</Text>
                    <Text style={styles.frameValue}>{s.value}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          <View style={{ height: 20 }} />

          {/* ── Photo zone (state-dependent) ── */}
          <View style={styles.photoZone}>
            {w.photoUri ? (
              <Image source={{ uri: w.result?.localImageUri ?? w.photoUri }} style={styles.photo} resizeMode="cover" />
            ) : (
              <View style={styles.photoEmpty}>
                <IconImage size={32} color={T.color.tertiary} strokeWidth={1.2} />
                <Text style={[type.caption, { marginTop: 12, color: T.color.tertiary, textAlign: 'center' }]}>
                  Ảnh rõ mặt, thấy phần thân trên,{'\n'}chỉ một mình bạn trong khung hình.
                </Text>
              </View>
            )}

            {/* Overlays */}
            {(w.phase === 'validating' || w.phase === 'rendering') && (
              <View style={styles.overlay}>
                <ActivityIndicator color={T.color.canvas} />
                <Text style={styles.overlayText}>
                  {w.phase === 'validating' ? 'ĐANG KIỂM TRA ẢNH…' : 'ĐANG TẠO ẢNH THỬ ĐỒ…'}
                </Text>
              </View>
            )}
            {w.phase === 'result' && (
              <View style={styles.resultBadge}>
                <Text style={styles.resultBadgeText}>AI · {outfit.title}</Text>
              </View>
            )}
          </View>

          {/* ── Invalid reason ── */}
          {w.phase === 'invalid' && (
            <View style={styles.notice}>
              <Text style={styles.noticeText}>{w.reason}</Text>
            </View>
          )}

          {/* ── Result title ── */}
          {w.phase === 'result' && w.result && (
            <>
              <View style={{ height: 16 }} />
              <Text style={styles.h2}>{outfit.title} on you.</Text>
            </>
          )}

          {/* ── Generation error ── */}
          {w.phase === 'error' && (
            <View style={styles.notice}>
              <Text style={styles.noticeText}>{w.errorMsg}</Text>
            </View>
          )}

          {/* ── Credit blocked ── */}
          {w.creditBlocked && (
            <View style={styles.notice}>
              <Text style={styles.noticeText}>
                Bạn đã dùng hết lượt thử đồ miễn phí tháng này. Nâng cấp Premium để thử không giới hạn.
              </Text>
            </View>
          )}

          {/* ── No wardrobe items resolved for this outfit ── */}
          {noGarments && w.phase !== 'result' && (
            <View style={styles.notice}>
              <Text style={styles.noticeText}>
                Không tìm thấy món đồ nào trong tủ cho bộ này. Hãy thêm đồ vào tủ rồi thử lại.
              </Text>
            </View>
          )}

          <View style={{ height: 28 }} />

          {/* ── Actions (state machine) ── */}
          {(w.phase === 'upload' || w.phase === 'invalid') && (
            <>
              <PrimaryButton onPress={w.pickFromCamera}>CHỤP ẢNH</PrimaryButton>
              <View style={{ height: 12 }} />
              <SecondaryButton onPress={w.pickFromLibrary}>CHỌN TỪ THƯ VIỆN</SecondaryButton>
            </>
          )}

          {w.phase === 'validating' && (
            <PrimaryButton disabled>ĐANG KIỂM TRA…</PrimaryButton>
          )}

          {w.phase === 'ready' && (
            <>
              <PrimaryButton onPress={w.generate} disabled={garments.length === 0 || w.creditBlocked}>WEAR ON</PrimaryButton>
              <View style={{ height: 12 }} />
              <SecondaryButton onPress={w.pickAnother}>CHỌN ẢNH KHÁC</SecondaryButton>
              <View style={{ height: 12 }} />
              <Text style={[type.caption, { fontSize: 11, color: T.color.tertiary, textAlign: 'center' }]}>
                Mất ~10 giây. Ảnh của bạn không được lưu lên máy chủ.
              </Text>
            </>
          )}

          {w.phase === 'rendering' && (
            <PrimaryButton disabled>ĐANG TẠO ẢNH…</PrimaryButton>
          )}

          {(w.phase === 'result' || w.phase === 'error') && (
            <>
              <PrimaryButton onPress={w.regenerate} disabled={w.creditBlocked}>TẠO LẠI</PrimaryButton>
              <View style={{ height: 12 }} />
              <SecondaryButton onPress={w.pickAnother}>THỬ ẢNH KHÁC</SecondaryButton>
              <View style={{ height: 16 }} />
              <View style={{ alignItems: 'center' }}>
                <TextLink onPress={() => router.back()} color={T.color.tertiary}>Xong</TextLink>
              </View>
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: T.color.canvas },
  nav: { height: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 },
  navTitle: { ...type.ui, fontSize: 10, color: T.color.tertiary },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  body: { paddingHorizontal: 24 },
  label: { ...type.ui, fontSize: 10, color: T.color.tertiary },
  miniLabel: { ...type.ui, fontSize: 9, color: T.color.tertiary },
  h2: { ...type.h2, color: T.color.primary },
  card: { borderWidth: 0.5, borderColor: T.color.hairline, padding: 20 },
  frameValue: { fontFamily: T.font.serif, fontSize: 18, color: T.color.primary, marginTop: 4 },
  photoZone: {
    width: '100%', aspectRatio: 3 / 4, backgroundColor: T.color.elevated,
    borderWidth: 0.5, borderColor: T.color.hairline, overflow: 'hidden',
    position: 'relative', alignItems: 'center', justifyContent: 'center',
  },
  photo: { width: '100%', height: '100%' },
  photoEmpty: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  overlay: {
    ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(26,24,21,0.55)',
    alignItems: 'center', justifyContent: 'center', gap: 14,
  },
  overlayText: { ...type.ui, fontSize: 10, color: T.color.canvas },
  resultBadge: {
    position: 'absolute', top: 12, left: 12, backgroundColor: T.color.canvas,
    paddingVertical: 4, paddingHorizontal: 8,
  },
  resultBadgeText: { ...type.ui, fontSize: 9, color: T.color.primary },
  notice: { marginTop: 16, borderWidth: 0.5, borderColor: T.color.hairline, padding: 16, backgroundColor: T.color.elevated },
  noticeText: { ...type.caption, color: T.color.secondary },
});
