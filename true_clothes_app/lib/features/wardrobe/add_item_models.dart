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

// ---------------------------------------------------------------------------
// Measurement enums
// ---------------------------------------------------------------------------

/// All possible garment measurement keys. [jsonKey] is the stable string used
/// for JSON persistence — do not rename existing values.
enum MeasurementKey {
  chest('chest'),
  waistTop('waist_top'),
  waistOuter('waist_outer'),
  waist('waist'),
  shoulderWidth('shoulder_width'),
  sleeves('sleeves'),
  bodyLength('body_length'),
  upperArm('upper_arm'),
  hip('hip'),
  inseam('inseam'),
  thigh('thigh'),
  rise('rise'),
  skirtLength('skirt_length'),
  shoeSize('shoe_size'),
  shoeWidth('shoe_width'),
  length('length'),
  width('width'),
  bagHeight('bag_height'),
  bagWidth('bag_width'),
  bagDepth('bag_depth');

  const MeasurementKey(this.jsonKey);

  /// Stable string key used in JSON — matches legacy string keys exactly.
  final String jsonKey;

  static MeasurementKey? fromJsonKey(String key) {
    for (final k in MeasurementKey.values) {
      if (k.jsonKey == key) return k;
    }
    return null;
  }
}

enum MeasurementUnit {
  cm('CM'),
  inch('IN');

  const MeasurementUnit(this.label);
  final String label;
}

// ---------------------------------------------------------------------------
// Item attribute enums
// ---------------------------------------------------------------------------

enum ClothingColor {
  neutral('neutral'),
  black('black'),
  white('white'),
  navy('navy'),
  beige('beige'),
  gray('gray'),
  brown('brown'),
  olive('olive'),
  blue('blue'),
  red('red'),
  purple('purple'),
  green('green'),
  yellow('yellow'),
  pink('pink'),
  orange('orange'),
  cream('cream'),
  ivory('ivory'),
  camel('camel'),
  tan('tan'),
  taupe('taupe'),
  khaki('khaki'),
  charcoal('charcoal'),
  burgundy('burgundy'),
  teal('teal'),
  metallic('metallic'),
  multicolor('multicolor'),
  natural('natural');

  const ClothingColor(this.value);

  /// Lowercase stable string for JSON persistence and scoring comparisons.
  final String value;

  static ClothingColor fromString(String s) {
    final normalized = s.toLowerCase().trim();
    const aliases = <String, ClothingColor>{
      'grey': ClothingColor.gray,
      'wine': ClothingColor.burgundy,
      'gold': ClothingColor.metallic,
      'silver': ClothingColor.metallic,
    };
    final fromAlias = aliases[normalized];
    if (fromAlias != null) return fromAlias;
    for (final c in ClothingColor.values) {
      if (c.value == normalized) return c;
    }
    return ClothingColor.neutral;
  }
}

/// Perceived lightness (value) of the garment’s main color — light vs deep.
/// Pairs with [ClothingColor] (hue family) for outfit harmony.
enum ColorLightness {
  light('light'),
  medium('medium'),
  dark('dark');

  const ColorLightness(this.value);

  /// Stable JSON string — do not rename existing values.
  final String value;

  static ColorLightness fromString(String? s) {
    if (s == null || s.isEmpty) return ColorLightness.medium;
    final n = s.toLowerCase().trim();
    for (final v in ColorLightness.values) {
      if (v.value == n || v.name == n) return v;
    }
    return ColorLightness.medium;
  }
}

/// Chroma / saturation band — soft “dusty” vs clear “true” color.
enum ColorSaturation {
  muted('muted'),
  balanced('balanced'),
  vivid('vivid');

  const ColorSaturation(this.value);

  /// Stable JSON string — do not rename existing values.
  final String value;

  static ColorSaturation fromString(String? s) {
    if (s == null || s.isEmpty) return ColorSaturation.balanced;
    final n = s.toLowerCase().trim();
    const aliases = <String, ColorSaturation>{
      'soft': ColorSaturation.muted,
      'dusty': ColorSaturation.muted,
      'bold': ColorSaturation.vivid,
      'saturated': ColorSaturation.vivid,
      'bright': ColorSaturation.vivid,
    };
    final a = aliases[n];
    if (a != null) return a;
    for (final v in ColorSaturation.values) {
      if (v.value == n || v.name == n) return v;
    }
    return ColorSaturation.balanced;
  }
}

/// How much visible artwork/graphic is on the garment.
/// Drives style-compatibility rules in outfit building.
enum GraphicWeight {
  none('none'),
  smallLogo('small_logo'),
  mediumLogo('medium_logo'),
  largeGraphic('large_graphic'),
  fullPrint('full_print');

  const GraphicWeight(this.value);

  /// Stable JSON key — do not rename existing values.
  final String value;

  static GraphicWeight fromString(String? s) {
    if (s == null || s.isEmpty) return GraphicWeight.none;
    for (final v in GraphicWeight.values) {
      if (v.value == s) return v;
    }
    return GraphicWeight.none;
  }
}

/// What kind of artwork is on the garment.
enum ArtworkType {
  none('none'),
  brandLogo('brand_logo'),
  sloganText('slogan_text'),
  graphicIllustration('graphic_illustration'),
  allOverPrint('all_over_print');

  const ArtworkType(this.value);

  /// Stable JSON key — do not rename existing values.
  final String value;

  static ArtworkType fromString(String? s) {
    if (s == null || s.isEmpty) return ArtworkType.none;
    for (final v in ArtworkType.values) {
      if (v.value == s) return v;
    }
    return ArtworkType.none;
  }
}

enum ClothingPattern {
  solid,
  striped,
  plaid,
  checkered,
  floral,
  graphic,
  abstract_;

