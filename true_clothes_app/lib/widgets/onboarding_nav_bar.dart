import 'package:flutter/material.dart';
import 'package:flutter/widget_previews.dart';

import '../core/responsive.dart';
import '../theme/widget_preview_theme.dart';
import '../theme/app_fonts.dart';
import 'true_progress_bar.dart';

/// Shared footer: Back + [TrueProgressBar] + Next (matches Kotlin onboarding screens).
class OnboardingNavBar extends StatelessWidget {
  const OnboardingNavBar({
    super.key,
    required this.activeIndices,
    this.backEnabled = true,
    this.nextEnabled = true,
    this.onBack,
    this.onNext,
    this.nextLabel = 'Next',
    this.footerVerticalDesignDp = 50.5,
  });

  final List<int> activeIndices;
  final bool backEnabled;
  /// When false, Next is disabled (e.g. country until a selection exists).
  final bool nextEnabled;
  final VoidCallback? onBack;
  final VoidCallback? onNext;
  final String nextLabel;
  /// Kotlin gender footer uses 50.5dp; other onboarding screens use 33.5dp.
  final double footerVerticalDesignDp;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final paddingH = scaleDp(context, 33.5);
    final paddingV = scaleDp(context, footerVerticalDesignDp);
    final footerPadH = scaleDp(context, 8);

    return Padding(
      padding: EdgeInsets.symmetric(horizontal: paddingH, vertical: paddingV),
      child: Row(
        children: [
          TextButton(
            onPressed: backEnabled ? onBack : null,
            child: Text(
              'Back',
              style: AppFonts.poppins(
                context,
                fontSize: scaleSp(context, 14),
                color: backEnabled
                    ? scheme.primary
                    : scheme.onSurface.withValues(alpha: 0.38),
              ),
            ),
          ),
          Expanded(
            child: Padding(
              padding: EdgeInsets.symmetric(horizontal: footerPadH),
              child: TrueProgressBar(
                totalPoints: 5,
                activeIndices: activeIndices,
              ),
            ),
          ),
          TextButton(
            onPressed: nextEnabled ? onNext : null,
            child: Text(
              nextLabel,
              style: AppFonts.poppins(
                context,
                fontSize: scaleSp(context, 14),
                color: nextEnabled
                    ? scheme.primary
                    : scheme.onSurface.withValues(alpha: 0.38),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

@Preview(
  name: 'Onboarding footer bar',
  group: 'Components',
  size: Size(402, 88),
  theme: trueClothesPreviewTheme,
)
Widget onboardingNavBarWidgetPreview() {
  return Builder(
    builder: (context) => Padding(
      padding: const EdgeInsets.only(top: 8),
      child: OnboardingNavBar(
        activeIndices: const [2],
        backEnabled: true,
        onBack: () {},
        onNext: () {},
      ),
    ),
  );
}
