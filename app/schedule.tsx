import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { T, type } from '../src/design/tokens';
import { BottomSheet, Photo } from '../src/components/ui';
import { IconChevronLeft, IconCalendar, IconPlus, IconBookmark } from '../src/components/icons';
import { useAppStore } from '../src/stores/appStore';
import { Outfit } from '../src/data';
import { useFitFeed } from '../src/features/feed/useFitFeed';

const { width: W } = Dimensions.get('window');
const CARD_W = (W - 24 * 2 - 12) / 2;

const FORECASTS = [
  '24°C · clear', '22°C · partly cloudy', '26°C · sun',
  '19°C · overcast', '28°C · humid', '21°C · breeze', '23°C · sun',
];

function fmtKey(d: Date) {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}
function fmtMonth(d: Date) {
  return d.toLocaleDateString('en', { month: 'short' }).toUpperCase();
}
function fmtWeekday(d: Date) {
  return d.toLocaleDateString('en', { weekday: 'short' }).toUpperCase();
}

function scorePercent(outfit: Outfit): string {
  if (!outfit.scores) return '';
  return `${Math.round(outfit.scores.totalScore * 100)}%`;
}

function DayCard({
  date, weather, outfit, isToday, onPlan, onOpen, onSwap, onClear,
}: {
  date: Date; weather: string; outfit: Outfit | null;
  isToday: boolean;
  onPlan: () => void; onOpen: () => void;
  onSwap: () => void; onClear: () => void;
}) {
  return (
    <View style={[styles.dayCard, isToday && styles.dayCardToday]}>
      {/* Date column */}
      <View style={[styles.dateCol, isToday && styles.dateColToday]}>
        <Text style={[styles.weekday, { color: isToday ? T.color.primary : T.color.tertiary }]}>
          {fmtWeekday(date)}
        </Text>
        <Text style={styles.dayNum}>{String(date.getDate()).padStart(2, '0')}</Text>
        <Text style={styles.monthLbl}>{fmtMonth(date)}</Text>
        {isToday && (
          <View style={styles.todayBadge}>
            <Text style={styles.todayBadgeText}>TODAY</Text>
          </View>
        )}
      </View>

      {/* Content */}
      <View style={{ flex: 1 }}>
        <View style={styles.weatherRow}>
          <Text style={styles.weatherText}>{weather}</Text>
        </View>
        {outfit ? (
          <View style={styles.outfitRow}>
            <Pressable onPress={onOpen} style={styles.outfitThumb}>
              <Photo src={outfit.img} label={outfit.title} tone={outfit.tone} />
            </Pressable>
            <View style={styles.outfitInfo}>
              <Pressable onPress={onOpen}>
                <Text style={styles.outfitStyle}>{outfit.style}</Text>
                <Text style={styles.outfitTitle} numberOfLines={2}>{outfit.title}</Text>
                {outfit.scores && (
                  <Text style={styles.outfitScore}>MATCH {scorePercent(outfit)}</Text>
                )}
              </Pressable>
              <View style={styles.outfitActions}>
                <Pressable onPress={onSwap} style={styles.textBtn}>
                  <Text style={styles.textBtnPrimary}>SWAP</Text>
                </Pressable>
                <Pressable onPress={onClear} style={styles.textBtn}>
                  <Text style={styles.textBtnMuted}>CLEAR</Text>
                </Pressable>
              </View>
            </View>
          </View>
        ) : (
          <Pressable onPress={onPlan} style={styles.emptySlot}>
            <View style={styles.emptySlotIcon}>
              <IconPlus size={14} color={T.color.tertiary} strokeWidth={1.4} />
            </View>
            <Text style={styles.emptySlotText}>PLAN OUTFIT</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

function OutfitPickerSheet({
  open, onClose, outfits, savedIds, onPick,
}: {
  open: boolean; onClose: () => void;
  outfits: Outfit[]; savedIds: string[];
  onPick: (id: string) => void;
}) {
  // Surface saved outfits first, then engine-generated ones
  const ordered = [
    ...outfits.filter((o) => savedIds.includes(o.id)),
    ...outfits.filter((o) => !savedIds.includes(o.id)),
  ];

  return (
    <BottomSheet open={open} onClose={onClose} maxHeight="80%">
      <View style={styles.pickerHeader}>
        <Text style={styles.pickerTitle}>Pick an outfit</Text>
        <Text style={styles.pickerSub}>
          {savedIds.length > 0 ? 'Saved outfits surface first.' : 'Ranked by your style, fit & color preferences.'}
        </Text>
      </View>
      <ScrollView contentContainerStyle={styles.pickerGrid} showsVerticalScrollIndicator={false}>
        {ordered.map((o) => (
          <Pressable
            key={o.id}
            onPress={() => onPick(o.id)}
            style={[styles.pickerCard, { width: CARD_W }]}
          >
            <View style={StyleSheet.absoluteFillObject}>
              <Photo src={o.img} label={o.title} tone={o.tone} />
            </View>
            <View style={styles.pickerGradient} />
            <View style={styles.pickerLabel}>
              <Text style={styles.pickerOutfitStyle}>{o.style}</Text>
              <Text style={styles.pickerOutfitTitle} numberOfLines={1}>{o.title}</Text>
              {o.scores && (
                <Text style={styles.pickerOutfitScore}>{scorePercent(o)} MATCH</Text>
              )}
            </View>
            {savedIds.includes(o.id) && (
              <View style={styles.savedBadge}>
                <IconBookmark size={11} color={T.color.primary} strokeWidth={1.4} filled />
              </View>
            )}
          </Pressable>
        ))}
      </ScrollView>
    </BottomSheet>
  );
}

export default function ScheduleOutfitsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { savedSet, scheduleMap, setScheduleOutfit, clearScheduleOutfit } = useAppStore();
  const { outfits: engineOutfits } = useFitFeed();
  const [weekOffset, setWeekOffset] = useState(0);

  const today = new Date();
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7) + weekOffset * 7);
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });

  const [pickerFor, setPickerFor] = useState<string | null>(null);

  const filledCount = days.filter((d) => scheduleMap[fmtKey(d)]).length;

  // Build lookup: all available outfits (engine-generated)
  const outfitMap = new Map(engineOutfits.map(o => [o.id, o]));

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.iconBtn}>
          <IconChevronLeft size={20} color={T.color.primary} strokeWidth={1.4} />
        </Pressable>
        <Text style={styles.headerTitle}>Schedule</Text>
        <Pressable onPress={() => setWeekOffset(0)} style={styles.iconBtn}>
          <IconCalendar size={20} color={T.color.primary} strokeWidth={1.4} />
        </Pressable>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.h1}>This week.</Text>
        <Text style={styles.caption}>Plan ahead — we'll surface each day's outfit in the morning.</Text>

        {/* Week pager */}
        <View style={styles.weekPager}>
          <Pressable onPress={() => setWeekOffset((o) => o - 1)}>
            <Text style={styles.weekBtn}>← PREV WEEK</Text>
          </Pressable>
          <Text style={styles.weekRange}>
            {fmtMonth(days[0])} {days[0].getDate()} – {fmtMonth(days[6])} {days[6].getDate()}
          </Text>
          <Pressable onPress={() => setWeekOffset((o) => o + 1)}>
            <Text style={styles.weekBtn}>NEXT WEEK →</Text>
          </Pressable>
        </View>

        <Text style={styles.plannedCount}>{filledCount} / 7 PLANNED</Text>

        <View style={styles.dayList}>
          {days.map((d, i) => {
            const k = fmtKey(d);
            const outfitId = scheduleMap[k];
            const outfit = outfitId ? outfitMap.get(outfitId) ?? null : null;
            return (
              <DayCard
                key={k}
                date={d}
                weather={FORECASTS[i]}
                outfit={outfit}
                isToday={fmtKey(d) === fmtKey(today)}
                onPlan={() => setPickerFor(k)}
                onOpen={() => outfit && router.push(`/outfit/${outfit.id}`)}
                onSwap={() => setPickerFor(k)}
                onClear={() => clearScheduleOutfit(k)}
              />
            );
          })}
        </View>
      </ScrollView>

      <OutfitPickerSheet
        open={!!pickerFor}
        onClose={() => setPickerFor(null)}
        outfits={engineOutfits}
        savedIds={[...savedSet]}
        onPick={(id) => {
          if (pickerFor) setScheduleOutfit(pickerFor, id);
          setPickerFor(null);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: T.color.canvas },
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  headerTitle: { ...type.h3, color: T.color.primary },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  content: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 32 },
  h1: { ...type.h1, color: T.color.primary },
  caption: { ...type.caption, marginTop: 12 },
  weekPager: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 28,
    marginBottom: 24,
  },
  weekBtn: { ...type.ui, fontSize: 10, color: T.color.primary },
  weekRange: { ...type.ui, fontSize: 10, color: T.color.tertiary },
  plannedCount: { ...type.ui, fontSize: 10, color: T.color.tertiary, marginBottom: 12 },
  dayList: { gap: 12 },

  // Day card
  dayCard: {
    flexDirection: 'row',
    borderWidth: 0.5,
    borderColor: T.color.hairline,
    minHeight: 120,
  },
  dayCardToday: { borderColor: T.color.primary },
  dateCol: {
    width: 84,
    borderRightWidth: 0.5,
    borderRightColor: T.color.hairline,
    padding: 16,
    paddingRight: 12,
    alignItems: 'flex-start',
  },
  dateColToday: { backgroundColor: T.color.elevated },
  weekday: { ...type.ui, fontSize: 9 },
  dayNum: {
    fontFamily: T.font.serif,
    fontSize: 32,
    fontWeight: '300',
    color: T.color.primary,
    marginTop: 4,
    lineHeight: 34,
  },
  monthLbl: { ...type.ui, fontSize: 9, color: T.color.tertiary, marginTop: 4 },
  todayBadge: {
    marginTop: 12,
    borderWidth: 0.5,
    borderColor: T.color.primary,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  todayBadgeText: { ...type.ui, fontSize: 9, color: T.color.primary },
  weatherRow: {
    borderBottomWidth: 0.5,
    borderBottomColor: T.color.hairline,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  weatherText: { ...type.caption, fontSize: 11, color: T.color.tertiary },
  outfitRow: { flex: 1, flexDirection: 'row' },
  outfitThumb: {
    width: 76,
    borderRightWidth: 0.5,
    borderRightColor: T.color.hairline,
    backgroundColor: T.color.elevated,
    overflow: 'hidden',
  },
  outfitInfo: {
    flex: 1,
    padding: 10,
    paddingLeft: 14,
    justifyContent: 'space-between',
  },
  outfitStyle: { ...type.ui, fontSize: 9, color: T.color.tertiary },
  outfitTitle: {
    fontFamily: T.font.serif,
    fontSize: 16,
    fontWeight: '400',
    color: T.color.primary,
    marginTop: 4,
    lineHeight: 19,
  },
  outfitScore: { ...type.ui, fontSize: 9, color: T.color.tertiary, marginTop: 4 },
  outfitActions: { flexDirection: 'row', gap: 12 },
  textBtn: { paddingVertical: 4 },
  textBtnPrimary: {
    ...type.ui,
    fontSize: 10,
    color: T.color.primary,
    textDecorationLine: 'underline',
  },
  textBtnMuted: {
    ...type.ui,
    fontSize: 10,
    color: T.color.tertiary,
    textDecorationLine: 'underline',
  },
  emptySlot: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
  },
  emptySlotIcon: {
    width: 28,
    height: 28,
    borderWidth: 0.5,
    borderColor: T.color.hairlineStrong,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptySlotText: { ...type.ui, fontSize: 10, color: T.color.tertiary },

  // Picker sheet
  pickerHeader: { padding: 24, paddingBottom: 0 },
  pickerTitle: { ...type.h2, color: T.color.primary },
  pickerSub: { ...type.caption, marginTop: 8 },
  pickerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    padding: 24,
  },
  pickerCard: {
    aspectRatio: 3 / 4,
    overflow: 'hidden',
    borderWidth: 0.5,
    borderColor: T.color.hairline,
    position: 'relative',
  },
  pickerGradient: {
    position: 'absolute',
    left: 0, right: 0, bottom: 0,
    height: '40%',
    backgroundColor: 'rgba(26,24,21,0.5)',
  },
  pickerLabel: { position: 'absolute', left: 10, right: 10, bottom: 10 },
  pickerOutfitStyle: { ...type.ui, fontSize: 9, color: 'rgba(242,237,228,0.85)' },
  pickerOutfitTitle: {
    fontFamily: T.font.serif,
    fontSize: 14,
    color: T.color.canvas,
    marginTop: 4,
    lineHeight: 17,
  },
  pickerOutfitScore: {
    ...type.ui,
    fontSize: 9,
    color: 'rgba(242,237,228,0.7)',
    marginTop: 2,
  },
  savedBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(250,247,242,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
