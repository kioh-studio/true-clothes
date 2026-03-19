package com.brian_bui.true_clothes.onboarding

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import com.brian_bui.true_clothes.shared.components.ModalActionMode
import com.brian_bui.true_clothes.shared.components.TrueModal
import com.brian_bui.true_clothes.shared.components.TrueProgressBar
import com.brian_bui.true_clothes.shared.theme.LocalResponsiveScale
import com.brian_bui.true_clothes.shared.theme.PoppinsFontFamily
import com.brian_bui.true_clothes.shared.theme.TrueclothesTheme

data class AddingWardrobeFormState(
    val uploadedCount: Int = 0, // Placeholder for future upload integration
)

@Suppress("UNUSED_PARAMETER")
@Composable
fun AddingWardrobeOnboardingScreen(
    state: AddingWardrobeFormState,
    onStateChange: (AddingWardrobeFormState) -> Unit,
    onBack: () -> Unit,
    onNext: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val scale = LocalResponsiveScale.current
    val paddingH = scale.scaleDp(33.5f)
    val paddingV = scale.scaleDp(33.5f)
    val spacingBeforeProgress = scale.scaleDp(78f)
    val titleFontSize = scale.scaleSp(20f)
    val subtitleFontSize = scale.scaleSp(14f)
    val dropZoneSize = scale.scaleDp(250f) // wardrobe.svg uses 250x250 placeholder
    val dashStrokeWidth = scale.scaleDp(2f)

    var modalMessage by remember { mutableStateOf<String?>(null) }
    if (modalMessage != null) {
        Dialog(
            onDismissRequest = { modalMessage = null },
            properties = DialogProperties(
                usePlatformDefaultWidth = false,
                dismissOnBackPress = true,
                dismissOnClickOutside = true,
            ),
        ) {
            Box(Modifier.fillMaxSize()) {
                TrueModal(
                    visible = true,
                    title = "Info",
                    message = modalMessage ?: "",
                    mode = ModalActionMode.CloseOnly,
                    onDismiss = { modalMessage = null },
                )
            }
        }
    }

    Column(
        modifier = modifier
            .fillMaxSize()
            .fillMaxWidth(),
    ) {
        // Body
        Column(
            modifier = Modifier
                .weight(1f)
                .fillMaxWidth()
                .padding(horizontal = paddingH, vertical = paddingV)
                .padding(bottom = spacingBeforeProgress),
        ) {
            Text(
                text = "Building your wardrobe",
                style = MaterialTheme.typography.titleLarge.copy(
                    fontFamily = PoppinsFontFamily,
                    fontSize = titleFontSize,
                    fontWeight = FontWeight.Medium,
                ),
            )

            Spacer(modifier = Modifier.size(scale.scaleDp(18f)))
            Text(
                text = "Let us know about your exisiting items and building outstanding outfits together",
                style = MaterialTheme.typography.bodyMedium.copy(
                    fontFamily = PoppinsFontFamily,
                    fontSize = subtitleFontSize,
                    fontWeight = FontWeight.Normal,
                    color = Color(0xFF6B6B6B),
                ),
            )

            Spacer(modifier = Modifier.size(scale.scaleDp(90f)))

            Box(
                modifier = Modifier
                    .fillMaxWidth(),
                contentAlignment = Alignment.Center,
            ) {
                Box(
                    modifier = Modifier
                        .size(dropZoneSize)
                        .clickable {
                            modalMessage = "Upload flow is coming soon."
                        },
                    contentAlignment = Alignment.Center,
                ) {
                    DashedUploadRect(
                        boxSize = dropZoneSize,
                        strokeWidth = dashStrokeWidth,
                    )
                }
            }
        }

        // Fixed footer
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = paddingH, vertical = paddingV),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween,
        ) {
            TextButton(onClick = onBack) { Text("Back") }
            TrueProgressBar(
                totalPoints = 5,
                activeIndices = listOf(4), // gender(0), country(1), body(2), colour(3), adding_wardrobe(4)
                modifier = Modifier.weight(1f).padding(horizontal = scale.scaleDp(8f)),
            )
            TextButton(
                onClick = onNext,
                enabled = true,
            ) { Text("Next") }
        }
    }
}

@Composable
private fun DashedUploadRect(
    boxSize: androidx.compose.ui.unit.Dp,
    strokeWidth: androidx.compose.ui.unit.Dp,
) {
    val density = LocalDensity.current
    val strokePx = strokeWidth.value * density.density
    val dashPx = 2f * density.density
    val dashEffect = PathEffect.dashPathEffect(floatArrayOf(dashPx, dashPx), 0f)

    Canvas(modifier = Modifier.size(boxSize)) {
        drawRect(
            color = Color.Black,
            topLeft = Offset(0f, 0f),
            size = androidx.compose.ui.geometry.Size(size.width, size.height),
            style = Stroke(width = strokePx, pathEffect = dashEffect),
        )
    }
}

@Preview(showBackground = true)
@Composable
private fun AddingWardrobeOnboardingScreenPreview() {
    TrueclothesTheme {
        AddingWardrobeOnboardingScreen(
            state = AddingWardrobeFormState(),
            onStateChange = {},
            onBack = {},
            onNext = {},
        )
    }
}

