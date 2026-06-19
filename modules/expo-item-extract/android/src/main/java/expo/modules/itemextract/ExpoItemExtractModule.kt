// ExpoItemExtractModule.kt
// Native Expo Module — Android implementation of expo-item-extract.
//
// Uses ML Kit:
//   - SubjectSegmenter  (com.google.mlkit:subject-segmentation)  → transparent PNG cutout
//   - ImageLabeler      (com.google.mlkit:image-labeling)         → labels
//   - TextRecognizer    (com.google.mlkit:text-recognition)       → OCR text
//
// Fallback (segmentation fails / empty mask): sample the 4 corner pixels; if they form
// a near-uniform background, key it out.  If still no clean result, return the original
// URI and usedFallback = true.  Never throws for "no subject".
//
// ML Kit Task APIs are async. We bridge them with a CountDownLatch so the Expo
// AsyncFunction coroutine blocks the background thread rather than the JS thread.

package expo.modules.itemextract

import android.graphics.*
import android.net.Uri
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.Promise
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.label.ImageLabeling
import com.google.mlkit.vision.label.defaults.ImageLabelerOptions
import com.google.mlkit.vision.segmentation.subject.SubjectSegmenter
import com.google.mlkit.vision.segmentation.subject.SubjectSegmenterOptions
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.latin.TextRecognizerOptions
import java.io.File
import java.io.FileOutputStream
import java.util.UUID
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import kotlin.math.abs
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt
import kotlin.math.sqrt

class ExpoItemExtractModule : Module() {

    override fun definition() = ModuleDefinition {
        Name("ExpoItemExtract")

        // AsyncFunction with Promise lets us control resolution timing from
        // the ML Kit task callbacks (which are themselves async).
        AsyncFunction("extractItem") { uri: String, promise: Promise ->
            // Run all blocking work on a background thread pool thread so we
            // never block the Expo JS thread.
            Thread {
                try {
                    val result = performExtraction(uri)
                    promise.resolve(result)
                } catch (e: Exception) {
                    promise.reject("ERR_EXTRACT", e.message ?: "Unknown extraction error", e)
                }
            }.start()
        }
    }

    // ── Core pipeline ────────────────────────────────────────────────────────

    private fun performExtraction(uri: String): Map<String, Any> {
        // Strip "file://" prefix.
        val filePath = if (uri.startsWith("file://")) uri.removePrefix("file://") else uri
        val file = File(filePath)
        if (!file.exists()) {
            throw IllegalArgumentException("Cannot load image at path: $filePath")
        }

        // Decode original bitmap (mutable ARGB_8888 so we can manipulate pixels).
        val original: Bitmap = BitmapFactory.decodeFile(filePath, BitmapFactory.Options().apply {
            inPreferredConfig = Bitmap.Config.ARGB_8888
        }) ?: throw IllegalArgumentException("BitmapFactory failed to decode: $filePath")

        // ── 1. Segmentation ───────────────────────────────────────────────
        val (cutoutBitmap, usedFallback) = segmentForeground(original)

        // Downscale to ~1024 long edge, save as transparent PNG.
        val scaledCutout = scaleTo1024(cutoutBitmap)
        val cutoutUri = savePng(scaledCutout)

        // Clean up intermediate bitmaps (original kept for labeling + OCR).
        if (cutoutBitmap !== original) cutoutBitmap.recycle()

        // ── 2. Palette from foreground pixels only ────────────────────────
        val palette = dominantColors(scaledCutout, maxColors = 3)
        scaledCutout.recycle()

        // ── 3. Image labels ───────────────────────────────────────────────
        val labels = classifyImage(original)

        // ── 4. OCR ────────────────────────────────────────────────────────
        val ocrText = recognizeText(original)

        original.recycle()

        return mapOf(
            "cutoutUri"    to "file://$cutoutUri",
            "usedFallback" to usedFallback,
            "palette"      to palette,
            "labels"       to labels,
            "ocrText"      to ocrText
        )
    }

    // ── Segmentation ─────────────────────────────────────────────────────────

    /**
     * Returns (foreground bitmap with alpha, usedFallback).
     * Falls back to corner-key then original if ML Kit segmentation fails or
     * produces an empty/low-confidence mask.
     */
    private fun segmentForeground(original: Bitmap): Pair<Bitmap, Boolean> {
        // ── ML Kit Subject Segmenter ──────────────────────────────────────
        val segmented = runSubjectSegmentation(original)
        if (segmented != null) return Pair(segmented, false)

        // ── Corner-pixel chroma key ───────────────────────────────────────
        val keyed = cornerChromaKey(original)
        if (keyed != null) return Pair(keyed, true)

        // ── Last resort: return original (copy with alpha) ────────────────
        val copy = original.copy(Bitmap.Config.ARGB_8888, false)
        return Pair(copy, true)
    }

