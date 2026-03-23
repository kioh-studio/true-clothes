import 'package:flutter/material.dart';
import 'package:flutter/widget_previews.dart';

import '../../core/responsive.dart';
import '../../main_nav_shell.dart';
import '../../theme/app_theme.dart';
import '../../theme/widget_preview_theme.dart';
import '../../theme/app_colors.dart';
import '../../theme/app_fonts.dart';
import '../../widgets/outfit_composition_card_placeholder.dart';
import 'home_outfit_models.dart';
import 'outfit_detail_screen.dart';

/// The scrollable content of the Home tab — no [Scaffold], so it can live
/// inside [MainNavShell]'s [IndexedStack] without nesting Scaffolds.
///
/// Port of Kotlin `HomeMainScreen.kt` + `design/screen/home/main/design.md`.
class HomeMainContent extends StatefulWidget {
  const HomeMainContent({super.key});

  @override
  State<HomeMainContent> createState() => _HomeMainContentState();
}

class _HomeMainContentState extends State<HomeMainContent> {
  static const _tabTitles = ['Outfit', 'Favourite', 'Closet'];

  int _tabIndex = 0;

  late final OutfitDetailPayload _demoOutfit = demoOutfitDetailPayload();

  void _openOutfitDetail() {
    Navigator.of(context).push<void>(
      MaterialPageRoute<void>(
        builder: (ctx) => OutfitDetailScreen(
          outfit: _demoOutfit,
          onBack: () => Navigator.of(ctx).pop(),
        ),
      ),
    );
  }

  /// Matches Kotlin `underlineWidthBeforeFinalLetter` / design tab indicator.
  double _tabUnderlineWidth(String text, TextStyle style) {
    if (text.length <= 1) return 0;
    final tp = TextPainter(
      text: TextSpan(text: text, style: style),
      textDirection: TextDirection.ltr,
      maxLines: 1,
    )..layout(minWidth: 0, maxWidth: double.infinity);
    final boxes = tp.getBoxesForSelection(
      TextSelection(
        baseOffset: text.length - 1,
        extentOffset: text.length,
      ),
    );
    if (boxes.isEmpty) return 0;
    return boxes.first.left.clamp(0.0, double.infinity);
  }

