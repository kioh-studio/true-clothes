package com.brian_bui.true_clothes.home

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
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
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.wrapContentWidth
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.ui.graphics.Brush
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextLayoutResult
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.em
import com.brian_bui.true_clothes.shared.theme.DefaultBodyFontFamily
import com.brian_bui.true_clothes.shared.theme.DefaultHeaderFontFamily
import com.brian_bui.true_clothes.shared.theme.LocalResponsiveScale
import com.brian_bui.true_clothes.shared.theme.ResponsiveScale
import com.brian_bui.true_clothes.shared.theme.TrueclothesTheme
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.TextUnit
import com.brian_bui.true_clothes.shared.components.OutfitCompositionCardPlaceholder

private enum class HomeTab(val title: String) {
    Outfit("Outfit"),
    Favourite("Favourite"),
    Closet("Closet"),
}

@Composable
fun HomeMainScreen(
    modifier: Modifier = Modifier,
) {
    val scale = LocalResponsiveScale.current

    var selectedTab by remember { mutableStateOf(HomeTab.Outfit) }
    /** Later: store [OutfitDetailPayload.outfitId] and load payload from DB. */
    var selectedOutfit by remember { mutableStateOf<OutfitDetailPayload?>(null) }
    /** Later: store item id and load [ItemDetailUi] from DB. */
    var selectedItemDetail by remember { mutableStateOf<ItemDetailUi?>(null) }

    val demoOutfit = remember { demoOutfitDetailPayload() }
    val outfitCardSources = remember(demoOutfit) { demoOutfit.toCompositionSources() }

    // Linear vertical: #4D5051 @ 35% at 0 → #DCDCDC at 24% stop; remainder stays bottom color.
    val homeBackgroundBrush = Brush.verticalGradient(
        colorStops = arrayOf(
            0f to Color(0xFF4D5051).copy(alpha = 0.50f),
            0.24f to Color(0xFFDCDCDC),
            1f to Color(0xFFDCDCDC),
        ),
    )

    Surface(
        modifier = modifier.fillMaxSize(),
        color = Color.Transparent,
    ) {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(brush = homeBackgroundBrush),
        ) {
            Column(modifier = Modifier.fillMaxSize()) {
                when {
                    selectedItemDetail != null -> {
                        ItemDetailScreen(
                            model = selectedItemDetail!!,
                            onBack = { selectedItemDetail = null },
                        )
                    }

                    selectedOutfit != null -> {
                        OutfitDetailScreen(
                            outfit = selectedOutfit!!,
                            onBack = {
                                selectedOutfit = null
                                selectedItemDetail = null
                            },
                            onItemRowClick = { item ->
                                // Later: if (item.itemId != null) viewModel.loadItem(item.itemId)
                                selectedItemDetail = item.toItemDetailUi()
                            },
                        )
                    }

                    else -> {
                        Column(
                            modifier = Modifier
                                .fillMaxSize()
                                .statusBarsPadding(),
                        ) {
                            Header(
                                title = "TRUE CLOTHES",
                                fontFamily = DefaultHeaderFontFamily,
                                paddingH = scale.scaleDp(24f),
                                paddingTop = scale.scaleDp(16f),
                                fontSize = scale.scaleSp(28f),
                                lineHeight = scale.scaleSp(40f),
                            )

                            TabsRow(
                                selectedTab = selectedTab,
                                fontFamily = DefaultBodyFontFamily,
                                scale = scale,
                                onTabSelected = { selectedTab = it },
                            )


                            LazyColumn(
                                modifier = Modifier
                                    .weight(1f)
                                    .fillMaxWidth()
                                    .padding(horizontal = scale.scaleDp(24f)),
                                verticalArrangement = Arrangement.spacedBy(scale.scaleDp(2f)),
                            ) {
                        when (selectedTab) {
                            HomeTab.Outfit -> {
                                item {
                                    Box(
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .heightIn(min = scale.scaleDp(48f))
                                            .padding(
                                                vertical = scale.scaleDp(16f),
                                                horizontal = scale.scaleDp(8f),
                                            )
                                            .semantics {
                                                role = Role.Button
                                                contentDescription =
                                                    "Suggested outfit, ${demoOutfit.title}, open details"
                                            }
                                            .clickable { selectedOutfit = demoOutfit },
                                    ) {
                                        OutfitCompositionCardPlaceholder(
                                            sources = outfitCardSources,
                                            modifier = Modifier.fillMaxWidth(),
                                        )
                                    }
                                }
                            }

                            HomeTab.Favourite -> {
                                val items = listOf("Favourite outfit #1", "Favourite outfit #2")
                                items(items) { label ->
                                    OutfitCardPlaceholder(label = label, scale = scale)
                                }
                            }

                            HomeTab.Closet -> {
                                val items = listOf("Closet outfit #1", "Closet outfit #2")
                                items(items) { label ->
                                    OutfitCardPlaceholder(label = label, scale = scale)
                                }
                            }
                            }
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun Header(
    title: String,
    fontFamily: FontFamily,
    paddingTop: Dp,
    paddingH: Dp,
    fontSize: TextUnit,
    lineHeight: TextUnit,
) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .padding(top = paddingTop, start = paddingH, end = paddingH),
        contentAlignment = Alignment.TopStart,
    ) {
        Text(
            text = title,
            fontFamily = fontFamily,
            fontWeight = FontWeight.Bold,
            color = Color(0xFFFFFAFA),
            fontSize = fontSize,
            lineHeight = lineHeight,
            letterSpacing = 0.06.em,
            modifier = Modifier.semantics { heading() },
        )
    }
}

/**
 * Width from the start of the laid-out line to the left edge of the final glyph
 * (underline does not extend under the last letter).
 */
private fun underlineWidthBeforeFinalLetter(layout: TextLayoutResult): Float {
    val plain = layout.layoutInput.text.text
    if (plain.isEmpty()) return 0f
    val lastIdx = plain.lastIndex
    if (lastIdx <= 0) return 0f
    val lineStart = layout.getLineLeft(0)
    val lastCharLeft = layout.getBoundingBox(lastIdx).left
    return (lastCharLeft - lineStart).coerceAtLeast(0f)
}

@Composable
private fun HomeTabItem(
    tab: HomeTab,
    isActive: Boolean,
    activeOpacity: Float,
    inactiveOpacity: Float,
    fontFamily: FontFamily,
    scale: ResponsiveScale,
    onTabSelected: (HomeTab) -> Unit,
) {
    var underlineWidthPx by remember(tab) { mutableStateOf(0f) }
    val alpha = if (isActive) activeOpacity else inactiveOpacity
    val density = LocalDensity.current
    val underlineWidthDp = with(density) { underlineWidthPx.toDp() }

    Column(
        horizontalAlignment = Alignment.Start,
        modifier = Modifier
            .heightIn(min = scale.scaleDp(48f))
            .semantics {
                role = Role.Tab
                selected = isActive
                contentDescription =
                    "${tab.title} tab${if (isActive) ", selected" else ""}"
            }
            .clickable { onTabSelected(tab) }
            .padding(
                horizontal = scale.scaleDp(4f),
                vertical = scale.scaleDp(8f),
            ),
    ) {
        Text(
            text = tab.title,
            fontFamily = fontFamily,
            fontWeight = FontWeight.Thin,
            color = Color(0xFFFFFFFF).copy(alpha = alpha),
            fontSize = scale.scaleSp(14f),
            letterSpacing = (0.10f).em,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            onTextLayout = { layout ->
                underlineWidthPx = underlineWidthBeforeFinalLetter(layout)
            },
            modifier = Modifier.wrapContentWidth(),
        )
        if (isActive && underlineWidthPx > 0f) {
            Spacer(modifier = Modifier.height(scale.scaleDp(5f)))
            Canvas(
                modifier = Modifier
                    .width(underlineWidthDp)
                    .height(scale.scaleDp(3f)),
            ) {
                val strokePx = scale.scaleDp(1.5f).toPx()
                val y = size.height / 2f
                drawLine(
                    color = Color.White.copy(alpha = activeOpacity),
                    start = Offset(0f, y),
                    end = Offset(size.width, y),
                    strokeWidth = strokePx,
                    cap = StrokeCap.Butt,
                )
            }
        }
    }
}

@Composable
private fun TabsRow(
    selectedTab: HomeTab,
    fontFamily: FontFamily,
    scale: ResponsiveScale,
    onTabSelected: (HomeTab) -> Unit,
) {
    // The design specifies tab base color as #FFFFFF, inactive opacity 70%.
    val inactiveOpacity = 0.70f
    val activeOpacity = 1.0f

    val tabs = listOf(HomeTab.Outfit, HomeTab.Favourite, HomeTab.Closet)

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = scale.scaleDp(40f), vertical = scale.scaleDp(70f)),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        tabs.forEach { tab ->
            HomeTabItem(
                tab = tab,
                isActive = tab == selectedTab,
                activeOpacity = activeOpacity,
                inactiveOpacity = inactiveOpacity,
                fontFamily = fontFamily,
                scale = scale,
                onTabSelected = onTabSelected,
            )
        }
    }
}

@Composable
private fun OutfitCardPlaceholder(
    label: String,
    scale: ResponsiveScale,
) {
    val shape = RoundedCornerShape(scale.scaleDp(12f))
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .height(scale.scaleDp(180f))
            .semantics {
                contentDescription = "Outfit preview placeholder, $label"
            }
            .background(Color.White.copy(alpha = 0.12f), shape)
            .border(
                width = scale.scaleDp(1f),
                color = Color.White.copy(alpha = 0.25f),
                shape = shape,
            ),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            text = label,
            style = MaterialTheme.typography.bodyMedium.copy(
                fontWeight = FontWeight.SemiBold,
                fontSize = scale.scaleSp(14f),
            ),
            color = Color.White,
            maxLines = 2,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.padding(horizontal = scale.scaleDp(16f)),
        )
    }
}

@Preview(showBackground = true)
@Composable
private fun HomeMainScreenPreview() {
    TrueclothesTheme {
        HomeMainScreen()
    }
}

