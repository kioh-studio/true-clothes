package com.brian_bui.true_clothes.shared.theme

import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import com.brian_bui.true_clothes.R

/**
 * Central place for default UI “design tokens” shared by multiple screens.
 *
 * Keep this lightweight: colors + font families that are referenced across the app.
 */

// Background for default screens (per design spec).
val DefaultScreenBackground = Color(0xFFF5F5F5)

// Default body text font family.
val DefaultBodyFontFamily: FontFamily = PoppinsFontFamily

// Header font family (“Display Fair” in your notes == Playfair Display).
val DefaultHeaderFontFamily: FontFamily = FontFamily(
    Font(R.font.playfairdisplay_bold, FontWeight.Bold),
)

val OutfitDetailFont : FontFamily = FontFamily(
    Font(R.font.playfairdisplay_medium, FontWeight.Medium)
)

