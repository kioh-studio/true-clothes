// data.jsx — Sample wardrobe items, outfits, collections, photos.
// All Unsplash URLs use stable photo IDs; Photo component falls back to elegant placeholder on error.

// Editorial fashion photo URLs (Unsplash, stable IDs)
const U = (id, w = 800) => `https://images.unsplash.com/${id}?w=${w}&q=80&auto=format&fit=crop`;

// Curated editorial photo set
const PHOTOS = {
  // Outfit hero shots (full-body, editorial, neutral)
  outfit_1: U('photo-1490481651871-ab68de25d43d'),
  outfit_2: U('photo-1539109136881-3be0616acf4b'),
  outfit_3: U('photo-1483985988355-763728e1935b'),
  outfit_4: U('photo-1496217590455-aa63a8350eea'),
  outfit_5: U('photo-1485231183945-fffde7cc051e'),
  outfit_6: U('photo-1551488831-00ddcb6c6bd3'),
  outfit_7: U('photo-1469334031218-e382a71b716b'),
  outfit_8: U('photo-1490114538077-0a7f8cb49891'),

  // Garment details (B&W or neutral closeups for hero/splash)
  detail_1: U('photo-1558769132-cb1aea458c5e'),
  detail_2: U('photo-1542272604-787c3835535d'),
  detail_3: U('photo-1485518882345-15568b007407'),

  // Style mood boards
  style_oldmoney: U('photo-1581338834647-b0fb40704e21'),
  style_streetwear: U('photo-1523398002811-999ca8dec234'),
  style_minimalist: U('photo-1487222477894-8943e31ef7b2'),
  style_smartcasual: U('photo-1507003211169-0a1dd7228f2d'),
  style_preppy: U('photo-1521572163474-6864f9cf17ab'),
  style_athleisure: U('photo-1539109136881-3be0616acf4b'),
  style_y2k: U('photo-1529139574466-a303027c1d8b'),
  style_bohemian: U('photo-1502716119720-b23a93e5fe1b'),

  // Trending hero
  trend_hero: U('photo-1581338834647-b0fb40704e21'),
};

