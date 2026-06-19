// Bundled clothing-cutout assets, keyed for DB-backed wardrobe items whose
// photo_url is stored as `asset:<key>` (feature 003-upload-image). These ship
// in the app bundle, so they render on any device/build without a file push or
// network — used to seed real items with a matching catalog image.

export const ITEM_ASSETS: Record<string, number> = {
  'tee-white':         require('../../../assets/items/tee-white.png'),
  'tee-yellow':        require('../../../assets/items/tee-yellow.png'),
  'tee-burgundy':      require('../../../assets/items/tee-burgundy.png'),
  'tee-grey':          require('../../../assets/items/tee-grey.png'),
  'tee-airism':        require('../../../assets/items/tee-airism.png'),
  'tee-beige':         require('../../../assets/items/tee-beige.jpeg'),
  'polo-olive':        require('../../../assets/items/polo-olive.png'),
  'sweater-black':     require('../../../assets/items/sweater-black.png'),
  'jacket-harrington': require('../../../assets/items/jacket-harrington.png'),
  'jeans-blue':        require('../../../assets/items/jeans-blue.png'),
  'jeans-dark':        require('../../../assets/items/jeans-dark.png'),
  'shirt-denim':       require('../../../assets/items/shirt-denim.png'),
  'trousers-wide':     require('../../../assets/items/trousers-wide.png'),
  'white-sneaker':     require('../../../assets/items/white-sneaker.png'),
  'loafers-black':     require('../../../assets/items/loafers-black.png'),
  'mule-tan':          require('../../../assets/items/mule-tan.png'),
  'bag-black':         require('../../../assets/items/bag-black.png'),
  'cap-plaid':         require('../../../assets/items/cap-plaid.png'),
};

const ASSET_PREFIX = 'asset:';

export function isAssetRef(photoPath: string | null | undefined): boolean {
  return !!photoPath && photoPath.startsWith(ASSET_PREFIX);
}

/** Resolve an `asset:<key>` reference to its bundled module, or null if unknown. */
export function resolveAssetRef(photoPath: string): number | null {
  const key = photoPath.slice(ASSET_PREFIX.length);
  return ITEM_ASSETS[key] ?? null;
}
