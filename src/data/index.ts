// Data — wardrobe items, outfits, collections, style options, colors.
// Images use Unsplash stable IDs; local PNG cutouts are required() assets.

const U = (id: string, w = 800) =>
  `https://images.unsplash.com/${id}?w=${w}&q=80&auto=format&fit=crop`;

export const PHOTOS = {
  outfit_1: U('photo-1490481651871-ab68de25d43d'),
  outfit_2: U('photo-1539109136881-3be0616acf4b'),
  outfit_3: U('photo-1483985988355-763728e1935b'),
  outfit_4: U('photo-1496217590455-aa63a8350eea'),
  outfit_5: U('photo-1485231183945-fffde7cc051e'),
  outfit_6: U('photo-1551488831-00ddcb6c6bd3'),
  outfit_7: U('photo-1469334031218-e382a71b716b'),
  outfit_8: U('photo-1490114538077-0a7f8cb49891'),
  detail_1: U('photo-1558769132-cb1aea458c5e'),
  detail_2: U('photo-1542272604-787c3835535d'),
  detail_3: U('photo-1485518882345-15568b007407'),
  style_oldmoney: U('photo-1581338834647-b0fb40704e21'),
  style_streetwear: U('photo-1523398002811-999ca8dec234'),
  style_minimalist: U('photo-1487222477894-8943e31ef7b2'),
  style_smartcasual: U('photo-1507003211169-0a1dd7228f2d'),
  style_preppy: U('photo-1521572163474-6864f9cf17ab'),
  style_athleisure: U('photo-1539109136881-3be0616acf4b'),
  style_y2k: U('photo-1529139574466-a303027c1d8b'),
  style_bohemian: U('photo-1502716119720-b23a93e5fe1b'),
};

export interface ClothingItem {
  id: string;
  type: string;
  name: string;
  color: string;
  material?: string;
  img?: string;
  png?: number;       // local require() path — set in ITEMS below
  pngBlend?: boolean;
  tone: number;
  wornCount: number;
  addedDate: string;
  brand?: string;
  size?: string;
  fit?: string;
  fitNote?: string;
  measurements?: Array<{ label: string; value: string | number; unit?: string }>;
  price?: number;       // VND
}

// Local PNG assets (transparent cutouts) — must use require() for native bundling
const ASSET = {
  'tee-white':            require('../../assets/items/tee-white.png')         as number,
  'tee-yellow':           require('../../assets/items/tee-yellow.png')        as number,
  'tee-burgundy':         require('../../assets/items/tee-burgundy.png')      as number,
  'tee-grey':             require('../../assets/items/tee-grey.png')          as number,
  'tee-airism':           require('../../assets/items/tee-airism.png')        as number,
  'polo-olive':           require('../../assets/items/polo-olive.png')        as number,
  'sweater-black':        require('../../assets/items/sweater-black.png')     as number,
  'tee-beige':            require('../../assets/items/tee-beige.jpeg')        as number,
  'jacket-harrington':    require('../../assets/items/jacket-harrington.png') as number,
  'jeans-blue':           require('../../assets/items/jeans-blue.png')        as number,
  'jeans-dark':           require('../../assets/items/jeans-dark.png')        as number,
  'loafers-black':        require('../../assets/items/loafers-black.png')     as number,
  'bag-black':            require('../../assets/items/bag-black.png')         as number,
  // Fetched items — Uniqlo MA-1 jackets
  'jacket-ma1-black':     require('../../assets/items/jacket-ma1-black.png')     as number,
  'jacket-ma1-olive':     require('../../assets/items/jacket-ma1-olive.png')     as number,
  'jacket-ma1-navy':      require('../../assets/items/jacket-ma1-navy.png')      as number,
  // Fetched items — Uniqlo Utility jackets
  'jacket-utility-olive': require('../../assets/items/jacket-utility-olive.png') as number,
  'jacket-utility-brown': require('../../assets/items/jacket-utility-brown.png') as number,
  // Fetched items — Uniqlo Slim Chinos
  'chino-beige':          require('../../assets/items/chino-beige.png')          as number,
  'chino-black':          require('../../assets/items/chino-black.png')          as number,
  'chino-olive':          require('../../assets/items/chino-olive.png')          as number,
  // Fetched items — Levi's jeans
  'jeans-levis-black':    require('../../assets/items/jeans-levis-black.png')    as number,
  // Fetched items — Uniqlo DRY Polos
  'polo-white':           require('../../assets/items/polo-white.png')           as number,
  'polo-black':           require('../../assets/items/polo-black.png')           as number,
  // Fetched items — Uniqlo SUPIMA Tees
  'tee-supima-black':     require('../../assets/items/tee-supima-black.png')     as number,
  'tee-supima-grey':      require('../../assets/items/tee-supima-grey.png')      as number,
  // Fetched items — Everlane Henley
  'henley-navy':          require('../../assets/items/henley-navy.png')          as number,
  'white-sneaker':        require('../../assets/items/white-sneaker.png')        as number,
  // Fetched items — De Basé Vietnam
  'shirt-denim':          require('../../assets/items/shirt-denim.png')          as number,
  'trousers-wide':        require('../../assets/items/trousers-wide.png')        as number,
  'mule-tan':             require('../../assets/items/mule-tan.png')             as number,
  'cap-plaid':            require('../../assets/items/cap-plaid.png')            as number,
  // Fetched items — womenswear (2026-08-11) — Uniqlo / Uniqlo:C / Charles & Keith
  'blouse-white':         require('../../assets/items/blouse-white.png')         as number,
  'dress-floral-midi':    require('../../assets/items/dress-floral-midi.png')    as number,
  'dress-black':          require('../../assets/items/dress-black.png')          as number,
  'skirt-pencil-black':   require('../../assets/items/skirt-pencil-black.png')   as number,
  'skirt-pleated-beige':  require('../../assets/items/skirt-pleated-beige.png')  as number,
  'cardigan-cream':       require('../../assets/items/cardigan-cream.png')       as number,
  'blazer-grey-women':    require('../../assets/items/blazer-grey-women.png')    as number,
  'heels-nude':           require('../../assets/items/heels-nude.png')           as number,
  'camisole-blush':       require('../../assets/items/camisole-blush.png')       as number,
  'trousers-wide-black':  require('../../assets/items/trousers-wide-black.png')  as number,
  // Fetched item — J.Crew Margeaux Blazer (2026-08-11) — waist-defined blazer for outfitWaistDefinition
  'blazer-tailored-black': require('../../assets/items/blazer-tailored-black.png') as number,
} satisfies Record<string, number>;

