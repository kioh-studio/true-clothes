import 'package:flutter/material.dart';
import 'package:flutter/widget_previews.dart';

import '../../core/responsive.dart';
import '../../theme/app_fonts.dart';
import '../../theme/widget_preview_theme.dart';
import '../../widgets/onboarding_nav_bar.dart';
import 'colour_form.dart';
import 'onboarding_measurement_widgets.dart';

/// Kotlin `ColourOnboardingScreen.kt`.
class ColourOnboardingScreen extends StatefulWidget {
  const ColourOnboardingScreen({
    super.key,
    required this.state,
    required this.onStateChange,
    required this.onBack,
    required this.onNext,
  });

  final ColourFormState state;
  final ValueChanged<ColourFormState> onStateChange;
  final VoidCallback onBack;
  final VoidCallback onNext;

  @override
  State<ColourOnboardingScreen> createState() => _ColourOnboardingScreenState();
}

class _ColourOnboardingScreenState extends State<ColourOnboardingScreen> {
  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final s = widget.state;

    final paddingH = scaleDp(context, 33.5);
    final paddingV = scaleDp(context, 33.5);
    final tileSize = scaleDp(context, 160);
    final tileBorder = scaleDp(context, 0.5);
    final titleSize = scaleSp(context, 20);
    final subtitleSize = scaleSp(context, 14);
    final sectionTitle = scaleSp(context, 18);
    final spacingBeforeProgress = scaleDp(context, 78);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Expanded(
          child: SingleChildScrollView(
            padding: EdgeInsets.fromLTRB(
              paddingH,
              paddingV,
              paddingH,
              spacingBeforeProgress,
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(
                  'Personal colour',
                  style: AppFonts.poppins(
                    context,
                    fontSize: titleSize,
                    fontWeight: FontWeight.w500,
                    color: scheme.onSurface,
                  ),
                ),
                SizedBox(height: scaleDp(context, 18)),
                Text(
                  'Let we know if you have detected your personal colour',
                  style: AppFonts.poppins(
                    context,
                    fontSize: subtitleSize,
                    color: kOnboardingSubtitleGrey,
                  ),
                ),
                SizedBox(height: scaleDp(context, 44)),
                Text(
                  'I like to be looking as...',
                  style: AppFonts.poppins(
                    context,
                    fontSize: sectionTitle,
                    fontWeight: FontWeight.w700,
                    color: scheme.onSurface,
                  ),
                ),
                SizedBox(height: scaleDp(context, 28)),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  crossAxisAlignment: CrossAxisAlignment.center,
                  children: [
                    _ColourTile(
                      selected: s.colourPreference == ColourPreference.unknown,
                      background: const Color(0xFFD5D5D5),
                      borderWidth: tileBorder,
                      size: tileSize,
                      onTap: () {
                        widget.onStateChange(
                          const ColourFormState(
                            colourPreference: ColourPreference.unknown,
                          ),
                        );
                      },
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          _UnknownColourGlyph(size: scaleDp(context, 56)),
                          SizedBox(height: scaleDp(context, 6)),
                          Text(
                            "I don't know",
                            textAlign: TextAlign.center,
                            style: AppFonts.poppins(
                              context,
                              fontSize: scaleSp(context, 14),
                            ),
                          ),
                        ],
                      ),
                    ),
                    _ColourTile(
                      selected:
                          s.colourPreference == ColourPreference.customLater,
                      background: Colors.white,
                      borderWidth: tileBorder,
                      size: tileSize,
                      onTap: () {
                        widget.onStateChange(
                          const ColourFormState(
                            colourPreference: ColourPreference.customLater,
                          ),
                        );
                      },
                      child: Center(
                        child: Padding(
                          padding: EdgeInsets.all(scaleDp(context, 12)),
                          child: Text(
                            ColourPreference.customLater.label,
                            textAlign: TextAlign.center,
                            style: AppFonts.poppins(
                              context,
                              fontSize: scaleSp(context, 14),
                            ),
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
        OnboardingNavBar(
          activeIndices: const [3],
          footerVerticalDesignDp: 33.5,
          onBack: widget.onBack,
          onNext: widget.onNext,
        ),
      ],
    );
  }
}

class _ColourTile extends StatelessWidget {
  const _ColourTile({
    required this.selected,
    required this.background,
    required this.borderWidth,
    required this.size,
    required this.onTap,
    required this.child,
  });

  final bool selected;
  final Color background;
  final double borderWidth;
  final double size;
  final VoidCallback onTap;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        child: Container(
          width: size,
          height: size,
          decoration: BoxDecoration(
            color: background,
            border: Border.all(
              color: Colors.black,
              width: borderWidth,
            ),
          ),
          child: child,
        ),
      ),
    );
  }
}

class _UnknownColourGlyph extends StatelessWidget {
  const _UnknownColourGlyph({required this.size});

  final double size;

  @override
  Widget build(BuildContext context) {
    final sw = scaleDp(context, 3);
    return CustomPaint(
      size: Size(size, size),
      painter: _UnknownGlyphPainter(strokeWidth: sw),
      child: Center(
        child: Text(
          '?',
          style: AppFonts.poppins(
            context,
            fontSize: scaleSp(context, 18),
            fontWeight: FontWeight.w600,
          ),
        ),
      ),
    );
  }
}

class _UnknownGlyphPainter extends CustomPainter {
  _UnknownGlyphPainter({required this.strokeWidth});

  final double strokeWidth;

  @override
  void paint(Canvas canvas, Size size) {
    final w = size.width;
    final h = size.height;
    final r = RRect.fromRectAndRadius(
      Rect.fromLTWH(w * 0.15, h * 0.25, w * 0.7, h * 0.5),
      Radius.circular(w * 0.1),
    );
    canvas.drawRRect(
      r,
      Paint()
        ..color = Colors.black
        ..style = PaintingStyle.stroke
        ..strokeWidth = strokeWidth,
    );
    canvas.drawCircle(
      Offset(w * 0.35, h * 0.23),
      w * 0.09,
      Paint()
        ..color = Colors.black
        ..style = PaintingStyle.stroke
        ..strokeWidth = strokeWidth,
    );
  }

  @override
  bool shouldRepaint(covariant _UnknownGlyphPainter oldDelegate) =>
      oldDelegate.strokeWidth != strokeWidth;
}

class ColourOnboardingScreenPreview extends StatefulWidget {
  const ColourOnboardingScreenPreview({super.key});

  @override
  State<ColourOnboardingScreenPreview> createState() =>
      _ColourOnboardingScreenPreviewState();
}

class _ColourOnboardingScreenPreviewState
    extends State<ColourOnboardingScreenPreview> {
  ColourFormState _state = const ColourFormState();

  @override
  Widget build(BuildContext context) {
    return ColourOnboardingScreen(
      state: _state,
      onStateChange: (s) => setState(() => _state = s),
      onBack: () {},
      onNext: () {},
    );
  }
}

@Preview(
  name: 'Colour onboarding',
  group: 'Onboarding',
  size: Size(402, 874),
  theme: trueClothesPreviewTheme,
)
Widget colourOnboardingWidgetPreview() {
  return const ColourOnboardingScreenPreview();
}