// Wardrobe items
// `png` is a transparent product cutout — when present, used by the collage
// without any frame. Falls back to a flat-color silhouette if absent.
const ITEMS = [
  // Tops (user-supplied PNG cutouts)
  { id: 'i_tee_white',  type: 'TEE',    name: 'Oversized white tee',  color: 'White',    material: 'Cotton', png: 'assets/items/tee-white.png',    img: U('photo-1521572163474-6864f9cf17ab', 600), tone: 2, wornCount: 12, addedDate: 'Apr 2026' },
  { id: 'i_tee_yellow', type: 'TEE',    name: 'Mustard cotton tee',   color: 'Mustard',  material: 'Cotton', png: 'assets/items/tee-yellow.png',   img: U('photo-1521572163474-6864f9cf17ab', 600), tone: 4, wornCount: 5,  addedDate: 'Apr 2026' },
  { id: 'i_tee_burg',   type: 'TEE',    name: 'Burgundy cotton tee',  color: 'Burgundy', material: 'Cotton', png: 'assets/items/tee-burgundy.png', img: U('photo-1521572163474-6864f9cf17ab', 600), tone: 3, wornCount: 4,  addedDate: 'Mar 2026' },
  { id: 'i_tee_grey',   type: 'TEE',    name: 'Heather grey tee',     color: 'Grey',     material: 'Cotton', png: 'assets/items/tee-grey.png',     img: U('photo-1521572163474-6864f9cf17ab', 600), tone: 1, wornCount: 16, addedDate: 'May 2026' },
  { id: 'i_tee_airism', type: 'TEE',    name: 'Airism crew tee',      color: 'Grey',     material: 'Cotton', png: 'assets/items/tee-airism.png',   img: U('photo-1521572163474-6864f9cf17ab', 600), tone: 1, wornCount: 9,  addedDate: 'May 2026' },
  { id: 'i_polo_olive', type: 'POLO',   name: 'Olive knit polo',      color: 'Olive',    material: 'Cotton', png: 'assets/items/polo-olive.png',   img: U('photo-1602810318383-e386cc2a3ccf', 600), tone: 1, wornCount: 6,  addedDate: 'Feb 2026' },
  { id: 'i_swt_black',  type: 'KNIT',   name: 'Black crewneck',       color: 'Black',    material: 'Cotton', png: 'assets/items/sweater-black.png',img: U('photo-1576566588028-4147f3842f27', 600), tone: 3, wornCount: 8,  addedDate: 'Jan 2026' },
  { id: 'i_tee_beige',  type: 'KNIT',   name: 'Beige milano knit',    color: 'Beige',    material: 'Wool',   png: 'assets/items/tee-beige.jpeg',   img: U('photo-1576566588028-4147f3842f27', 600), tone: 0, pngBlend: true, wornCount: 9, addedDate: 'Jan 2026' },

  // Outerwear
  { id: 'i_jkt_harr',   type: 'JACKET', name: 'Beige harrington',     color: 'Beige',    material: 'Cotton', png: 'assets/items/jacket-harrington.png', img: U('photo-1591047139829-d91aecb6caea', 600), tone: 0, wornCount: 4, addedDate: 'May 2026' },

  // Bottoms
  { id: 'i_jeans_blue', type: 'JEANS',  name: 'Light wash jeans',     color: 'Indigo',   material: 'Denim',  png: 'assets/items/jeans-blue.png',   img: U('photo-1542272604-787c3835535d', 600), tone: 2, wornCount: 14, addedDate: 'Apr 2026' },
  { id: 'i_jeans_dark', type: 'JEANS',  name: 'Dark wash jeans',      color: 'Navy',     material: 'Denim',  png: 'assets/items/jeans-dark.png',   img: U('photo-1542272604-787c3835535d', 600), tone: 3, wornCount: 11, addedDate: 'Apr 2026' },

  // Shoes (PNG cutout)
  { id: 'i_loaf_black', type: 'LOAFERS',name: 'Black penny loafers',  color: 'Black',    material: 'Leather',png: 'assets/items/loafers-black.png',img: U('photo-1582897085656-c636d006a246', 600), tone: 3, wornCount: 7, addedDate: 'Mar 2026' },

  // Bags (PNG cutout)
  { id: 'i_bag_black',  type: 'BAG',    name: 'Black nylon tote',     color: 'Black',    material: 'Nylon',  png: 'assets/items/bag-black.png',    img: U('photo-1548036328-c9fa89d128fa', 500), tone: 3, wornCount: 6, addedDate: 'Apr 2026' },

  // Items without PNG yet — appear in lists only, not collage
  { id: 'i1', type: 'BLAZER',   name: 'Beige linen blazer',     color: 'Beige',    material: 'Linen',   img: U('photo-1591047139829-d91aecb6caea', 600), tone: 0, wornCount: 3, addedDate: 'May 2026' },
  { id: 'i4', type: 'LOAFERS',  name: 'Brown leather loafers',  color: 'Brown',    material: 'Leather', img: U('photo-1582897085656-c636d006a246', 600), tone: 1, wornCount: 5, addedDate: 'Feb 2026' },
  { id: 'i7', type: 'TROUSERS', name: 'Charcoal wool trousers', color: 'Charcoal', material: 'Wool',    img: U('photo-1473966968600-fa801b3ef83f', 600), tone: 3, wornCount: 4, addedDate: 'Jan 2026' },
  { id: 'i8', type: 'COAT',     name: 'Camel overcoat',         color: 'Camel',    material: 'Wool',    img: U('photo-1539533018447-63fcce2678e3', 600), tone: 0, wornCount: 2, addedDate: 'Dec 2025' },
  { id: 'i10', type: 'SNEAKERS',name: 'White low-tops',         color: 'White',    material: 'Canvas',  img: U('photo-1542291026-7eec264c27ff', 600), tone: 2, wornCount: 14, addedDate: 'Nov 2025' },
  { id: 'i11', type: 'SCARF',   name: 'Wool herringbone scarf', color: 'Grey',     material: 'Wool',    img: U('photo-1601925260368-ae2f83cf8b7f', 600), tone: 3, wornCount: 3, addedDate: 'Nov 2025' },
  { id: 'i12', type: 'CHINOS',  name: 'Stone cotton chinos',    color: 'Stone',    material: 'Cotton',  img: U('photo-1473966968600-fa801b3ef83f', 600), tone: 1, wornCount: 6, addedDate: 'Oct 2025' },

  // Accessory placeholders
  { id: 'a2', type: 'WATCH',    name: 'Gold quartz watch',      color: 'Gold',     material: 'Steel',   img: U('photo-1524805444758-089113d48a6d', 500), tone: 4, wornCount: 22, addedDate: 'Jan 2026' },
  { id: 'a3', type: 'NECKLACE', name: 'Gold chain pendant',     color: 'Gold',     material: 'Plated',  img: U('photo-1599643478518-a784e5dc4c8f', 500), tone: 4, wornCount: 18, addedDate: 'Dec 2025' },
  { id: 'a4', type: 'SUNGLASSES', name: 'Tortoise frames',      color: 'Brown',    material: 'Acetate', img: U('photo-1572635196237-14b3f281503f', 500), tone: 1, wornCount: 7, addedDate: 'Mar 2026' },
  { id: 'i5', type: 'BELT',     name: 'Tan calfskin belt',      color: 'Tan',      material: 'Leather', img: U('photo-1624222247344-550fb60583dc', 600), tone: 4, wornCount: 7, addedDate: 'Feb 2026' },
];

