package com.brian_bui.true_clothes.shared.components

import android.graphics.Bitmap
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.produceState
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.em
import com.brian_bui.true_clothes.shared.media.loadBitmapFromSource

data class OutfitCompositionSources(
    val pants: String? = null,
    val jacket: String? = null,
    val shirt: String? = null,
    val bag: String? = null,
    val shoes: String? = null,
)

/**
 * Debug/placeholder layout for the 5-piece outfit composition.
 *
 * Coordinates/sizes are based on the provided design reference:
 * - Left column: pants (350x468) at x=0,y=0; shoes (102x102) at x=0,y=468
 * - Right column: jacket (150x206) at x=350,y=0; shirt (150x206) at x=350,y=206
 *               bag (102x140) at x=350,y=412
 *
 * The whole canvas scales uniformly to fit the available width AND height (so the full outfit
 * composition remains visible without needing to scroll inside the card).
 */
@Composable
fun OutfitCompositionCardPlaceholder(
    sources: OutfitCompositionSources,
    modifier: Modifier = Modifier,
) {
    BoxWithConstraints(modifier = modifier) {
        val canvasWidthPx = 500f
        val canvasHeightPx = 570f

        val scaleX = maxWidth.value / canvasWidthPx
        val maxH = maxHeight.value
        val scaleY = if (maxH.isFinite()) maxH / canvasHeightPx else Float.POSITIVE_INFINITY
        val scale = minOf(scaleX, scaleY)

        fun s(px: Float): Dp = (px * scale).dp

        val scaledCanvasWidth = s(canvasWidthPx)
        val scaledCanvasHeight = s(canvasHeightPx)

        Box(
            modifier = Modifier
                .size(width = scaledCanvasWidth, height = scaledCanvasHeight),
        ) {
            OutfitSlot(
                label = "",
                imageSource = sources.pants,
                xDp = s(0f),
                yDp = s(0f),
                wDp = s(350f),
                hDp = s(468f),
            )
            OutfitSlot(
                label = "",
                imageSource = sources.jacket,
                xDp = s(350f),
                yDp = s(0f),
                wDp = s(150f),
                hDp = s(206f),
            )
            OutfitSlot(
                label = "",
                imageSource = sources.shirt,
                xDp = s(350f),
                yDp = s(206f),
                wDp = s(150f),
                hDp = s(206f),
            )
            OutfitSlot(
                label = "",
                imageSource = sources.bag,
                xDp = s(350f),
                yDp = s(412f),
                wDp = s(102f),
                hDp = s(140f),
            )
            OutfitSlot(
                label = "",
                imageSource = sources.shoes,
                xDp = s(0f),
                yDp = s(468f),
                wDp = s(102f),
                hDp = s(102f),
            )
        }
    }
}

@Composable
private fun OutfitSlot(
    label: String?,
    imageSource: String?,
    xDp: Dp,
    yDp: Dp,
    wDp: Dp,
    hDp: Dp,
) {
    val context = LocalContext.current

    val bitmap by produceState<Bitmap?>(initialValue = null, key1 = imageSource) {
        if (imageSource.isNullOrBlank()) return@produceState
        value = loadBitmapFromSource(context, imageSource)
    }

    val loadFailed = !imageSource.isNullOrBlank() && bitmap == null
    val debugLabel = label ?: ""

    Box(
        modifier = Modifier
            .offset(x = xDp, y = yDp)
            .size(width = wDp, height = hDp),
    ) {
        if (bitmap != null) {
            Image(
                bitmap = bitmap!!.asImageBitmap(),
                contentDescription = debugLabel,
                modifier = Modifier.fillMaxSize(),
                contentScale = ContentScale.Fit,
            )
        }

        // Debug helper so we can verify that the placement is correct.
        if (debugLabel.isNotBlank()) {
            Text(
                text = debugLabel,
                color = Color.White,
                fontWeight = FontWeight.SemiBold,
                letterSpacing = (0.08f).em,
                modifier = Modifier
                    .align(Alignment.TopStart)
                    .background(Color.Black.copy(alpha = 0.35f))
                    .padding(horizontal = 8.dp, vertical = 4.dp),
            )
        }

        if (loadFailed) {
            Text(
                text = "LOAD FAILED\n$imageSource",
                color = Color.White,
                fontWeight = FontWeight.Bold,
                modifier = Modifier
                    .align(Alignment.Center)
                    .background(Color.Black.copy(alpha = 0.35f))
                    .padding(horizontal = 10.dp, vertical = 6.dp),
            )
        }
    }
}

