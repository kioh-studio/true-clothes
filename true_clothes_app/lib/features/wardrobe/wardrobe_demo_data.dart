import '../home/home_outfit_models.dart';

/// Wardrobe item display model — used by the My Wardrobe screen slider.
///
/// In production, instances are created from backend API responses.
/// For demo/offline, use [demoWardrobeItems] below.
class WardrobeItem {
  const WardrobeItem({
    required this.id,
    required this.name,
    this.imageUrl,
    this.detailInfo,
  });

  final String id;
  final String name;

  /// Image source — local asset path (e.g. `assets/jeans.png`) or
  /// network URL (e.g. `https://cdn.example.com/items/123.jpg`).
  /// When null, a placeholder icon is shown.
  final String? imageUrl;

  /// Full item detail payload for navigation to ItemDetailScreen.
  final OutfitItemInfo? detailInfo;

  bool get isAssetImage => imageUrl != null && !imageUrl!.startsWith('http');
}

/// Demo wardrobe items grouped by category label.
///
/// Edit this map to change mock data without touching screen code.
/// Each category should have ≥2 items so the slider shows the
/// primary/secondary card contrast.
final Map<String, List<WardrobeItem>> demoWardrobeItems = _build();

Map<String, List<WardrobeItem>> _build() {
  final demo = demoOutfitDetailPayload();
  final byCategory = <ItemCategory, OutfitItemInfo>{};
  for (final item in demo.items) {
    byCategory[item.category] = item;
  }

  WardrobeItem fromInfo(OutfitItemInfo info) => WardrobeItem(
        id: info.itemId ?? info.name,
        name: info.name,
        imageUrl: info.imageSource,
        detailInfo: info,
      );

  final top = byCategory[ItemCategory.top]!;
  final bottom = byCategory[ItemCategory.bottom]!;
  final outwear = byCategory[ItemCategory.outwear]!;
  final shoes = byCategory[ItemCategory.shoes]!;
  final accessory = byCategory[ItemCategory.accessory]!;

  return {
    'Top': [
      fromInfo(top),
      WardrobeItem(
        id: 'demo-airism',
        name: 'Airism Cotton T-Shirt',
        imageUrl: 'assets/airism.png',
        detailInfo: top,
      ),
    ],
    'Bottom': [
      fromInfo(bottom),
      WardrobeItem(
        id: 'demo-jeans-2',
        name: 'Straight Fit Jeans',
        imageUrl: 'assets/jeans.png',
        detailInfo: bottom,
      ),
    ],
    'Outerwear': [
      fromInfo(outwear),
      WardrobeItem(
        id: 'demo-harrington-2',
        name: 'Cotton Harrington',
        imageUrl: 'assets/harrington.png',
        detailInfo: outwear,
      ),
    ],
    'Shoes': [
      fromInfo(shoes),
      WardrobeItem(
        id: 'demo-shoes-2',
        name: 'Casual Sneakers',
        imageUrl: 'assets/shoes.png',
        detailInfo: shoes,
      ),
    ],
    'Accessory': [],
    'Bag': [
      fromInfo(accessory),
      WardrobeItem(
        id: 'demo-bag-2',
        name: 'Canvas Tote',
        imageUrl: 'assets/bag.png',
        detailInfo: accessory,
      ),
    ],
  };
}
