import 'package:flutter/material.dart';
import 'package:flutter/widget_previews.dart';

import '../../core/responsive.dart';
import '../../theme/app_colors.dart';
import '../../theme/app_fonts.dart';
import '../../theme/app_theme.dart';
import '../../theme/widget_preview_theme.dart';
import '../../widgets/outfit_composition_card_placeholder.dart';
import 'home_outfit_models.dart';
import 'item_detail_screen.dart';

/// Matches Kotlin `OutfitDetailScreen.kt` + `app/design/screen/home/outfit/design.md`.
class OutfitDetailScreen extends StatelessWidget {
  const OutfitDetailScreen({
    super.key,
    required this.outfit,
    required this.onBack,
  });

  final OutfitDetailPayload outfit;
  final VoidCallback onBack;

  @override
  Widget build(BuildContext context) {
    final hPad = scaleDp(context, 24);
    final items = outfit.items;

    return Scaffold(
      backgroundColor: AppColors.mainBackground,
      body: SafeArea(
        child: CustomScrollView(
          slivers: [
            // Header + overview + tags — scrolls away with the list.
            SliverToBoxAdapter(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  // Header — Back + title (Playfair bold 25 / line ~37).
                  Padding(
                    padding: EdgeInsets.symmetric(
                      horizontal: hPad,
                      vertical: scaleDp(context, 24),
                    ),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        TextButton(
                          onPressed: onBack,
                          style: TextButton.styleFrom(
                            padding: EdgeInsets.zero,
                            minimumSize: Size.zero,
                            tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                          ),
                          child: Text(
                            'Back',
                            style: AppFonts.poppins(
                              context,
                              fontSize: scaleSp(context, 14),
                              fontWeight: FontWeight.w700,
                              color: Colors.black,
                            ),
                          ),
                        ),
                        SizedBox(width: scaleDp(context, 50)),
                        Expanded(
                          child: Text(
                            outfit.title,
                            style: AppFonts.playfairDisplay(
                              context,
                              fontSize: scaleSp(context, 25),
                              fontWeight: FontWeight.bold,
                              height: scaleSp(context, 37) / scaleSp(context, 25),
                              color: Colors.black,
                              letterSpacing: -0.02 * scaleSp(context, 25),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                  if (outfit.overview != null &&
                      outfit.overview!.trim().isNotEmpty) ...[
                    SizedBox(height: scaleDp(context, 48)),
                    Padding(
                      padding: EdgeInsets.symmetric(horizontal: hPad),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Overview',
                            style: AppFonts.poppins(
                              context,
                              fontSize: scaleSp(context, 15),
                              fontWeight: FontWeight.w500,
                              color: Colors.black,
                            ),
                          ),
                          SizedBox(height: scaleDp(context, 8)),
                          Text(
                            outfit.overview!.trim(),
                            style: AppFonts.poppins(
                              context,
                              fontSize: scaleSp(context, 14),
                              fontWeight: FontWeight.w400,
                              height: 1.45,
                              color: Colors.black.withValues(alpha: 0.72),
                            ),
                          ),
                        ],
                      ),
                    ),
                    SizedBox(height: scaleDp(context, 24)),
                  ] else
                    SizedBox(height: scaleDp(context, 43)),
                  // Tags — title + chip wrap on one row; wrap max 350dp, 14dp gap title→wrap;
                  // 8 / 14 chip spacing; each chip r=30, H10 V2, Poppins 13 medium.
                  Padding(
                    padding: EdgeInsets.only(
                      left: scaleDp(context, 28),
                      right: hPad,
                    ),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Padding(
                          padding: EdgeInsets.only(top: scaleDp(context, 2)),
                          child: Text(
                            'Tags',
                            style: AppFonts.poppins(
                              context,
                              fontSize: scaleSp(context, 15),
                              fontWeight: FontWeight.w500,
                              color: Colors.black,
                            ),
                          ),
                        ),
                        SizedBox(width: scaleDp(context, 14)),
                        Expanded(
                          child: Align(
                            alignment: Alignment.centerLeft,
                            child: ConstrainedBox(
                              constraints: BoxConstraints(
                                maxWidth: scaleDp(context, 350),
                              ),
                              child: Wrap(
                                spacing: scaleDp(context, 8),
                                runSpacing: scaleDp(context, 14),
                                alignment: WrapAlignment.start,
                                crossAxisAlignment: WrapCrossAlignment.center,
                                children: outfit.tags
                                    .map((tag) => _OutfitTagChip(label: tag))
                                    .toList(),
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                  // design.md: bottom_to_item_list_dp 67.
                  SizedBox(height: scaleDp(context, 67)),
                ],
              ),
            ),
            // Item list — each item separated by a hairline divider.
            SliverPadding(
              padding: EdgeInsets.symmetric(horizontal: hPad, vertical: scaleDp(context, 8)),
              sliver: SliverList.separated(
                itemCount: items.length,
                separatorBuilder: (_, _) => Container(
                  height: scaleDp(context, 0.3),
                  color: Colors.black.withValues(alpha: 0.22),
                ),
                itemBuilder: (context, idx) => Padding(
                  padding: EdgeInsets.symmetric(vertical: scaleDp(context, 40)),
                  child: _OutfitDetailItemRow(item: items[idx]),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _OutfitTagChip extends StatelessWidget {
  const _OutfitTagChip({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      constraints: BoxConstraints(
        maxWidth: scaleDp(context, 350),
      ),
      padding: EdgeInsets.symmetric(
        horizontal: scaleDp(context, 10),
        vertical: scaleDp(context, 2),
      ),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(scaleDp(context, 30)),
      ),
      child: Text(
        label,
        maxLines: 1,
        softWrap: false,
        overflow: TextOverflow.ellipsis,
        style: AppFonts.poppins(
          context,
          fontSize: scaleSp(context, 13),
          fontWeight: FontWeight.w500,
          color: Colors.black,
        ),
      ),
    );
  }
}

class _OutfitDetailItemRow extends StatelessWidget {
  const _OutfitDetailItemRow({required this.item});

  final OutfitItemInfo item;

  @override
  Widget build(BuildContext context) {
    final metaGray = Colors.black.withValues(alpha: 0.58);
    final wrapperHeight = scaleDp(context, 200);

    // Stack approach: InkWell fills full row width so text gets all space after the
    // 140dp image (~202dp content). The link is Positioned at the bottom-right corner
    // where the text column is empty (text ends ~150dp from top; link sits at ~158dp).
    // This avoids both horizontal overflow and the text-squishing that a flat Row causes.
    return SizedBox(
      height: wrapperHeight,
      child: SizedBox.expand(
        child: Stack(
          children: [
            // Tappable image + text block — fills entire 200dp × row_width area.
            Positioned.fill(
              child: InkWell(
                onTap: () {
                  Navigator.of(context).push<void>(
                    MaterialPageRoute<void>(
                      builder: (ctx) => ItemDetailScreen(
                        item: item,
                        onBack: () => Navigator.of(ctx).pop(),
                      ),
                    ),
                  );
                },
                child: Semantics(
                  label: 'View ${item.name}, details',
                  button: true,
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      _OutfitItemImageCard(imagePath: item.imageSource),
                      // Text gets all width after the 140dp image: no link competing here.
                      Expanded(
                        child: Padding(
                          padding: EdgeInsets.only(
                            left: scaleDp(context, 12),
                            top: scaleDp(context, 10),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            mainAxisAlignment: MainAxisAlignment.start,
                            mainAxisSize: MainAxisSize.max,
                            children: [
                              Text(
                                item.name,
                                style: AppFonts.poppins(
                                  context,
                                  fontSize: scaleSp(context, 16),
                                  fontWeight: FontWeight.w500,
                                  color: Colors.black,
                                ),
                              ),
                              SizedBox(height: scaleDp(context, 6)),
                              Text(
                                item.itemColor,
                                style: AppFonts.poppins(
                                  context,
                                  fontSize: scaleSp(context, 20),
                                  fontWeight: FontWeight.w300,
                                  color: Colors.black.withValues(alpha: 0.5),
                                ),
                              ),
                              SizedBox(height: scaleDp(context, 11)),
                              Text(
                                item.form,
                                style: AppFonts.poppins(
                                  context,
                                  fontSize: scaleSp(context, 13),
                                  fontWeight: FontWeight.w500,
                                  color: metaGray,
                                ),
                              ),
                              SizedBox(height: scaleDp(context, 2)),
                              Text(
                                item.aesthetic,
                                style: AppFonts.poppins(
                                  context,
                                  fontSize: scaleSp(context, 13),
                                  fontWeight: FontWeight.w500,
                                  color: metaGray,
                                ),
                              ),
                              SizedBox(height: scaleDp(context, 2)),
                              Text(
                                item.material,
                                style: AppFonts.poppins(
                                  context,
                                  fontSize: scaleSp(context, 13),
                                  fontWeight: FontWeight.w500,
                                  color: metaGray,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
            // Action link — bottom-right corner of the 200dp frame.
            // Mirrors Kotlin: component bottom = row bottom (verticalAlignment=Bottom),
            // internal padding(end=29, top=6, bottom=6), heightIn(min=48), widthIn(max=140).
            // Using Positioned(bottom:0, right:0) + internal Padding so the text renders at
            // its natural width without hitting an external maxWidth cap that would clip letters.
            Positioned(
              bottom: 0,
              right: 0,
              child: ConstrainedBox(
                constraints: BoxConstraints(
                  maxWidth: scaleDp(context, 140),
                  minHeight: scaleDp(context, 48),
                ),
                child: Padding(
                  padding: EdgeInsets.only(
                    right: scaleDp(context, 29),
                    top: scaleDp(context, 6),
                    bottom: scaleDp(context, 6),
                  ),
                  child: Align(
                    alignment: Alignment.bottomRight,
                    child: InkWell(
                      onTap: () {},
                      child: Text(
                        item.actionText,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        textAlign: TextAlign.end,
                        style: AppFonts.poppins(
                          context,
                          fontSize: scaleSp(context, 20),
                          fontWeight: FontWeight.w600,
                          color: Colors.black,
                        ).copyWith(decoration: TextDecoration.underline),
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _OutfitItemImageCard extends StatelessWidget {
  const _OutfitItemImageCard({required this.imagePath});

  final String? imagePath;

  @override
  Widget build(BuildContext context) {
    // Design spec: image 150×205 centered inside 140×200 container.
    // OverflowBox lets the image exceed the frame without a debug stripe
    // (matches Kotlin Box with no clip: image peeks slightly outside the grey border).
    final containerW = scaleDp(context, 140);
    final containerH = scaleDp(context, 200);
    final itemW = scaleDp(context, 150);
    final itemH = scaleDp(context, 205);
    return SizedBox(
      width: containerW,
      height: containerH,
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: const Color(0xFFDCDCDC),
          border: Border.all(color: Colors.black, width: 0.5),
        ),
        child: Align(
          alignment: Alignment.center,
          child: OverflowBox(
            maxWidth: itemW,
            maxHeight: itemH,
            child: imagePath != null && imagePath!.isNotEmpty
                ? Image.asset(
                    imagePath!,
                    package: kPreviewImagePackage,
                    width: itemW,
                    height: itemH,
                    fit: BoxFit.contain,
                    errorBuilder: (_, _, _) => const SizedBox.shrink(),
                  )
                : const SizedBox.shrink(),
          ),
        ),
      ),
    );
  }
}

// -----------------------------------------------------------------------------
// Widget Previewer — run: `flutter widget-preview start` or IDE Flutter Widget Preview.
// -----------------------------------------------------------------------------

class OutfitDetailScreenPreview extends StatelessWidget {
  const OutfitDetailScreenPreview({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      theme: buildAppTheme(),
      home: OutfitDetailScreen(
        outfit: demoOutfitDetailPayload(),
        onBack: () {},
      ),
    );
  }
}

@Preview(
  name: 'Outfit detail',
  group: 'Home',
  size: Size(402, 874),
  theme: trueClothesPreviewTheme,
)
Widget outfitDetailScreenWidgetPreview() {
  return const OutfitDetailScreenPreview();
}
