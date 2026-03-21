package com.brian_bui.true_clothes.shared.media

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import androidx.compose.foundation.Image
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.produceState
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File
import java.net.URL

suspend fun loadBitmapFromSource(context: Context, source: String): Bitmap? =
    withContext(Dispatchers.IO) {
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

@Composable
fun BitmapSourceImage(
    imageSource: String?,
    contentDescription: String?,
    modifier: Modifier = Modifier,
    contentScale: ContentScale = ContentScale.Fit,
) {
    val context = LocalContext.current
    val bitmap by produceState<Bitmap?>(initialValue = null, key1 = imageSource) {
        if (imageSource.isNullOrBlank()) return@produceState
        value = loadBitmapFromSource(context, imageSource)
    }

    if (bitmap != null) {
        Image(
            bitmap = bitmap!!.asImageBitmap(),
            contentDescription = contentDescription,
            modifier = modifier,
            contentScale = contentScale,
        )
    }
}
