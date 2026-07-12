import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { T, type } from '../src/design/tokens';
import { BottomSheet, Photo } from '../src/components/ui';
import { IconChevronLeft, IconCalendar, IconPlus, IconBookmark } from '../src/components/icons';
import { useAppStore, OutfitSnapshot } from '../src/stores/appStore';
import { Outfit } from '../src/data';
import { useFitFeed } from '../src/features/feed/useFitFeed';
import { useGridCardWidth } from '../src/design/layout';
import i18n, { useTranslation } from '../src/i18n';

// Mock/demo forecast copy — cycles regardless of the actual scheduled day;
// real weather integration is a future enhancement (see CLAUDE.md feature flags).
const FORECAST_KEYS = [
  'schedule_forecast1', 'schedule_forecast2', 'schedule_forecast3',
  'schedule_forecast4', 'schedule_forecast5', 'schedule_forecast6', 'schedule_forecast7',
];

function fmtKey(d: Date) {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}
function fmtMonth(d: Date) {
  const locale = i18n.language?.startsWith('vi') ? 'vi-VN' : 'en';
  return d.toLocaleDateString(locale, { month: 'short' }).toUpperCase();
}
function fmtWeekday(d: Date) {
  const locale = i18n.language?.startsWith('vi') ? 'vi-VN' : 'en';
  return d.toLocaleDateString(locale, { weekday: 'short' }).toUpperCase();
}

function scorePercent(outfit: Outfit): number | null {
  if (!outfit.scores) return null;
  return Math.round(outfit.scores.totalScore * 100);
}

