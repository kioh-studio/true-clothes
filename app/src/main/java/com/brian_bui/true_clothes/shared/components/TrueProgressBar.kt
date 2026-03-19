package com.brian_bui.true_clothes.shared.components

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.tooling.preview.Preview
import com.brian_bui.true_clothes.shared.theme.LocalResponsiveScale
import com.brian_bui.true_clothes.shared.theme.TrueclothesTheme
import kotlin.collections.emptyList

/**
 * Reusable progress bar component that matches the progress-bar design spec.
 *
 * Tracks onboarding progress across steps with configurable number of points.
 * Points can be shown as empty (stroke only) or active (filled).
 *
 * @param totalPoints Number of progress points to display
 * @param activeIndices Indices of points to show as bold/filled (0-based, can be multiple)
 * @param modifier Modifier for the component
 */
@Composable
fun TrueProgressBar(
    totalPoints: Int = 0,
    activeIndices: List<Int> = emptyList(),
    modifier: Modifier = Modifier,
) {
    if (totalPoints <= 0) return

    val scale = LocalResponsiveScale.current
    val progressPointSize = scale.scaleDp(14f)  // circle diameter from design (r=7)
    val progressLineWidth = scale.scaleDp(2f)
    val strokeWidth = scale.scaleDp(1f)

    Row(
        modifier = modifier
            .fillMaxWidth()
            .height(progressPointSize),
        horizontalArrangement = Arrangement.Center,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        repeat(totalPoints) { index ->
            val isActive = activeIndices.contains(index)

            Canvas(
                modifier = Modifier.size(progressPointSize)
            ) {
                val center = Offset(size.width / 2, size.height / 2)
                val radius = progressPointSize.toPx() / 2

                if (isActive) {
                    drawCircle(
                        color = Color.Black,
                        radius = radius,
                        center = center,
                    )
                } else {
                    drawCircle(
                        color = Color.Black,
                        radius = radius,
                        center = center,
                        style = Stroke(width = strokeWidth.toPx()),
                    )
                }
            }

            if (index < totalPoints - 1) {
                Canvas(
                    modifier = Modifier
                        .weight(1f)
                        .height(progressPointSize)
                ) {
                    val centerY = size.height / 2
                    drawLine(
                        color = Color.Black,
                        start = Offset(0f, centerY),
                        end = Offset(size.width, centerY),
                        strokeWidth = progressLineWidth.toPx(),
                    )
                }
            }
        }
    }
}

@Preview(showBackground = true)
@Composable
private fun TrueProgressBarPreviewEmpty() {
    TrueclothesTheme {
        TrueProgressBar(
            totalPoints = 0,
            activeIndices = emptyList(),
        )
    }
}

@Preview(showBackground = true)
@Composable
private fun TrueProgressBarPreviewFivePoints() {
    TrueclothesTheme {
        TrueProgressBar(
            totalPoints = 5,
            activeIndices = emptyList(),
        )
    }
}

@Preview(showBackground = true)
@Composable
private fun TrueProgressBarPreviewActiveFirst() {
    TrueclothesTheme {
        TrueProgressBar(
            totalPoints = 5,
            activeIndices = listOf(0),
        )
    }
}

@Preview(showBackground = true)
@Composable
private fun TrueProgressBarPreviewActiveMultiple() {
    TrueclothesTheme {
        TrueProgressBar(
            totalPoints = 5,
            activeIndices = listOf(0, 1, 2),
        )
    }
}
