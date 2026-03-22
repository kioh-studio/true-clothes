import 'package:flutter/material.dart';

import '../../core/responsive.dart';
import '../../theme/app_fonts.dart';
import '../../widgets/onboarding_nav_bar.dart';

/// Generic stand-in for onboarding steps not yet wired in a given build.
/// Replaced in app flow by screens ported from Kotlin (`com.brian_bui.true_clothes`).
class OnboardingPlaceholderScreen extends StatelessWidget {
  const OnboardingPlaceholderScreen({
    super.key,
    required this.title,
    this.subtitle,
    required this.activeProgressIndices,
    required this.backEnabled,
    required this.onBack,
    required this.onNext,
    this.nextLabel = 'Next',
  });

  final String title;
  final String? subtitle;
  final List<int> activeProgressIndices;
  final bool backEnabled;
  final VoidCallback onBack;
  final VoidCallback onNext;
  final String nextLabel;

  @override
  Widget build(BuildContext context) {
    final pad = scaleDp(context, 24);
    final titleSize = scaleSp(context, 20);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Expanded(
          child: Padding(
            padding: EdgeInsets.all(pad),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: AppFonts.poppins(
                    context,
                    fontSize: titleSize,
                    fontWeight: FontWeight.w500,
                  ),
                ),
                if (subtitle != null) ...[
                  SizedBox(height: scaleDp(context, 12)),
                  Text(
                    subtitle!,
                    style: AppFonts.poppins(
                      context,
                      fontSize: scaleSp(context, 14),
                      color: Theme.of(context).colorScheme.onSurfaceVariant,
                    ),
                  ),
                ],
                SizedBox(height: scaleDp(context, 24)),
                Text(
                  'Flutter port in progress — see true-clothes-docs design for this step.',
                  style: AppFonts.poppins(
                    context,
                    fontSize: scaleSp(context, 13),
                  ),
                ),
              ],
            ),
          ),
        ),
        OnboardingNavBar(
          activeIndices: activeProgressIndices,
          backEnabled: backEnabled,
          onBack: onBack,
          onNext: onNext,
          nextLabel: nextLabel,
        ),
      ],
    );
  }
}
