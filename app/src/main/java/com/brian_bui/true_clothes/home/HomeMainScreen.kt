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
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.TextUnit
import com.brian_bui.true_clothes.R
import com.brian_bui.true_clothes.shared.theme.LocalResponsiveScale
import com.brian_bui.true_clothes.shared.theme.ResponsiveScale
import com.brian_bui.true_clothes.shared.theme.MainBackground

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

    val playfairBold = FontFamily(
        Font(R.font.playfairdisplay_bold, FontWeight.Bold),
    )
    val poppinsThin = FontFamily(
        Font(R.font.poppins_thin, FontWeight.Thin),
    )

    var selectedTab by remember { mutableStateOf(HomeTab.Outfit) }

    Surface(
        modifier = modifier.fillMaxSize(),
        color = MainBackground,
    ) {
        Column(modifier = Modifier.fillMaxSize()) {
            Header(
                title = "TRUE CLOTHES",
                fontFamily = playfairBold,
                paddingH = scale.scaleDp(24f),
                paddingTop = scale.scaleDp(24f),
                fontSize = scale.scaleSp(28f),
            )

            TabsRow(
                selectedTab = selectedTab,
                poppinsThin = poppinsThin,
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
                val items = when (selectedTab) {
                    HomeTab.Outfit -> listOf("Suggested outfit #1", "Suggested outfit #2")
                    HomeTab.Favourite -> listOf("Favourite outfit #1", "Favourite outfit #2")
                    HomeTab.Closet -> listOf("Closet outfit #1", "Closet outfit #2")
                }
                items(items) { label ->
                    OutfitCardPlaceholder(label = label, scale = scale)
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
    poppinsThin: FontFamily,
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
            .padding(horizontal = scale.scaleDp(24f)),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        tabs.forEach { tab ->
            val isActive = tab == selectedTab
            val alpha = if (isActive) activeOpacity else inactiveOpacity
            Text(
                text = tab.title,
                fontFamily = poppinsThin,
                fontWeight = FontWeight.Thin,
                color = Color(0xFFFFFFFF).copy(alpha = alpha),
                fontSize = scale.scaleSp(14f),
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

