// ExpoItemExtractModule.kt
// Native Expo Module — Android implementation of expo-item-extract.
//
// Uses ML Kit:
//   - SubjectSegmenter  (com.google.mlkit:subject-segmentation)  → transparent PNG cutout
//   - ImageLabeler      (com.google.mlkit:image-labeling)         → labels
//   - TextRecognizer    (com.google.mlkit:text-recognition)       → OCR text
//
// Fallback (segmentation fails / empty mask): build a background model from a border
// frame (LAB k-means + connected-components flood from the edges) and cut out the
// foreground.  If the result is degenerate, return the original URI with
// usedFallback = true.  Never throws for "no subject".
//
// ML Kit Task APIs are async. We bridge them with a CountDownLatch so the Expo
// AsyncFunction coroutine blocks the background thread rather than the JS thread.

package expo.modules.itemextract

import android.graphics.*
import android.net.Uri
import android.os.Build
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.Promise
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.label.ImageLabeling
import com.google.mlkit.vision.label.defaults.ImageLabelerOptions
import com.google.mlkit.vision.segmentation.subject.SubjectSegmentation
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

    companion object {
        // Set once per process if Subject Segmentation's model proves unavailable
        // (offline / emulator / first-run download not ready) so the rest of the
        // session skips ML tier-1 and uses the on-device fallback directly.
        @Volatile private var mlSegmentationUnavailable = false

        // Emulators usually can't provision the Subject Segmentation model via Play
        // Services (GMS retries the download forever → System-UI ANRs). Skip ML
        // entirely on emulators so the app never triggers that download and goes
        // straight to the on-device fallback. Real devices are unaffected.
        private val IS_EMULATOR: Boolean = run {
            val fp = Build.FINGERPRINT ?: ""
            fp.startsWith("generic") || fp.startsWith("unknown") || fp.contains("emulator") ||
                Build.HARDWARE.contains("goldfish") || Build.HARDWARE.contains("ranchu") ||
                (Build.MODEL ?: "").contains("sdk_gphone") || (Build.MODEL ?: "").contains("Emulator") ||
                (Build.PRODUCT ?: "").contains("sdk") || (Build.BRAND ?: "").startsWith("generic")
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

        // ── Background-model fallback (LAB k-means + connected components) ─
        val keyed = backgroundModelKey(original)
        if (keyed != null) return Pair(keyed, true)

        // ── Last resort: return original (copy with alpha) ────────────────
        val copy = original.copy(Bitmap.Config.ARGB_8888, false)
        return Pair(copy, true)
    }

    /**
     * Runs ML Kit SubjectSegmenter synchronously (via CountDownLatch).
     * Returns null if the task fails or the mask appears to cover nothing.
     *
     * Subject Segmentation's model is downloaded on demand via Play Services. When
     * it isn't available (offline, emulator without GMS model delivery, or the
     * first-run download is still pending) the task stalls — so we cap the wait at
     * 3s and, on timeout/failure, remember it for the rest of the process so every
     * subsequent extraction skips straight to the on-device fallback instead of
     * eating the stall again (matters when a user adds several items in a row).
     */
    private fun runSubjectSegmentation(bitmap: Bitmap): Bitmap? {
        if (mlSegmentationUnavailable || IS_EMULATOR) return null

        val options = SubjectSegmenterOptions.Builder()
            .enableForegroundConfidenceMask()
            .build()
        val segmenter = SubjectSegmentation.getClient(options)

        val inputImage = InputImage.fromBitmap(bitmap, 0)
        var resultBitmap: Bitmap? = null
        var failed = false
        val latch = CountDownLatch(1)

        segmenter.process(inputImage)
            .addOnSuccessListener { result ->
                try {
                    val confidenceMask = result.foregroundConfidenceMask
                        ?: run { latch.countDown(); return@addOnSuccessListener }

                    val w = bitmap.width
                    val h = bitmap.height
                    val n = w * h
                    // Bulk pixel I/O (one JNI call each) — per-pixel get/setPixel over
                    // a multi-megapixel image is pathologically slow on Android.
                    val src = IntArray(n)
                    bitmap.getPixels(src, 0, w, 0, 0, w, h)
                    val dst = IntArray(n)  // 0 = transparent
                    var foregroundPixelCount = 0
                    for (i in 0 until n) {
                        val alpha = (confidenceMask.get() * 255).roundToInt().coerceIn(0, 255)
                        if (alpha > 30) {
                            dst[i] = (alpha shl 24) or (src[i] and 0x00FFFFFF)
                            foregroundPixelCount++
                        }
                    }
                    confidenceMask.rewind()

                    // Require at least 1% opaque pixels; otherwise treat as failure.
                    if (foregroundPixelCount > (n / 100)) {
                        val out = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888)
                        out.setPixels(dst, 0, w, 0, 0, w, h)
                        resultBitmap = out
                    }
                } finally {
                    latch.countDown()
                }
            }
            .addOnFailureListener { failed = true; latch.countDown() }

        val completed = latch.await(3, TimeUnit.SECONDS)
        segmenter.close()
        // Model unavailable (download pending / offline / emulator) → stop trying it
        // this session so we don't stall 3s on every subsequent item.
        if (!completed || failed) mlSegmentationUnavailable = true
        return resultBitmap
    }

    /**
     * Smarter on-device background removal fallback (tier 2).
     *
     * Faithful port of the validated Python `extract` algorithm:
     *   1. Downscale to ~512px long edge.
     *   2. Convert to LAB.
     *   3. Sample a 6%-wide border frame; k-means (k=6) on the border LAB pixels.
     *   4. Keep only clusters with >=10% share of the border as "background".
     *   5. Per-pixel: bg-candidate if min LAB distance to any bg cluster < TAU(14).
     *   6. Keep only bg-candidate pixels connected (4-conn) to the image border.
     *   7. fg = NOT bg; fill holes; opening; drop components < 1% of area.
     *   8. Degenerate guard: fg fraction < 3% or > 97% -> return null.
     *   9. Feather the mask (box-blur approx of gaussian), then upscale the
     *      alpha (bilinear) to the ORIGINAL resolution and apply to the full-res
     *      original so the cut-out stays full quality.
     *
     * Returns the foreground bitmap-with-alpha, or null on any degenerate
     * result / internal failure (caller then falls through to tier 3).
     */
    private fun backgroundModelKey(original: Bitmap): Bitmap? {
        try {
            val ow = original.width
            val oh = original.height
            if (ow < 4 || oh < 4) return null

            // ── Working resolution (~512px long edge) ─────────────────────
            val maxLong = 512
            val longEdge = max(ow, oh)
            val scale = if (longEdge > maxLong) maxLong.toFloat() / longEdge else 1f
            val w = max(1, (ow * scale).roundToInt())
            val h = max(1, (oh * scale).roundToInt())

            val workBmp = if (w == ow && h == oh) original
                          else Bitmap.createScaledBitmap(original, w, h, true)

            // Read working pixels.
            val argb = IntArray(w * h)
            workBmp.getPixels(argb, 0, w, 0, 0, w, h)
            if (workBmp !== original) workBmp.recycle()

            // ── LAB conversion (parallel arrays) ──────────────────────────
            val labL = FloatArray(w * h)
            val labA = FloatArray(w * h)
            val labB = FloatArray(w * h)
            for (i in argb.indices) {
                val c = argb[i]
                val lab = rgbToLab(Color.red(c), Color.green(c), Color.blue(c))
                labL[i] = lab[0]; labA[i] = lab[1]; labB[i] = lab[2]
            }

            // ── 1) Border frame, width = 6% of min(H,W) (>=3) ─────────────
            val bw = max(3, (0.06 * min(h, w)).roundToInt())
            val borderIdx = ArrayList<Int>()
            for (y in 0 until h) {
                for (x in 0 until w) {
                    val onBorder = x < bw || x >= w - bw || y < bw || y >= h - bw
                    if (onBorder) borderIdx.add(y * w + x)
                }
            }
            if (borderIdx.isEmpty()) return null

            // ── 2) k-means k=6 on border LAB (15 iters, deterministic) ────
            val k = 6
            val n = borderIdx.size
            val kk = min(k, n)
            val cL = FloatArray(kk); val cA = FloatArray(kk); val cB = FloatArray(kk)
            // Deterministic seeding: evenly spaced through the sample list.
            val step = max(1, n / kk)
            for (c in 0 until kk) {
                val p = borderIdx[min(n - 1, c * step)]
                cL[c] = labL[p]; cA[c] = labA[p]; cB[c] = labB[p]
            }
            val assign = IntArray(n)
            for (iter in 0 until 15) {
                var changed = false
                for (j in 0 until n) {
                    val p = borderIdx[j]
                    var best = 0; var bestD = Float.MAX_VALUE
                    for (c in 0 until kk) {
                        val dl = labL[p] - cL[c]
                        val da = labA[p] - cA[c]
                        val db = labB[p] - cB[c]
                        val d = dl * dl + da * da + db * db
                        if (d < bestD) { bestD = d; best = c }
                    }
                    if (assign[j] != best) { assign[j] = best; changed = true }
                }
                val sL = DoubleArray(kk); val sA = DoubleArray(kk); val sB = DoubleArray(kk)
                val cnt = IntArray(kk)
                for (j in 0 until n) {
                    val p = borderIdx[j]; val c = assign[j]
                    sL[c] += labL[p]; sA[c] += labA[p]; sB[c] += labB[p]; cnt[c]++
                }
                for (c in 0 until kk) {
                    if (cnt[c] > 0) {
                        cL[c] = (sL[c] / cnt[c]).toFloat()
                        cA[c] = (sA[c] / cnt[c]).toFloat()
                        cB[c] = (sB[c] / cnt[c]).toFloat()
                    }
                }
                if (!changed && iter > 0) break
            }

            // ── 3) Keep only clusters with border share >= 0.10 ───────────
            val clusterCount = IntArray(kk)
            for (j in 0 until n) clusterCount[assign[j]]++
            val bgL = ArrayList<Float>(); val bgA = ArrayList<Float>(); val bgB2 = ArrayList<Float>()
            for (c in 0 until kk) {
                val share = clusterCount[c].toFloat() / n
                if (share >= 0.10f) { bgL.add(cL[c]); bgA.add(cA[c]); bgB2.add(cB[c]) }
            }
            if (bgL.isEmpty()) return null

            // ── 4) Per-pixel bg candidate: min LAB dist to bg clusters < TAU
            val tau = 14.0f
            val tauSq = tau * tau
            val bgCand = BooleanArray(w * h)
            val m = bgL.size
            for (i in 0 until w * h) {
                var minD = Float.MAX_VALUE
                for (c in 0 until m) {
                    val dl = labL[i] - bgL[c]
                    val da = labA[i] - bgA[c]
                    val db = labB[i] - bgB2[c]
                    val d = dl * dl + da * da + db * db
                    if (d < minD) minD = d
                }
                bgCand[i] = minD < tauSq
            }

            // ── 5) Keep only bg connected (4-conn) to the image border ────
            val bg = BooleanArray(w * h)
            run {
                val stack = IntArray(w * h)
                var sp = 0
                // Seed: border pixels that are bg candidates.
                for (x in 0 until w) {
                    val top = x
                    val bot = (h - 1) * w + x
                    if (bgCand[top] && !bg[top]) { bg[top] = true; stack[sp++] = top }
                    if (bgCand[bot] && !bg[bot]) { bg[bot] = true; stack[sp++] = bot }
                }
                for (y in 0 until h) {
                    val left = y * w
                    val right = y * w + (w - 1)
                    if (bgCand[left] && !bg[left]) { bg[left] = true; stack[sp++] = left }
                    if (bgCand[right] && !bg[right]) { bg[right] = true; stack[sp++] = right }
                }
                while (sp > 0) {
                    val p = stack[--sp]
                    val px = p % w; val py = p / w
                    // 4-connectivity neighbours.
                    if (px > 0)     { val q = p - 1; if (bgCand[q] && !bg[q]) { bg[q] = true; stack[sp++] = q } }
                    if (px < w - 1) { val q = p + 1; if (bgCand[q] && !bg[q]) { bg[q] = true; stack[sp++] = q } }
                    if (py > 0)     { val q = p - w; if (bgCand[q] && !bg[q]) { bg[q] = true; stack[sp++] = q } }
                    if (py < h - 1) { val q = p + w; if (bgCand[q] && !bg[q]) { bg[q] = true; stack[sp++] = q } }
                }
            }

            // fg = NOT bg
            var fg = BooleanArray(w * h)
            for (i in 0 until w * h) fg[i] = !bg[i]

            // ── 6a) binary_fill_holes: flood non-fg from border; unreached
            //        non-fg pixels are enclosed holes -> set to fg.
            run {
                val reached = BooleanArray(w * h)
                val stack = IntArray(w * h)
                var sp = 0
                fun seed(p: Int) { if (!fg[p] && !reached[p]) { reached[p] = true; stack[sp++] = p } }
                for (x in 0 until w) { seed(x); seed((h - 1) * w + x) }
                for (y in 0 until h) { seed(y * w); seed(y * w + (w - 1)) }
                while (sp > 0) {
                    val p = stack[--sp]
                    val px = p % w; val py = p / w
                    if (px > 0)     { val q = p - 1; if (!fg[q] && !reached[q]) { reached[q] = true; stack[sp++] = q } }
                    if (px < w - 1) { val q = p + 1; if (!fg[q] && !reached[q]) { reached[q] = true; stack[sp++] = q } }
                    if (py > 0)     { val q = p - w; if (!fg[q] && !reached[q]) { reached[q] = true; stack[sp++] = q } }
                    if (py < h - 1) { val q = p + w; if (!fg[q] && !reached[q]) { reached[q] = true; stack[sp++] = q } }
                }
                for (i in 0 until w * h) if (!fg[i] && !reached[i]) fg[i] = true
            }

            // ── 6b) binary_opening (erode then dilate), 3x3 via 4-neighbour
            run {
                // Erode: a pixel stays fg only if all 4 neighbours are fg.
                val eroded = BooleanArray(w * h)
                for (y in 0 until h) {
                    for (x in 0 until w) {
                        val i = y * w + x
                        if (!fg[i]) continue
                        val l = if (x > 0) fg[i - 1] else false
                        val r = if (x < w - 1) fg[i + 1] else false
                        val u = if (y > 0) fg[i - w] else false
                        val d = if (y < h - 1) fg[i + w] else false
                        eroded[i] = l && r && u && d
                    }
                }
                // Dilate: a pixel becomes fg if any 4-neighbour (or self) is fg.
                val dilated = BooleanArray(w * h)
                for (y in 0 until h) {
                    for (x in 0 until w) {
                        val i = y * w + x
                        var on = eroded[i]
                        if (!on && x > 0) on = eroded[i - 1]
                        if (!on && x < w - 1) on = eroded[i + 1]
                        if (!on && y > 0) on = eroded[i - w]
                        if (!on && y < h - 1) on = eroded[i + w]
                        dilated[i] = on
                    }
                }
                fg = dilated
            }

            // ── 6c) Keep only fg components with area >= 1% of H*W ─────────
            run {
                val minArea = (0.01 * w * h).toInt()
                val visited = BooleanArray(w * h)
                val stack = IntArray(w * h)
                val comp = IntArray(w * h)
                for (start in 0 until w * h) {
                    if (!fg[start] || visited[start]) continue
                    var sp = 0
                    var cc = 0
                    visited[start] = true; stack[sp++] = start
                    while (sp > 0) {
                        val p = stack[--sp]
                        comp[cc++] = p
                        val px = p % w; val py = p / w
                        if (px > 0)     { val q = p - 1; if (fg[q] && !visited[q]) { visited[q] = true; stack[sp++] = q } }
                        if (px < w - 1) { val q = p + 1; if (fg[q] && !visited[q]) { visited[q] = true; stack[sp++] = q } }
                        if (py > 0)     { val q = p - w; if (fg[q] && !visited[q]) { visited[q] = true; stack[sp++] = q } }
                        if (py < h - 1) { val q = p + w; if (fg[q] && !visited[q]) { visited[q] = true; stack[sp++] = q } }
                    }
                    if (cc < minArea) {
                        for (t in 0 until cc) fg[comp[t]] = false
                    }
                }
            }

            // ── 7) Degenerate guard ───────────────────────────────────────
            var fgArea = 0
            for (i in 0 until w * h) if (fg[i]) fgArea++
            val frac = fgArea.toFloat() / (w * h)
            if (frac < 0.03f || frac > 0.97f) return null

            // ── 8) Feather: gaussian (box-blur approx) then clip ──────────
            val alphaF = FloatArray(w * h)
            for (i in 0 until w * h) alphaF[i] = if (fg[i]) 1f else 0f
            boxBlur(alphaF, w, h, radius = 2, passes = 3)
            for (i in 0 until w * h) {
                val v = (alphaF[i] - 0.35f) / 0.30f
                alphaF[i] = if (v < 0f) 0f else if (v > 1f) 1f else v
            }

            // ── 9) Upscale alpha (bilinear) to original res, apply to original
            val out = Bitmap.createBitmap(ow, oh, Bitmap.Config.ARGB_8888)
            val outPixels = IntArray(ow * oh)
            val origPixels = IntArray(ow * oh)
            original.getPixels(origPixels, 0, ow, 0, 0, ow, oh)

            // Map original (ox,oy) -> working coords for bilinear sampling.
            val sx = if (ow > 1) (w - 1).toFloat() / (ow - 1) else 0f
            val sy = if (oh > 1) (h - 1).toFloat() / (oh - 1) else 0f
            for (oy in 0 until oh) {
                val fy = oy * sy
                var y0 = fy.toInt()
                if (y0 > h - 1) y0 = h - 1
                val y1 = if (y0 < h - 1) y0 + 1 else y0
                val wy = fy - y0
                for (ox in 0 until ow) {
                    val fx = ox * sx
                    var x0 = fx.toInt()
                    if (x0 > w - 1) x0 = w - 1
                    val x1 = if (x0 < w - 1) x0 + 1 else x0
                    val wx = fx - x0
                    val a00 = alphaF[y0 * w + x0]
                    val a10 = alphaF[y0 * w + x1]
                    val a01 = alphaF[y1 * w + x0]
                    val a11 = alphaF[y1 * w + x1]
                    val top = a00 + (a10 - a00) * wx
                    val bot = a01 + (a11 - a01) * wx
                    val a = top + (bot - top) * wy
                    val alpha = (a * 255f).roundToInt().coerceIn(0, 255)
                    val src = origPixels[oy * ow + ox]
                    outPixels[oy * ow + ox] = Color.argb(
                        alpha, Color.red(src), Color.green(src), Color.blue(src)
                    )
                }
            }
            out.setPixels(outPixels, 0, ow, 0, 0, ow, oh)
            return out
        } catch (e: Throwable) {
            return null
        }
    }

    /**
     * Separable box blur (in-place) — a fast approximation of a small gaussian.
     * `passes` repeated box blurs of the given `radius` approximate a gaussian
     * (3 passes ≈ gaussian). Edges use clamped sampling.
     */
    private fun boxBlur(buf: FloatArray, w: Int, h: Int, radius: Int, passes: Int) {
        if (radius < 1) return
        val tmp = FloatArray(w * h)
        val win = (2 * radius + 1).toFloat()
        repeat(passes) {
            // Horizontal pass: buf -> tmp.
            for (y in 0 until h) {
                val row = y * w
                for (x in 0 until w) {
                    var sum = 0f
                    for (k in -radius..radius) {
                        var xx = x + k
                        if (xx < 0) xx = 0 else if (xx > w - 1) xx = w - 1
                        sum += buf[row + xx]
                    }
                    tmp[row + x] = sum / win
                }
            }
            // Vertical pass: tmp -> buf.
            for (x in 0 until w) {
                for (y in 0 until h) {
                    var sum = 0f
                    for (k in -radius..radius) {
                        var yy = y + k
                        if (yy < 0) yy = 0 else if (yy > h - 1) yy = h - 1
                        sum += tmp[yy * w + x]
                    }
                    buf[y * w + x] = sum / win
                }
            }
        }
    }

    /**
     * sRGB (0..255) -> CIE LAB (D65). Returns [L, a, b].
     */
    private fun rgbToLab(r: Int, g: Int, b: Int): FloatArray {
        // sRGB -> linear
        fun inv(c: Int): Double {
            val cs = c / 255.0
            return if (cs <= 0.04045) cs / 12.92 else Math.pow((cs + 0.055) / 1.055, 2.4)
        }
        val rl = inv(r); val gl = inv(g); val bl = inv(b)
        // linear RGB -> XYZ (sRGB D65 matrix)
        val x = (rl * 0.4124564 + gl * 0.3575761 + bl * 0.1804375) / 0.95047
        val y = (rl * 0.2126729 + gl * 0.7151522 + bl * 0.0721750) / 1.0
        val z = (rl * 0.0193339 + gl * 0.1191920 + bl * 0.9503041) / 1.08883
        fun f(t: Double): Double = if (t > 0.008856) Math.cbrt(t) else 7.787 * t + 16.0 / 116.0
        val fx = f(x); val fy = f(y); val fz = f(z)
        val l = (116.0 * fy - 16.0).toFloat()
        val a = (500.0 * (fx - fy)).toFloat()
        val bb = (200.0 * (fy - fz)).toFloat()
        return floatArrayOf(l, a, bb)
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

        latch.await(5, TimeUnit.SECONDS)
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

        latch.await(5, TimeUnit.SECONDS)
        recognizer.close()
        return ocrText
    }
}
