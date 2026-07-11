// Deterministic styling tips (Way to Wear — Phase B, 2026-07-03).
// Rule-derived from the outfit's actual items so tips render on the FEED card
// instantly and offline — no AI call. Phase A (AI-led, lazy on the detail
// screen) remains the richer layer on top.
//
// Contract: pure function, deterministic, max 2 tips, both locales inline so
// the client picks without another round trip.

import { FitItem } from './types.ts';

export interface StylingTip {
  key: string;
  en: string;
  vi: string;
}

const name = (i: FitItem) => i.typeName.charAt(0) + i.typeName.slice(1).toLowerCase();

export function deriveStylingTips(items: FitItem[], formula: string, slots?: { top?: string; outwear?: string }): StylingTip[] {
  const tips: StylingTip[] = [];
  const tops = items.filter(i => i.category === 'top');
  const top = tops[0];
  const bottom = items.find(i => i.category === 'bottom');
  const shoes = items.find(i => i.category === 'shoes');
  // The item occupying the outwear SLOT (may be a dual-role top): resolve via
  // slots when provided, else fall back to the outwear-category item.
  const outerSlotItem = slots?.outwear
    ? items.find(i => i.id === slots.outwear)
    : items.find(i => i.category === 'outwear');

  // 1. Dual-role layer worn open — the most distinctive move, always leads.
  if (outerSlotItem && outerSlotItem.category === 'top' && top && outerSlotItem.id !== top.id) {
    tips.push({
      key: 'layer_open',
      en: `Wear the ${name(outerSlotItem).toLowerCase()} open over the ${name(top).toLowerCase()}`,
      vi: `Khoác mở ${name(outerSlotItem).toLowerCase()} bên ngoài ${name(top).toLowerCase()}`,
    });
  }

  // 2. Tuck for a sharp register (dressy bottom under a tuckable top).
  const TUCKABLE = new Set(['SHIRT', 'TEE', 'BLOUSE', 'POLO', 'CAMISOLE']);
  if (top && bottom && TUCKABLE.has(top.typeName) && bottom.formality >= 3.5) {
    tips.push({
      key: 'tuck',
      en: 'Tuck the top in to sharpen the line',
      vi: 'Sơ vin để dáng gọn và chỉn chu hơn',
    });
  }

  // 3. Relaxed half-tuck for knits over denim.
  if (top && bottom && (top.typeName === 'KNIT' || top.typeName === 'SWEATER') && bottom.typeName === 'JEANS') {
    tips.push({
      key: 'half_tuck',
      en: 'A loose half-tuck keeps the knit effortless',
      vi: 'Sơ vin hờ nửa vạt cho chiếc len thêm tự nhiên',
    });
  }

  // 4. Roll shirt sleeves when the bottom is casual.
  if (top && bottom && top.typeName === 'SHIRT' && bottom.formality <= 2.5) {
    tips.push({
      key: 'sleeve_roll',
      en: 'Roll the sleeves to relax the shirt',
      vi: 'Xắn tay áo cho sơ mi bớt nghiêm',
    });
  }

  // 5. Cuff jeans to show off loafers/boots.
  if (bottom && shoes && bottom.typeName === 'JEANS' && (shoes.typeName === 'LOAFERS' || shoes.typeName === 'BOOTS')) {
    tips.push({
      key: 'cuff',
      en: 'Cuff the jeans once so the shoes read',
      vi: 'Gập gấu quần một lần để khoe form giày',
    });
  }

  // 6. Formula-specific voice.
  if (formula === 'monochrome') {
    tips.push({
      key: 'mono_texture',
      en: 'One tone — let the textures do the talking',
      vi: 'Một tông màu — để chất vải tự lên tiếng',
    });
  }
  if (formula === 'neutral_pop' || formula === 'one_two_three') {
    const hero = [...items].sort((a, b) => b.statementStrength - a.statementStrength)[0];
    if (hero && hero.statementStrength >= 1.5) {
      tips.push({
        key: 'one_statement',
        en: `Keep the rest quiet — the ${name(hero).toLowerCase()} is the statement`,
        vi: `Giữ phần còn lại tối giản — ${name(hero).toLowerCase()} là điểm nhấn`,
      });
    }
  }

  // 7. Match belt tone to leather shoes.
  const belt = items.find(i => i.typeName === 'BELT');
  if (belt && shoes && (shoes.fabricName === 'leather' || shoes.fabricName === 'suede')) {
    tips.push({
      key: 'belt_shoe',
      en: 'Match the belt to your shoe tone',
      vi: 'Chọn thắt lưng cùng tông với giày',
    });
  }

  return tips.slice(0, 2);
}
