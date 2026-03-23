// Mirrors Kotlin `ItemDetailModels.kt` for demo outfit / composition mapping.

enum ItemCategory { top, bottom, outwear, shoes, accessory }

class OutfitItemInfo {
  const OutfitItemInfo({
    this.itemId,
    required this.name,
    required this.itemColor,
    required this.form,
    required this.aesthetic,
    required this.material,
    this.imageSource,
    required this.actionText,
    required this.fullName,
    required this.brand,
    this.productUrl,
    required this.category,
    required this.measurements,
  });

  final String? itemId;
  final String name;
  final String itemColor;
  final String form;
  final String aesthetic;
  final String material;
  final String? imageSource;
  final String actionText;
  final String fullName;
  final String brand;
  final String? productUrl;
  final ItemCategory category;
  final Map<String, String> measurements;
}

class OutfitDetailPayload {
  const OutfitDetailPayload({
    this.outfitId,
    required this.title,
    this.overview,
    required this.tags,
    required this.items,
  });

  final String? outfitId;
  final String title;
  /// Short editorial summary under the outfit title (optional; design body copy).
  final String? overview;
  final List<String> tags;
  final List<OutfitItemInfo> items;
}

class OutfitCompositionSources {
  const OutfitCompositionSources({
    this.pants,
    this.jacket,
    this.shirt,
    this.bag,
    this.shoes,
  });

  final String? pants;
  final String? jacket;
  final String? shirt;
  final String? bag;
  final String? shoes;
}

extension OutfitDetailPayloadComposition on OutfitDetailPayload {
  OutfitCompositionSources toCompositionSources() {
    final byCategory = <ItemCategory, List<OutfitItemInfo>>{};
    for (final item in items) {
      byCategory.putIfAbsent(item.category, () => []).add(item);
    }

    String? firstImage(ItemCategory cat, int indexFallback) {
      final list = byCategory[cat];
      if (list != null && list.isNotEmpty) {
        return list.first.imageSource;
      }
      if (indexFallback >= 0 && indexFallback < items.length) {
        return items[indexFallback].imageSource;
      }
      return null;
    }

    return OutfitCompositionSources(
      pants: firstImage(ItemCategory.bottom, 0),
      jacket: firstImage(ItemCategory.outwear, 1),
      shirt: firstImage(ItemCategory.top, 2),
      bag: firstImage(ItemCategory.accessory, 3),
      shoes: firstImage(ItemCategory.shoes, 4),
    );
  }
}

/// Demo payload aligned with Kotlin `demoOutfitDetailPayload()`; paths match `assets/*.png`.
OutfitDetailPayload demoOutfitDetailPayload() {
  return OutfitDetailPayload(
    outfitId: 'demo-outfit-gentlemen',
    title: 'The gentlemen',
    overview:
        'Indigo denim, soft tailoring, and black leather accents—edited for days '
        'that move between work and evening without changing the whole look.',
    tags: [
      'minimalism',
      'menswear',
      'classic',
      'sunny day',
      'formal',
      'quiet luxury',
    ],
    items: [
      OutfitItemInfo(
        itemId: 'demo-item-jeans',
        name: 'Jeans Denim',
        itemColor: 'NAVI',
        form: 'Regular fit',
        aesthetic: 'Quiet luxury',
        material: '50% polyester, 50% cotton',
        imageSource: 'assets/jeans.png',
        actionText: 'Go to closet',
        fullName: 'Slim taper indigo stretch denim jeans',
        brand: 'A.P.C.',
        productUrl: 'https://example.com/products/slim-jeans',
        category: ItemCategory.bottom,
        measurements: {
          'waist': '81 cm',
          'inseam': '81 cm',
          'thigh': '58 cm',
          'knee': '38 cm',
          'leg_opening': '34 cm',
          'rise': '26 cm',
        },
      ),
      OutfitItemInfo(
        itemId: 'demo-item-harrington',
        name: 'Harrington Jacket',
        itemColor: 'BEIGE',
        form: 'Oversize',
        aesthetic: 'Old money',
        material: '70% wool, 30% viscose',
        imageSource: 'assets/harrington.png',
        actionText: 'Go to closet',
        fullName: 'Cotton-blend Harrington jacket',
        brand: 'Baracuta',
        productUrl: 'https://example.com/products/harrington',
        category: ItemCategory.outwear,
        measurements: {
          'chest': '104 cm',
          'shoulder': '48 cm',
          'sleeves': '65 cm',
          'length': '68 cm',
          'bicep': '36 cm',
        },
      ),
      OutfitItemInfo(
        itemId: 'demo-item-shirt',
        name: 'Uniqlo Airism Shirt',
        itemColor: 'BLACK',
        form: 'Wide fit',
        aesthetic: 'Formal',
        material: '100% cotton',
        imageSource: 'assets/shirt.png',
        actionText: 'Go to shop',
        fullName: 'Poplin spread-collar dress shirt',
        brand: 'Brooks Brothers',
        productUrl: 'https://example.com/products/poplin-shirt',
        category: ItemCategory.top,
        measurements: {
          'chest': '98 cm',
          'sleeves': '64 cm',
          'shoulder': '45 cm',
          'bicep': '34 cm',
          'length': '78 cm',
        },
      ),
      OutfitItemInfo(
        itemId: 'demo-item-bag',
        name: 'Hermes Bag',
        itemColor: 'BLACK',
        form: 'Regular fit',
        aesthetic: 'Casual',
        material: '100% leather',
        imageSource: 'assets/bag.png',
        actionText: 'Go to shop',
        fullName: 'Crossbody leather mini bag',
        brand: 'COS',
        productUrl: 'https://example.com/products/crossbody-bag',
        category: ItemCategory.accessory,
        measurements: {
          'length': '22 cm',
          'width': '18 cm',
          'height': '8 cm',
          'strap_drop': '55 cm',
        },
      ),
      OutfitItemInfo(
        itemId: 'demo-item-shoes',
        name: 'Loafer',
        itemColor: 'BLACK',
        form: 'Regular fit',
        aesthetic: 'Casual',
        material: '60% leather, 40% rubber',
        imageSource: 'assets/shoes.png',
        actionText: 'Go to closet',
        fullName: 'Leather derby shoes',
        brand: 'Dr. Martens',
        productUrl: 'https://example.com/products/derby',
        category: ItemCategory.shoes,
        measurements: {
          'size_us': '9',
          'size_eu': '42',
          'foot_length': '27 cm',
          'width': 'D',
          'instep': '24 cm',
        },
      ),
    ],
  );
}
