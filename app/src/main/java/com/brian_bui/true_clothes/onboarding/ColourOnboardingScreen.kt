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
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import com.brian_bui.true_clothes.shared.components.TrueProgressBar
import com.brian_bui.true_clothes.shared.theme.LocalResponsiveScale
import com.brian_bui.true_clothes.shared.theme.PoppinsFontFamily
import com.brian_bui.true_clothes.shared.theme.TrueclothesTheme

enum class ColourPreference(val id: String, val label: String) {
    Unknown("unknown", "I don’t know"),
    CustomLater("custom_later", "I’ll set this later"),
}

data class ColourFormState(
    val colourPreference: ColourPreference? = null,
)

@Composable
fun ColourOnboardingScreen(
    state: ColourFormState,
    onStateChange: (ColourFormState) -> Unit,
    onBack: () -> Unit,
    onNext: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val scale = LocalResponsiveScale.current
    val paddingH = scale.scaleDp(33.5f)
    val paddingV = scale.scaleDp(33.5f)
    val tileBorder = scale.scaleDp(0.5f)
    val tileSize = scale.scaleDp(160f)
    val headerTitleSize = scale.scaleSp(20f)
    val subtitleSize = scale.scaleSp(14f)
    val sectionTitleSize = scale.scaleSp(18f)
    val footerPaddingV = paddingV

    Column(
        modifier = modifier
            .fillMaxSize()
            .fillMaxWidth(),
    ) {
        // Scrollable body (so fixed footer never overlaps content)
        Column(
            modifier = Modifier
                .weight(1f)
                .fillMaxWidth()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = paddingH, vertical = paddingV)
                .padding(bottom = scale.scaleDp(78f)),
        ) {
            Text(
                text = "Personal colour",
                style = MaterialTheme.typography.titleLarge.copy(
                    fontFamily = PoppinsFontFamily,
                    fontSize = headerTitleSize,
                    fontWeight = FontWeight.Medium,
                ),
            )
            Spacer(modifier = Modifier.size(scale.scaleDp(18f)))
            Text(
                text = "Let we know if you have detected your personal colour",
                style = MaterialTheme.typography.bodyMedium.copy(
                    fontFamily = PoppinsFontFamily,
                    fontSize = subtitleSize,
                    fontWeight = FontWeight.Normal,
                    color = Color(0xFF6B6B6B),
                ),
            )

            Spacer(modifier = Modifier.size(scale.scaleDp(44f)))
            Text(
                text = "I like to be looking as...",
                style = MaterialTheme.typography.bodyMedium.copy(
                    fontFamily = PoppinsFontFamily,
                    fontWeight = FontWeight.Bold,
                    fontSize = sectionTitleSize,
                ),
            )

            Spacer(modifier = Modifier.size(scale.scaleDp(28f)))
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                ColourTile(
                    selected = state.colourPreference == ColourPreference.Unknown,
                    background = Color(0xFFD5D5D5),
                    borderWidth = tileBorder,
                    size = tileSize,
                    icon = { UnknownTileIcon(size = scale.scaleDp(56f)) },
                    content = { Text("I dont know", fontFamily = PoppinsFontFamily, fontWeight = FontWeight.Normal) },
                    onClick = { onStateChange(state.copy(colourPreference = ColourPreference.Unknown)) },
                )

                ColourTile(
                    selected = state.colourPreference == ColourPreference.CustomLater,
                    background = Color.White,
                    borderWidth = tileBorder,
                    size = tileSize,
                    icon = null,
                    content = {},
                    onClick = { onStateChange(state.copy(colourPreference = ColourPreference.CustomLater)) },
                )
            }
        }

        // Fixed footer
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = paddingH, vertical = footerPaddingV),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween,
        ) {
            TextButton(onClick = onBack) { Text("Back") }
            TrueProgressBar(
                totalPoints = 5,
                activeIndices = listOf(3), // 0=gender,1=country,2=body_measurement,3=colour
                modifier = Modifier.weight(1f).padding(horizontal = scale.scaleDp(8f)),
            )
            TextButton(onClick = onNext) { Text("Next") }
        }
    }
}

@Composable
private fun ColourTile(
    selected: Boolean,
    background: Color,
    borderWidth: androidx.compose.ui.unit.Dp,
    size: androidx.compose.ui.unit.Dp,
    icon: (@Composable () -> Unit)?,
    content: @Composable () -> Unit,
    onClick: () -> Unit,
) {
    val scale = LocalResponsiveScale.current
    Box(
        modifier = Modifier
            .size(size)
            .clickable { onClick() }
            .padding(0.dp),
        contentAlignment = Alignment.Center,
    ) {
        Surface(
            modifier = Modifier.fillMaxSize(),
            color = background,
            tonalElevation = 0.dp,
            shadowElevation = 0.dp,
            border = androidx.compose.foundation.BorderStroke(borderWidth, Color.Black),
        ) {
            Column(
                modifier = Modifier.fillMaxSize().padding(scale.scaleDp(12f)),
                verticalArrangement = Arrangement.Center,
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                if (icon != null) {
                    icon()
                    Spacer(modifier = Modifier.size(6.dp))
                }
                content()
            }
        }
    }
}

@Composable
private fun UnknownTileIcon(size: androidx.compose.ui.unit.Dp) {
    // Lightweight placeholder matching the “icon + ? badge” look in the PNG.
    val scale = LocalResponsiveScale.current
    Box(contentAlignment = Alignment.Center) {
        Canvas(modifier = Modifier.size(size)) {
            val stroke = Stroke(width = scale.scaleDp(3f).toPx())
            drawRoundRect(
                color = Color.Black,
                topLeft = Offset(size.toPx() * 0.15f, size.toPx() * 0.25f),
                size = androidx.compose.ui.geometry.Size(size.toPx() * 0.7f, size.toPx() * 0.5f),
                cornerRadius = androidx.compose.ui.geometry.CornerRadius(size.toPx() * 0.1f, size.toPx() * 0.1f),
                style = stroke,
            )
            drawCircle(
                color = Color.Black,
                radius = size.toPx() * 0.09f,
                center = Offset(size.toPx() * 0.35f, size.toPx() * 0.23f),
                style = stroke,
            )
        }
        Text(
            text = "?",
            fontFamily = PoppinsFontFamily,
            fontWeight = FontWeight.SemiBold,
            color = Color.Black,
        )
    }
}

@Preview(showBackground = true)
@Composable
private fun ColourOnboardingScreenPreview() {
    TrueclothesTheme {
        ColourOnboardingScreen(
            state = ColourFormState(),
            onStateChange = {},
            onBack = {},
            onNext = {},
        )
    }
}