const itemById = (id) => ITEMS.find(i => i.id === id);

// Outfits — each has at minimum: one top, one bottom, one pair of shoes.
// May be enriched with outerwear, bag, or small accessories.
const OUTFITS = [
  {
    id: 'o1',
    title: 'Harrington & Denim',
    subtitle: 'casual friday',
    style: 'OLD MONEY',
    context: 'CASUAL FRIDAY',
    weather: '24°C',
    description: 'Beige harrington, white tee, light wash denim, black loafers.',
    longDescription: 'A jacket that belongs to no decade. Wear it open over a clean white tee, with jeans you have already broken in, and shoes that walk well.',
    tags: ['24°C', 'WEEKEND', 'DAYTIME'],
    tone: 0,
    itemIds: ['i_jeans_blue', 'i_tee_white', 'i_jkt_harr', 'i_loaf_black', 'i_bag_black'],
  },
  {
    id: 'o2',
    title: 'Quiet Monday',
    subtitle: 'workday rotation',
    style: 'MINIMALIST',
    context: 'WORKDAY',
    weather: '22°C',
    description: 'Beige knit, dark wash jeans, black loafers.',
    longDescription: 'A composed palette for the start of the week. Soft texture against sharp tailoring — nothing shouts, everything resolves.',
    tags: ['22°C', 'OFFICE', 'MORNING'],
    tone: 1,
    itemIds: ['i_jeans_dark', 'i_tee_beige', 'i_loaf_black', 'i_bag_black'],
  },
  {
    id: 'o3',
    title: 'Slow Sunday',
    subtitle: 'long lunch energy',
    style: 'SMART CASUAL',
    context: 'WEEKEND',
    weather: '26°C',
    description: 'Olive polo, light wash jeans, black loafers.',
    longDescription: 'For days that move at their own pace. A long lunch, a longer book, an evening walk through somewhere familiar.',
    tags: ['26°C', 'WEEKEND', 'AFTERNOON'],
    tone: 2,
    itemIds: ['i_jeans_blue', 'i_polo_olive', 'i_loaf_black'],
  },
  {
    id: 'o4',
    title: 'After Hours',
    subtitle: 'considered, never costumed',
    style: 'SMART CASUAL',
    context: 'DINNER',
    weather: '20°C',
    description: 'Black crewneck, dark wash jeans, black loafers.',
    longDescription: 'A dinner that doesn\'t announce itself. Considered, never costumed.',
    tags: ['20°C', 'EVENING', 'DINNER'],
    tone: 3,
    itemIds: ['i_jeans_dark', 'i_swt_black', 'i_loaf_black', 'i_bag_black'],
  },
  {
    id: 'o5',
    title: 'Off-Duty',
    subtitle: 'basics, executed precisely',
    style: 'STREETWEAR',
    context: 'WEEKEND',
    weather: '28°C',
    description: 'Mustard tee, light wash jeans, black loafers.',
    longDescription: 'The basics, executed precisely. The whole point is restraint — let the fit do the talking.',
    tags: ['28°C', 'CASUAL', 'DAY'],
    tone: 4,
    itemIds: ['i_jeans_blue', 'i_tee_yellow', 'i_loaf_black'],
  },
  {
    id: 'o6',
    title: 'Slate Weather',
    subtitle: 'overcast, considered',
    style: 'MINIMALIST',
    context: 'WORKDAY',
    weather: '19°C',
    description: 'Grey tee, harrington jacket, dark jeans, black loafers.',
    longDescription: 'Tone-on-tone with one warm note. The jacket holds the shape, the rest gets out of the way.',
    tags: ['19°C', 'OFFICE', 'DAY'],
    tone: 0,
    itemIds: ['i_jeans_dark', 'i_tee_grey', 'i_jkt_harr', 'i_loaf_black', 'i_bag_black'],
  },
];

