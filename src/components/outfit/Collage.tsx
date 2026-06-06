import React from 'react';
import { View, Image, StyleSheet, Text } from 'react-native';
import { itemById, Outfit } from '../../data';
import { T } from '../../design/tokens';

// ─── Item role classification ────────────────────────────────────────────────
// Anchors: the tall/long bottom item that defines the outfit's scale
const ANCHOR_PRIORITY = ['DRESS', 'OVERCOAT', 'COAT', 'TROUSERS', 'JEANS', 'CHINOS', 'SKIRT', 'SHORTS', 'BLAZER'];
const OUTER_TOPS = new Set(['JACKET', 'BLAZER', 'COAT', 'OVERCOAT']);
const INNER_TOPS = new Set(['TEE', 'SHIRT', 'KNIT', 'POLO']);
const ACCESSORY_TYPES = new Set([
  'LOAFERS', 'SNEAKERS', 'BAG', 'WATCH', 'NECKLACE', 'SUNGLASSES',
  'BELT', 'SCARF', 'RING', 'BRACELET', 'HAT', 'CAP',
]);

// Natural width/height ratios — < 1 = taller than wide
const ASPECT: Record<string, number> = {
  JEANS: 0.54,  TROUSERS: 0.50, CHINOS: 0.54, SHORTS: 0.80, SKIRT: 0.68,
  DRESS: 0.44,  OVERCOAT: 0.50, COAT: 0.50,
  TEE: 0.86,    SHIRT: 0.82,    KNIT: 0.88,   POLO: 0.84,
  BLAZER: 0.80, JACKET: 0.82,
  LOAFERS: 1.35, SNEAKERS: 1.55, BELT: 2.8,
  BAG: 0.95,    WATCH: 1.0,     NECKLACE: 0.85,
  SUNGLASSES: 1.9, SCARF: 1.6,  CAP: 1.25,    HAT: 1.2,
};

// ─── Zone definitions (% of the items-area View) ────────────────────────────
//
// Layout rule:
//   ANCHOR      → left column  (0–42 %)   tallest, largest
//   SECONDARIES → right column (44–98 %)  stacked vertically within anchor height
//   ACCESSORIES → bottom strip (80–100%)  full width, below everything
//
type Zone = { left: number; top: number; maxW: number; maxH: number };

const ANCHOR_ZONE: Zone = { left: 2, top: 0, maxW: 40, maxH: 78 };

// Secondary zones keyed by total count of secondaries (1–4)
const SEC_ZONES: Record<number, Zone[]> = {
  1: [
    { left: 44, top: 0,  maxW: 52, maxH: 76 },
  ],
  2: [
    { left: 44, top: 0,  maxW: 52, maxH: 37 },
    { left: 44, top: 40, maxW: 52, maxH: 37 },
  ],
  3: [
    { left: 44, top: 0,  maxW: 52, maxH: 24 },
    { left: 44, top: 27, maxW: 52, maxH: 24 },
    { left: 44, top: 54, maxW: 52, maxH: 24 },
  ],
  4: [
    { left: 44, top: 0,  maxW: 26, maxH: 37 },
    { left: 71, top: 0,  maxW: 26, maxH: 37 },
    { left: 44, top: 40, maxW: 26, maxH: 37 },
    { left: 71, top: 40, maxW: 26, maxH: 37 },
  ],
};