    /**
     * Runs ML Kit SubjectSegmenter synchronously (via CountDownLatch).
     * Returns null if the task fails or the mask appears to cover nothing.
     */
    private fun runSubjectSegmentation(bitmap: Bitmap): Bitmap? {
        val options = SubjectSegmenterOptions.Builder()
            .enableForegroundConfidenceMask()
            .build()
        val segmenter = SubjectSegmenter.getClient(options)

        val inputImage = InputImage.fromBitmap(bitmap, 0)
        var resultBitmap: Bitmap? = null
        val latch = CountDownLatch(1)

        segmenter.process(inputImage)
            .addOnSuccessListener { result ->
                try {
                    val confidenceMask = result.foregroundConfidenceMask
                        ?: run { latch.countDown(); return@addOnSuccessListener }

                    val w = bitmap.width
                    val h = bitmap.height
                    val out = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888)

                    // Apply confidence mask: pixel alpha = (confidence * 255).
                    var foregroundPixelCount = 0
                    for (y in 0 until h) {
                        for (x in 0 until w) {
                            val confidence = confidenceMask.get() // sequential buffer
                            val alpha = (confidence * 255).roundToInt().coerceIn(0, 255)
                            if (alpha > 30) {
                                val px = bitmap.getPixel(x, y)
                                val r  = Color.red(px)
                                val g  = Color.green(px)
                                val b  = Color.blue(px)
                                out.setPixel(x, y, Color.argb(alpha, r, g, b))
                                foregroundPixelCount++
                            }
                        }
                    }
                    confidenceMask.rewind()

                    // Require at least 1% opaque pixels; otherwise treat as failure.
                    if (foregroundPixelCount > (w * h / 100)) {
                        resultBitmap = out
                    } else {
                        out.recycle()
                    }
                } finally {
                    latch.countDown()
                }
            }
            .addOnFailureListener { latch.countDown() }