// Measurement helpers — keeps item definitions concise
type M = Array<{ label: string; value: string | number; unit?: string }>;
const top  = (chest: number, length: number, sleeve: number, shoulder: number): M => [
  { label: 'Chest', value: chest }, { label: 'Length', value: length },
  { label: 'Sleeve', value: sleeve }, { label: 'Shoulder', value: shoulder },
];
const bot  = (waist: number, hip: number, inseam: number, rise: number, leg: number): M => [
  { label: 'Waist', value: waist }, { label: 'Hip', value: hip },
  { label: 'Inseam', value: inseam }, { label: 'Rise', value: rise }, { label: 'Leg opening', value: leg },
];
const shoe = (us: number, eu: number): M => [
  { label: 'Size (US)', value: us, unit: '' }, { label: 'Size (EU)', value: eu, unit: '' },
  { label: 'Width', value: 'D', unit: '' },
];
const bag  = (w: number, h: number, d: number, strap: number): M => [
  { label: 'Width', value: w }, { label: 'Height', value: h },
  { label: 'Depth', value: d }, { label: 'Strap drop', value: strap },
];

export const ITEMS: ClothingItem[] = [
  { id: 'i_tee_white',  type: 'TEE',    name: 'Oversized white tee',  color: 'White',    material: 'Cotton', png: ASSET['tee-white'],    img: U('photo-1521572163474-6864f9cf17ab', 600), tone: 2, wornCount: 12, addedDate: 'Apr 2026', price: 299_000,   size: 'L',    measurements: top(58, 72, 26, 52) },
  { id: 'i_tee_yellow', type: 'TEE',    name: 'Mustard cotton tee',   color: 'Mustard',  material: 'Cotton', png: ASSET['tee-yellow'],   img: U('photo-1521572163474-6864f9cf17ab', 600), tone: 4, wornCount: 5,  addedDate: 'Apr 2026', price: 299_000,   size: 'M',    measurements: top(56, 70, 24, 50) },
  { id: 'i_tee_burg',   type: 'TEE',    name: 'Burgundy cotton tee',  color: 'Burgundy', material: 'Cotton', png: ASSET['tee-burgundy'], img: U('photo-1521572163474-6864f9cf17ab', 600), tone: 3, wornCount: 4,  addedDate: 'Mar 2026', price: 299_000,   size: 'M',    measurements: top(56, 70, 24, 50) },
  { id: 'i_tee_grey',   type: 'TEE',    name: 'Heather grey tee',     color: 'Grey',     material: 'Cotton', png: ASSET['tee-grey'],     img: U('photo-1521572163474-6864f9cf17ab', 600), tone: 1, wornCount: 16, addedDate: 'May 2026', price: 299_000,   size: 'M',    measurements: top(56, 70, 24, 50) },
  { id: 'i_tee_airism', type: 'TEE',    name: 'Airism crew tee',      color: 'Grey',     material: 'Cotton', png: ASSET['tee-airism'],   img: U('photo-1521572163474-6864f9cf17ab', 600), tone: 1, wornCount: 9,  addedDate: 'May 2026', price: 399_000,   size: 'M',    measurements: top(54, 68, 23, 49) },
  { id: 'i_polo_olive', type: 'POLO',   name: 'Olive knit polo',      color: 'Olive',    material: 'Cotton', png: ASSET['polo-olive'],   img: U('photo-1602810318383-e386cc2a3ccf', 600), tone: 1, wornCount: 6,  addedDate: 'Feb 2026', price: 499_000,   size: 'M',    measurements: top(56, 70, 24, 50) },
  { id: 'i_swt_black',  type: 'KNIT',   name: 'Black crewneck',       color: 'Black',    material: 'Cotton', png: ASSET['sweater-black'],img: U('photo-1576566588028-4147f3842f27', 600), tone: 3, wornCount: 8,  addedDate: 'Jan 2026', price: 599_000,   size: 'M',    measurements: top(58, 68, 65, 50) },
  { id: 'i_tee_beige',  type: 'KNIT',   name: 'Beige milano knit',    color: 'Beige',    material: 'Wool',   png: ASSET['tee-beige'],    img: U('photo-1576566588028-4147f3842f27', 600), tone: 0, pngBlend: true, wornCount: 9, addedDate: 'Jan 2026', price: 799_000,   size: 'M',    measurements: top(56, 66, 62, 48) },
  { id: 'i_jkt_harr',   type: 'JACKET', name: 'Beige harrington',     color: 'Beige',    material: 'Cotton', png: ASSET['jacket-harrington'], img: U('photo-1591047139829-d91aecb6caea', 600), tone: 0, wornCount: 4, addedDate: 'May 2026', price: 899_000,   size: 'M',    measurements: top(60, 66, 64, 52) },
  { id: 'i_jeans_blue', type: 'JEANS',  name: 'Light wash jeans',     color: 'Indigo',   material: 'Denim',  png: ASSET['jeans-blue'],   img: U('photo-1542272604-787c3835535d', 600), tone: 2, wornCount: 14, addedDate: 'Apr 2026', price: 799_000,   size: 'W32 L30', measurements: bot(82, 100, 80, 27, 22) },
  { id: 'i_jeans_dark', type: 'JEANS',  name: 'Dark wash jeans',      color: 'Navy',     material: 'Denim',  png: ASSET['jeans-dark'],   img: U('photo-1542272604-787c3835535d', 600), tone: 3, wornCount: 11, addedDate: 'Apr 2026', price: 799_000,   size: 'W32 L30', measurements: bot(82, 100, 80, 27, 20) },
  { id: 'i_loaf_black', type: 'LOAFERS',name: 'Black penny loafers',  color: 'Black',    material: 'Leather',png: ASSET['loafers-black'],img: U('photo-1582897085656-c636d006a246', 600), tone: 3, wornCount: 7, addedDate: 'Mar 2026', price: 1_490_000, size: 'EU 42',  measurements: shoe(9, 42) },
  { id: 'i_bag_black',  type: 'BAG',    name: 'Black nylon tote',     color: 'Black',    material: 'Nylon',  png: ASSET['bag-black'],    img: U('photo-1548036328-c9fa89d128fa', 500), tone: 3, wornCount: 6, addedDate: 'Apr 2026', price: 699_000,                 measurements: bag(38, 32, 14, 28) },
  { id: 'i10',          type: 'SNEAKERS',name: 'White low-tops',      color: 'White',    material: 'Canvas', png: ASSET['white-sneaker'], tone: 2, wornCount: 14, addedDate: 'Nov 2025', price: 2_990_000, size: 'EU 42',  measurements: shoe(9, 42) },

  // ── Fetched items ─────────────────────────────────────────────────────────
  // Jackets
  { id: 'jkt_ma1_blk', type: 'JACKET', name: 'MA-1 Blouson Jacket',   color: 'Black', material: 'Nylon',  png: ASSET['jacket-ma1-black'],     tone: 3, wornCount: 0, addedDate: 'May 2026', brand: 'Uniqlo',   price: 1_290_000, size: 'M', measurements: top(62, 66, 65, 53) },
  { id: 'jkt_ma1_olv', type: 'JACKET', name: 'MA-1 Blouson Jacket',   color: 'Olive', material: 'Nylon',  png: ASSET['jacket-ma1-olive'],     tone: 1, wornCount: 0, addedDate: 'May 2026', brand: 'Uniqlo',   price: 1_290_000, size: 'M', measurements: top(62, 66, 65, 53) },
  { id: 'jkt_ma1_nvy', type: 'JACKET', name: 'MA-1 Blouson Jacket',   color: 'Navy',  material: 'Nylon',  png: ASSET['jacket-ma1-navy'],      tone: 3, wornCount: 0, addedDate: 'May 2026', brand: 'Uniqlo',   price: 1_290_000, size: 'M', measurements: top(62, 66, 65, 53) },
  { id: 'jkt_utl_olv', type: 'JACKET', name: 'Cotton Utility Jacket', color: 'Olive', material: 'Cotton', png: ASSET['jacket-utility-olive'], tone: 1, wornCount: 0, addedDate: 'May 2026', brand: 'Uniqlo',   price: 999_000,   size: 'M', measurements: top(60, 72, 64, 52) },
  { id: 'jkt_utl_brn', type: 'JACKET', name: 'Cotton Utility Jacket', color: 'Brown', material: 'Cotton', png: ASSET['jacket-utility-brown'], tone: 2, wornCount: 0, addedDate: 'May 2026', brand: 'Uniqlo',   price: 999_000,   size: 'M', measurements: top(60, 72, 64, 52) },
  // Bottoms
  { id: 'chino_beige', type: 'CHINOS', name: 'Slim Fit Chino Pants',  color: 'Beige', material: 'Cotton', png: ASSET['chino-beige'],          tone: 0, wornCount: 0, addedDate: 'May 2026', brand: 'Uniqlo',   price: 799_000,   size: 'W30 L30', measurements: bot(80, 96, 80, 27, 18) },
  { id: 'chino_black', type: 'CHINOS', name: 'Slim Fit Chino Pants',  color: 'Black', material: 'Cotton', png: ASSET['chino-black'],          tone: 3, wornCount: 0, addedDate: 'May 2026', brand: 'Uniqlo',   price: 799_000,   size: 'W30 L30', measurements: bot(80, 96, 80, 27, 18) },
  { id: 'chino_olive', type: 'CHINOS', name: 'Slim Fit Chino Pants',  color: 'Olive', material: 'Cotton', png: ASSET['chino-olive'],          tone: 1, wornCount: 0, addedDate: 'May 2026', brand: 'Uniqlo',   price: 799_000,   size: 'W30 L30', measurements: bot(80, 96, 80, 27, 18) },
  { id: 'jns_lv_blk',  type: 'JEANS',  name: '511 Slim Fit Jeans',    color: 'Black', material: 'Denim',  png: ASSET['jeans-levis-black'],    tone: 3, wornCount: 0, addedDate: 'May 2026', brand: "Levi's",   price: 1_890_000, size: 'W32 L30', measurements: bot(82, 98, 78, 26, 18) },
  // Tops
  { id: 'polo_white',  type: 'POLO',   name: 'DRY Piqué Polo Shirt',  color: 'White', material: 'Cotton', png: ASSET['polo-white'],           tone: 0, wornCount: 0, addedDate: 'May 2026', brand: 'Uniqlo',   price: 499_000,   size: 'M', measurements: top(56, 70, 24, 50) },
  { id: 'polo_black',  type: 'POLO',   name: 'DRY Piqué Polo Shirt',  color: 'Black', material: 'Cotton', png: ASSET['polo-black'],           tone: 3, wornCount: 0, addedDate: 'May 2026', brand: 'Uniqlo',   price: 499_000,   size: 'M', measurements: top(56, 70, 24, 50) },
  { id: 'tee_sup_blk', type: 'TEE',    name: 'SUPIMA Cotton Crew Tee',color: 'Black', material: 'Cotton', png: ASSET['tee-supima-black'],     tone: 3, wornCount: 0, addedDate: 'May 2026', brand: 'Uniqlo',   price: 499_000,   size: 'M', measurements: top(55, 70, 24, 50) },
  { id: 'tee_sup_gry', type: 'TEE',    name: 'SUPIMA Cotton Crew Tee',color: 'Grey',  material: 'Cotton', png: ASSET['tee-supima-grey'],      tone: 2, wornCount: 0, addedDate: 'May 2026', brand: 'Uniqlo',   price: 499_000,   size: 'M', measurements: top(55, 70, 24, 50) },
  { id: 'henley_navy', type: 'SHIRT',  name: 'Waffle-Knit Henley',    color: 'Navy',  material: 'Cotton', png: ASSET['henley-navy'],          tone: 3, wornCount: 0, addedDate: 'May 2026', brand: 'Everlane', price: 1_290_000, size: 'M', measurements: top(56, 70, 62, 50) },

  // ── De Basé Vietnam ────────────────────────────────────────────────────────
  // Tops
  { id: 'debase_shirt_denim', type: 'SHIRT',    name: 'RAW Denim Shirt',       color: 'Indigo', material: 'Raw Denim',         png: ASSET['shirt-denim'],    tone: 3, wornCount: 0, addedDate: 'May 2026', brand: 'De Basé', price: 540_000, size: 'L', measurements: top(112, 74, 65, 58) },
  // Bottoms
  { id: 'debase_trousers',    type: 'TROUSERS', name: 'basé TROUSERS 01',      color: 'Black',  material: 'Polyester / Rayon', png: ASSET['trousers-wide'],  tone: 3, wornCount: 0, addedDate: 'May 2026', brand: 'De Basé', price: 520_000, size: 'L', measurements: bot(80, 95, 75, 28, 27) },
  // Accessories
  { id: 'debase_mule_tan',    type: 'LOAFERS',  name: 'Buckle Mulé',           color: 'Tan',    material: 'Suede',             png: ASSET['mule-tan'],       tone: 2, wornCount: 0, addedDate: 'May 2026', brand: 'De Basé', price: 850_000, size: 'EU 42', measurements: shoe(9, 42) },
  { id: 'debase_cap_plaid',   type: 'CAP',      name: 'basé Logo CAP 01',      color: 'Forest', material: 'Wool Felt',         png: ASSET['cap-plaid'],      tone: 3, wornCount: 0, addedDate: 'May 2026', brand: 'De Basé', price: 300_000, measurements: [{ label: 'Head circ.', value: '50–60', unit: 'cm' }] },

  // ── Womenswear (2026-08-11) — Uniqlo / Uniqlo:C / Charles & Keith ──────────
  // No confirmed price/size/measurements from source product pages — omitted
  // rather than guessed (see CLAUDE.md field-fill policy).
  { id: 'blouse_white',      type: 'BLOUSE',   name: 'Rayon Blouse',              color: 'White',  material: 'Rayon',     png: ASSET['blouse-white'],        tone: 0, wornCount: 0, addedDate: 'Aug 2026', brand: 'Uniqlo' },
  { id: 'dress_floral',      type: 'DRESS',    name: 'Floral Flare Dress',        color: 'Ivory',  material: 'Rayon',     png: ASSET['dress-floral-midi'],   tone: 0, wornCount: 0, addedDate: 'Aug 2026', brand: 'Uniqlo' },
  { id: 'dress_black',       type: 'DRESS',    name: 'Pleated Sleeveless Dress',  color: 'Black',  material: 'Polyester', png: ASSET['dress-black'],         tone: 3, wornCount: 0, addedDate: 'Aug 2026', brand: 'Uniqlo' },
  { id: 'skirt_pencil_blk',  type: 'SKIRT',    name: 'Linen Narrow Skirt',        color: 'Black',  material: 'Linen',     png: ASSET['skirt-pencil-black'],  tone: 3, wornCount: 0, addedDate: 'Aug 2026', brand: 'Uniqlo' },
  { id: 'skirt_pleated_stn', type: 'SKIRT',    name: 'Pleated Long Skirt',        color: 'Stone',  material: 'Polyester', png: ASSET['skirt-pleated-beige'], tone: 1, wornCount: 0, addedDate: 'Aug 2026', brand: 'Uniqlo' },
  { id: 'cardigan_cream',    type: 'CARDIGAN', name: '3D Knit Mesh Cardigan',     color: 'Cream',  material: 'Cotton',    png: ASSET['cardigan-cream'],      tone: 0, wornCount: 0, addedDate: 'Aug 2026', brand: 'Uniqlo' },
  { id: 'blazer_grey_w',     type: 'BLAZER',   name: 'U Boxy Tailored Jacket',    color: 'Grey',   material: 'Cotton',    png: ASSET['blazer-grey-women'],   tone: 1, wornCount: 0, addedDate: 'Aug 2026', brand: 'Uniqlo' },
  { id: 'heels_nude',        type: 'HEELS',    name: 'Emmy Pointed Kitten Heels', color: 'Nude',   material: 'Leather',   png: ASSET['heels-nude'],          tone: 2, wornCount: 0, addedDate: 'Aug 2026', brand: 'Charles & Keith' },
  { id: 'camisole_blush',    type: 'CAMISOLE', name: 'AIRism Bra Camisole',       color: 'Blush',  material: 'Polyester', png: ASSET['camisole-blush'],      tone: 1, wornCount: 0, addedDate: 'Aug 2026', brand: 'Uniqlo' },
  { id: 'trousers_wide_blk', type: 'TROUSERS', name: 'Wide Chino Pants',          color: 'Black',  material: 'Cotton',    png: ASSET['trousers-wide-black'], tone: 3, wornCount: 0, addedDate: 'Aug 2026', brand: 'Uniqlo' },

  // ── Waist-defined blazer (2026-08-11) — J.Crew ─────────────────────────────
  // Unlike blazer_grey_w (boxy, fit left blank), this one carries an explicit
  // `fit` so it activates outfitWaistDefinition (engine/silhouette.ts), which
  // only treats BLAZER as waist-creating when fit isn't oversized/wide.
  { id: 'blazer_margeaux_blk', type: 'BLAZER', name: 'Margeaux Blazer in Stretch Linen Blend', color: 'Black', material: 'Linen', png: ASSET['blazer-tailored-black'], tone: 3, wornCount: 0, addedDate: 'Aug 2026', brand: 'J.Crew', fit: 'regular' },
];

