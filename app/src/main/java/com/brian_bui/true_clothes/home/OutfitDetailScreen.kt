package com.brian_bui.true_clothes.home

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import com.brian_bui.true_clothes.shared.media.BitmapSourceImage
import com.brian_bui.true_clothes.shared.theme.DefaultBodyFontFamily
import com.brian_bui.true_clothes.shared.theme.DefaultHeaderFontFamily
import com.brian_bui.true_clothes.shared.theme.DefaultScreenBackground
import com.brian_bui.true_clothes.shared.theme.LocalResponsiveScale
import com.brian_bui.true_clothes.shared.theme.ResponsiveScale
import com.brian_bui.true_clothes.shared.theme.TrueclothesTheme

@Composable
@OptIn(ExperimentalLayoutApi::class)
fun OutfitDetailScreen(
    outfit: OutfitDetailPayload,
    onBack: () -> Unit,
    onItemRowClick: (OutfitItemInfo) -> Unit = {},
) {
    val scale = LocalResponsiveScale.current
    val tags = outfit.tags
    val detailItems = outfit.items

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(DefaultScreenBackground),
    ) {
        // Header
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = scale.scaleDp(24f), vertical = scale.scaleDp(24f)),
            verticalAlignment = Alignment.Top,
            horizontalArrangement = Arrangement.spacedBy(scale.scaleDp(16f)),
        ) {
            TextButton(onClick = onBack) {
                Text(
                    text = "Back",
                    style = MaterialTheme.typography.bodyMedium.copy(
                        fontFamily = DefaultBodyFontFamily,
                        fontWeight = FontWeight.Bold,
                    ),
                    color = Color(0xFF000000),
                )
            }

            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = outfit.title,
                    style = MaterialTheme.typography.titleLarge.copy(
                        fontFamily = DefaultHeaderFontFamily,
                        fontWeight = FontWeight.Bold,
                        fontSize = scale.scaleSp(25f),
                        lineHeight = scale.scaleSp(37f),
                    ),
                    color = Color(0xFF000000),
                )
            }
        }

        // Tags section (between header and items list)
        Spacer(modifier = Modifier.height(scale.scaleDp(43f)))

        FlowRow(
            modifier = Modifier
                .fillMaxWidth()
                .padding(start = scale.scaleDp(28f), end = scale.scaleDp(24f)),
            horizontalArrangement = Arrangement.spacedBy(scale.scaleDp(17f)),
            verticalArrangement = Arrangement.spacedBy(scale.scaleDp(17f)),
        ) {
            Text(
                text = "Tags",
                style = MaterialTheme.typography.bodyMedium.copy(
                    fontFamily = DefaultBodyFontFamily,
                    fontWeight = FontWeight.Medium,
                    fontSize = scale.scaleSp(15f),
                ),
                color = Color(0xFF000000),
            )

            tags.forEach { tag ->
                Box(
                    modifier = Modifier
                        .widthIn(min = scale.scaleDp(99f))
                        .height(scale.scaleDp(25f))
                        .background(Color.White, RoundedCornerShape(scale.scaleDp(30f)))
                        .padding(
                            horizontal = scale.scaleDp(10f),
                            vertical = scale.scaleDp(2f),
                        ),
                    contentAlignment = Alignment.Center,
                ) {
                    Text(
                        text = tag,
                        style = MaterialTheme.typography.bodyMedium.copy(
                            fontFamily = DefaultBodyFontFamily,
                            fontWeight = FontWeight.Medium,
                            fontSize = scale.scaleSp(13f),
                        ),
                        color = Color(0xFF000000),
                        maxLines = 1,
                    )
                }
            }
        }

        // Padding from last tag row to the item list
        Spacer(modifier = Modifier.height(scale.scaleDp(47f)))

        // Body
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(horizontal = scale.scaleDp(24f), vertical = scale.scaleDp(8f))
                .verticalScroll(rememberScrollState()),
        ) {
            detailItems.forEachIndexed { idx, item ->
                if (idx > 0) {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(scale.scaleDp(0.3f))
                            .background(Color.Black.copy(alpha = 0.22f)),
                    )
                }

                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(vertical = scale.scaleDp(40f)),
                    verticalAlignment = Alignment.Bottom,
                    horizontalArrangement = Arrangement.Start,
                ) {
                    val wrapperHeight = scale.scaleDp(200f)

                    Row(
                        modifier = Modifier
                            .clickable { onItemRowClick(item) }
                            .semantics {
                                role = Role.Button
                                contentDescription = "View ${item.name}, details"
                            },
                        verticalAlignment = Alignment.Bottom,
                        horizontalArrangement = Arrangement.Start,
                    ) {
                        // Image wrapper on the LEFT.
                        OutfitItemImageCard(
                            imageSource = item.imageSource,
                            imageContentDescription = item.name,
                            scale = scale,
                        )

                        // Text block on the RIGHT of the wrapper.
                        Column(
                            modifier = Modifier
                                .height(wrapperHeight)
                                .widthIn(max = scale.scaleDp(217f))
                                .padding(
                                    start = scale.scaleDp(12f),
                                    top = scale.scaleDp(10f),
                                ),
                            verticalArrangement = Arrangement.Top,
                        ) {
                        // 1) Item name / overview (Poppins, medium, 16, black)
                        Text(
                            text = item.name,
                            style = MaterialTheme.typography.bodyMedium.copy(
                                fontFamily = DefaultBodyFontFamily,
                                fontWeight = FontWeight.Medium,
                                fontSize = scale.scaleSp(16f),
                            ),
                            color = Color(0xFF000000),
                        )

                        Spacer(modifier = Modifier.height(scale.scaleDp(24f)))

                        // 2) Item color (Poppins, light, 20, black @ 50% opacity)
                        Text(
                            text = item.itemColor,
                            style = MaterialTheme.typography.bodyMedium.copy(
                                fontFamily = DefaultBodyFontFamily,
                                fontWeight = FontWeight.Light,
                                fontSize = scale.scaleSp(20f),
                            ),
                            color = Color(0xFF000000).copy(alpha = 0.5f),
                        )

                        Spacer(modifier = Modifier.height(scale.scaleDp(11f)))

                        val metaGray = Color(0xFF000000).copy(alpha = 0.58f)

                        // 3) Item form (Poppins, medium, 13)
                        Text(
                            text = item.form,
                            style = MaterialTheme.typography.bodyMedium.copy(
                                fontFamily = DefaultBodyFontFamily,
                                fontWeight = FontWeight.Medium,
                                fontSize = scale.scaleSp(13f),
                            ),
                            color = metaGray,
                        )

                        Spacer(modifier = Modifier.height(scale.scaleDp(2f)))

                        // 4) Aesthetic/style (Poppins, medium, 13)
                        Text(
                            text = item.aesthetic,
                            style = MaterialTheme.typography.bodyMedium.copy(
                                fontFamily = DefaultBodyFontFamily,
                                fontWeight = FontWeight.Medium,
                                fontSize = scale.scaleSp(13f),
                            ),
                            color = metaGray,
                        )

                        Spacer(modifier = Modifier.height(scale.scaleDp(2f)))

                        // 5) Material description (Poppins, medium, 13)
                        Text(
                            text = item.material,
                            style = MaterialTheme.typography.bodyMedium.copy(
                                fontFamily = DefaultBodyFontFamily,
                                fontWeight = FontWeight.Medium,
                                fontSize = scale.scaleSp(13f),
                            ),
                            color = metaGray,
                        )
                        }
                    }

                    Spacer(modifier = Modifier.weight(1f))

                    // Push action link to the far right with 29dp right padding.
                    Text(
                        text = item.actionText,
                        style = TextStyle(
                            fontFamily = DefaultBodyFontFamily,
                            fontWeight = FontWeight.SemiBold,
                            fontSize = scale.scaleSp(20f),
                            textDecoration = TextDecoration.Underline,
                        ),
                        color = Color(0xFF000000),
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        modifier = Modifier
                            .widthIn(max = scale.scaleDp(140f))
                            .heightIn(min = scale.scaleDp(48f))
                            .padding(
                                end = scale.scaleDp(29f),
                                top = scale.scaleDp(6f),
                                bottom = scale.scaleDp(6f),
                            )
                            .clickable {
                                // Demo only: link destination not implemented yet.
                            },
                    )
                }
            }
        }
    }
}

@Composable
private fun OutfitItemImageCard(
    imageSource: String?,
    imageContentDescription: String,
    scale: ResponsiveScale,
) {
    // Design spec: image is 150x205, wrapped by a container 140x200.
    val containerW = scale.scaleDp(140f)
    val containerH = scale.scaleDp(200f)
    val itemW = scale.scaleDp(150f)
    val itemH = scale.scaleDp(205f)
    val borderWidth = scale.scaleDp(0.5f)

    Box(
        modifier = Modifier
            .size(containerW, containerH)
            .background(Color(0xFFDCDCDC))
            .border(width = borderWidth, color = Color.Black),
        contentAlignment = Alignment.Center,
    ) {
        BitmapSourceImage(
            imageSource = imageSource,
            contentDescription = imageContentDescription,
            modifier = Modifier.size(itemW, itemH),
            contentScale = ContentScale.Fit,
        )
    }
}

@Preview(showBackground = true)
@Composable
private fun OutfitDetailScreenPreview() {
    TrueclothesTheme {
        OutfitDetailScreen(
            outfit = demoOutfitDetailPayload(),
            onBack = {},
        )
    }
}