  static ClothingPattern? fromString(String? s) {
    if (s == null) return null;
    for (final p in ClothingPattern.values) {
      if (p.name == s) return p;
    }
    return null;
  }
}

enum FabricWeight {
  light,
  medium,
  heavy;

  static FabricWeight? fromString(String? s) {
    if (s == null) return null;
    for (final w in FabricWeight.values) {
      if (w.name == s.toLowerCase().trim()) return w;
    }
    return null;
  }
}

enum Breathability {
  low,
  medium,
  high;

  static Breathability? fromString(String? s) {
    if (s == null) return null;
    for (final b in Breathability.values) {
      if (b.name == s.toLowerCase().trim()) return b;
    }
    return null;
  }
}

enum Season {
  spring,
  summer,
  fall,
  winter,
  allSeason;

  static Season? fromString(String? s) {
    if (s == null) return null;
    for (final v in Season.values) {
      if (v.name == s) return v;
    }
    return null;
  }
}

enum LayerRole {
  base,
  mid,
  outer;

  static LayerRole? fromString(String? s) {
    if (s == null) return null;
    for (final v in LayerRole.values) {
      if (v.name == s) return v;
    }
    return null;
  }
}

// ---------------------------------------------------------------------------
// Measurement definitions
// ---------------------------------------------------------------------------

/// A single garment measurement with its unit.
class MeasurementValue {
  MeasurementValue({this.value, this.unit = MeasurementUnit.cm});

  double? value;
  MeasurementUnit unit;

  bool get hasValue => value != null;
}

/// Measurement field definition for a specific item type.
class MeasurementDef {
  const MeasurementDef({required this.key, required this.label, this.iconAsset});
  final MeasurementKey key;
  final String label;
  final String? iconAsset;
}

const topMeasurements = [
  MeasurementDef(key: MeasurementKey.chest, label: 'Chest / Bust'),
  MeasurementDef(key: MeasurementKey.waistTop, label: 'Waist'),
  MeasurementDef(key: MeasurementKey.shoulderWidth, label: 'Shoulder width'),
  MeasurementDef(key: MeasurementKey.sleeves, label: 'Sleeve length'),
  MeasurementDef(key: MeasurementKey.bodyLength, label: 'Body length'),
  MeasurementDef(key: MeasurementKey.upperArm, label: 'Upper arm'),
];

const pantsMeasurements = [
  MeasurementDef(key: MeasurementKey.waist, label: 'Waist'),
  MeasurementDef(key: MeasurementKey.hip, label: 'Hip'),
  MeasurementDef(key: MeasurementKey.inseam, label: 'Inseam'),
  MeasurementDef(key: MeasurementKey.thigh, label: 'Thigh'),
  MeasurementDef(key: MeasurementKey.rise, label: 'Rise'),
];

const skirtMeasurements = [
  MeasurementDef(key: MeasurementKey.waist, label: 'Waist'),
  MeasurementDef(key: MeasurementKey.hip, label: 'Hip'),
  MeasurementDef(key: MeasurementKey.skirtLength, label: 'Skirt length'),
];

const outerwearMeasurements = [
  MeasurementDef(key: MeasurementKey.chest, label: 'Chest'),
  MeasurementDef(key: MeasurementKey.waistOuter, label: 'Waist'),
  MeasurementDef(key: MeasurementKey.shoulderWidth, label: 'Shoulder width'),
  MeasurementDef(key: MeasurementKey.sleeves, label: 'Sleeve length'),
  MeasurementDef(key: MeasurementKey.bodyLength, label: 'Body length'),
  MeasurementDef(key: MeasurementKey.upperArm, label: 'Upper arm'),
];

const shoesMeasurements = [
  MeasurementDef(key: MeasurementKey.shoeSize, label: 'Size'),
  MeasurementDef(key: MeasurementKey.shoeWidth, label: 'Width'),
];

const accessoryMeasurements = [
  MeasurementDef(key: MeasurementKey.length, label: 'Length'),
  MeasurementDef(key: MeasurementKey.width, label: 'Width'),
];

const bagMeasurements = [
  MeasurementDef(key: MeasurementKey.bagHeight, label: 'Height'),
  MeasurementDef(key: MeasurementKey.bagWidth, label: 'Width'),
  MeasurementDef(key: MeasurementKey.bagDepth, label: 'Depth'),
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

// ---------------------------------------------------------------------------
// Form state
// ---------------------------------------------------------------------------

/// Aggregated data across both steps of the add-item flow.
class NewItemData {
  String? imagePath;
  String name = '';
  ItemType type = ItemType.bottomItem;
  String description = '';

  String brand = '';
  String productUrl = '';
  Map<MeasurementKey, MeasurementValue> measurements = {};
  List<String> tags = [];

  /// User-assigned hue family for outfit harmony (see docs/building-outift.md).
  ClothingColor primaryColor = ClothingColor.neutral;

  /// Lightness (value): pastel vs deep within the hue family.
  ColorLightness colorLightness = ColorLightness.medium;

  /// Saturation: muted vs vivid chroma.
  ColorSaturation colorSaturation = ColorSaturation.balanced;

  /// Optional style keywords for scoring; may overlap with [tags].
  List<String> styleTags = [];

  /// How much visible artwork/graphic is on the garment.
  GraphicWeight graphicWeight = GraphicWeight.none;

  /// What kind of artwork is present (brand logo, slogan, illustration, etc).
  ArtworkType artworkType = ArtworkType.none;

  /// True when [graphicWeight] and [artworkType] were set by auto-detection
  /// rather than user selection. Shown as "Auto-detected" chip in the UI.
  bool graphicAutoDetected = false;
}
