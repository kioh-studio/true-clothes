import 'wardrobe_demo_data.dart';

/// A user-created collection of wardrobe items grouped by theme/aesthetic.
///
/// Many-to-many: an item can belong to many collections,
/// and a collection can hold many items.
class ItemCollection {
  const ItemCollection({
    required this.id,
    required this.name,
    required this.items,
  });

  final String id;
  final String name;
  final List<WardrobeItem> items;
}

/// Demo collections built from existing wardrobe items.
///
/// Edit this list to change mock data without touching screen code.
final List<ItemCollection> demoCollections = _build();

List<ItemCollection> _build() {
  final all = <WardrobeItem>[];
  for (final list in demoWardrobeItems.values) {
    all.addAll(list);
  }

  WardrobeItem? find(String id) {
    for (final item in all) {
      if (item.id == id) return item;
    }
    return null;
  }

  final jeans = find('demo-jeans-2') ?? all.firstWhere((i) => i.name.contains('Jeans'), orElse: () => all.first);
  final harrington = find('demo-harrington-2') ?? all.firstWhere((i) => i.name.contains('Harrington'), orElse: () => all.first);
  final airism = find('demo-airism') ?? all.firstWhere((i) => i.name.contains('Airism'), orElse: () => all.first);
  final shoes = find('demo-shoes-2') ?? all.firstWhere((i) => i.name.contains('Sneakers'), orElse: () => all.first);

  return [
    ItemCollection(
      id: 'col-soft-boy',
      name: 'Soft boy',
      items: [jeans, harrington, airism],
    ),
    ItemCollection(
      id: 'col-quiet-luxury',
      name: 'Quiet luxury',
      items: [jeans, harrington, shoes],
    ),
  ];
}