export const itemById = (id: string) => ITEMS.find(i => i.id === id);

export interface Outfit {
  id: string;
  title: string;
  subtitle: string;
  style: string;
  context: string;
  weather: string;
  description: string;
  longDescription: string;
  tags: string[];
  tone: number;
  itemIds: string[];
  img?: string;
  formula?: string; // formula ID that generated this outfit
  tier?: 1 | 2;     // 1 = matches user style, 2 = flex/discovery
  stylistNote?: string; // one-line LLM curator note — why this works for the user
  stylingTip?: string;  // one resolved-locale "way to wear" tip (feature 008)
  silhouette?: string; // display tag: engine's target silhouette for this outfit
  silhouetteShape?: string; // display tag: parallel geometric-shape name (1-to-1 from silhouette)
  colorTone?: string;  // display tag: outfit's dominant (anchor) colour
  styleTag?: string;   // display tag: wardrobe-affinity fallback style name (2026-08-02), fallback-only
  // Fit engine scores (0.0–1.0) — present on generated outfits
  scores?: {
    totalScore: number;
    styleCoherence: number;
    colorHarmony: number;
    fitScore: number;
    proportionBalance: number;
    formalityConsistency: number;
    seasonMatch: number;
    textureInterest: number;
  };
}

export const OUTFITS: Outfit[] = [
  {
    id: 'o1', title: 'Harrington & Denim', subtitle: 'casual friday',
    style: 'OLD MONEY', context: 'CASUAL FRIDAY', weather: '24°C',
    description: 'Beige harrington, white tee, light wash denim, black loafers.',
    longDescription: 'A jacket that belongs to no decade. Wear it open over a clean white tee, with jeans you have already broken in, and shoes that walk well.',
    tags: ['24°C', 'WEEKEND', 'DAYTIME'], tone: 0,
    itemIds: ['i_jeans_blue', 'i_tee_white', 'i_jkt_harr', 'i_loaf_black', 'i_bag_black'],
    img: PHOTOS.outfit_1,
  },
  {
    id: 'o2', title: 'Quiet Monday', subtitle: 'workday rotation',
    style: 'MINIMALIST', context: 'WORKDAY', weather: '22°C',
    description: 'Beige knit, dark wash jeans, black loafers.',
    longDescription: 'A composed palette for the start of the week. Soft texture against sharp tailoring — nothing shouts, everything resolves.',
    tags: ['22°C', 'OFFICE', 'MORNING'], tone: 1,
    itemIds: ['i_jeans_dark', 'i_tee_beige', 'i_loaf_black', 'i_bag_black'],
    img: PHOTOS.outfit_2,
  },
  {
    id: 'o7', title: 'Boardroom Line', subtitle: 'sharp, unbothered',
    style: 'OFFICE CHIC', context: 'OFFICE', weather: '23°C',
    description: 'Grey boxy blazer, white blouse, wide black trousers, nude heels.',
    longDescription: 'Structure without stiffness. The blazer holds the line, the wide leg gives it room to move, and the heel keeps the whole thing polished from nine to nine.',
    tags: ['23°C', 'OFFICE', 'MORNING'], tone: 1,
    itemIds: ['blouse_white', 'blazer_grey_w', 'trousers_wide_blk', 'heels_nude', 'i_bag_black'],
    img: PHOTOS.outfit_7,
  },
  {
    id: 'o8', title: 'Left Bank', subtitle: 'unbothered, unhurried',
    style: 'PARISIAN CHIC', context: 'WEEKEND', weather: '21°C',
    description: 'Floral midi dress, cream cardigan, nude heels.',
    longDescription: 'Small florals, a cardigan thrown over the shoulders, shoes that still let you walk the whole afternoon. Nothing about it tries too hard.',
    tags: ['21°C', 'WEEKEND', 'AFTERNOON'], tone: 0,
    itemIds: ['dress_floral', 'cardigan_cream', 'heels_nude'],
    img: PHOTOS.outfit_8,
  },
  {
    id: 'o3', title: 'Slow Sunday', subtitle: 'long lunch energy',
    style: 'SMART CASUAL', context: 'WEEKEND', weather: '26°C',
    description: 'Olive polo, light wash jeans, black loafers.',
    longDescription: 'For days that move at their own pace. A long lunch, a longer book, an evening walk through somewhere familiar.',
    tags: ['26°C', 'WEEKEND', 'AFTERNOON'], tone: 2,
    itemIds: ['i_jeans_blue', 'i_polo_olive', 'i_loaf_black'],
    img: PHOTOS.outfit_3,
  },
  {
    id: 'o4', title: 'After Hours', subtitle: 'considered, never costumed',
    style: 'SMART CASUAL', context: 'DINNER', weather: '20°C',
    description: 'Black crewneck, dark wash jeans, black loafers.',
    longDescription: "A dinner that doesn't announce itself. Considered, never costumed.",
    tags: ['20°C', 'EVENING', 'DINNER'], tone: 3,
    itemIds: ['i_jeans_dark', 'i_swt_black', 'i_loaf_black', 'i_bag_black'],
    img: PHOTOS.outfit_4,
  },
  {
    id: 'o5', title: 'Off-Duty', subtitle: 'basics, executed precisely',
    style: 'STREETWEAR', context: 'WEEKEND', weather: '28°C',
    description: 'Mustard tee, light wash jeans, black loafers.',
    longDescription: 'The basics, executed precisely. The whole point is restraint — let the fit do the talking.',
    tags: ['28°C', 'CASUAL', 'DAY'], tone: 4,
    itemIds: ['i_jeans_blue', 'i_tee_yellow', 'i_loaf_black'],
    img: PHOTOS.outfit_5,
  },
  {
    id: 'o6', title: 'Slate Weather', subtitle: 'overcast, considered',
    style: 'MINIMALIST', context: 'WORKDAY', weather: '19°C',
    description: 'Grey tee, harrington jacket, dark jeans, black loafers.',
    longDescription: 'Tone-on-tone with one warm note. The jacket holds the shape, the rest gets out of the way.',
    tags: ['19°C', 'OFFICE', 'DAY'], tone: 0,
    itemIds: ['i_jeans_dark', 'i_tee_grey', 'i_jkt_harr', 'i_loaf_black', 'i_bag_black'],
    img: PHOTOS.outfit_6,
  },
];

