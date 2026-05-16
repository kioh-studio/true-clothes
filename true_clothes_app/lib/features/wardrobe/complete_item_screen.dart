import 'package:flutter/material.dart';
import 'package:flutter/widget_previews.dart';

import '../../core/responsive.dart';
import '../../theme/app_colors.dart';
import '../../theme/app_fonts.dart';
import '../../theme/app_theme.dart';
import '../../theme/widget_preview_theme.dart';
import '../../widgets/true_back_button.dart';
import '../../widgets/true_modal.dart';
import 'add_item_models.dart';

/// Step 2 of the "Add Item" flow — brand, product link, measurements, tags.
/// Design spec: `design/screen/add-item/design.md` → step_2_layout.
class CompleteItemScreen extends StatefulWidget {
  const CompleteItemScreen({
    super.key,
    required this.data,
    required this.onComplete,
  });

  final NewItemData data;
  final Future<void> Function() onComplete;

  @override
  State<CompleteItemScreen> createState() => _CompleteItemScreenState();
}

class _CompleteItemScreenState extends State<CompleteItemScreen> {
  static const _primaryColorChoices = <(ClothingColor, String)>[
    (ClothingColor.neutral, 'Neutral / not sure'),
    (ClothingColor.black, 'Black'),
    (ClothingColor.white, 'White'),
    (ClothingColor.ivory, 'Ivory'),
    (ClothingColor.cream, 'Cream'),
    (ClothingColor.beige, 'Beige'),
    (ClothingColor.camel, 'Camel'),
    (ClothingColor.tan, 'Tan'),
    (ClothingColor.natural, 'Natural (undyed)'),
    (ClothingColor.navy, 'Navy'),
    (ClothingColor.gray, 'Gray'),
    (ClothingColor.charcoal, 'Charcoal'),
    (ClothingColor.brown, 'Brown'),
    (ClothingColor.taupe, 'Taupe'),
    (ClothingColor.khaki, 'Khaki'),
    (ClothingColor.olive, 'Olive'),
    (ClothingColor.burgundy, 'Burgundy / wine'),
    (ClothingColor.red, 'Red'),
    (ClothingColor.orange, 'Orange'),
    (ClothingColor.yellow, 'Yellow'),
    (ClothingColor.pink, 'Pink'),
    (ClothingColor.purple, 'Purple'),
    (ClothingColor.green, 'Green'),
    (ClothingColor.teal, 'Teal'),
    (ClothingColor.blue, 'Blue'),
    (ClothingColor.metallic, 'Metallic (gold, silver, …)'),
    (ClothingColor.multicolor, 'Multicolor / print'),
  ];

  static const _lightnessChoices = <(ColorLightness, String)>[
    (ColorLightness.light, 'Light (pastel / airy)'),
    (ColorLightness.medium, 'Medium'),
    (ColorLightness.dark, 'Dark / deep'),
  ];

  static const _saturationChoices = <(ColorSaturation, String)>[
    (ColorSaturation.muted, 'Muted / soft'),
    (ColorSaturation.balanced, 'Balanced'),
    (ColorSaturation.vivid, 'Vivid / bold'),
  ];

  static const _artworkTypeChoices = <(ArtworkType, String)>[
    (ArtworkType.none, 'None'),
    (ArtworkType.brandLogo, 'Brand logo'),
    (ArtworkType.sloganText, 'Slogan / text'),
    (ArtworkType.graphicIllustration, 'Graphic / illustration'),
    (ArtworkType.allOverPrint, 'All-over print'),
  ];

  static const _graphicWeightTiles = <(GraphicWeight, String)>[
    (GraphicWeight.none, 'None'),
    (GraphicWeight.smallLogo, 'Small\nlogo'),
    (GraphicWeight.mediumLogo, 'Medium\nlogo'),
    (GraphicWeight.largeGraphic, 'Large\ngraphic'),
    (GraphicWeight.fullPrint, 'Full\nprint'),
  ];

  late final TextEditingController _brandController;
  late final TextEditingController _linkController;
  late final TextEditingController _tagInputController;
  late final List<MeasurementDef> _measurementDefs;
  late final Map<MeasurementKey, _MeasurementControllers> _measurementCtrls;
  late ClothingColor _primaryColor;
  late ColorLightness _colorLightness;
  late ColorSaturation _colorSaturation;
  late GraphicWeight _graphicWeight;
  late ArtworkType _artworkType;
  late bool _graphicAutoDetected;

