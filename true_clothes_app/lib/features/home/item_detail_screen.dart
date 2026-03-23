import 'package:flutter/material.dart';
import 'package:flutter/widget_previews.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/responsive.dart';
import '../../theme/app_colors.dart';
import '../../theme/app_fonts.dart';
import '../../theme/app_theme.dart';
import '../../theme/widget_preview_theme.dart';
import '../../widgets/outfit_composition_card_placeholder.dart';
import 'home_outfit_models.dart';

// ---------------------------------------------------------------------------
// Measurement field order per category — mirrors Kotlin `measurementRowsFor`.
// ---------------------------------------------------------------------------

const _categoryFields = <ItemCategory, List<({String key, String label})>>{
  ItemCategory.top: [
    (key: 'chest', label: 'Chest'),
    (key: 'sleeves', label: 'Sleeves'),
    (key: 'shoulder', label: 'Shoulder'),
    (key: 'bicep', label: 'Bicep'),
    (key: 'length', label: 'Length'),
  ],
  ItemCategory.bottom: [
    (key: 'waist', label: 'Waist'),
    (key: 'inseam', label: 'Inseam'),
    (key: 'thigh', label: 'Thigh'),
    (key: 'knee', label: 'Knee'),
    (key: 'leg_opening', label: 'Leg opening'),
    (key: 'rise', label: 'Rise'),
  ],
  ItemCategory.outwear: [
    (key: 'chest', label: 'Chest'),
    (key: 'shoulder', label: 'Shoulder'),
    (key: 'sleeves', label: 'Sleeves'),
    (key: 'length', label: 'Length'),
    (key: 'bicep', label: 'Bicep'),
  ],
  ItemCategory.shoes: [
    (key: 'size_us', label: 'Size (US)'),
    (key: 'size_eu', label: 'Size (EU)'),
    (key: 'foot_length', label: 'Foot length'),
    (key: 'width', label: 'Width'),
    (key: 'instep', label: 'Instep'),
  ],
  ItemCategory.accessory: [
    (key: 'length', label: 'Length'),
    (key: 'width', label: 'Width'),
    (key: 'height', label: 'Height'),
    (key: 'circumference', label: 'Circumference'),
    (key: 'strap_drop', label: 'Strap drop'),
  ],
};

List<(String label, String value)> _measurementRows(
  ItemCategory category,
  Map<String, String> measurements,
) {
  final fields = _categoryFields[category] ?? [];
  return [
    for (final f in fields)
      if (measurements[f.key] case final v? when v.isNotEmpty) (f.label, v),
  ];
}

