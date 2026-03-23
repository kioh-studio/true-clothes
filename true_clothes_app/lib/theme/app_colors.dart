import 'package:flutter/material.dart';

/// Kotlin `Color.kt` / `DesignTokens.kt` + design `theme_colors.main_background`.
abstract final class AppColors {
  /// Default app / scaffold background (#F5F5F5).
  static const Color mainBackground = Color(0xFFF5F5F5);

  /// Home gradient (matches `HomeMainScreen.kt` implementation).
  static const Color homeGradientTop = Color(0xFF4D5051);
  /// Design `home/main/design.md`: `#4D5051` @ 35% at gradient stop 0.
  static const double homeGradientTopAlpha = 0.35;
  static const Color homeGradientBottom = Color(0xFFDCDCDC);

  static const Color homeLogotype = Color(0xFFFFFAFA);
}