  @override
  void initState() {
    super.initState();
    _brandController = TextEditingController(text: widget.data.brand);
    _linkController = TextEditingController(text: widget.data.productUrl);
    _tagInputController = TextEditingController();

    _measurementDefs = measurementsForType(widget.data.type);
    _measurementCtrls = {
      for (final def in _measurementDefs)
        def.key: _MeasurementControllers(
          controller: TextEditingController(),
          unit: MeasurementUnit.cm,
        ),
    };
    _primaryColor = widget.data.primaryColor;
    _colorLightness = widget.data.colorLightness;
    _colorSaturation = widget.data.colorSaturation;
    _graphicWeight = widget.data.graphicWeight;
    _artworkType = widget.data.artworkType;
    _graphicAutoDetected = widget.data.graphicAutoDetected;
  }

  @override
  void dispose() {
    _brandController.dispose();
    _linkController.dispose();
    _tagInputController.dispose();
    for (final mc in _measurementCtrls.values) {
      mc.controller.dispose();
    }
    super.dispose();
  }

  Future<void> _handleComplete() async {
    widget.data.brand = _brandController.text.trim();
    widget.data.productUrl = _linkController.text.trim();
    widget.data.primaryColor = _primaryColor;
    widget.data.colorLightness = _colorLightness;
    widget.data.colorSaturation = _colorSaturation;
    widget.data.graphicWeight = _graphicWeight;
    widget.data.artworkType = _artworkType;
    widget.data.graphicAutoDetected = false; // user has confirmed by saving

    final measurements = <MeasurementKey, MeasurementValue>{};
    for (final entry in _measurementCtrls.entries) {
      final text = entry.value.controller.text.trim();
      if (text.isNotEmpty) {
        final parsed = double.tryParse(text);
        if (parsed != null) {
          measurements[entry.key] = MeasurementValue(
            value: parsed,
            unit: entry.value.unit,
          );
        }
      }
    }
    widget.data.measurements = measurements;

    await widget.onComplete();
  }

  void _addTag() {
    final tag = _tagInputController.text.trim();
    if (tag.isNotEmpty && !widget.data.tags.contains(tag)) {
      setState(() {
        widget.data.tags.add(tag);
        _tagInputController.clear();
      });
    }
  }

  void _removeTag(String tag) {
    setState(() => widget.data.tags.remove(tag));
  }

