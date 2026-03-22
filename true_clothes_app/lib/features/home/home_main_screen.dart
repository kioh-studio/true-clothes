import 'package:flutter/material.dart';
import 'package:flutter/widget_previews.dart';

import '../../core/responsive.dart';
import '../../theme/widget_preview_theme.dart';
import '../../theme/app_colors.dart';
import '../../theme/app_fonts.dart';

/// Simplified port of `HomeMainScreen.kt` (gradient, logotype, tab labels).
/// Extend with `OutfitCompositionCardPlaceholder` and detail routes per design docs.
class HomeMainScreen extends StatefulWidget {
  const HomeMainScreen({super.key});

  @override
  State<HomeMainScreen> createState() => _HomeMainScreenState();
}

class _HomeMainScreenState extends State<HomeMainScreen> {
  int _tab = 0;
  static const _tabs = ['Outfit', 'Favourite', 'Closet'];

  @override
  Widget build(BuildContext context) {
    final scale = layoutScaleOf(context);
    final padH = scaleDp(context, 24);
    final padTop = scaleDp(context, 16);
    final titleSize = scaleSp(context, 28);
    final lineHeight = scaleSp(context, 40);

    // Not `AppColors.mainBackground` — home uses the gradient only; scaffold color
    // matches gradient end so overscroll / edges never flash #F5F5F5.
    return Scaffold(
      backgroundColor: AppColors.homeGradientBottom,
      body: Container(
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
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Padding(
                padding: EdgeInsets.fromLTRB(padH, padTop, padH, 0),
                child: Text(
                  'TRUE CLOTHES',
                  style: AppFonts.playfairDisplay(
                    context,
                    fontSize: titleSize,
                    fontWeight: FontWeight.bold,
                    color: AppColors.homeLogotype,
                    height: lineHeight / titleSize,
                    letterSpacing: 0.06 * titleSize, // 0.06em in Kotlin
                  ),
                ),
              ),
              SizedBox(height: scaleDp(context, 70) * 0.35),
              Padding(
                padding: EdgeInsets.symmetric(horizontal: scaleDp(context, 40)),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: List.generate(_tabs.length, (i) {
                    final active = _tab == i;
                    return InkWell(
                      onTap: () => setState(() => _tab = i),
                      child: SizedBox(
                        height: scaleDp(context, 48),
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Text(
                              _tabs[i],
                              style: AppFonts.poppins(
                                context,
                                fontSize: scaleSp(context, 14),
                                fontWeight: FontWeight.w100,
                                color: Colors.white.withValues(
                                  alpha: active ? 1 : 0.7,
                                ),
                                letterSpacing: 0.10 * scaleSp(context, 14),
                              ),
                            ),
                            if (active) ...[
                              SizedBox(height: scaleDp(context, 5)),
                              Container(
                                height: scaleDp(context, 1.5),
                                width: 48 * scale,
                                color: Colors.white,
                              ),
                            ],
                          ],
                        ),
                      ),
                    );
                  }),
                ),
              ),
              Expanded(
                child: ListView(
                  padding: EdgeInsets.symmetric(horizontal: padH),
                  children: [
                    SizedBox(height: scaleDp(context, 16)),
                    Text(
                      _tabs[_tab] == 'Outfit'
                          ? 'Suggested outfits (demo)'
                          : '${_tabs[_tab]} (demo)',
                      style: AppFonts.poppins(
                        context,
                        fontSize: scaleSp(context, 14),
                        color: Colors.white.withValues(alpha: 0.9),
                      ),
                    ),
                    SizedBox(height: scaleDp(context, 12)),
                    Container(
                      height: scaleDp(context, 120),
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: 0.15),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(
                          color: Colors.white.withValues(alpha: 0.25),
                        ),
                      ),
                      alignment: Alignment.center,
                      child: Text(
                        'Outfit card placeholder',
                        style: AppFonts.poppins(
                          context,
                          fontSize: scaleSp(context, 14),
                          color: Colors.white,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// -----------------------------------------------------------------------------
// Screen preview — Kotlin `HomeMainScreen.kt` `@Preview`.
// Run: `flutter run -t lib/preview/preview_main.dart`
// -----------------------------------------------------------------------------

class HomeMainScreenPreview extends StatelessWidget {
  const HomeMainScreenPreview({super.key});

  @override
  Widget build(BuildContext context) => const HomeMainScreen();
}

@Preview(
  name: 'Home main',
  group: 'Home',
  size: Size(402, 874),
  theme: trueClothesPreviewTheme,
)
Widget homeMainWidgetPreview() {
  return const HomeMainScreenPreview();
}