export type StyleGenderLean = 'feminine' | 'masculine' | 'neutral';

export interface StyleOption {
  id: string;
  name: string;
  desc: string;
  img: string;
  // Display-sort hint only (2026-08-10 style catalog expansion) — mirrors
  // public.styles.gender_lean / STYLE_CONFIGS' DB row. NEVER consumed by
  // scoring/engine code; see sortStylesByGenderLean in stylesCatalogService.
  genderLean: StyleGenderLean;
}

// `img` is left '' for every style below (not just the 14 added 2026-08-10) —
// Photo() renders a labelled fallback tile for a falsy src, and none of these
// have a real branded photo asset. See backlog.md.
export const STYLES: StyleOption[] = [
  { id: 'oldmoney',    name: 'Old Money',    desc: 'REFINED · CLASSIC',    img: PHOTOS.style_oldmoney,   genderLean: 'masculine' },
  { id: 'streetwear',  name: 'Streetwear',   desc: 'URBAN · BOLD',         img: PHOTOS.style_streetwear, genderLean: 'masculine' },
  { id: 'minimalist',  name: 'Minimalist',   desc: 'PARED · DELIBERATE',   img: PHOTOS.style_minimalist, genderLean: 'neutral' },
  { id: 'smartcasual', name: 'Smart Casual', desc: 'POLISHED · EASY',      img: PHOTOS.style_smartcasual, genderLean: 'masculine' },
  { id: 'preppy',      name: 'Preppy',       desc: 'CLEAN · TRADITIONAL',  img: PHOTOS.style_preppy,     genderLean: 'masculine' },
  { id: 'athleisure',  name: 'Athleisure',   desc: 'ACTIVE · RELAXED',     img: PHOTOS.style_athleisure, genderLean: 'neutral' },
  { id: 'y2k',         name: 'Y2K',          desc: 'PLAYFUL · NOSTALGIC',  img: PHOTOS.style_y2k,        genderLean: 'feminine' },
  { id: 'bohemian',    name: 'Bohemian',     desc: 'FLOWING · ROMANTIC',   img: PHOTOS.style_bohemian,   genderLean: 'feminine' },
  // ─── Style catalog expansion (2026-08-10) — mirrors public.styles / STYLE_CONFIGS ───
  { id: 'feminine',     name: 'Feminine',      desc: 'ROMANTIC · SOFT',       img: '', genderLean: 'feminine' },
  { id: 'officechic',   name: 'Office Chic',   desc: 'TAILORED · SHARP',      img: '', genderLean: 'feminine' },
  { id: 'parisian',     name: 'Parisian Chic', desc: 'EFFORTLESS · CHIC',     img: '', genderLean: 'feminine' },
  { id: 'coquette',     name: 'Coquette',      desc: 'DELICATE · PLAYFUL',    img: '', genderLean: 'feminine' },
  { id: 'cleangirl',    name: 'Clean Girl',    desc: 'POLISHED · MINIMAL',    img: '', genderLean: 'feminine' },
  { id: 'darkacademia', name: 'Dark Academia', desc: 'MOODY · LITERARY',      img: '', genderLean: 'feminine' },
  { id: 'cottagecore',  name: 'Cottagecore',   desc: 'PASTORAL · SOFT',       img: '', genderLean: 'feminine' },
  { id: 'grunge',       name: 'Grunge',        desc: 'RAW · EDGY',            img: '', genderLean: 'feminine' },
  { id: 'athflow',      name: 'Athflow',       desc: 'FLUID · ACTIVE',        img: '', genderLean: 'feminine' },
  { id: 'elegant',      name: 'Elegant',       desc: 'REFINED · CLASSIC',     img: '', genderLean: 'feminine' },
  { id: 'kfashion',     name: 'K-Fashion',     desc: 'SOFT · LAYERED',        img: '', genderLean: 'feminine' },
  { id: 'vintage',      name: 'Vintage',       desc: 'RETRO · WORN-IN',       img: '', genderLean: 'feminine' },
  { id: 'resort',       name: 'Resort',        desc: 'EASY · WARM-WEATHER',   img: '', genderLean: 'neutral' },
  { id: 'artsy',        name: 'Artsy',         desc: 'AVANT-GARDE · BOLD',    img: '', genderLean: 'neutral' },
  // ─── Style catalog expansion batch 2 (2026-08-10) — mirrors public.styles / STYLE_CONFIGS ───
  // 9 of 11 requested styles shipped ('mobwife'/'modest' stopped for a
  // vocabulary gap — see plan.md).
  { id: 'glam',           name: 'Glam',            desc: 'EVENING · LUXE',        img: '', genderLean: 'feminine' },
  { id: 'businessformal', name: 'Business Formal', desc: 'TAILORED · SHARP',      img: '', genderLean: 'neutral' },
  { id: 'gothic',         name: 'Gothic',          desc: 'DARK · ROMANTIC',       img: '', genderLean: 'feminine' },
  { id: 'utility',        name: 'Utility',         desc: 'FUNCTIONAL · CARGO',    img: '', genderLean: 'neutral' },
  { id: 'sporty',         name: 'Sporty',          desc: 'VARSITY · ACTIVE',      img: '', genderLean: 'feminine' },
  { id: 'normcore',       name: 'Normcore',        desc: 'PLAIN · UNDONE',        img: '', genderLean: 'neutral' },
  { id: 'retro70s',       name: 'Retro 70s',       desc: 'FLARE · GEOMETRIC',     img: '', genderLean: 'feminine' },
  { id: 'pinup',          name: 'Pinup',           desc: 'FIT-AND-FLARE · RED',   img: '', genderLean: 'feminine' },
  { id: 'whimsigoth',     name: 'Whimsigoth',      desc: 'MYSTICAL · VELVET',     img: '', genderLean: 'feminine' },
];

