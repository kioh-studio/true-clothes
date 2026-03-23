import 'package:flutter/material.dart';
import 'package:flutter/widget_previews.dart';

import '../../core/responsive.dart';
import '../../main_nav_shell.dart';
import '../../theme/app_colors.dart';
import '../../theme/app_fonts.dart';
import '../../theme/app_theme.dart';
import '../../theme/widget_preview_theme.dart';

/// User settings & profile — placeholder content for [MainNavShell] tab 2.
/// Lives inside the shared [Scaffold] in [MainNavShell]; no nested Scaffold.
class UserProfileContent extends StatelessWidget {
  const UserProfileContent({super.key});

  @override
  Widget build(BuildContext context) {
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
        child: Padding(
          padding: EdgeInsets.symmetric(horizontal: scaleDp(context, 24)),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              SizedBox(height: scaleDp(context, 36)),
              Text(
                'PROFILE',
                style: AppFonts.playfairDisplay(
                  context,
                  fontSize: scaleSp(context, 28),
                  fontWeight: FontWeight.bold,
                  color: AppColors.homeLogotype,
                  height: scaleSp(context, 40) / scaleSp(context, 28),
                  letterSpacing: 0.06 * scaleSp(context, 28),
                ),
              ),
              SizedBox(height: scaleDp(context, 48)),
              Expanded(
                child: Center(
                  child: Text(
                    'Settings & profile coming soon.',
                    textAlign: TextAlign.center,
                    style: AppFonts.poppins(
                      context,
                      fontSize: scaleSp(context, 14),
                      fontWeight: FontWeight.w300,
                      color: Colors.white.withValues(alpha: 0.7),
                      letterSpacing: 0.04 * scaleSp(context, 14),
                    ),
                  ),
                ),
              ),
              // Clear the floating nav circles (active diameter 70 + 21dp gap).
              SizedBox(height: scaleDp(context, 100)),
            ],
          ),
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Widget Previewer
// ---------------------------------------------------------------------------

class UserProfileScreenPreview extends StatelessWidget {
  const UserProfileScreenPreview({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      theme: buildAppTheme(),
      home: const MainNavShell(initialIndex: 2),
    );
  }
}

@Preview(
  name: 'User profile',
  group: 'Home',
  size: Size(402, 874),
  theme: trueClothesPreviewTheme,
)
Widget userProfileWidgetPreview() {
  return const UserProfileScreenPreview();
}