const STYLES = [
  { id: 'oldmoney', name: 'Old Money', desc: 'REFINED · CLASSIC', img: PHOTOS.style_oldmoney },
  { id: 'streetwear', name: 'Streetwear', desc: 'URBAN · BOLD', img: PHOTOS.style_streetwear },
  { id: 'minimalist', name: 'Minimalist', desc: 'PARED · DELIBERATE', img: PHOTOS.style_minimalist },
  { id: 'smartcasual', name: 'Smart Casual', desc: 'POLISHED · EASY', img: PHOTOS.style_smartcasual },
  { id: 'preppy', name: 'Preppy', desc: 'CLEAN · TRADITIONAL', img: PHOTOS.style_preppy },
  { id: 'athleisure', name: 'Athleisure', desc: 'ACTIVE · RELAXED', img: PHOTOS.style_athleisure },
  { id: 'y2k', name: 'Y2K', desc: 'PLAYFUL · NOSTALGIC', img: PHOTOS.style_y2k },
  { id: 'bohemian', name: 'Bohemian', desc: 'FLOWING · ROMANTIC', img: PHOTOS.style_bohemian },
];

const COLORS = [
  { name: 'Cream', hex: '#F2EDE4', tag: 'WARM NEUTRAL' },
  { name: 'Sand', hex: '#D9C9A8', tag: 'EARTH' },
  { name: 'Camel', hex: '#B89776', tag: 'EARTH' },
  { name: 'Terracotta', hex: '#A0613F', tag: 'EARTH' },
  { name: 'Rust', hex: '#7C3B25', tag: 'EARTH' },
  { name: 'Dove', hex: '#C8C5BF', tag: 'NEUTRAL' },
  { name: 'Charcoal', hex: '#3A3631', tag: 'DARK NEUTRAL' },
  { name: 'Black', hex: '#1A1815', tag: 'DARK NEUTRAL' },
  { name: 'Navy', hex: '#1F2A44', tag: 'COOL' },
  { name: 'Slate', hex: '#5C6770', tag: 'COOL' },
  { name: 'Sage', hex: '#8B9B7A', tag: 'COOL' },
  { name: 'Forest', hex: '#3B4E3B', tag: 'COOL' },
  { name: 'Burgundy', hex: '#5C2B2E', tag: 'WARM' },
  { name: 'Mustard', hex: '#B58A2D', tag: 'WARM' },
  { name: 'Ochre', hex: '#9C6B2F', tag: 'WARM' },
  { name: 'Emerald', hex: '#2F5D4F', tag: 'ACCENT' },
];

const COLLECTIONS = [
  {
    id: 'c1', name: 'Workweek',
    description: 'Outfits I rotate Monday through Friday.',
    createdDate: 'CREATED MAY 2026',
    outfitIds: ['o1', 'o2', 'o3', 'o4', 'o6'],
  },
  {
    id: 'c2', name: 'Weekends',
    description: 'Slower days, unhurried compositions.',
    createdDate: 'CREATED APR 2026',
    outfitIds: ['o1', 'o5', 'o6'],
  },
  {
    id: 'c3', name: 'Travel',
    description: 'Pieces that pack flat and never feel borrowed.',
    createdDate: 'CREATED MAR 2026',
    outfitIds: ['o2', 'o4'],
  },
];