export interface ColorOption {
  name: string;
  hex: string;
  tag: string;
}

export const COLORS: ColorOption[] = [
  { name: 'Cream',     hex: '#F2EDE4', tag: 'WARM NEUTRAL' },
  { name: 'Sand',      hex: '#D9C9A8', tag: 'EARTH' },
  { name: 'Camel',     hex: '#B89776', tag: 'EARTH' },
  { name: 'Terracotta',hex: '#A0613F', tag: 'EARTH' },
  { name: 'Rust',      hex: '#7C3B25', tag: 'EARTH' },
  { name: 'Dove',      hex: '#C8C5BF', tag: 'NEUTRAL' },
  { name: 'Charcoal',  hex: '#3A3631', tag: 'DARK NEUTRAL' },
  { name: 'Black',     hex: '#1A1815', tag: 'DARK NEUTRAL' },
  { name: 'Navy',      hex: '#1F2A44', tag: 'COOL' },
  { name: 'Slate',     hex: '#5C6770', tag: 'COOL' },
  { name: 'Sage',      hex: '#8B9B7A', tag: 'COOL' },
  { name: 'Forest',    hex: '#3B4E3B', tag: 'COOL' },
  { name: 'Burgundy',  hex: '#5C2B2E', tag: 'WARM' },
  { name: 'Mustard',   hex: '#B58A2D', tag: 'WARM' },
  { name: 'Ochre',     hex: '#9C6B2F', tag: 'WARM' },
  { name: 'Emerald',   hex: '#2F5D4F', tag: 'ACCENT' },
];