        latch.await(10, TimeUnit.SECONDS)
        segmenter.close()
        return resultBitmap
    }

    /**
     * Samples the 4 corners; if they are within a colour-spread threshold,
     * uses that as the background colour and makes near-matching pixels
     * transparent. Returns null when the background is not uniform.
     */
    private fun cornerChromaKey(bitmap: Bitmap): Bitmap? {
        val w = bitmap.width
        val h = bitmap.height

        fun px(x: Int, y: Int): Triple<Int, Int, Int> {
            val c = bitmap.getPixel(x, y)
            return Triple(Color.red(c), Color.green(c), Color.blue(c))
        }

        val corners = listOf(px(0, 0), px(w - 1, 0), px(0, h - 1), px(w - 1, h - 1))
        val bgR = corners.sumOf { it.first }  / 4
        val bgG = corners.sumOf { it.second } / 4
        val bgB = corners.sumOf { it.third }  / 4

        // Reject if corners are too varied (not a uniform background).
        val spread = corners.maxOf { c ->
            abs(c.first - bgR) + abs(c.second - bgG) + abs(c.third - bgB)
        }
        if (spread > 60) return null

        val tolerance = 40
        val out = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888)

        for (y in 0 until h) {
            for (x in 0 until w) {
                val c = bitmap.getPixel(x, y)
                val r = Color.red(c); val g = Color.green(c); val b = Color.blue(c)
                val dist = abs(r - bgR) + abs(g - bgG) + abs(b - bgB)
                out.setPixel(x, y, if (dist <= tolerance) Color.TRANSPARENT else c)
            }
        }
        return out
    }

    // ── Scale & Save ─────────────────────────────────────────────────────────

    private fun scaleTo1024(bitmap: Bitmap): Bitmap {
        val maxLong = 1024
        val w = bitmap.width; val h = bitmap.height
        val long_ = max(w, h)
        if (long_ <= maxLong) return bitmap.copy(Bitmap.Config.ARGB_8888, false)
        val scale = maxLong.toFloat() / long_
        val nw = (w * scale).roundToInt()
        val nh = (h * scale).roundToInt()
        return Bitmap.createScaledBitmap(bitmap, nw, nh, true)
    }

    private fun savePng(bitmap: Bitmap): String {
        val cacheDir = appContext.reactContext?.cacheDir
            ?: throw IllegalStateException("No cache directory available")
        val file = File(cacheDir, "cutout_${UUID.randomUUID()}.png")
        FileOutputStream(file).use { out ->
            bitmap.compress(Bitmap.CompressFormat.PNG, 100, out)
        }
        return file.absolutePath
    }

    // ── Palette ───────────────────────────────────────────────────────────────

    /**
     * Downsamples the bitmap to a 64×64 grid, ignores transparent pixels,
     * then runs simple k-means (k ≤ maxColors, ≤ 20 iterations).
     * Returns list of {r,g,b} maps sorted most-dominant first.
     */
    private fun dominantColors(bitmap: Bitmap, maxColors: Int): List<Map<String, Int>> {
        val side = 64
        val small = Bitmap.createScaledBitmap(bitmap, side, side, true)

        val pixels = mutableListOf<Triple<Int, Int, Int>>()
        for (y in 0 until side) {
            for (x in 0 until side) {
                val c = small.getPixel(x, y)
                if (Color.alpha(c) > 30) {
                    pixels.add(Triple(Color.red(c), Color.green(c), Color.blue(c)))
                }
            }
        }
        small.recycle()

        if (pixels.isEmpty()) return emptyList()

        val k = min(maxColors, pixels.size)
        val clusters = kMeans(pixels, k)
        return clusters.map { mapOf("r" to it.first, "g" to it.second, "b" to it.third) }
    }

    private fun kMeans(
        pixels: List<Triple<Int, Int, Int>>,
        k: Int
    ): List<Triple<Int, Int, Int>> {
        val step = pixels.size / k
        var centroids = (0 until k).map { i ->
            val p = pixels[i * step]
            Triple(p.first.toDouble(), p.second.toDouble(), p.third.toDouble())
        }.toMutableList()

        val assignments = IntArray(pixels.size)

        repeat(20) { _ ->
            var changed = false
            for (i in pixels.indices) {
                var best = 0; var bestDist = Double.MAX_VALUE
                for (ci in centroids.indices) {
                    val d = colorDist(pixels[i], centroids[ci])
                    if (d < bestDist) { bestDist = d; best = ci }
                }
                if (assignments[i] != best) { assignments[i] = best; changed = true }
            }
            if (!changed) return@repeat

            val sums   = Array(k) { Triple(0.0, 0.0, 0.0) }
            val counts = IntArray(k)
            for (i in pixels.indices) {
                val ci = assignments[i]
                val p  = pixels[i]
                sums[ci]   = Triple(
                    sums[ci].first  + p.first,
                    sums[ci].second + p.second,
                    sums[ci].third  + p.third
                )
                counts[ci]++
            }
            for (ci in 0 until k) {
                if (counts[ci] > 0) {
                    centroids[ci] = Triple(
                        sums[ci].first  / counts[ci],
                        sums[ci].second / counts[ci],
                        sums[ci].third  / counts[ci]
                    )
                }
            }
        }

        val clusterSizes = IntArray(k)
        for (a in assignments) clusterSizes[a]++

        return (0 until k)
            .filter { clusterSizes[it] > 0 }
            .sortedByDescending { clusterSizes[it] }
            .map { ci ->
                Triple(
                    centroids[ci].first.roundToInt(),
                    centroids[ci].second.roundToInt(),
                    centroids[ci].third.roundToInt()
                )
            }
    }

    private fun colorDist(
        p: Triple<Int, Int, Int>,
        c: Triple<Double, Double, Double>
    ): Double {
        val dr = p.first  - c.first
        val dg = p.second - c.second
        val db = p.third  - c.third
        return dr * dr + dg * dg + db * db
    }

    // ── Image labeling ────────────────────────────────────────────────────────

    private fun classifyImage(bitmap: Bitmap): List<Map<String, Any>> {
        val options = ImageLabelerOptions.Builder()
            .setConfidenceThreshold(0.05f)
            .build()
        val labeler = ImageLabeling.getClient(options)
        val inputImage = InputImage.fromBitmap(bitmap, 0)

        var labels: List<Map<String, Any>> = emptyList()
        val latch = CountDownLatch(1)

        labeler.process(inputImage)
            .addOnSuccessListener { results ->
                labels = results
                    .sortedByDescending { it.confidence }
                    .take(5)
                    .map { label ->
                        mapOf("text" to label.text, "confidence" to label.confidence.toDouble())
                    }
                latch.countDown()
            }
            .addOnFailureListener { latch.countDown() }

        latch.await(10, TimeUnit.SECONDS)
        labeler.close()
        return labels
    }

    // ── Text recognition ──────────────────────────────────────────────────────

    private fun recognizeText(bitmap: Bitmap): List<String> {
        val recognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)
        val inputImage  = InputImage.fromBitmap(bitmap, 0)

        var ocrText: List<String> = emptyList()
        val latch = CountDownLatch(1)

        recognizer.process(inputImage)
            .addOnSuccessListener { result ->
                ocrText = result.textBlocks.map { it.text }.filter { it.isNotBlank() }
                latch.countDown()
            }
            .addOnFailureListener { latch.countDown() }

        latch.await(10, TimeUnit.SECONDS)
        recognizer.close()
        return ocrText
    }
}
