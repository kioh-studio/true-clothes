package com.brian_bui.true_clothes.shared.theme

import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.compositionLocalOf
import androidx.compose.runtime.remember
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.TextUnit
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/** Base width (dp) at which design specs are defined. Scale = currentWidth / this. */
const val REFERENCE_DESIGN_WIDTH_DP = 402f

/**
 * Scale factor and helpers for responsive layout.
 * Use [scaleDp] and [scaleSp] so elements keep the same relative size across screen sizes.
 */
data class ResponsiveScale(
    val scale: Float,
    val screenWidthDp: Int,
    val screenHeightDp: Int,
) {
    fun scaleDp(value: Float): Dp = (value * scale).dp
    fun scaleDp(value: Dp): Dp = (value.value * scale).dp
    fun scaleSp(value: Float): TextUnit = (value * scale).sp
}

val LocalResponsiveScale = compositionLocalOf {
    ResponsiveScale(scale = 1f, screenWidthDp = REFERENCE_DESIGN_WIDTH_DP.toInt(), screenHeightDp = 0)
}

@Composable
fun rememberResponsiveScale(): ResponsiveScale {
    val config = LocalConfiguration.current
    return remember(config.screenWidthDp, config.screenHeightDp) {
        val scale = config.screenWidthDp / REFERENCE_DESIGN_WIDTH_DP
        ResponsiveScale(
            scale = scale,
            screenWidthDp = config.screenWidthDp,
            screenHeightDp = config.screenHeightDp,
        )
    }
}

@Composable
fun WithResponsiveScale(content: @Composable () -> Unit) {
    val scale = rememberResponsiveScale()
    CompositionLocalProvider(LocalResponsiveScale provides scale, content = content)
}
