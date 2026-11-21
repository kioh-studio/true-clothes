// Deterministic proportion-effect notes (backlog AL, 2026-11-06).
// DISPLAY-ONLY: explains the proportion effect the wearer gets from the outfit's
// actual items. Never a scoring/ranking input. Mirrors styling-tips.ts: pure,
// deterministic, both locales inline, max MAX_PROPORTION_NOTES.
// Missing item fields make a rule not fire (fail-closed), never throw.

import { FitItem } from './types.ts';
import { outfitTopBottomVolumes } from './scoring.ts';
import { outfitWaistDefinition } from './silhouette.ts';

export interface ProportionNote {
  key: string;
  en: string;
  vi: string;
}

export const MAX_PROPORTION_NOTES = 2;
// VOLUME scale (slim=1 … oversized=5): "fitted" = at most regular, "wide" = at least wide.
export const FITTED_MAX_VOLUME = 2;
export const WIDE_MIN_VOLUME = 4;

export function deriveProportionNotes(items: FitItem[], slots?: { top?: string; outwear?: string }): ProportionNote[] {
  const notes: ProportionNote[] = [];
  const isTopLike = (i: FitItem) => i.category === 'top' || i.category === 'onepiece';
  const outerSlotItem = slots?.outwear
    ? items.find(i => i.id === slots.outwear)
    : items.find(i => i.category === 'outwear');
  // Inner top: the item in the top slot when given, else the first top-like item that isn't the outer layer.
  const top = (slots?.top ? items.find(i => i.id === slots.top) : undefined)
    ?? items.find(i => isTopLike(i) && i.id !== outerSlotItem?.id);
  const bottom = items.find(i => i.category === 'bottom');
  const shoes = items.find(i => i.category === 'shoes');
  const colorOf = (i?: FitItem) => i?.colorProfile?.primaryColor;
  const sameTone = (a?: FitItem, b?: FitItem) => !!colorOf(a) && colorOf(a) === colorOf(b);

  const column = !!top && !!bottom && sameTone(top, bottom);
  if (column) {
    notes.push({
      key: 'column',
      en: 'Top and bottom in one tone make an unbroken vertical line — you read taller and leaner',
      vi: 'Áo và quần cùng tông tạo một đường dọc liền → trông cao và gọn hơn',
    });
  }

  if (!column && bottom && shoes && sameTone(bottom, shoes)) {
    notes.push({
      key: 'leg_line',
      en: 'Shoes in the same tone as the trousers extend the leg line — legs look longer',
      vi: 'Giày cùng tông quần nối dài đường chân → chân trông dài hơn',
    });
  }

  if (outerSlotItem && top && outerSlotItem.id !== top.id && colorOf(outerSlotItem) && colorOf(top) && !sameTone(outerSlotItem, top)) {
    notes.push({
      key: 'open_layer',
      en: 'The open layer frames two vertical lines — the torso looks longer and slimmer',
      vi: 'Áo khoác mở tạo hai đường dọc hai bên → thân trông dài và gọn hơn',
    });
  }

  if (outfitWaistDefinition(items)) {
    notes.push({
      key: 'waist',
      en: 'A defined waist sets the top–bottom proportion — the shape reads more structured',
      vi: 'Eo được nhấn rõ → tỉ lệ trên–dưới cân, dáng trông structure hơn',
    });
  }

  const volumes = outfitTopBottomVolumes(items);
  if (volumes) {
    const { topVolume, bottomVolume } = volumes;
    if (topVolume <= FITTED_MAX_VOLUME && bottomVolume >= WIDE_MIN_VOLUME) {
      notes.push({
        key: 'fitted_top_wide_leg',
        en: 'Fitted top over a wide leg — slimmer up top, longer through the leg',
        vi: 'Áo gọn trên quần ống rộng → phần trên thon, chân trông dài hơn',
      });
    }
    if (topVolume >= WIDE_MIN_VOLUME && bottomVolume <= FITTED_MAX_VOLUME) {
      notes.push({
        key: 'wide_top_slim_leg',
        en: 'Roomy top over a slim leg — broader shoulders, a leaner lower half',
        vi: 'Áo rộng trên quần gọn → vai trông rộng, phần dưới thon hơn',
      });
    }
  }

  if (outerSlotItem?.drape === 'structured') {
    notes.push({
      key: 'structured_shoulder',
      en: 'A structured shoulder squares the frame — a sharper, straighter line',
      vi: 'Vai áo có form → vai thẳng, dáng gọn gàng hơn',
    });
  }

  return notes.slice(0, MAX_PROPORTION_NOTES);
}
