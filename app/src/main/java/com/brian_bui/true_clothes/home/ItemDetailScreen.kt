package com.brian_bui.true_clothes.home

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.tooling.preview.Preview
import com.brian_bui.true_clothes.shared.media.BitmapSourceImage
import com.brian_bui.true_clothes.shared.theme.DefaultBodyFontFamily
import com.brian_bui.true_clothes.shared.theme.DefaultHeaderFontFamily
import com.brian_bui.true_clothes.shared.theme.DefaultScreenBackground
import com.brian_bui.true_clothes.shared.theme.LocalResponsiveScale
import com.brian_bui.true_clothes.shared.theme.TrueclothesTheme

@Composable
fun ItemDetailScreen(
    model: ItemDetailUi,
    onBack: () -> Unit,
) {
    val scale = LocalResponsiveScale.current
    val uriHandler = LocalUriHandler.current
    val horizontal = scale.scaleDp(28f)
    val heroHeight = scale.scaleDp(486f)
    val rows = measurementRowsFor(model.category, model.measurements)
    val scrimHeight = scale.scaleDp(140f)

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(DefaultScreenBackground)
            .verticalScroll(rememberScrollState()),
    ) {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(heroHeight),
        ) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(Color(0xFFDCDCDC)),
            )
            BitmapSourceImage(
                imageSource = model.imageSource,
                contentDescription = model.fullName,
                modifier = Modifier.fillMaxSize(),
                contentScale = ContentScale.Crop,
            )
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(scrimHeight)
                    .align(Alignment.TopCenter)
                    .background(
                        Brush.verticalGradient(
                            colors = listOf(
                                Color.Black.copy(alpha = 0.55f),
                                Color.Transparent,
                            ),
                        ),
                    ),
            )
            Row(
                modifier = Modifier
                    .align(Alignment.TopStart)
                    .statusBarsPadding()
                    .padding(
                        start = scale.scaleDp(8f),
                        top = scale.scaleDp(8f),
                    ),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                TextButton(
                    onClick = onBack,
                    colors = ButtonDefaults.textButtonColors(contentColor = Color.White),
                ) {
                    Text(
                        text = "Back",
                        style = MaterialTheme.typography.bodyMedium.copy(
                            fontFamily = DefaultBodyFontFamily,
                            fontWeight = FontWeight.Bold,
                        ),
                    )
                }
            }
        }

        Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = horizontal)
                    .padding(top = scale.scaleDp(24f)),
            ) {
                Text(
                    text = model.fullName,
                    style = MaterialTheme.typography.titleLarge.copy(
                        fontFamily = DefaultHeaderFontFamily,
                        fontWeight = FontWeight.Bold,
                        fontSize = scale.scaleSp(22f),
                        lineHeight = scale.scaleSp(34f),
                    ),
                    color = Color(0xFF000000),
                )

                Spacer(modifier = Modifier.height(scale.scaleDp(12f)))

                Text(
                    text = model.color,
                    style = MaterialTheme.typography.bodyMedium.copy(
                        fontFamily = DefaultBodyFontFamily,
                        fontWeight = FontWeight.Light,
                        fontSize = scale.scaleSp(20f),
                    ),
                    color = Color(0xFF000000).copy(alpha = 0.5f),
                    modifier = Modifier.semantics {
                        contentDescription = "Color: ${model.color}"
                    },
                )

                Spacer(modifier = Modifier.height(scale.scaleDp(8f)))

                Text(
                    text = "${model.brand}",
                    style = MaterialTheme.typography.bodyMedium.copy(
                        fontFamily = DefaultBodyFontFamily,
                        fontWeight = FontWeight.Medium,
                        fontSize = scale.scaleSp(15f),
                    ),
                    color = Color(0xFF000000),
                )

                Spacer(modifier = Modifier.height(scale.scaleDp(20f)))

                val url = model.productUrl
                if (!url.isNullOrBlank()) {
                    val host = runCatching { android.net.Uri.parse(url).host }.getOrNull().orEmpty()
                    val linkSemantics = if (host.isNotEmpty()) {
                        "View product link. Opens $host"
                    } else {
                        "View product link"
                    }
                    Text(
                        text = "View product link",
                        style = TextStyle(
                            fontFamily = DefaultBodyFontFamily,
                            fontWeight = FontWeight.SemiBold,
                            fontSize = scale.scaleSp(16f),
                            textDecoration = TextDecoration.Underline,
                        ),
                        color = Color(0xFF000000),
                        modifier = Modifier
                            .heightIn(min = scale.scaleDp(48f))
                            .semantics {
                                role = Role.Button
                                contentDescription = linkSemantics
                            }
                            .clickable {
                                runCatching { uriHandler.openUri(url) }
                            }
                            .padding(vertical = scale.scaleDp(8f)),
                    )
                }

                Spacer(modifier = Modifier.height(scale.scaleDp(28f)))

                Text(
                    text = "Measurements",
                    style = MaterialTheme.typography.titleMedium.copy(
                        fontFamily = DefaultBodyFontFamily,
                        fontWeight = FontWeight.SemiBold,
                        fontSize = scale.scaleSp(16f),
                    ),
                    color = Color(0xFF000000),
                )

                Spacer(modifier = Modifier.height(scale.scaleDp(8f)))

                Text(
                    text = model.measurementUnitNote,
                    style = MaterialTheme.typography.bodySmall.copy(
                        fontFamily = DefaultBodyFontFamily,
                        fontWeight = FontWeight.Normal,
                        fontSize = scale.scaleSp(13f),
                    ),
                    color = Color(0xFF000000).copy(alpha = 0.55f),
                )

                Spacer(modifier = Modifier.height(scale.scaleDp(12f)))

                if (rows.isEmpty()) {
                    Text(
                        text = "No measurements added",
                        style = MaterialTheme.typography.bodyMedium.copy(
                            fontFamily = DefaultBodyFontFamily,
                            fontSize = scale.scaleSp(14f),
                        ),
                        color = Color(0xFF000000).copy(alpha = 0.55f),
                    )
                } else {
                    rows.forEachIndexed { index, (label, value) ->
                        if (index > 0) {
                            Box(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .height(scale.scaleDp(0.3f))
                                    .background(Color.Black.copy(alpha = 0.15f)),
                            )
                        }
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .heightIn(min = scale.scaleDp(48f))
                                .padding(vertical = scale.scaleDp(12f)),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Text(
                                text = label,
                                style = MaterialTheme.typography.bodyMedium.copy(
                                    fontFamily = DefaultBodyFontFamily,
                                    fontWeight = FontWeight.Normal,
                                    fontSize = scale.scaleSp(14f),
                                ),
                                color = Color(0xFF000000).copy(alpha = 0.55f),
                                modifier = Modifier.weight(1f),
                            )
                            Text(
                                text = value,
                                style = MaterialTheme.typography.bodyMedium.copy(
                                    fontFamily = DefaultBodyFontFamily,
                                    fontWeight = FontWeight.Medium,
                                    fontSize = scale.scaleSp(14f),
                                ),
                                color = Color(0xFF000000),
                                textAlign = TextAlign.End,
                                modifier = Modifier.padding(start = scale.scaleDp(12f)),
                            )
                        }
                    }
                }

                Spacer(modifier = Modifier.height(scale.scaleDp(32f)))
            }
    }
}

@Preview(showBackground = true)
@Composable
private fun ItemDetailScreenPreview() {
    val model = ItemDetailUi(
        itemId = "preview-shirt",
        imageSource = "asset:images/shirt.png",
        fullName = "Poplin spread-collar dress shirt",
        color = "BLACK",
        brand = "Brooks Brothers",
        productUrl = "https://example.com/product/shirt",
        category = ItemCategory.Top,
        measurements = mapOf(
            "chest" to "98 cm",
            "sleeves" to "64 cm",
            "shoulder" to "45 cm",
            "bicep" to "34 cm",
            "length" to "78 cm",
        ),
    )
    TrueclothesTheme {
        ItemDetailScreen(model = model, onBack = {})
    }
}
