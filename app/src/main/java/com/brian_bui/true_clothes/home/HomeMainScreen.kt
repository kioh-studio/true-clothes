package com.brian_bui.true_clothes.home

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.em
import com.brian_bui.true_clothes.R
import com.brian_bui.true_clothes.shared.theme.DefaultBodyFontFamily
import com.brian_bui.true_clothes.shared.theme.DefaultHeaderFontFamily
import com.brian_bui.true_clothes.shared.theme.DefaultScreenBackground
import com.brian_bui.true_clothes.shared.theme.LocalResponsiveScale
import com.brian_bui.true_clothes.shared.theme.ResponsiveScale
import com.brian_bui.true_clothes.shared.theme.TrueclothesTheme
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.TextUnit
import com.brian_bui.true_clothes.shared.components.OutfitCompositionCardPlaceholder
import com.brian_bui.true_clothes.shared.components.OutfitCompositionSources

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
    var selectedOutfitSources by remember { mutableStateOf<OutfitCompositionSources?>(null) }

    val homeBackgroundBrush = Brush.verticalGradient(
        listOf(
            // Match design spec background: #F5F5F5 (opaque).
            DefaultScreenBackground,
        ),
    )

    // Placeholder image sources for the 5-slot outfit composition.
    // Replace these values later with URLs or local file/content URIs.
    val outfitPlaceholderSources = OutfitCompositionSources(
        pants = "asset:images/jeans.png",
        jacket = "asset:images/harrington.png",
        shirt = "asset:images/shirt.png",
        bag = "asset:images/bag.png",
        shoes = "asset:images/shoes.png"
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
                if (selectedOutfitSources != null) {
                    OutfitDetailScreen(
                        sources = selectedOutfitSources!!,
                        onBack = { selectedOutfitSources = null },
                        backgroundBrush = homeBackgroundBrush,
                    )
                } else {
                    Header(
                        title = "TRUE CLOTHES",
                        fontFamily = DefaultHeaderFontFamily,
                        paddingH = scale.scaleDp(24f),
                        paddingTop = scale.scaleDp(32f),
                        fontSize = scale.scaleSp(28f),
                    )

                    TabsRow(
                        selectedTab = selectedTab,
                        fontFamily = DefaultBodyFontFamily,
                        scale = scale,
                        onTabSelected = { selectedTab = it },
                    )

                    Spacer(modifier = Modifier.height(scale.scaleDp(16f)))

                    // Body is scrollable (cards/content can grow).
                    LazyColumn(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = scale.scaleDp(24f)),
                        verticalArrangement = Arrangement.spacedBy(scale.scaleDp(12f)),
                    ) {
                        when (selectedTab) {
                            HomeTab.Outfit -> {
                                item {
                                    Box(
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .padding(
                                                vertical = scale.scaleDp(16f),
                                                horizontal = scale.scaleDp(8f),
                                            )
                                            .clickable { selectedOutfitSources = outfitPlaceholderSources },
                                    ) {
                                        OutfitCompositionCardPlaceholder(
                                            sources = outfitPlaceholderSources,
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

@Composable
private fun Header(
    title: String,
    fontFamily: FontFamily,
    paddingTop: Dp,
    paddingH: Dp,
    fontSize: TextUnit,
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
        )
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
            val isActive = tab == selectedTab
            val alpha = if (isActive) activeOpacity else inactiveOpacity
            Text(
                text = tab.title,
                fontFamily = fontFamily,
                fontWeight = FontWeight.Thin,
                color = Color(0xFFFFFFFF).copy(alpha = alpha),
                fontSize = scale.scaleSp(14f),
                letterSpacing = (0.10f).em,
                modifier = Modifier
                    .clickable { onTabSelected(tab) }
                    .padding(vertical = scale.scaleDp(8f)),
            )
        }
    }
}

@Composable
private fun OutfitCardPlaceholder(
    label: String,
    scale: ResponsiveScale,
) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .height(scale.scaleDp(180f))
            .background(Color.White.copy(alpha = 0.18f)),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            text = label,
            style = MaterialTheme.typography.bodyMedium.copy(
                fontWeight = FontWeight.SemiBold,
                fontSize = scale.scaleSp(14f),
            ),
            color = Color.White,
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

