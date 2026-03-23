/// Types of wardrobe items that can be added.
enum ItemType {
  topItem('Top item'),
  bottomItem('Bottom item (pants)'),
  skirt('Bottom item (skirt)'),
  outerwear('Outerwear'),
  shoes('Shoes'),
  accessory('Accessory'),
  bag('Bag');

  const ItemType(this.label);
  final String label;
}

/// A single garment measurement with its unit.
class MeasurementValue {
  MeasurementValue({this.value, this.unit = MeasurementUnit.cm});

  double? value;
  MeasurementUnit unit;

  bool get hasValue => value != null;
}

enum MeasurementUnit {
  cm('CM'),
  inch('IN');

  const MeasurementUnit(this.label);
  final String label;
}

/// Measurement definitions per item type.
class MeasurementDef {
  const MeasurementDef({required this.key, required this.label, this.iconAsset});
  final String key;
  final String label;
  final String? iconAsset;
}

const topMeasurements = [
  MeasurementDef(key: 'chest', label: 'Chest / Bust'),
  MeasurementDef(key: 'waist_top', label: 'Waist'),
  MeasurementDef(key: 'shoulder_width', label: 'Shoulder width'),
  MeasurementDef(key: 'sleeves', label: 'Sleeve length'),
  MeasurementDef(key: 'body_length', label: 'Body length'),
  MeasurementDef(key: 'upper_arm', label: 'Upper arm'),
];

const pantsMeasurements = [
  MeasurementDef(key: 'waist', label: 'Waist'),
  MeasurementDef(key: 'hip', label: 'Hip'),
  MeasurementDef(key: 'inseam', label: 'Inseam'),
  MeasurementDef(key: 'thigh', label: 'Thigh'),
  MeasurementDef(key: 'rise', label: 'Rise'),
];

const skirtMeasurements = [
  MeasurementDef(key: 'waist', label: 'Waist'),
  MeasurementDef(key: 'hip', label: 'Hip'),
  MeasurementDef(key: 'skirt_length', label: 'Skirt length'),
];

const outerwearMeasurements = [
  MeasurementDef(key: 'chest', label: 'Chest'),
  MeasurementDef(key: 'waist_outer', label: 'Waist'),
  MeasurementDef(key: 'shoulder_width', label: 'Shoulder width'),
  MeasurementDef(key: 'sleeves', label: 'Sleeve length'),
  MeasurementDef(key: 'body_length', label: 'Body length'),
  MeasurementDef(key: 'upper_arm', label: 'Upper arm'),
];

const shoesMeasurements = [
  MeasurementDef(key: 'shoe_size', label: 'Size'),
  MeasurementDef(key: 'shoe_width', label: 'Width'),
];

const accessoryMeasurements = [
  MeasurementDef(key: 'length', label: 'Length'),
  MeasurementDef(key: 'width', label: 'Width'),
];

const bagMeasurements = [
  MeasurementDef(key: 'bag_height', label: 'Height'),
  MeasurementDef(key: 'bag_width', label: 'Width'),
  MeasurementDef(key: 'bag_depth', label: 'Depth'),
];

List<MeasurementDef> measurementsForType(ItemType type) {
  switch (type) {
    case ItemType.topItem:
      return topMeasurements;
    case ItemType.outerwear:
      return outerwearMeasurements;
    case ItemType.bottomItem:
      return pantsMeasurements;
    case ItemType.skirt:
      return skirtMeasurements;
    case ItemType.shoes:
      return shoesMeasurements;
    case ItemType.accessory:
      return accessoryMeasurements;
    case ItemType.bag:
      return bagMeasurements;
  }
}

/// Aggregated data across both steps of the add-item flow.
class NewItemData {
  String? imagePath;
  String name = '';
  ItemType type = ItemType.bottomItem;
  String description = '';

  String brand = '';
  String productUrl = '';
  Map<String, MeasurementValue> measurements = {};
  List<String> tags = [];
}
