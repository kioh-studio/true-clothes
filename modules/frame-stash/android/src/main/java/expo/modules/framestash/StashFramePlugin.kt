package expo.modules.framestash

import android.graphics.ImageFormat
import com.mrousavy.camera.core.types.Orientation
import com.mrousavy.camera.frameprocessors.Frame
import com.mrousavy.camera.frameprocessors.FrameProcessorPlugin
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt

/**
 * YUV_420_888 -> upright, unmirrored RGBA, long side <= LONG_SIDE (keep in sync with
 * FRAME_LONG_SIDE in stillToRgba.ts). Returns {id, w, h}; pixels stay native until
 * FrameStash.take(id). Rotation = clockwise degrees to upright. Downscale happens in
 * sensor space BEFORE rotation. Bilinear on luma, nearest on chroma; JFIF full-range BT.601.
 */
class StashFramePlugin : FrameProcessorPlugin() {
  companion object { const val LONG_SIDE = 960 }

  override fun callback(frame: Frame, params: MutableMap<String, Any>?): Any? {
    val img = frame.image
    if (img.format != ImageFormat.YUV_420_888) throw Error("stashFrame: unsupported format ${img.format}")
    val srcW = frame.width
    val srcH = frame.height
    // Frame.orientation is the REVERSED CameraX rotationDegrees (clockwise rotation to upright).
    val rot = when (frame.orientation) {
      Orientation.LANDSCAPE_RIGHT -> 90
      Orientation.LANDSCAPE_LEFT -> 270
      Orientation.PORTRAIT_UPSIDE_DOWN -> 180
      else -> 0
    }
    val s = min(1f, LONG_SIDE.toFloat() / max(srcW, srcH))
    val sw = (srcW * s).roundToInt()
    val sh = (srcH * s).roundToInt()
    val swap = rot == 90 || rot == 270  // 0/90/180/270 only
    val ow = if (swap) sh else sw
    val oh = if (swap) sw else sh

    val planes = img.planes
    val yBuf = ByteArray(planes[0].buffer.remaining()).also { planes[0].buffer.get(it) }
    val uBuf = ByteArray(planes[1].buffer.remaining()).also { planes[1].buffer.get(it) }
    val vBuf = ByteArray(planes[2].buffer.remaining()).also { planes[2].buffer.get(it) }
    val yRow = planes[0].rowStride
    val cRow = planes[1].rowStride
    val cPix = planes[1].pixelStride
    val xs = srcW.toFloat() / sw
    val ys = srcH.toFloat() / sh
    val out = ByteArray(ow * oh * 4)
    var o = 0
    for (y in 0 until oh) {
      for (x in 0 until ow) {
        val px: Int
        val py: Int
        when (rot) {
          90 -> { px = y; py = sh - 1 - x }
          180 -> { px = sw - 1 - x; py = sh - 1 - y }
          270 -> { px = sw - 1 - y; py = x }
          else -> { px = x; py = y }
        }
        val fx = ((px + 0.5f) * xs - 0.5f).coerceIn(0f, srcW - 1f)
        val fy = ((py + 0.5f) * ys - 0.5f).coerceIn(0f, srcH - 1f)
        val x0 = fx.toInt(); val y0 = fy.toInt()
        val x1 = min(x0 + 1, srcW - 1); val y1 = min(y0 + 1, srcH - 1)
        val ax = fx - x0; val ay = fy - y0
        val r0 = y0 * yRow; val r1 = y1 * yRow
        val top = (yBuf[r0 + x0].toInt() and 0xFF) * (1 - ax) + (yBuf[r0 + x1].toInt() and 0xFF) * ax
        val bot = (yBuf[r1 + x0].toInt() and 0xFF) * (1 - ax) + (yBuf[r1 + x1].toInt() and 0xFF) * ax
        val yy = top * (1 - ay) + bot * ay
        val ci = (min(y0 + (ay + 0.5f).toInt(), srcH - 1) shr 1) * cRow + (min(x0 + (ax + 0.5f).toInt(), srcW - 1) shr 1) * cPix
        val u = (uBuf[ci].toInt() and 0xFF) - 128
        val v = (vBuf[ci].toInt() and 0xFF) - 128
        out[o++] = (yy + 1.402f * v).roundToInt().coerceIn(0, 255).toByte()
        out[o++] = (yy - 0.344136f * u - 0.714136f * v).roundToInt().coerceIn(0, 255).toByte()
        out[o++] = (yy + 1.772f * u).roundToInt().coerceIn(0, 255).toByte()
        out[o++] = 0xFF.toByte()
      }
    }
    val id = FrameStash.put(ow, oh, out)
    return hashMapOf<String, Any>("id" to id, "w" to ow, "h" to oh)
  }
}
