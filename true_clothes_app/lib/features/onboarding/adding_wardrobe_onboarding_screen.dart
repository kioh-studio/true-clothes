import 'package:flutter/material.dart';
import 'package:flutter/widget_previews.dart';

import '../../core/responsive.dart';
import '../../theme/app_fonts.dart';
import '../../theme/widget_preview_theme.dart';
import '../../widgets/onboarding_nav_bar.dart';
import '../../widgets/true_modal.dart';
import 'adding_wardrobe_form.dart';
import 'onboarding_measurement_widgets.dart';

/// Kotlin `AddingWardrobeOnboardingScreen.kt`.
class AddingWardrobeOnboardingScreen extends StatelessWidget {
  const AddingWardrobeOnboardingScreen({
    super.key,
    required this.state,
    required this.onBack,
    required this.onNext,
  });

  final AddingWardrobeFormState state;
  final VoidCallback onBack;
  final VoidCallback onNext;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final paddingH = scaleDp(context, 33.5);
    final paddingV = scaleDp(context, 33.5);
    final spacingBeforeProgress = scaleDp(context, 78);
    final titleSize = scaleSp(context, 20);
    final subtitleSize = scaleSp(context, 14);
    final dropSize = scaleDp(context, 250);
    final dashW = scaleDp(context, 2);

    return Column(
      key: ValueKey<int>(state.uploadedCount),
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Expanded(
          child: Padding(
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
                  'Building your wardrobe',
                  style: AppFonts.poppins(
                    context,
                    fontSize: titleSize,
                    fontWeight: FontWeight.w500,
                    color: scheme.onSurface,
                  ),
                ),
                SizedBox(height: scaleDp(context, 18)),
                Text(
                  'Let us know about your exisiting items and building outstanding outfits together',
                  style: AppFonts.poppins(
                    context,
                    fontSize: subtitleSize,
                    color: kOnboardingSubtitleGrey,
                  ),
                ),
                SizedBox(height: scaleDp(context, 90)),
                Center(
                  child: Material(
                    color: Colors.transparent,
                    child: InkWell(
                      onTap: () => showTrueInfoModal(
                        context,
                        message: 'Upload flow is coming soon.',
                      ),
                      child: CustomPaint(
                        painter: _DashedRectPainter(strokeWidth: dashW),
                        child: SizedBox(width: dropSize, height: dropSize),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
        OnboardingNavBar(
          activeIndices: const [4],
          footerVerticalDesignDp: 33.5,
          onBack: onBack,
          onNext: onNext,
        ),
      ],
    );
  }
}

class _DashedRectPainter extends CustomPainter {
  _DashedRectPainter({required this.strokeWidth});

  final double strokeWidth;

  void _dashSide(
    Canvas canvas,
    Paint paint,
    Offset a,
    Offset b,
    double dash,
    double gap,
  ) {
    final d = b - a;
    final len = d.distance;
    if (len <= 0) return;
    final dir = d / len;
    var t = 0.0;
    while (t < len) {
      final end = (t + dash).clamp(0.0, len);
      canvas.drawLine(a + dir * t, a + dir * end, paint);
      t += dash + gap;
    }
  }

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = Colors.black
      ..style = PaintingStyle.stroke
      ..strokeWidth = strokeWidth;
    final dash = 2 * strokeWidth;
    final gap = dash;
    final w = size.width;
    final h = size.height;
    _dashSide(canvas, paint, Offset.zero, Offset(w, 0), dash, gap);
    _dashSide(canvas, paint, Offset(w, 0), Offset(w, h), dash, gap);
    _dashSide(canvas, paint, Offset(w, h), Offset(0, h), dash, gap);
    _dashSide(canvas, paint, Offset(0, h), Offset.zero, dash, gap);
  }

  @override
  bool shouldRepaint(covariant _DashedRectPainter oldDelegate) =>
      oldDelegate.strokeWidth != strokeWidth;
}

class AddingWardrobeOnboardingScreenPreview extends StatefulWidget {
  const AddingWardrobeOnboardingScreenPreview({super.key});

  @override
  State<AddingWardrobeOnboardingScreenPreview> createState() =>
      _AddingWardrobeOnboardingScreenPreviewState();
}

class _AddingWardrobeOnboardingScreenPreviewState
    extends State<AddingWardrobeOnboardingScreenPreview> {
  final AddingWardrobeFormState _state = const AddingWardrobeFormState();

  @override
  Widget build(BuildContext context) {
    return AddingWardrobeOnboardingScreen(
      state: _state,
      onBack: () {},
      onNext: () {},
    );
  }
}

@Preview(
  name: 'Adding wardrobe',
  group: 'Onboarding',
  size: Size(402, 874),
  theme: trueClothesPreviewTheme,
)
Widget addingWardrobeOnboardingWidgetPreview() {
  return const AddingWardrobeOnboardingScreenPreview();
}