  @override
  Widget build(BuildContext context) {
    final padH = scaleDp(context, 20);

    return Scaffold(
      backgroundColor: AppColors.mainBackground,
      body: SafeArea(
        child: Column(
          children: [
            _Header(onBack: () => Navigator.of(context).pop()),
            Expanded(
              child: SingleChildScrollView(
                padding: EdgeInsets.symmetric(horizontal: padH),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    SizedBox(height: scaleDp(context, 24)),
                    _buildBrandField(context),
                    SizedBox(height: scaleDp(context, 20)),
                    _buildLinkField(context),
                    SizedBox(height: scaleDp(context, 20)),
                    _buildColorAttributesSection(context),
                    SizedBox(height: scaleDp(context, 28)),
                    _Separator(),
                    SizedBox(height: scaleDp(context, 20)),
                    _buildGraphicSection(context),
                    SizedBox(height: scaleDp(context, 24)),
                    if (_measurementDefs.isNotEmpty) ...[
                      _Separator(),
                      SizedBox(height: scaleDp(context, 16)),
                      _MotivationalText(),
                      SizedBox(height: scaleDp(context, 24)),
                      ..._buildMeasurementRows(context),
                    ],
                    SizedBox(height: scaleDp(context, 32)),
                    _buildTagsSection(context),
                    SizedBox(height: scaleDp(context, 40)),
                    _CompleteButton(onTap: _handleComplete),
                    SizedBox(height: scaleDp(context, 24)),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildBrandField(BuildContext context) {
    return _LabeledInput(
      label: 'Brand',
      controller: _brandController,
      placeholder: 'Uniqlo',
    );
  }

  Widget _buildLinkField(BuildContext context) {
    return _LabeledInput(
      label: 'Link product',
      controller: _linkController,
      placeholder: 'shopee.com',
      keyboardType: TextInputType.url,
    );
  }

  Widget _buildColorAttributesSection(BuildContext context) {
    final labelStyle = AppFonts.poppins(
      context,
      fontSize: scaleSp(context, 14),
      fontWeight: FontWeight.w600,
      color: Colors.black,
    );
    final dropdownStyle = AppFonts.poppins(
      context,
      fontSize: scaleSp(context, 13),
      color: Colors.black,
    );
    final icon = Icon(
      Icons.arrow_drop_down,
      color: const Color(0xFF1D1B20),
      size: scaleDp(context, 20),
    );

    Widget paletteDropdown<T extends Object>({
      required String label,
      required T value,
      required List<(T, String)> choices,
      required ValueChanged<T?> onChanged,
    }) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(label, style: labelStyle),
          SizedBox(height: scaleDp(context, 8)),
          Container(
            height: scaleDp(context, 39.5),
            decoration: BoxDecoration(
              border: Border.all(color: Colors.black, width: 0.5),
            ),
            padding: EdgeInsets.symmetric(horizontal: scaleDp(context, 12)),
            child: DropdownButtonHideUnderline(
              child: DropdownButton<T>(
                value: value,
                isExpanded: true,
                icon: icon,
                style: dropdownStyle,
                items: choices
                    .map(
                      (e) => DropdownMenuItem<T>(
                        value: e.$1,
                        child: Text(e.$2),
                      ),
                    )
                    .toList(),
                onChanged: onChanged,
              ),
            ),
          ),
        ],
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(
          'Color',
          style: AppFonts.poppins(
            context,
            fontSize: scaleSp(context, 16),
            fontWeight: FontWeight.w600,
            color: Colors.black,
          ),
        ),
        SizedBox(height: scaleDp(context, 6)),
        Text(
          'Hue, lightness, and saturation help match outfits.',
          style: AppFonts.poppins(
            context,
            fontSize: scaleSp(context, 12),
            fontWeight: FontWeight.w400,
            color: Colors.black.withValues(alpha: 0.65),
          ),
        ),
        SizedBox(height: scaleDp(context, 16)),
        paletteDropdown<ClothingColor>(
          label: 'Hue (color family)',
          value: _primaryColor,
          choices: _primaryColorChoices,
          onChanged: (v) {
            if (v != null) setState(() => _primaryColor = v);
          },
        ),
        SizedBox(height: scaleDp(context, 16)),
        paletteDropdown<ColorLightness>(
          label: 'Lightness',
          value: _colorLightness,
          choices: _lightnessChoices,
          onChanged: (v) {
            if (v != null) setState(() => _colorLightness = v);
          },
        ),
        SizedBox(height: scaleDp(context, 16)),
        paletteDropdown<ColorSaturation>(
          label: 'Saturation',
          value: _colorSaturation,
          choices: _saturationChoices,
          onChanged: (v) {
            if (v != null) setState(() => _colorSaturation = v);
          },
        ),
      ],
    );
  }

  List<Widget> _buildMeasurementRows(BuildContext context) {
    return _measurementDefs.map((def) {
      final mc = _measurementCtrls[def.key]!;
      return Padding(
        padding: EdgeInsets.only(bottom: scaleDp(context, 28)),
        child: _MeasurementRow(
          def: def,
          controller: mc.controller,
          unit: mc.unit,
          onUnitChanged: (u) => setState(() => mc.unit = u),
        ),
      );
    }).toList();
  }

  Widget _buildTagsSection(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Row(
          children: [
            Text(
              'Add tags',
              style: AppFonts.poppins(
                context,
                fontSize: scaleSp(context, 16),
                fontWeight: FontWeight.w600,
                color: Colors.black,
              ),
            ),
            SizedBox(width: scaleDp(context, 8)),
            GestureDetector(
              onTap: () => _showTagInput(context),
              child: Icon(
                Icons.add,
                size: scaleDp(context, 20),
                color: Colors.black,
              ),
            ),
          ],
        ),
        if (widget.data.tags.isNotEmpty) ...[
          SizedBox(height: scaleDp(context, 12)),
          Wrap(
            spacing: scaleDp(context, 8),
            runSpacing: scaleDp(context, 8),
            children: widget.data.tags.map((tag) {
              return _TagChip(label: tag, onRemove: () => _removeTag(tag));
            }).toList(),
          ),
        ],
      ],
    );
  }

  void _showTagInput(BuildContext context) {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      builder: (ctx) {
        return Padding(
          padding: EdgeInsets.only(
            bottom: MediaQuery.of(ctx).viewInsets.bottom,
            left: 20,
            right: 20,
            top: 20,
          ),
          child: Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _tagInputController,
                  autofocus: true,
                  decoration: const InputDecoration(hintText: 'Enter tag'),
                  onSubmitted: (_) {
                    _addTag();
                    Navigator.of(ctx).pop();
                  },
                ),
              ),
              const SizedBox(width: 12),
              TextButton(
                onPressed: () {
                  _addTag();
                  Navigator.of(ctx).pop();
                },
                child: const Text('Add'),
              ),
            ],
          ),
        );
      },
    );
  }
}