export interface Collection {
  id: string;
  name: string;
  description: string;
  createdDate: string;
  itemIds: string[];   // wardrobe item IDs — a collection groups items, not outfits
}

export const COLLECTIONS: Collection[] = [
  { id: 'c1', name: 'Workweek', description: 'Pieces I rotate Monday through Friday.',       createdDate: 'CREATED MAY 2026', itemIds: ['i_tee_beige', 'i_swt_black', 'i_jeans_dark', 'i_loaf_black', 'i_bag_black'] },
  { id: 'c2', name: 'Weekends', description: 'Slower days, unhurried compositions.',          createdDate: 'CREATED APR 2026', itemIds: ['i_tee_white', 'i_tee_yellow', 'i_polo_olive', 'i_jeans_blue', 'i10'] },
  { id: 'c3', name: 'Travel',   description: 'Pieces that pack flat and never feel borrowed.', createdDate: 'CREATED MAR 2026', itemIds: ['i_swt_black', 'chino_beige', 'jkt_ma1_olv', 'i10'] },
];

export interface StyleNiche {
  id: string;
  name: string;
  desc: string;
}

export const STYLE_NICHES: Record<string, StyleNiche[]> = {
  oldmoney: [
    { id: 'oldmoney:ivy',      name: 'Ivy League',           desc: 'Oxford shirts, cable knits, penny loafers' },
    { id: 'oldmoney:european', name: 'European Heritage',    desc: 'Tailoring, scarves, understated quality' },
    { id: 'oldmoney:coastal',  name: 'Coastal Preppy',       desc: 'Linen, boat shoes, relaxed shapes' },
    { id: 'oldmoney:quiet',    name: 'Quiet Luxury',         desc: 'No logos, impeccable fabric, restrained palette' },
  ],
  minimalist: [
    { id: 'minimalist:scandi', name: 'Scandinavian',         desc: 'Functional, raw fabrics, tonal dressing' },
    { id: 'minimalist:lemaire',name: 'Margiela / Lemaire',   desc: 'Deconstructed, draped, intellectual' },
    { id: 'minimalist:japmin', name: 'Japanese Minimal',     desc: 'Wabi-sabi, natural fibres, asymmetry' },
    { id: 'minimalist:capsule',name: 'Capsule Wardrobe',     desc: 'Fewer pieces, endless rotation' },
  ],
  streetwear: [
    { id: 'streetwear:hype',   name: 'Hype / Drop Culture', desc: 'Collabs, exclusives, statement pieces' },
    { id: 'streetwear:skate',  name: 'Skate-Influenced',    desc: 'Wide-leg, graphic tees, low-profile shoes' },
    { id: 'streetwear:workwear',name: 'Workwear / Utility',  desc: 'Cargos, flannels, durable fabrics' },
    { id: 'streetwear:luxe',   name: 'Luxury Streetwear',   desc: 'High-end sportswear, understated flex' },
  ],
  smartcasual: [
    { id: 'smartcasual:biz',   name: 'Business Casual',     desc: 'Chinos, polos, clean trainers' },
    { id: 'smartcasual:resort',name: 'Resort Smart',        desc: 'Linen, relaxed tailoring, warm tones' },
    { id: 'smartcasual:denim', name: 'Denim-Led',           desc: 'Premium denim as a foundation' },
  ],
  preppy: [
    { id: 'preppy:trad',       name: 'Trad / East Coast',   desc: 'Rugby shirts, chinos, duck boots' },
    { id: 'preppy:mod',        name: 'Modern Preppy',       desc: 'Elevated basics with a campus feel' },
  ],
  athleisure: [
    { id: 'athleisure:run',    name: 'Running Culture',     desc: 'Technical fabrics, trail aesthetics' },
    { id: 'athleisure:gorpcore',name: 'Gorpcore',           desc: 'Outdoor gear worn in the city' },
    { id: 'athleisure:studio', name: 'Studio-to-Street',    desc: 'Yoga-adjacent, clean and mobile' },
  ],
  y2k: [
    { id: 'y2k:cyber',         name: 'Cyber Y2K',           desc: 'Metallics, tech fabrics, bright accents' },
    { id: 'y2k:indie',         name: 'Indie Sleaze',        desc: 'Low-rise, vintage band tees, dishevelled' },
  ],
  bohemian: [
    { id: 'bohemian:earthy',   name: 'Earthy Boho',         desc: 'Terracotta, linen, natural textures' },
    { id: 'bohemian:folk',     name: 'Folk-Inspired',       desc: 'Embroidery, prints, layered silhouettes' },
  ],
  // ─── Style catalog expansion (2026-08-10) — names mirror public.styles.niches ───
  feminine: [
    { id: 'feminine:romantic',  name: 'Romantic Florals', desc: 'Soft prints, gentle draping' },
    { id: 'feminine:lace',      name: 'Ruffles & Lace',   desc: 'Delicate trims, feminine detailing' },
    { id: 'feminine:softpower', name: 'Soft Power',       desc: 'Fitted but never severe' },
  ],
  officechic: [
    { id: 'officechic:bizcasual', name: 'Business Casual',    desc: 'Chinos-adjacent tailoring, clean trainers' },
    { id: 'officechic:boardroom', name: 'Boardroom Tailoring', desc: 'Sharp blazers, structured shirting' },
    { id: 'officechic:weekend',   name: 'Weekend-to-Work',    desc: 'Pieces that carry over past 6pm' },
  ],
  parisian: [
    { id: 'parisian:stripes',  name: 'Breton Stripes',       desc: 'Nautical stripes, understated ease' },
    { id: 'parisian:tailored', name: 'Effortless Tailoring', desc: 'Trench coats, quality basics' },
  ],
  coquette: [
    { id: 'coquette:ballet',   name: 'Balletcore',   desc: 'Wrap tops, soft pink, ballet flats' },
    { id: 'coquette:bows',     name: 'Bow Details',  desc: 'Ribbons, bows, delicate hardware' },
  ],
  cleangirl: [
    { id: 'cleangirl:tonal',    name: 'Ton-sur-ton',        desc: 'Single-tone dressing, no clutter' },
    { id: 'cleangirl:basics',   name: 'Everyday Essentials', desc: 'Slick basics, exact fit' },
  ],
  darkacademia: [
    { id: 'darkacademia:ivy',    name: 'Ivy Scholar',       desc: 'Tweed blazers, oxford shirts' },
    { id: 'darkacademia:gothic', name: 'Gothic Academia',   desc: 'Darker palette, structured layers' },
  ],
  cottagecore: [
    { id: 'cottagecore:prairie', name: 'Prairie Dress', desc: 'Maxi dresses, puff sleeves' },
    { id: 'cottagecore:meadow',  name: 'Meadow Florals', desc: 'Small florals, natural fibers' },
  ],
  grunge: [
    { id: 'grunge:90s',    name: '90s Grunge',       desc: 'Flannel, band tees, worn denim' },
    { id: 'grunge:distressed', name: 'Distressed Denim', desc: 'Raw hems, deconstructed layers' },
  ],
  athflow: [
    { id: 'athflow:studio', name: 'Studio-to-Street', desc: 'Yoga-adjacent, fluid layers' },
    { id: 'athflow:soft',   name: 'Soft Performance', desc: 'Technical fabrics, gentler cut' },
  ],
  elegant: [
    { id: 'elegant:evening',  name: 'Evening Tailoring', desc: 'Rich fabrics, clean lines' },
    { id: 'elegant:classic',  name: 'Modern Classic',    desc: 'Timeless silhouettes, quiet polish' },
  ],
  kfashion: [
    { id: 'kfashion:seoul',   name: 'Seoul Street',    desc: 'Muted oversized layering' },
    { id: 'kfashion:soft',    name: 'Soft Layering',   desc: 'Light knits, relaxed proportions' },
  ],
  vintage: [
    { id: 'vintage:70s',      name: '70s Revival',      desc: 'Flared cuts, sun-faded tones' },
    { id: 'vintage:thrifted', name: 'Thrifted Classics', desc: 'Worn-in textures, retro denim' },
  ],
  resort: [
    { id: 'resort:linen',   name: 'Vacation Linen', desc: 'Breathable fabrics, light color' },
    { id: 'resort:coastal', name: 'Coastal Getaway', desc: 'Easy shapes, poolside ready' },
  ],
  artsy: [
    { id: 'artsy:deconstructed', name: 'Deconstructed', desc: 'Unusual proportions, raw seams' },
    { id: 'artsy:colorblock',    name: 'Color-Block Statement', desc: 'Bold contrast, gallery-ready' },
  ],
  // ─── Style catalog expansion batch 2 (2026-08-10) — names mirror public.styles.niches ───
  glam: [
    { id: 'glam:redcarpet', name: 'Red Carpet',      desc: 'Gowns, statement jewels, high shine' },
    { id: 'glam:cocktail',  name: 'Cocktail Hour',    desc: 'Sleek dresses, sharp heels' },
  ],
  businessformal: [
    { id: 'businessformal:suiting', name: 'Power Suiting', desc: 'Structured suits, sharp lines' },
    { id: 'businessformal:exec',    name: 'Executive Polish', desc: 'Boardroom-ready, zero casual' },
  ],
  gothic: [
    { id: 'gothic:romantic', name: 'Romantic Goth', desc: 'Velvet, lace-adjacent silk, corsetry' },
    { id: 'gothic:trad',     name: 'Traditional Goth', desc: 'All-black, structured, austere' },
  ],
  utility: [
    { id: 'utility:cargo',    name: 'Cargo Core',     desc: 'Box pockets, canvas, loose fit' },
    { id: 'utility:military', name: 'Military-Inspired', desc: 'Khaki, olive, functional hardware' },
  ],
  sporty: [
    { id: 'sporty:varsity', name: 'Varsity',       desc: 'Letterman jackets, collegiate color-blocking' },
    { id: 'sporty:tomboy',  name: 'Tomboy',         desc: 'Jerseys, caps, boyish ease' },
  ],
  normcore: [
    { id: 'normcore:basics', name: 'Deliberate Basics', desc: 'Plain tees, dad denim, no branding' },
    { id: 'normcore:unisex', name: 'Unisex Nothing-Special', desc: 'Mall-brand staples, on purpose' },
  ],
  retro70s: [
    { id: 'retro70s:flare',    name: 'Flare & Bell-Bottom', desc: 'Wide-leg denim, platform soles' },
    { id: 'retro70s:geometric',name: 'Geometric Print',     desc: 'Bold shapes, mustard and rust tones' },
  ],
  pinup: [
    { id: 'pinup:rockabilly', name: 'Rockabilly',      desc: 'Polka dots, cherry red, fitted bodice' },
    { id: 'pinup:swing',      name: 'Swing Dress',      desc: 'Full skirts, cinched waist' },
  ],
  whimsigoth: [
    { id: 'whimsigoth:witchy',   name: 'Witchy Romantic', desc: 'Flowing velvet, celestial motifs' },
    { id: 'whimsigoth:darkboho', name: 'Dark Bohemian',   desc: '70s silhouettes in jewel tones' },
  ],
};