// Niche sub-styles surfaced after a top-level style is picked.
// Each niche is a more specific direction under its parent — used to refine
// the recommendation engine. id is namespaced as `<parent>:<niche>`.
const STYLE_NICHES = {
  oldmoney: [
    { id: 'oldmoney:ivy',          name: 'Ivy League',           desc: 'Tweed · repp ties · weejuns' },
    { id: 'oldmoney:european',     name: 'European Heritage',    desc: 'Loro Piana · Brunello · quiet luxury' },
    { id: 'oldmoney:wasp',         name: 'Coastal WASP',         desc: 'Linen · boat shoes · pastel chinos' },
    { id: 'oldmoney:equestrian',   name: 'Equestrian',           desc: 'Tall boots · waxed jackets · cords' },
  ],
  minimalist: [
    { id: 'minimalist:scandi',     name: 'Scandinavian',         desc: 'Cos · Toteme · muted tones' },
    { id: 'minimalist:japanese',   name: 'Japanese Wabi',        desc: 'Architectural · undyed · tonal' },
    { id: 'minimalist:margiela',   name: 'Margiela / Lemaire',   desc: 'Conceptual · pared · drape' },
    { id: 'minimalist:normcore',   name: 'Normcore',             desc: 'Anti-statement basics' },
  ],
  streetwear: [
    { id: 'streetwear:tokyo',      name: 'Tokyo Street',         desc: 'Layered · raf · avant-garde' },
    { id: 'streetwear:techwear',   name: 'Techwear',             desc: 'Acronym · matte black · function' },
    { id: 'streetwear:workwear',   name: 'Workwear',             desc: 'Carhartt · Dickies · raw denim' },
    { id: 'streetwear:gorpcore',   name: 'Gorpcore',             desc: 'Patagonia · Salomon · trail' },
  ],
  smartcasual: [
    { id: 'smartcasual:italian',   name: 'Sprezzatura',          desc: 'Italian tailoring · effortless' },
    { id: 'smartcasual:business',  name: 'Business Casual',      desc: 'Blazer · chinos · clean shirt' },
    { id: 'smartcasual:dandy',     name: 'Modern Dandy',         desc: 'Sharp tailoring with a twist' },
  ],
  preppy: [
    { id: 'preppy:classic',        name: 'Classic Prep',         desc: 'Polo · khakis · pennies' },
    { id: 'preppy:newengland',     name: 'New England',          desc: 'Fisherman knits · cords' },
    { id: 'preppy:modern',         name: 'Modern Prep',          desc: 'Updated proportions · clean' },
  ],
  athleisure: [
    { id: 'athleisure:tech',       name: 'Tech Active',          desc: 'Lululemon · ON · performance' },
    { id: 'athleisure:court',      name: 'Court / Tennis',       desc: 'White polo · pleated short' },
    { id: 'athleisure:studio',     name: 'Studio',               desc: 'Soft jersey · tonal layers' },
  ],
  y2k: [
    { id: 'y2k:mall',              name: 'Mall Y2K',             desc: 'Low-rise · logos · velour' },
    { id: 'y2k:mcbling',           name: 'McBling',              desc: 'Pink · sparkle · trucker caps' },
    { id: 'y2k:cyber',             name: 'Cyber Y2K',            desc: 'Silver · mesh · futurewear' },
  ],
  bohemian: [
    { id: 'bohemian:desert',       name: 'Desert Boho',          desc: 'Earth tones · fringe · suede' },
    { id: 'bohemian:cottage',      name: 'Cottagecore',          desc: 'Floral · soft · vintage' },
    { id: 'bohemian:gypset',       name: 'Gypset',               desc: 'Resort · crochet · layered' },
  ],
};

// "Why this works" rationale generator for suggested outfits — text labels
// pulled from the anchor items + filters.
const OCCASIONS = ['WORKDAY', 'WEEKEND', 'DINNER', 'TRAVEL', 'EVENT'];

Object.assign(window, { PHOTOS, ITEMS, OUTFITS, STYLES, COLORS, COLLECTIONS, STYLE_NICHES, OCCASIONS, itemById });