// ---------------------------------------------------------------------------
// Header: back button + centred title
// ---------------------------------------------------------------------------

class _Header extends StatelessWidget {
  const _Header({required this.onBack});
  final VoidCallback onBack;

  @override
  Widget build(BuildContext context) {
    final padH = scaleDp(context, 20);
    return Padding(
      padding: EdgeInsets.only(left: padH, right: padH, top: scaleDp(context, 16)),
      child: SizedBox(
        height: scaleDp(context, 40),
        child: Stack(
          alignment: Alignment.center,
          children: [
            Align(
              alignment: Alignment.centerLeft,
              child: TrueBackButton(onTap: onBack),
            ),
            Text(
              'Complete item',
              style: AppFonts.poppins(
                context,
                fontSize: scaleSp(context, 22),
                fontWeight: FontWeight.bold,
                color: Colors.black,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Labeled text input (thin border)
// ---------------------------------------------------------------------------

class _LabeledInput extends StatelessWidget {
  const _LabeledInput({
    required this.label,
    required this.controller,
    this.placeholder,
    this.keyboardType,
  });

  final String label;
  final TextEditingController controller;
  final String? placeholder;
  final TextInputType? keyboardType;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(
          label,
          style: AppFonts.poppins(
            context,
            fontSize: scaleSp(context, 14),
            fontWeight: FontWeight.w600,
            color: Colors.black,
          ),
        ),
        SizedBox(height: scaleDp(context, 8)),
        SizedBox(
          height: scaleDp(context, 39.5),
          child: TextField(
            controller: controller,
            keyboardType: keyboardType,
            style: AppFonts.poppins(
              context,
              fontSize: scaleSp(context, 13),
              color: Colors.black,
            ),
            decoration: InputDecoration(
              filled: false,
              hintText: placeholder,
              hintStyle: AppFonts.poppins(
                context,
                fontSize: scaleSp(context, 13),
                color: Colors.black.withValues(alpha: 0.4),
              ),
              contentPadding: EdgeInsets.symmetric(
                horizontal: scaleDp(context, 12),
                vertical: scaleDp(context, 8),
              ),
              border: const OutlineInputBorder(
                borderRadius: BorderRadius.zero,
                borderSide: BorderSide(color: Colors.black, width: 0.5),
              ),
              enabledBorder: const OutlineInputBorder(
                borderRadius: BorderRadius.zero,
                borderSide: BorderSide(color: Colors.black, width: 0.5),
              ),
              focusedBorder: const OutlineInputBorder(
                borderRadius: BorderRadius.zero,
                borderSide: BorderSide(color: Colors.black, width: 1),
              ),
            ),
          ),
        ),
      ],
    );
  }
}

// ---------------------------------------------------------------------------
// Separator line
// ---------------------------------------------------------------------------

class _Separator extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Divider(
      color: Colors.black.withValues(alpha: 0.5),
      thickness: 0.5,
    );
  }
}

// ---------------------------------------------------------------------------
// Motivational text
// ---------------------------------------------------------------------------

class _MotivationalText extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Text(
      'Knowing your clothes measurement can help building best outfit as your desire',
      style: AppFonts.poppins(
        context,
        fontSize: scaleSp(context, 12),
        color: Colors.black.withValues(alpha: 0.5),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Measurement row: icon + label + value input + unit dropdown + help
// ---------------------------------------------------------------------------

class _MeasurementRow extends StatelessWidget {
  const _MeasurementRow({
    required this.def,
    required this.controller,
    required this.unit,
    required this.onUnitChanged,
  });

  final MeasurementDef def;
  final TextEditingController controller;
  final MeasurementUnit unit;
  final ValueChanged<MeasurementUnit> onUnitChanged;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Row(
          children: [
            Icon(
              _iconForMeasurement(def.key),
              size: scaleDp(context, 32),
              color: Colors.black,
            ),
            SizedBox(width: scaleDp(context, 12)),
            Text(
              def.label,
              style: AppFonts.poppins(
                context,
                fontSize: scaleSp(context, 14),
                fontWeight: FontWeight.bold,
                color: Colors.black,
              ),
            ),
          ],
        ),
        SizedBox(height: scaleDp(context, 10)),
        Row(
          children: [
            SizedBox(
              width: scaleDp(context, 140.5),
              height: scaleDp(context, 29.5),
              child: TextField(
                controller: controller,
                keyboardType: const TextInputType.numberWithOptions(decimal: true),
                style: AppFonts.poppins(
                  context,
                  fontSize: scaleSp(context, 12),
                  color: Colors.black.withValues(alpha: 0.5),
                ),
                decoration: InputDecoration(
                  filled: false,
                  hintText: 'our...secret.........',
                  hintStyle: AppFonts.poppins(
                    context,
                    fontSize: scaleSp(context, 11),
                    color: Colors.black.withValues(alpha: 0.35),
                  ),
                  contentPadding: EdgeInsets.symmetric(
                    horizontal: scaleDp(context, 8),
                    vertical: scaleDp(context, 4),
                  ),
                  border: const OutlineInputBorder(
                    borderRadius: BorderRadius.zero,
                    borderSide: BorderSide(color: Colors.black, width: 0.5),
                  ),
                  enabledBorder: const OutlineInputBorder(
                    borderRadius: BorderRadius.zero,
                    borderSide: BorderSide(color: Colors.black, width: 0.5),
                  ),
                  focusedBorder: const OutlineInputBorder(
                    borderRadius: BorderRadius.zero,
                    borderSide: BorderSide(color: Colors.black, width: 1),
                  ),
                ),
              ),
            ),
            SizedBox(width: scaleDp(context, 12)),
            _UnitDropdown(value: unit, onChanged: onUnitChanged),
            SizedBox(width: scaleDp(context, 12)),
            Semantics(
              button: true,
              label: 'How to measure ${def.label}',
              child: GestureDetector(
                onTap: () => _showHelp(context),
                child: Container(
                  width: scaleDp(context, 28),
                  height: scaleDp(context, 28),
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    border: Border.all(color: Colors.black, width: 1.5),
                  ),
                  child: Center(
                    child: Text(
                      '?',
                      style: AppFonts.poppins(
                        context,
                        fontSize: scaleSp(context, 14),
                        fontWeight: FontWeight.bold,
                        color: Colors.black,
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
      ],
    );
  }

  IconData _iconForMeasurement(MeasurementKey key) {
    switch (key) {
      case MeasurementKey.shoulderWidth:
        return Icons.accessibility_new;
      case MeasurementKey.chest:
        return Icons.checkroom;
      case MeasurementKey.upperArm:
      case MeasurementKey.thigh:
        return Icons.fitness_center;
      case MeasurementKey.sleeves:
        return Icons.straighten;
      case MeasurementKey.bodyLength:
      case MeasurementKey.inseam:
      case MeasurementKey.skirtLength:
        return Icons.height;
      case MeasurementKey.waist:
      case MeasurementKey.waistTop:
      case MeasurementKey.waistOuter:
        return Icons.horizontal_rule;
      case MeasurementKey.hip:
      case MeasurementKey.rise:
        return Icons.expand;
      case MeasurementKey.shoeSize:
        return Icons.directions_walk;
      case MeasurementKey.shoeWidth:
      case MeasurementKey.width:
      case MeasurementKey.bagWidth:
        return Icons.swap_horiz;
      case MeasurementKey.length:
      case MeasurementKey.bagHeight:
        return Icons.swap_vert;
      case MeasurementKey.bagDepth:
        return Icons.open_in_full;
    }
  }

  void _showHelp(BuildContext context) {
    showTrueInfoModal(
      context,
      title: 'How to measure ${def.label}',
      message: 'Use a flexible tape measure. '
          'Measure ${def.label.toLowerCase()} flat and relaxed.',
    );
  }
}

// ---------------------------------------------------------------------------
// Unit dropdown (CM / IN) — cream yellow background
// ---------------------------------------------------------------------------

class _UnitDropdown extends StatelessWidget {
  const _UnitDropdown({required this.value, required this.onChanged});
  final MeasurementUnit value;
  final ValueChanged<MeasurementUnit> onChanged;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: scaleDp(context, 87),
      height: scaleDp(context, 34),
      decoration: BoxDecoration(
        color: const Color(0xFFFFFAE0),
        borderRadius: BorderRadius.circular(scaleDp(context, 6.5)),
        border: Border.all(color: Colors.black, width: 1),
      ),
      padding: EdgeInsets.symmetric(horizontal: scaleDp(context, 8)),
      child: DropdownButtonHideUnderline(
        child: DropdownButton<MeasurementUnit>(
          value: value,
          isExpanded: true,
          icon: Icon(
            Icons.arrow_drop_down,
            color: const Color(0xFF1D1B20),
            size: scaleDp(context, 16),
          ),
          style: AppFonts.poppins(
            context,
            fontSize: scaleSp(context, 13),
            fontWeight: FontWeight.w600,
            color: Colors.black,
          ),
          items: MeasurementUnit.values.map((u) {
            return DropdownMenuItem(value: u, child: Text(u.label));
          }).toList(),
          onChanged: (u) {
            if (u != null) onChanged(u);
          },
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Tag chip
// ---------------------------------------------------------------------------

class _TagChip extends StatelessWidget {
  const _TagChip({required this.label, required this.onRemove});
  final String label;
  final VoidCallback onRemove;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onRemove,
      child: Container(
        padding: EdgeInsets.symmetric(
          horizontal: scaleDp(context, 12),
          vertical: scaleDp(context, 6),
        ),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(scaleDp(context, 16)),
          border: Border.all(color: Colors.black, width: 0.5),
        ),
        child: Text(
          label,
          style: AppFonts.poppins(
            context,
            fontSize: scaleSp(context, 12),
            color: Colors.black,
          ),
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Complete button — black pill
// ---------------------------------------------------------------------------

class _CompleteButton extends StatelessWidget {
  const _CompleteButton({required this.onTap});
  final Future<void> Function() onTap;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Semantics(
        button: true,
        label: 'Complete and save item',
        child: GestureDetector(
          onTap: () async {
            await onTap();
          },
          child: Container(
            width: scaleDp(context, 200),
            height: scaleDp(context, 50),
            decoration: BoxDecoration(
              color: Colors.black,
              borderRadius: BorderRadius.circular(scaleDp(context, 25)),
            ),
            child: Center(
              child: Text(
                'Complete',
                style: AppFonts.poppins(
                  context,
                  fontSize: scaleSp(context, 16),
                  fontWeight: FontWeight.w600,
                  color: Colors.white,
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Internal helper
// ---------------------------------------------------------------------------

class _MeasurementControllers {
  _MeasurementControllers({required this.controller, required this.unit});
  final TextEditingController controller;
  MeasurementUnit unit;
}

// ---------------------------------------------------------------------------
// Preview wrappers
// ---------------------------------------------------------------------------

class CompleteItemScreenPreview extends StatelessWidget {
  const CompleteItemScreenPreview({super.key});

  @override
  Widget build(BuildContext context) {
    final data = NewItemData()
      ..name = 'Demo T-Shirt'
      ..type = ItemType.topItem
      ..tags.addAll(['minimalism', 'menswear']);

    return MaterialApp(
      debugShowCheckedModeBanner: false,
      theme: buildAppTheme(),
      home: CompleteItemScreen(
        data: data,
        onComplete: () async {},
      ),
    );
  }
}

@Preview(
  name: 'Complete Item (step 2)',
  group: 'Add Item',
  size: Size(402, 874),
  theme: trueClothesPreviewTheme,
)
Widget completeItemWidgetPreview() {
  return const CompleteItemScreenPreview();
}