String _measurementUnitNote(Map<String, String> measurements) {
  if (measurements.isEmpty) return '';
  final allCm = measurements.values.every((v) => v.trim().endsWith('cm'));
  return allCm ? 'All values in cm' : '';
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

/// Matches Kotlin `ItemDetailScreen.kt` + `app/design/screen/home/item/design.md`.
class ItemDetailScreen extends StatelessWidget {
  const ItemDetailScreen({
    super.key,
    required this.item,
    required this.onBack,
  });

  final OutfitItemInfo item;
  final VoidCallback onBack;

  @override
  Widget build(BuildContext context) {
    final horizontal = scaleDp(context, 28);
    final heroHeight = scaleDp(context, 486);
    final scrimHeight = scaleDp(context, 140);
    final statusBarTop = MediaQuery.paddingOf(context).top;
    final rows = _measurementRows(item.category, item.measurements);
    final unitNote = _measurementUnitNote(item.measurements);
    final url = item.productUrl;

    return Scaffold(
      backgroundColor: AppColors.mainBackground,
      // No AppBar — body starts at y=0 so the hero is flush to screen top,
      // matching Kotlin's Column(fillMaxSize) with no top window inset offset.
      body: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // ── Hero banner ──────────────────────────────────────────────
            SizedBox(
              width: double.infinity,
              height: heroHeight,
              child: Stack(
                fit: StackFit.expand,
                children: [
                  // Placeholder background (#DCDCDC) shown before/on error.
                  const ColoredBox(color: Color(0xFFDCDCDC)),

                  // Product image — full bleed, ContentScale.Crop.
                  if (item.imageSource != null && item.imageSource!.isNotEmpty)
                    Image.asset(
                      item.imageSource!,
                      package: kPreviewImagePackage,
                      fit: BoxFit.cover,
                      width: double.infinity,
                      height: heroHeight,
                      errorBuilder: (_, _, _) => const SizedBox.shrink(),
                    ),

                  // Gradient scrim: top 140dp, black 55% → transparent.
                  Positioned(
                    top: 0,
                    left: 0,
                    right: 0,
                    height: scrimHeight,
                    child: const DecoratedBox(
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          begin: Alignment.topCenter,
                          end: Alignment.bottomCenter,
                          colors: [
                            Color(0x8C000000), // black ~55%
                            Colors.transparent,
                          ],
                        ),
                      ),
                    ),
                  ),

                  // Back button — TopStart, below status bar + 8dp, start + 8dp.
                  Positioned(
                    top: statusBarTop + scaleDp(context, 8),
                    left: scaleDp(context, 8),
                    child: TextButton(
                      onPressed: onBack,
                      style: TextButton.styleFrom(
                        padding: EdgeInsets.zero,
                        minimumSize: Size.zero,
                        tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                        foregroundColor: Colors.white,
                      ),
                      child: Text(
                        'Back',
                        style: AppFonts.poppins(
                          context,
                          fontSize: scaleSp(context, 14),
                          fontWeight: FontWeight.w700,
                          color: Colors.white,
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),

            // ── Content scroll ───────────────────────────────────────────
            Padding(
              padding: EdgeInsets.only(
                left: horizontal,
                right: horizontal,
                top: scaleDp(context, 24),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Full product name — Playfair Display Bold 22sp / lh 34sp.
                  Text(
                    item.fullName,
                    style: AppFonts.playfairDisplay(
                      context,
                      fontSize: scaleSp(context, 22),
                      fontWeight: FontWeight.bold,
                      height: scaleSp(context, 34) / scaleSp(context, 22),
                      color: Colors.black,
                    ),
                  ),

                  SizedBox(height: scaleDp(context, 12)),

                  // Color — value only; accessibility label includes "Color:" prefix.
                  Semantics(
                    label: 'Color: ${item.itemColor}',
                    child: ExcludeSemantics(
                      child: Text(
                        item.itemColor,
                        style: AppFonts.poppins(
                          context,
                          fontSize: scaleSp(context, 20),
                          fontWeight: FontWeight.w300,
                          color: Colors.black.withValues(alpha: 0.5),
                        ),
                      ),
                    ),
                  ),

                  SizedBox(height: scaleDp(context, 8)),

                  // Brand name — Poppins Medium 15sp (no "Brand:" prefix, matches Kotlin).
                  Text(
                    item.brand,
                    style: AppFonts.poppins(
                      context,
                      fontSize: scaleSp(context, 15),
                      fontWeight: FontWeight.w500,
                      color: Colors.black,
                    ),
                  ),

                  SizedBox(height: scaleDp(context, 20)),

                  // Product link — only when URL is present.
                  if (url != null && url.isNotEmpty)
                    _ProductLink(url: url, context: context),

                  SizedBox(height: scaleDp(context, 28)),

                  // Measurements section title.
                  Text(
                    'Measurements',
                    style: AppFonts.poppins(
                      context,
                      fontSize: scaleSp(context, 16),
                      fontWeight: FontWeight.w600,
                      color: Colors.black,
                    ),
                  ),

                  SizedBox(height: scaleDp(context, 8)),

                  // Unit note line.
                  if (unitNote.isNotEmpty)
                    Text(
                      unitNote,
                      style: AppFonts.poppins(
                        context,
                        fontSize: scaleSp(context, 13),
                        fontWeight: FontWeight.w400,
                        color: Colors.black.withValues(alpha: 0.55),
                      ),
                    ),

                  SizedBox(height: scaleDp(context, 12)),

                  // Measurement rows or empty state.
                  if (rows.isEmpty)
                    Text(
                      'No measurements added',
                      style: AppFonts.poppins(
                        context,
                        fontSize: scaleSp(context, 14),
                        fontWeight: FontWeight.w400,
                        color: Colors.black.withValues(alpha: 0.55),
                      ),
                    )
                  else
                    for (final (index, (label, value)) in rows.indexed) ...[
                      if (index > 0)
                        Container(
                          height: scaleDp(context, 0.3),
                          color: Colors.black.withValues(alpha: 0.15),
                        ),
                      ConstrainedBox(
                        constraints: BoxConstraints(
                          minHeight: scaleDp(context, 48),
                        ),
                        child: Padding(
                          padding: EdgeInsets.symmetric(
                            vertical: scaleDp(context, 12),
                          ),
                          child: Row(
                            crossAxisAlignment: CrossAxisAlignment.center,
                            children: [
                              Expanded(
                                child: Text(
                                  label,
                                  style: AppFonts.poppins(
                                    context,
                                    fontSize: scaleSp(context, 14),
                                    fontWeight: FontWeight.w400,
                                    color: Colors.black.withValues(alpha: 0.55),
                                  ),
                                ),
                              ),
                              Padding(
                                padding: EdgeInsets.only(
                                  left: scaleDp(context, 12),
                                ),
                                child: Text(
                                  value,
                                  textAlign: TextAlign.end,
                                  style: AppFonts.poppins(
                                    context,
                                    fontSize: scaleSp(context, 14),
                                    fontWeight: FontWeight.w500,
                                    color: Colors.black,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ],

                  SizedBox(height: scaleDp(context, 32)),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Product link widget — Poppins SemiBold 16sp, underline, heightIn(min=48).
// ---------------------------------------------------------------------------

class _ProductLink extends StatelessWidget {
  const _ProductLink({required this.url, required this.context});

  final String url;
  final BuildContext context;

  @override
  Widget build(BuildContext _) {
    return Semantics(
      button: true,
      label: _semanticsLabel(url),
      child: InkWell(
        onTap: () => _openUrl(url),
        child: ConstrainedBox(
          constraints: BoxConstraints(minHeight: scaleDp(context, 48)),
          child: Padding(
            padding: EdgeInsets.symmetric(vertical: scaleDp(context, 8)),
            child: Text(
              'View product link',
              style: AppFonts.poppins(
                context,
                fontSize: scaleSp(context, 16),
                fontWeight: FontWeight.w600,
                color: Colors.black,
              ).copyWith(decoration: TextDecoration.underline),
            ),
          ),
        ),
      ),
    );
  }

  String _semanticsLabel(String url) {
    try {
      final host = Uri.parse(url).host;
      if (host.isNotEmpty) return 'View product link. Opens $host';
    } catch (_) {}
    return 'View product link';
  }

  Future<void> _openUrl(String url) async {
    final uri = Uri.tryParse(url);
    if (uri != null) await launchUrl(uri, mode: LaunchMode.externalApplication);
  }
}

// ---------------------------------------------------------------------------
// Widget Previewer
// ---------------------------------------------------------------------------

class ItemDetailScreenPreview extends StatelessWidget {
  const ItemDetailScreenPreview({super.key});

  @override
  Widget build(BuildContext context) {
    final item = demoOutfitDetailPayload().items.first;
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      theme: buildAppTheme(),
      home: ItemDetailScreen(
        item: item,
        onBack: () {},
      ),
    );
  }
}

@Preview(
  name: 'Item detail',
  group: 'Home',
  size: Size(402, 874),
  theme: trueClothesPreviewTheme,
)
Widget itemDetailScreenWidgetPreview() {
  return const ItemDetailScreenPreview();
}