  Widget _luxuryOutfitPlaceholderRow(BuildContext context, String label) {
    final r = scaleDp(context, 12);
    return Semantics(
      label: 'Outfit preview placeholder, $label',
      child: Container(
        height: scaleDp(context, 180),
        decoration: BoxDecoration(
          color: Colors.white.withValues(alpha: 0.12),
          borderRadius: BorderRadius.circular(r),
          border: Border.all(
            color: Colors.white.withValues(alpha: 0.25),
            width: scaleDp(context, 1),
          ),
        ),
        alignment: Alignment.center,
        padding: EdgeInsets.symmetric(horizontal: scaleDp(context, 16)),
        child: Text(
          label,
          maxLines: 2,
          overflow: TextOverflow.ellipsis,
          textAlign: TextAlign.center,
          style: AppFonts.poppins(
            context,
            fontSize: scaleSp(context, 14),
            fontWeight: FontWeight.w600,
            color: Colors.white,
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final padH = scaleDp(context, 24);
    final padTop = scaleDp(context, 36);
    final titleSize = scaleSp(context, 28);
    final lineHeight = scaleSp(context, 40);
    const inactiveOpacity = 0.7;

    final tabStyle = AppFonts.poppins(
      context,
      fontSize: scaleSp(context, 14),
      fontWeight: FontWeight.normal,
      letterSpacing: 0.10 * scaleSp(context, 14),
    );

    // Full-screen gradient container — bottom: false so the floating nav circles
    // in MainNavShell can overlap the bottom area without clipping.
    return Container(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          stops: const [0, 0.24, 1],
          colors: [
            AppColors.homeGradientTop.withValues(
              alpha: AppColors.homeGradientTopAlpha,
            ),
            AppColors.homeGradientBottom,
            AppColors.homeGradientBottom,
          ],
        ),
      ),
      child: SafeArea(
        bottom: false,
        // CustomScrollView avoids Column+Expanded overflow when the viewport is
        // short (widget preview, split IDE, large text scale, or inset changes).
        child: CustomScrollView(
          slivers: [
            SliverPadding(
              padding: EdgeInsets.fromLTRB(padH, padTop, padH, 0),
              sliver: SliverToBoxAdapter(
                child: Text(
                  'TRUE CLOTHES',
                  style: AppFonts.playfairDisplay(
                    context,
                    fontSize: titleSize,
                    fontWeight: FontWeight.bold,
                    color: AppColors.homeLogotype,
                    height: lineHeight / titleSize,
                    letterSpacing: 0.06 * titleSize,
                  ),
                ),
              ),
            ),
            SliverPadding(
              padding: EdgeInsets.symmetric(
                horizontal: scaleDp(context, 40),
                vertical: scaleDp(context, 70),
              ),
              sliver: SliverToBoxAdapter(
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  crossAxisAlignment: CrossAxisAlignment.center,
                  children: List.generate(_tabTitles.length, (i) {
                    final active = _tabIndex == i;
                    final title = _tabTitles[i];
                    final color = Colors.white.withValues(
                      alpha: active ? 1.0 : inactiveOpacity,
                    );
                    final style = tabStyle.copyWith(color: color);
                    final uw = active ? _tabUnderlineWidth(title, style) : 0.0;

                    return Semantics(
                      selected: active,
                      button: true,
                      label: '$title tab${active ? ', selected' : ''}',
                      child: InkWell(
                        onTap: () => setState(() => _tabIndex = i),
                        child: Padding(
                          padding: EdgeInsets.symmetric(
                            horizontal: scaleDp(context, 4),
                            vertical: scaleDp(context, 8),
                          ),
                          child: ConstrainedBox(
                            constraints: BoxConstraints(
                              minHeight: scaleDp(context, 48),
                            ),
                            child: Column(
                              mainAxisAlignment: MainAxisAlignment.center,
                              crossAxisAlignment: CrossAxisAlignment.start,
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Text(
                                  title,
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: style,
                                ),
                                if (active && uw > 0) ...[
                                  SizedBox(height: scaleDp(context, 5)),
                                  Container(
                                    height: scaleDp(context, 1.5),
                                    width: uw,
                                    color: Colors.white.withValues(alpha: 1.0),
                                  ),
                                ],
                              ],
                            ),
                          ),
                        ),
                      ),
                    );
                  }),
                ),
              ),
            ),
            if (_tabIndex == 0)
              SliverPadding(
                padding: EdgeInsets.symmetric(horizontal: padH),
                sliver: SliverToBoxAdapter(
                  child: Semantics(
                    button: true,
                    label:
                        'Suggested outfit, ${_demoOutfit.title}, open details',
                    child: InkWell(
                      onTap: _openOutfitDetail,
                      child: ConstrainedBox(
                        constraints: BoxConstraints(
                          minHeight: scaleDp(context, 48),
                        ),
                        child: Padding(
                          padding: EdgeInsets.symmetric(
                            vertical: scaleDp(context, 16),
                            horizontal: scaleDp(context, 8),
                          ),
                          child: OutfitCompositionCardPlaceholder(
                            sources: _demoOutfit.toCompositionSources(),
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
              )
            else
              SliverPadding(
                padding: EdgeInsets.symmetric(horizontal: padH),
                sliver: SliverList(
                  delegate: SliverChildBuilderDelegate(
                    (context, index) {
                      if (index.isOdd) {
                        return SizedBox(height: scaleDp(context, 2));
                      }
                      final i = index ~/ 2;
                      final prefix = _tabIndex == 1 ? 'Favourite' : 'Closet';
                      return _luxuryOutfitPlaceholderRow(
                        context,
                        '$prefix outfit #${i + 1}',
                      );
                    },
                    childCount: 3,
                  ),
                ),
              ),
            // Bottom padding so the last content item clears the floating circles.
            // Active circle top ≈ 91dp above the bottom safe area edge (70dp diameter + 21dp gap).
            SliverPadding(
              padding: EdgeInsets.only(bottom: scaleDp(context, 100)),
              sliver: const SliverToBoxAdapter(child: SizedBox.shrink()),
            ),
          ],
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Thin shell — used only for standalone widget preview.
// ---------------------------------------------------------------------------

/// Standalone wrapper around [HomeMainContent] with its own [Scaffold].
/// In the real app [HomeMainContent] lives inside [MainNavShell].
class HomeMainScreen extends StatelessWidget {
  const HomeMainScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.homeGradientBottom,
      body: const HomeMainContent(),
    );
  }
}

// ---------------------------------------------------------------------------
// Widget preview
// ---------------------------------------------------------------------------

@Preview(
  name: 'Home main',
  group: 'Home',
  size: Size(402, 874),
  theme: trueClothesPreviewTheme,
)
Widget homeMainWidgetPreview() {
  // Use MainNavShell so the preview includes the floating circular nav buttons.
  return MaterialApp(
    debugShowCheckedModeBanner: false,
    theme: buildAppTheme(),
    home: const MainNavShell(),
  );
}