export const OCCASIONS = ['CASUAL', 'OFFICE', 'WEEKEND', 'EVENING', 'DINNER', 'TRAVEL', 'GYM'] as const;

// ─── Collection item resolution ──────────────────────────────────────────────

import { WardrobeItem } from '../types/fitEngine';

export interface CollectionDisplayItem {
  id: string;
  name: string;
  categoryLabel: string;
  imageSource: number | { uri: string } | null;
}

export function resolveItemIds(ids: string[], wardrobeItems: WardrobeItem[]): CollectionDisplayItem[] {
  return ids.map(id => {
    const s = itemById(id);
    if (s) {
      return {
        id,
        name: s.name,
        categoryLabel: s.type,
        imageSource: s.png ?? (s.img ? { uri: s.img } : null),
      };
    }
    const r = wardrobeItems.find(i => i.id === id);
    if (r) {
      return {
        id,
        name: r.notes ?? r.category.toUpperCase(),
        categoryLabel: r.category.toUpperCase(),
        imageSource: r.photoUrl ? { uri: r.photoUrl } : null,
      };
    }
    return null;
  }).filter((item): item is CollectionDisplayItem => item !== null);
}

export const COLOR_HEX: Record<string, string> = {
  Beige: '#D4C2A0', Cream: '#EFE6D2', White: '#F5F1E8', Tan: '#C9A77A',
  Brown: '#7C5A3B', Camel: '#B89776', Sand: '#D9C9A8', Stone: '#C2B7A3',
  Charcoal: '#3A3631', Black: '#1F1D1A', Grey: '#9C968B', Indigo: '#3E4A66',
  Blue: '#5C7392', Navy: '#2A3550', Gold: '#C9A865',
  Mustard: '#C6A24C', Olive: '#7B7A4E', Burgundy: '#7E2F36',
};
