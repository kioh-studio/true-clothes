package com.brian_bui.true_clothes.home

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.foundation.layout.offset
import androidx.compose.material3.TextButton
import androidx.compose.ui.tooling.preview.Preview
import com.brian_bui.true_clothes.R
import com.brian_bui.true_clothes.shared.components.OutfitCompositionSources
import com.brian_bui.true_clothes.shared.theme.DefaultBodyFontFamily
import com.brian_bui.true_clothes.shared.theme.DefaultHeaderFontFamily
import com.brian_bui.true_clothes.shared.theme.LocalResponsiveScale
import com.brian_bui.true_clothes.shared.theme.ResponsiveScale
import com.brian_bui.true_clothes.shared.theme.TrueclothesTheme
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File
import java.net.URL

private data class OutfitDetailItem(
    val label: String,
    val imageSource: String?,
)

@Composable
fun OutfitDetailScreen(
    sources: OutfitCompositionSources,
    onBack: () -> Unit,
    backgroundBrush: Brush,
) {
    val scale = LocalResponsiveScale.current

    val detailItems = remember(sources) {
        listOf(
            OutfitDetailItem(label = "Pants", imageSource = sources.pants),
            OutfitDetailItem(label = "Jacket", imageSource = sources.jacket),
            OutfitDetailItem(label = "Shirt", imageSource = sources.shirt),
            OutfitDetailItem(label = "Bag", imageSource = sources.bag),
            OutfitDetailItem(label = "Shoes", imageSource = sources.shoes),
        )
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(backgroundBrush),
    ) {
        // Header
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = scale.scaleDp(24f), vertical = scale.scaleDp(24f)),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(scale.scaleDp(16f)),
        ) {
            TextButton(onClick = onBack) {
                Text(
                    text = "Back",
                    style = MaterialTheme.typography.bodyMedium.copy(
                        fontFamily = DefaultBodyFontFamily,
                        fontWeight = FontWeight.Bold,
                    ),
                    color = Color(0xFFFFFFFF),
                )
            }

            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = "Outfit Name",
                    style = MaterialTheme.typography.titleLarge.copy(
                        fontFamily = DefaultHeaderFontFamily,
                        fontWeight = FontWeight.Bold,
                        fontSize = scale.scaleSp(22f),
                    ),
                    color = Color(0xFFFFFAFA),
                )
                Spacer(modifier = Modifier.height(scale.scaleDp(8f)))
                Box(
                    modifier = Modifier
                        .background(Color.White.copy(alpha = 0.9f))
                        .padding(
                            horizontal = scale.scaleDp(16f),
                            vertical = scale.scaleDp(6f),
                        ),
                ) {
                    Text(
                        text = "Demo tag",
                        style = MaterialTheme.typography.bodySmall.copy(
                            fontFamily = DefaultBodyFontFamily,
                            fontWeight = FontWeight.SemiBold,
                            fontSize = 12.sp,
                        ),
                        color = Color.Black,
                    )
                }
            }
        }

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
                            .background(Color.Black.copy(alpha = 0.3f)),
                    )
                }

                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(vertical = scale.scaleDp(40f)),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween,
                ) {
                    Column(verticalArrangement = Arrangement.spacedBy(scale.scaleDp(12f))) {
                        Text(
                            text = item.label,
                            style = MaterialTheme.typography.bodyMedium.copy(
                                    fontFamily = DefaultBodyFontFamily,
                                fontWeight = FontWeight.Bold,
                            ),
                            color = Color(0xFFFFFFFF),
                        )

                        OutfitItemImageCard(
                            imageSource = item.imageSource,
                            scale = scale,
                        )
                    }

                    Text(
                        text = "Go to closet",
                        style = TextStyle(
                            fontFamily = DefaultBodyFontFamily,
                            fontWeight = FontWeight.Bold,
                            fontSize = scale.scaleSp(14f),
                            textDecoration = TextDecoration.Underline,
                        ),
                        color = Color(0xFFFFFFFF),
                        modifier = Modifier.clickable {
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
    scale: ResponsiveScale,
) {
    // Design spec: image is 150x205, wrapped by a container 140x200.
    val containerW = scale.scaleDp(140f)
    val containerH = scale.scaleDp(200f)
    val itemW = scale.scaleDp(150f)
    val itemH = scale.scaleDp(205f)
    val borderWidth = scale.scaleDp(0.5f)

    val offsetX = ((containerW.value - itemW.value) / 2f).dp
    val offsetY = ((containerH.value - itemH.value) / 2f).dp

    Box(
        modifier = Modifier
            .size(containerW, containerH)
            .background(Color(0xFFDCDCDC))
            .border(width = borderWidth, color = Color.Black),
        contentAlignment = Alignment.Center,
    ) {
        if (!imageSource.isNullOrBlank()) {
            OutfitImageFromSource(
                imageSource = imageSource,
                modifier = Modifier
                    .size(itemW, itemH)
                    .offset(x = offsetX, y = offsetY),
            )
        }
    }
}

@Composable
private fun OutfitImageFromSource(
    imageSource: String,
    modifier: Modifier = Modifier,
) {
    val context = LocalContext.current
    val bitmap by produceState<Bitmap?>(initialValue = null, key1 = imageSource) {
        value = loadBitmapFromSource(context, imageSource)
    }

    if (bitmap != null) {
        Image(
            bitmap = bitmap!!.asImageBitmap(),
            contentDescription = null,
            modifier = modifier,
            contentScale = ContentScale.Fit,
        )
    }
}

private suspend fun loadBitmapFromSource(
    context: Context,
    source: String,
): Bitmap? = withContext(Dispatchers.IO) {
    runCatching {
        when {
            source.startsWith("asset:") -> {
                val assetPath = source.removePrefix("asset:")
                context.assets.open(assetPath).use { stream ->
                    val bytes = stream.readBytes()
                    BitmapFactory.decodeByteArray(bytes, 0, bytes.size)
                }
            }

            source.startsWith("http://") || source.startsWith("https://") -> {
                URL(source).openStream().use { BitmapFactory.decodeStream(it) }
            }

            source.startsWith("content://") -> {
                val uri = Uri.parse(source)
                context.contentResolver.openInputStream(uri).use { stream ->
                    stream?.let { BitmapFactory.decodeStream(it) }
                }
            }

            source.startsWith("file://") -> {
                val filePath = source.removePrefix("file://")
                val file = File(filePath)
                if (!file.exists()) null else BitmapFactory.decodeFile(file.absolutePath)
            }

            else -> {
                val file = File(source)
                if (!file.exists()) null else BitmapFactory.decodeFile(file.absolutePath)
            }
        }
    }.getOrNull()
}

@Preview(showBackground = true)
@Composable
private fun OutfitDetailScreenPreview() {
    val sources = OutfitCompositionSources(
        pants = "asset:images/jeans.png",
        jacket = "asset:images/harrington.png",
        shirt = "asset:images/shirt.png",
        bag = "asset:images/bag.png",
        shoes = "asset:images/shoes.png",
    )
    TrueclothesTheme {
        OutfitDetailScreen(
            sources = sources,
            onBack = {},
            backgroundBrush = Brush.verticalGradient(
                listOf(Color(0xFF4D5051).copy(alpha = 0.35f), Color(0xFFDCDCDC)),
            ),
        )
    }
}

