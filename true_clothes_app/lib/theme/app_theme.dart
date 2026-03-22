import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import 'app_colors.dart';

/// Kotlin `Color.kt` + `Theme.kt` — Purple40 primary, #F5F5F5 surface.
/// Design: `theme_colors.main_background` in onboarding `design.md`.
ColorScheme _trueClothesLightScheme() {
  const purple40 = Color(0xFF6650A4);
  const purpleGrey40 = Color(0xFF625B71);
  const pink40 = Color(0xFF7D5260);
  const bg = AppColors.mainBackground;
  return ColorScheme.light(
    primary: purple40,
    onPrimary: Colors.white,
    primaryContainer: const Color(0xFFEADDFF),
    onPrimaryContainer: const Color(0xFF21005D),
    secondary: purpleGrey40,
    onSecondary: Colors.white,
    tertiary: pink40,
    onTertiary: Colors.white,
    error: const Color(0xFFB3261E),
    onError: Colors.white,
    surface: bg,
    onSurface: const Color(0xFF1C1B1F),
    onSurfaceVariant: const Color(0xFF49454F),
    outline: const Color(0xFF79747E),
    outlineVariant: const Color(0xFFCAC4D0),
  ).copyWith(
    // Material 3 otherwise derives lighter greys; spec is flat #F5F5F5.
    surfaceContainerLowest: bg,
    surfaceContainerLow: bg,
    surfaceContainer: bg,
    surfaceContainerHigh: bg,
    surfaceContainerHighest: bg,
    // Without this, M3 tints surfaces with [primary] and #F5F5F5 looks purple-grey.
    surfaceTint: Colors.transparent,
  );
}

/// Light theme aligned with Kotlin `TrueclothesTheme` + Material 3.
///
/// Default page background is [AppColors.mainBackground] (#F5F5F5). [HomeMainScreen]
/// overrides its [Scaffold.backgroundColor] to the home gradient (not #F5F5F5).
ThemeData buildAppTheme() {
  final scheme = _trueClothesLightScheme();
  final poppins = GoogleFonts.poppinsTextTheme().apply(
    bodyColor: scheme.onSurface,
    displayColor: scheme.onSurface,
  );

  return ThemeData(
    useMaterial3: true,
    colorScheme: scheme,
    scaffoldBackgroundColor: AppColors.mainBackground,
    textTheme: poppins,
    textButtonTheme: TextButtonThemeData(
      style: TextButton.styleFrom(
        foregroundColor: scheme.primary,
      ),
    ),
    radioTheme: RadioThemeData(
      fillColor: WidgetStateProperty.resolveWith((states) {
        if (states.contains(WidgetState.selected)) {
          return scheme.primary;
        }
        if (states.contains(WidgetState.disabled)) {
          return scheme.onSurface.withValues(alpha: 0.38);
        }
        return scheme.onSurfaceVariant;
      }),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: Colors.white,
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
      hintStyle: TextStyle(color: scheme.onSurfaceVariant),
      labelStyle: TextStyle(color: scheme.onSurfaceVariant),
      floatingLabelStyle: WidgetStateTextStyle.resolveWith((states) {
        if (states.contains(WidgetState.error)) {
          return TextStyle(color: scheme.error);
        }
        if (states.contains(WidgetState.focused)) {
          return TextStyle(color: scheme.primary);
        }
        return TextStyle(color: scheme.onSurfaceVariant);
      }),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(4),
        borderSide: BorderSide(color: scheme.outline),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(4),
        borderSide: BorderSide(color: scheme.outline),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(4),
        borderSide: BorderSide(color: scheme.primary, width: 2),
      ),
      errorBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(4),
        borderSide: BorderSide(color: scheme.error),
      ),
      focusedErrorBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(4),
        borderSide: BorderSide(color: scheme.error, width: 2),
      ),
    ),
  );
}