// Accessory zones keyed by count (1–3)
const ACC_ZONES: Record<number, Zone[]> = {
  1: [
    { left: 30, top: 80, maxW: 40, maxH: 20 },
  ],
  2: [
    { left: 5,  top: 80, maxW: 36, maxH: 20 },
    { left: 59, top: 80, maxW: 36, maxH: 20 },
  ],
  3: [
    { left: 2,  top: 80, maxW: 28, maxH: 20 },
    { left: 36, top: 80, maxW: 28, maxH: 20 },
    { left: 70, top: 80, maxW: 28, maxH: 20 },
  ],
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
function fitInZone(zone: Zone, aspect: number) {
  let w = zone.maxW;
  let h = w / aspect;
  if (h > zone.maxH) {
    h = zone.maxH;
    w = h * aspect;
  }
  // Center within the zone
  const left = zone.left + (zone.maxW - w) / 2;
  const top  = zone.top  + (zone.maxH - h) / 2;
  return { left, top, w, h };
}

function resolveRoles(items: NonNullable<ReturnType<typeof itemById>>[]) {
  let anchor: (typeof items)[0] | undefined;
  for (const t of ANCHOR_PRIORITY) {
    anchor = items.find(i => i.type === t);
    if (anchor) break;
  }
  if (!anchor) anchor = items.find(i => !ACCESSORY_TYPES.has(i.type)) ?? items[0];

  const accessories = items.filter(i => ACCESSORY_TYPES.has(i.type));
  const rest = items.filter(i => i !== anchor && !ACCESSORY_TYPES.has(i.type));
  const secondaries = [
    ...rest.filter(i => OUTER_TOPS.has(i.type)),
    ...rest.filter(i => INNER_TOPS.has(i.type)),
    ...rest.filter(i => !OUTER_TOPS.has(i.type) && !INNER_TOPS.has(i.type)),
  ];
  return { anchor, secondaries, accessories };
}

type Slot = { left: number; top: number; w: number; h: number; z: number };
type PositionedItem = NonNullable<ReturnType<typeof itemById>> & { slot: Slot };

function buildLayout(rawItems: ReturnType<typeof itemById>[]): PositionedItem[] {
  const items = (rawItems.filter(Boolean) as NonNullable<ReturnType<typeof itemById>>[])
    .filter(i => i.png);
  const { anchor, secondaries, accessories } = resolveRoles(items);
  const out: PositionedItem[] = [];

  if (anchor) {
    const fit = fitInZone(ANCHOR_ZONE, ASPECT[anchor.type] ?? 0.58);
    out.push({ ...anchor, slot: { ...fit, z: 1 } });
  }

  const secCount = Math.min(secondaries.length, 4) as 1 | 2 | 3 | 4;
  const secZones = SEC_ZONES[secCount] ?? SEC_ZONES[1];
  secondaries.slice(0, 4).forEach((item, i) => {
    const zone = secZones[i];
    if (!zone) return;
    const fit = fitInZone(zone, ASPECT[item.type] ?? 0.85);
    out.push({ ...item, slot: { ...fit, z: 2 + i } });
  });

  const accCount = Math.min(accessories.length, 3) as 1 | 2 | 3;
  const accZones = ACC_ZONES[accCount] ?? ACC_ZONES[1];
  accessories.slice(0, 3).forEach((item, i) => {
    const zone = accZones[i];
    if (!zone) return;
    const fit = fitInZone(zone, ASPECT[item.type] ?? 1.3);
    out.push({ ...item, slot: { ...fit, z: 6 + i } });
  });

  return out;
}

// ─── Component ───────────────────────────────────────────────────────────────
interface CollageProps {
  outfit: Outfit;
  showTitle?: boolean;
  bg?: string;
  compact?: boolean;
  titleTop?: number;
  containerHeight?: number;
}

export function OutfitCollage({
  outfit,
  showTitle = true,
  bg = T.color.canvas,
  compact = false,
  titleTop,
  containerHeight = 400,
}: CollageProps) {
  const items = outfit.itemIds.map(itemById);
  const positioned = buildLayout(items);
  const titleY = titleTop != null ? titleTop : (compact ? 16 : 24);
  const titleBlockH = compact ? 52 : 72;
  const itemsTop = showTitle ? titleY + titleBlockH : 0;

  return (
    <View style={[styles.container, { backgroundColor: bg, height: containerHeight }]}>
      {showTitle && (
        <View style={[styles.titleBlock, { top: titleY }]} pointerEvents="none">
          <Text style={[styles.title, { fontSize: compact ? 20 : 24 }]}>
            {outfit.title.toUpperCase()}
          </Text>
          <Text style={[styles.subtitle, { fontSize: compact ? 12 : 14 }]}>
            {(outfit.subtitle || outfit.context).toLowerCase()}
          </Text>
        </View>
      )}

      {/* Items area: absolute from below title to near bottom */}
      <View style={[styles.itemsArea, { top: itemsTop }]}>
        {positioned.map(item => (
          <View
            key={item.id}
            style={{
              position: 'absolute',
              left:   `${item.slot.left}%` as `${number}%`,
              top:    `${item.slot.top}%`  as `${number}%`,
              width:  `${item.slot.w}%`    as `${number}%`,
              height: `${item.slot.h}%`    as `${number}%`,
              zIndex: item.slot.z,
            }}
          >
            <Image
              source={item.png}
              style={styles.itemImage}
              resizeMode="contain"
            />
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    overflow: 'hidden',
    position: 'relative',
  },
  titleBlock: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: 24,
    zIndex: 10,
  },
  title: {
    fontFamily: T.font.serif,
    fontWeight: '400',
    letterSpacing: 1.5,
    color: T.color.primary,
    textAlign: 'center',
    lineHeight: 28,
  },
  subtitle: {
    fontFamily: T.font.serif,
    fontWeight: '400',
    fontStyle: 'italic',
    color: T.color.secondary,
    marginTop: 8,
    textAlign: 'center',
  },
  itemsArea: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 8,
  },
  itemImage: {
    width: '100%',
    height: '100%',
  },
});
