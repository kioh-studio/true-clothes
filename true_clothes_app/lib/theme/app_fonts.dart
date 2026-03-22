import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

/// Poppins + Playfair Display via [google_fonts] (Android `res/font` had XML only; TTFs were not in repo).
/// To bundle offline fonts instead, add `.ttf` under `fonts/` and declare them in `pubspec.yaml`.
abstract final class AppFonts {
  static TextStyle poppins(
    BuildContext context, {
    required double fontSize,
    FontWeight fontWeight = FontWeight.normal,
    Color? color,
    double? height,
    double letterSpacing = 0,
  }) {
    return GoogleFonts.poppins(
      fontSize: fontSize,
      fontWeight: fontWeight,
      color: color,
      height: height,
      letterSpacing: letterSpacing,
    );
  }

  static TextStyle playfairDisplay(
    BuildContext context, {
    required double fontSize,
    FontWeight fontWeight = FontWeight.bold,
    Color? color,
    double? height,
    double letterSpacing = 0,
  }) {
    return GoogleFonts.playfairDisplay(
      fontSize: fontSize,
      fontWeight: fontWeight,
      color: color,
      height: height,
      letterSpacing: letterSpacing,
    );
  }
}