function DayCard({
  date, weather, snapshot, isToday, onPlan, onOpen, onSwap, onClear,
}: {
  date: Date; weather: string; snapshot: OutfitSnapshot | null;
  isToday: boolean;
  onPlan: () => void; onOpen: () => void;
  onSwap: () => void; onClear: () => void;
}) {
  const { t } = useTranslation();
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
            <Text style={styles.todayBadgeText}>{t('schedule_todayBadge')}</Text>
          </View>
        )}
      </View>

      {/* Content */}
      <View style={{ flex: 1 }}>
        <View style={styles.weatherRow}>
          <Text style={styles.weatherText}>{weather}</Text>
        </View>
        {snapshot ? (
          <View style={styles.outfitRow}>
            <Pressable onPress={onOpen} style={styles.outfitThumb}>
              <Photo src={snapshot.imageUri} label={snapshot.title} tone={1} />
            </Pressable>
            <View style={styles.outfitInfo}>
              <Pressable onPress={onOpen}>
                {snapshot.styleTag ? (
                  <Text style={styles.outfitStyle}>{snapshot.styleTag}</Text>
                ) : null}
                <Text style={styles.outfitTitle} numberOfLines={2}>{snapshot.title}</Text>
              </Pressable>
              <View style={styles.outfitActions}>
                <Pressable onPress={onSwap} style={styles.textBtn}>
                  <Text style={styles.textBtnPrimary}>{t('schedule_swap')}</Text>
                </Pressable>
                <Pressable onPress={onClear} style={styles.textBtn}>
                  <Text style={styles.textBtnMuted}>{t('schedule_clear')}</Text>
                </Pressable>
              </View>
            </View>
          </View>
        ) : (
          <Pressable onPress={onPlan} style={styles.emptySlot}>
            <View style={styles.emptySlotIcon}>
              <IconPlus size={14} color={T.color.tertiary} strokeWidth={1.4} />
            </View>
            <Text style={styles.emptySlotText}>{t('schedule_planOutfit')}</Text>
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
  const CARD_W = useGridCardWidth();
  const { t } = useTranslation();
  // Surface saved outfits first, then engine-generated ones
  const ordered = [
    ...outfits.filter((o) => savedIds.includes(o.id)),
    ...outfits.filter((o) => !savedIds.includes(o.id)),
  ];

  return (
    <BottomSheet open={open} onClose={onClose} maxHeight="80%">
      <View style={styles.pickerHeader}>
        <Text style={styles.pickerTitle}>{t('schedule_pickerTitle')}</Text>
        <Text style={styles.pickerSub}>
          {savedIds.length > 0 ? t('schedule_pickerSubtitleSaved') : t('schedule_pickerSubtitleRanked')}
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
              {o.scores && scorePercent(o) !== null && (
                <Text style={styles.pickerOutfitScore}>{t('schedule_matchPercent', { percent: scorePercent(o) })}</Text>
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
  const { t } = useTranslation();
  const {
    savedSet,
    scheduleMap, setScheduleOutfit, clearScheduleOutfit,
    scheduledOutfits, setScheduledOutfit, clearScheduledOutfit,
  } = useAppStore();
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

  const filledCount = days.filter((d) => scheduledOutfits[fmtKey(d)]).length;

  // Engine outfit map — used only for the picker sheet display, not for
  // resolving already-scheduled days (those use the durable snapshot).
  const outfitMap = new Map(engineOutfits.map(o => [o.id, o]));

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.iconBtn}>
          <IconChevronLeft size={20} color={T.color.primary} strokeWidth={1.4} />
        </Pressable>
        <Text style={styles.headerTitle}>{t('schedule_title')}</Text>
        <Pressable onPress={() => setWeekOffset(0)} style={styles.iconBtn}>
          <IconCalendar size={20} color={T.color.primary} strokeWidth={1.4} />
        </Pressable>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.h1}>{t('schedule_heading')}</Text>
        <Text style={styles.caption}>{t('schedule_subtitle')}</Text>

        {/* Week pager */}
        <View style={styles.weekPager}>
          <Pressable onPress={() => setWeekOffset((o) => o - 1)}>
            <Text style={styles.weekBtn}>{t('schedule_prevWeek')}</Text>
          </Pressable>
          <Text style={styles.weekRange}>
            {fmtMonth(days[0])} {days[0].getDate()} – {fmtMonth(days[6])} {days[6].getDate()}
          </Text>
          <Pressable onPress={() => setWeekOffset((o) => o + 1)}>
            <Text style={styles.weekBtn}>{t('schedule_nextWeek')}</Text>
          </Pressable>
        </View>

        <Text style={styles.plannedCount}>{t('schedule_plannedCount', { count: filledCount })}</Text>

        <View style={styles.dayList}>
          {days.map((d, i) => {
            const k = fmtKey(d);
            // Render from the durable snapshot — survives feed regeneration.
            const snapshot = scheduledOutfits[k] ?? null;
            // Resolve the live outfit for the "open" action (navigate to detail).
            // Use the snapshot id as the route param so detail screen can decode it.
            const snapshotId = snapshot?.id ?? scheduleMap[k];
            return (
              <DayCard
                key={k}
                date={d}
                weather={t(FORECAST_KEYS[i])}
                snapshot={snapshot}
                isToday={fmtKey(d) === fmtKey(today)}
                onPlan={() => setPickerFor(k)}
                onOpen={() => {
                  if (!snapshotId) return;
                  // Generated outfits (gen_…) aren't in the static OUTFITS list —
                  // the detail screen needs the full outfit serialized as `data`
                  // or it renders "Outfit not found". Static/demo outfits resolve
                  // by id alone, so omit data when we don't have a live match
                  // (e.g. the feed regenerated since this day was scheduled).
                  const live = outfitMap.get(snapshotId);
                  router.push(live
                    ? { pathname: '/outfit/[id]', params: { id: snapshotId, data: JSON.stringify(live) } }
                    : `/outfit/${snapshotId}`);
                }}
                onSwap={() => setPickerFor(k)}
                onClear={() => {
                  clearScheduleOutfit(k);
                  clearScheduledOutfit(k);
                }}
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
          if (pickerFor) {
            // Persist the id in scheduleMap to keep scheduledSet badge in sync.
            setScheduleOutfit(pickerFor, id);
            // Also capture a durable snapshot so the day survives feed reload.
            const picked = outfitMap.get(id);
            const snapshot: OutfitSnapshot = {
              id,
              title:    picked?.title    ?? t('schedule_outfitFallback'),
              imageUri: picked?.img      ?? undefined,
              styleTag: picked?.style    ?? undefined,
            };
            setScheduledOutfit(pickerFor, snapshot);
          }
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
