// Static archetype catalog for the Wardrobe Critic (feature 010).
// Each archetype is a foundational piece the critic may recommend: a synthetic
// row the engine can enrich exactly like a real item, style affinities, an
// owned-match definition (so we never recommend what the user already has),
// and MIEN-voice note templates ({count} is filled with the unlock count).
// Pure data — validated structurally in analyze.test.ts.

import { ClothingItemRow } from '../generate-outfits/engine/types.ts';

export interface GapArchetype {
  id: string;
  label: { en: string; vi: string };
  syntheticRow: ClothingItemRow;
  styleAffinity: string[]; // STYLE_CONFIGS ids
  ownedMatch: { type: string; colorFamily: string };
  noteTemplate: { en: string; vi: string };
  starter: boolean;
}

const row = (id: string, type: string, color: string, material?: string, fit?: string): ClothingItemRow => ({
  id: `hypo_${id}`, type, name: `${color} ${type.toLowerCase()}`, color,
  material, fit, pattern: 'solid',
});

const ALL_STYLES = ['oldmoney', 'minimalist', 'streetwear', 'smartcasual', 'preppy', 'athleisure', 'y2k', 'bohemian'];

export const ARCHETYPES: GapArchetype[] = [
  {
    id: 'white_shirt',
    label: { en: 'A crisp white shirt', vi: 'Một sơ mi trắng đứng dáng' },
    syntheticRow: row('white_shirt', 'SHIRT', 'White', 'Cotton', 'regular'),
    styleAffinity: ['oldmoney', 'minimalist', 'smartcasual', 'preppy'],
    ownedMatch: { type: 'SHIRT', colorFamily: 'whites' },
    noteTemplate: {
      en: 'The quietest piece in the room does the most work — it opens {count} new looks.',
      vi: 'Món lặng lẽ nhất lại gánh nhiều nhất — nó mở ra {count} look mới cho anh.',
    },
    starter: true,
  },
  {
    id: 'white_tee',
    label: { en: 'An essential white tee', vi: 'Một tee trắng nền tảng' },
    syntheticRow: row('white_tee', 'TEE', 'White', 'Cotton', 'regular'),
    styleAffinity: ALL_STYLES,
    ownedMatch: { type: 'TEE', colorFamily: 'whites' },
    noteTemplate: {
      en: 'Every wardrobe stands on a clean white tee — {count} looks are waiting on it.',
      vi: 'Tủ đồ nào cũng đứng trên một chiếc tee trắng sạch — {count} look đang chờ nó.',
    },
    starter: true,
  },
  {
    id: 'black_tee',
    label: { en: 'A clean black tee', vi: 'Một tee đen gọn gàng' },
    syntheticRow: row('black_tee', 'TEE', 'Black', 'Cotton', 'regular'),
    styleAffinity: ['minimalist', 'streetwear', 'athleisure', 'y2k', 'smartcasual'],
    ownedMatch: { type: 'TEE', colorFamily: 'blacks' },
    noteTemplate: {
      en: 'Black at the base lets everything above it speak — {count} new looks.',
      vi: 'Nền đen để mọi thứ bên trên tự lên tiếng — thêm {count} look mới.',
    },
    starter: false,
  },
  {
    id: 'gray_knit',
    label: { en: 'A fine gray knit', vi: 'Một áo len xám mảnh' },
    syntheticRow: row('gray_knit', 'KNIT', 'Grey', 'Wool', 'regular'),
    styleAffinity: ['oldmoney', 'minimalist', 'smartcasual', 'preppy'],
    ownedMatch: { type: 'KNIT', colorFamily: 'grays' },
    noteTemplate: {
      en: 'A knit carries the in-between days — {count} looks appear with it.',
      vi: 'Một chiếc len gánh những ngày lưng chừng — {count} look xuất hiện cùng nó.',
    },
    starter: false,
  },
  {
    id: 'navy_blazer',
    label: { en: 'A navy blazer', vi: 'Một blazer navy' },
    syntheticRow: row('navy_blazer', 'BLAZER', 'Navy', 'Wool', 'regular'),
    styleAffinity: ['oldmoney', 'smartcasual', 'preppy', 'minimalist'],
    ownedMatch: { type: 'BLAZER', colorFamily: 'blues' },
    noteTemplate: {
      en: 'One structured shoulder changes the register of everything under it — {count} looks unlocked.',
      vi: 'Một bờ vai có cấu trúc đổi hẳn đẳng cấp mọi thứ bên dưới — mở khóa {count} look.',
    },
    starter: false,
  },
  {
    id: 'dark_trousers',
    label: { en: 'Tailored dark trousers', vi: 'Một quần âu tối màu' },
    syntheticRow: row('dark_trousers', 'TROUSERS', 'Charcoal', 'Wool', 'regular'),
    styleAffinity: ['oldmoney', 'minimalist', 'smartcasual', 'preppy'],
    ownedMatch: { type: 'TROUSERS', colorFamily: 'blacks' },
    noteTemplate: {
      en: 'The anchor of a considered wardrobe — {count} looks stand on these.',
      vi: 'Chiếc neo của một tủ đồ có suy nghĩ — {count} look đứng trên nó.',
    },
    starter: true,
  },
  {
    id: 'dark_jeans',
    label: { en: 'Dark straight jeans', vi: 'Một jeans tối ống đứng' },
    syntheticRow: row('dark_jeans', 'JEANS', 'Indigo', 'Denim', 'regular'),
    styleAffinity: ALL_STYLES,
    ownedMatch: { type: 'JEANS', colorFamily: 'blues' },
    noteTemplate: {
      en: 'Dark denim moves between registers without asking — {count} new looks.',
      vi: 'Denim tối đi giữa các đẳng phục mà không cần xin phép — {count} look mới.',
    },
    starter: true,
  },
  {
    id: 'beige_chinos',
    label: { en: 'Beige chinos', vi: 'Một chinos be' },
    syntheticRow: row('beige_chinos', 'CHINOS', 'Beige', 'Cotton', 'regular'),
    styleAffinity: ['smartcasual', 'preppy', 'oldmoney', 'minimalist'],
    ownedMatch: { type: 'CHINOS', colorFamily: 'earths' },
    noteTemplate: {
      en: 'Warmth without effort — beige below opens {count} looks above.',
      vi: 'Ấm áp mà không gắng gượng — nền be mở ra {count} look phía trên.',
    },
    starter: false,
  },
  {
    id: 'dark_skirt',
    label: { en: 'A dark A-line skirt', vi: 'Một chân váy chữ A tối màu' },
    syntheticRow: row('dark_skirt', 'SKIRT', 'Black', 'Wool', 'regular'),
    styleAffinity: ['minimalist', 'smartcasual', 'oldmoney', 'y2k'],
    ownedMatch: { type: 'SKIRT', colorFamily: 'blacks' },
    noteTemplate: {
      en: 'A dark skirt is a second pair of trousers with better posture — {count} looks.',
      vi: 'Một chân váy tối là chiếc quần âu thứ hai với dáng đứng đẹp hơn — {count} look.',
    },
    starter: false,
  },
  {
    id: 'white_sneakers',
    label: { en: 'Clean white sneakers', vi: 'Một đôi sneakers trắng sạch' },
    syntheticRow: row('white_sneakers', 'SNEAKERS', 'White', 'Leather', 'regular'),
    styleAffinity: ALL_STYLES,
    ownedMatch: { type: 'SNEAKERS', colorFamily: 'whites' },
    noteTemplate: {
      en: 'White underfoot resets everything — {count} looks come alive.',
      vi: 'Một đôi trắng dưới chân làm mới tất cả — {count} look sống dậy.',
    },
    starter: true,
  },
  {
    id: 'dark_loafers',
    label: { en: 'Dark leather loafers', vi: 'Một đôi loafers da tối màu' },
    syntheticRow: row('dark_loafers', 'LOAFERS', 'Brown', 'Leather', 'regular'),
    styleAffinity: ['oldmoney', 'smartcasual', 'preppy', 'minimalist'],
    ownedMatch: { type: 'LOAFERS', colorFamily: 'earths' },
    noteTemplate: {
      en: 'Loafers finish a sentence sneakers can only start — {count} looks unlocked.',
      vi: 'Loafers kết câu mà sneakers chỉ mở đầu được — mở khóa {count} look.',
    },
    starter: false,
  },
  {
    id: 'black_boots',
    label: { en: 'Black leather boots', vi: 'Một đôi boots da đen' },
    syntheticRow: row('black_boots', 'BOOTS', 'Black', 'Leather', 'regular'),
    styleAffinity: ['minimalist', 'streetwear', 'smartcasual', 'bohemian', 'y2k'],
    ownedMatch: { type: 'BOOTS', colorFamily: 'blacks' },
    noteTemplate: {
      en: 'Boots give weight to quiet outfits — {count} looks gain ground.',
      vi: 'Boots cho những bộ đồ trầm một điểm tựa — thêm {count} look.',
    },
    starter: false,
  },
  {
    id: 'black_heels',
    label: { en: 'Black pointed heels', vi: 'Một đôi cao gót đen mũi nhọn' },
    syntheticRow: row('black_heels', 'HEELS', 'Black', 'Leather', 'slim'),
    styleAffinity: ['oldmoney', 'minimalist', 'smartcasual', 'y2k'],
    ownedMatch: { type: 'HEELS', colorFamily: 'blacks' },
    noteTemplate: {
      en: 'One pair of black heels turns daytime pieces into evenings — {count} looks.',
      vi: 'Một đôi gót đen biến đồ ban ngày thành buổi tối — {count} look.',
    },
    starter: false,
  },
  {
    id: 'camel_coat',
    label: { en: 'A camel coat', vi: 'Một áo khoác dạ camel' },
    syntheticRow: row('camel_coat', 'COAT', 'Camel', 'Wool', 'relaxed'),
    styleAffinity: ['oldmoney', 'minimalist', 'smartcasual'],
    ownedMatch: { type: 'COAT', colorFamily: 'earths' },
    noteTemplate: {
      en: 'The coat that makes basics look intentional — {count} looks in one layer.',
      vi: 'Chiếc khoác khiến đồ cơ bản trông có chủ đích — {count} look trong một lớp.',
    },
    starter: false,
  },
  {
    id: 'denim_jacket',
    label: { en: 'A denim jacket', vi: 'Một khoác denim' },
    syntheticRow: row('denim_jacket', 'JACKET', 'Blue', 'Denim', 'regular'),
    styleAffinity: ['streetwear', 'athleisure', 'y2k', 'smartcasual', 'bohemian'],
    ownedMatch: { type: 'JACKET', colorFamily: 'blues' },
    noteTemplate: {
      en: 'The easiest third piece there is — {count} looks pick it up.',
      vi: 'Lớp thứ ba dễ nhất trần đời — {count} look nhận nó ngay.',
    },
    starter: false,
  },
  {
    id: 'gray_hoodie',
    label: { en: 'A heather gray hoodie', vi: 'Một hoodie xám tiêu' },
    syntheticRow: row('gray_hoodie', 'HOODIE', 'Grey', 'Cotton', 'relaxed'),
    styleAffinity: ['streetwear', 'athleisure', 'y2k'],
    ownedMatch: { type: 'HOODIE', colorFamily: 'grays' },
    noteTemplate: {
      en: 'Gray keeps loud pieces honest — {count} looks settle around it.',
      vi: 'Xám giữ những món ồn ào biết điều — {count} look xoay quanh nó.',
    },
    starter: false,
  },
];
