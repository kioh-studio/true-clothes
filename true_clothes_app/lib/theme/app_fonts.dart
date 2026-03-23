import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

/// Poppins + Playfair Display via [google_fonts] (fetched from Google Fonts, cached on device).
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
