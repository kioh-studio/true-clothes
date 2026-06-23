// ExpoItemExtractModule.swift
// Native Expo Module — iOS implementation of expo-item-extract.
//
// Uses:
//   - Vision.VNGenerateForegroundInstanceMaskRequest  (iOS 17+) for subject segmentation
//   - CoreImage / UIKit to composite the mask onto a transparent PNG
//   - Vision.VNClassifyImageRequest for image labels
//   - Vision.VNRecognizeTextRequest for OCR
//
// Fallback path (iOS < 17, or VNGenerateForegroundInstanceMaskRequest fails / returns
// an empty mask): build a background model from a border frame (LAB k-means +
// connected-components flood from the edges) and cut out the foreground. If the result
// is degenerate, return the original uri and set usedFallback = true. Never throws for
// "no subject".
//
// All heavy work runs on a background DispatchQueue so the JS thread is never blocked.

import ExpoModulesCore
import Vision
import UIKit
import CoreImage
import CoreImage.CIFilterBuiltins

// MARK: - Module definition

public class ExpoItemExtractModule: Module {
  public func definition() -> ModuleDefinition {
    Name("ExpoItemExtract")

    AsyncFunction("extractItem") { (uri: String, promise: Promise) in
      DispatchQueue.global(qos: .userInitiated).async {
        do {
          let result = try ExpoItemExtractModule.performExtraction(uri: uri)
          promise.resolve(result)
        } catch {
          promise.reject("ERR_EXTRACT", error.localizedDescription)
        }
      }
    }
  }

  // MARK: - Core extraction pipeline

  private static func performExtraction(uri: String) throws -> [String: Any] {
    // Strip "file://" prefix if present.
    let filePath = uri.hasPrefix("file://")
      ? String(uri.dropFirst("file://".count))
      : uri

    guard let image = UIImage(contentsOfFile: filePath) else {
      throw NSError(
        domain: "ExpoItemExtract",
        code: 1,
        userInfo: [NSLocalizedDescriptionKey: "Cannot load image at path: \(filePath)"]
      )
    }

    guard let cgImage = image.cgImage else {
      throw NSError(
        domain: "ExpoItemExtract",
        code: 2,
        userInfo: [NSLocalizedDescriptionKey: "Cannot obtain CGImage from UIImage"]
      )
    }

    // ── 1. Segmentation ──────────────────────────────────────────────────────
    let (cutoutUri, usedFallback) = segmentForeground(
      cgImage: cgImage,
      originalUri: uri,
      originalFilePath: filePath
    )

    // Load the cutout (or original on full fallback) for downstream tasks.
    // We run labels + OCR on the ORIGINAL image for best accuracy; palette on
    // the cutout so background pixels are excluded.
    let cutoutPath = cutoutUri.hasPrefix("file://")
      ? String(cutoutUri.dropFirst("file://".count))
      : cutoutUri

    let cutoutImage = UIImage(contentsOfFile: cutoutPath)?.cgImage ?? cgImage

    // ── 2. Palette from foreground pixels only ────────────────────────────
    let palette = dominantColors(from: cutoutImage, maxColors: 3)

    // ── 3. Image labels ───────────────────────────────────────────────────
    let labels = classifyImage(cgImage: cgImage)

    // ── 4. OCR ────────────────────────────────────────────────────────────
    let ocrText = recognizeText(cgImage: cgImage)

    return [
      "cutoutUri":    cutoutUri,
      "usedFallback": usedFallback,
      "palette":      palette,      // [[r, g, b]] encoded as [[String:Int]]
      "labels":       labels,       // [[text, confidence]]
      "ocrText":      ocrText,      // [String]
    ]
  }

  // MARK: - Foreground segmentation

  /// Returns (cutoutUri, usedFallback).
  /// Priority: VNGenerateForegroundInstanceMaskRequest (iOS 17+)
  ///           → background-model key (LAB k-means + connected components, any iOS)
  ///           → original image (usedFallback = true)
  private static func segmentForeground(
    cgImage: CGImage,
    originalUri: String,
    originalFilePath: String
  ) -> (String, Bool) {

    // ── iOS 17+ path ──────────────────────────────────────────────────────
    if #available(iOS 17.0, *) {
      if let uri = visionSegment(cgImage: cgImage) {
        return (uri, false)
      }
    }

    // ── Background-model fallback ─────────────────────────────────────────
    if let uri = backgroundModelKey(cgImage: cgImage) {
      return (uri, true)
    }

    // ── Last resort: return original ──────────────────────────────────────
    return (originalUri, true)
  }

  // MARK: VNGenerateForegroundInstanceMaskRequest (iOS 17+)

  @available(iOS 17.0, *)
  private static func visionSegment(cgImage: CGImage) -> String? {
    let request = VNGenerateForegroundInstanceMaskRequest()
    let handler = VNImageRequestHandler(cgImage: cgImage, options: [:])

    do {
      try handler.perform([request])
    } catch {
      return nil
    }

    guard
      let observation = request.results?.first as? VNInstanceMaskObservation
    else { return nil }

    // Generate the masked image (foreground + alpha).
    guard let maskedPixelBuffer = try? observation.generateMaskedImage(
      ofInstances: observation.allInstances,
      from: handler,
      croppedToInstancesExtent: false
    ) else { return nil }

    // Convert CVPixelBuffer → UIImage with transparency preserved.
    let ciImage = CIImage(cvPixelBuffer: maskedPixelBuffer)
    let context = CIContext()
    guard let maskedCG = context.createCGImage(ciImage, from: ciImage.extent) else {
      return nil
    }

    return saveTransparentPNG(cgImage: maskedCG, originalSize: CGSize(
      width: cgImage.width,
      height: cgImage.height
    ))
  }

  // MARK: Background-model keying (LAB k-means + connected components)

  /// Smarter on-device background removal fallback (tier 2).
  ///
  /// Faithful port of the validated Python `extract` algorithm:
  ///   1. Downscale to ~512px long edge.
  ///   2. Convert to LAB.
  ///   3. Sample a 6%-wide border frame; k-means (k=6) on the border LAB pixels.
  ///   4. Keep only clusters with >=10% share of the border as "background".
  ///   5. Per-pixel: bg-candidate if min LAB distance to any bg cluster < TAU(14).
  ///   6. Keep only bg-candidate pixels connected (4-conn) to the image border.
  ///   7. fg = NOT bg; fill holes; opening; drop components < 1% of area.
  ///   8. Degenerate guard: fg fraction < 3% or > 97% -> return nil.
  ///   9. Feather the mask (box-blur approx of gaussian), then upscale the
  ///      alpha (bilinear) to the ORIGINAL resolution and apply to the full-res
  ///      original so the cut-out stays full quality.
  ///
  /// Returns a "file://" PNG uri, or nil on any degenerate result / failure.
  private static func backgroundModelKey(cgImage: CGImage) -> String? {
    let ow = cgImage.width
    let oh = cgImage.height
    if ow < 4 || oh < 4 { return nil }

    // ── Working resolution (~512px long edge) ───────────────────────────
    let maxLong = 512
    let longEdge = max(ow, oh)
    let scaleF: Double = longEdge > maxLong ? Double(maxLong) / Double(longEdge) : 1.0
    let w = max(1, Int((Double(ow) * scaleF).rounded()))
    let h = max(1, Int((Double(oh) * scaleF).rounded()))

    // Render working image to an RGBA buffer.
    guard let colorSpace = CGColorSpace(name: CGColorSpace.sRGB) else { return nil }
    guard let wctx = CGContext(
      data: nil,
      width: w, height: h,
      bitsPerComponent: 8,
      bytesPerRow: w * 4,
      space: colorSpace,
      bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
    ) else { return nil }
    wctx.interpolationQuality = .high
    wctx.draw(cgImage, in: CGRect(x: 0, y: 0, width: w, height: h))
    guard let wdata = wctx.data else { return nil }
    let wptr = wdata.assumingMemoryBound(to: UInt8.self)

    let count = w * h

    // ── LAB conversion (parallel arrays) ────────────────────────────────
    var labL = [Float](repeating: 0, count: count)
    var labA = [Float](repeating: 0, count: count)
    var labB = [Float](repeating: 0, count: count)
    for i in 0..<count {
      let off = i * 4
      let lab = rgbToLab(Int(wptr[off]), Int(wptr[off + 1]), Int(wptr[off + 2]))
      labL[i] = lab.0; labA[i] = lab.1; labB[i] = lab.2
    }

    // ── 1) Border frame, width = 6% of min(H,W) (>=3) ───────────────────
    let bw = max(3, Int((0.06 * Double(min(h, w))).rounded()))
    var borderIdx = [Int]()
    for y in 0..<h {
      for x in 0..<w {
        if x < bw || x >= w - bw || y < bw || y >= h - bw {
          borderIdx.append(y * w + x)
        }
      }
    }
    if borderIdx.isEmpty { return nil }

    // ── 2) k-means k=6 on border LAB (15 iters, deterministic) ──────────
    let n = borderIdx.count
    let kk = min(6, n)
    var cL = [Float](repeating: 0, count: kk)
    var cA = [Float](repeating: 0, count: kk)
    var cB = [Float](repeating: 0, count: kk)
    let step = max(1, n / kk)
    for c in 0..<kk {
      let p = borderIdx[min(n - 1, c * step)]
      cL[c] = labL[p]; cA[c] = labA[p]; cB[c] = labB[p]
    }
    var assign = [Int](repeating: 0, count: n)
    for iter in 0..<15 {
      var changed = false
      for j in 0..<n {
        let p = borderIdx[j]
        var best = 0
        var bestD = Float.greatestFiniteMagnitude
        for c in 0..<kk {
          let dl = labL[p] - cL[c]
          let da = labA[p] - cA[c]
          let db = labB[p] - cB[c]
          let d = dl * dl + da * da + db * db
          if d < bestD { bestD = d; best = c }
        }
        if assign[j] != best { assign[j] = best; changed = true }
      }
      var sL = [Double](repeating: 0, count: kk)
      var sA = [Double](repeating: 0, count: kk)
      var sB = [Double](repeating: 0, count: kk)
      var cnt = [Int](repeating: 0, count: kk)
      for j in 0..<n {
        let p = borderIdx[j]; let c = assign[j]
        sL[c] += Double(labL[p]); sA[c] += Double(labA[p]); sB[c] += Double(labB[p]); cnt[c] += 1
      }
      for c in 0..<kk where cnt[c] > 0 {
        cL[c] = Float(sL[c] / Double(cnt[c]))
        cA[c] = Float(sA[c] / Double(cnt[c]))
        cB[c] = Float(sB[c] / Double(cnt[c]))
      }
      if !changed && iter > 0 { break }
    }

    // ── 3) Keep only clusters with border share >= 0.10 ─────────────────
    var clusterCount = [Int](repeating: 0, count: kk)
    for j in 0..<n { clusterCount[assign[j]] += 1 }
    var bgL = [Float](); var bgA = [Float](); var bgB2 = [Float]()
    for c in 0..<kk {
      let share = Float(clusterCount[c]) / Float(n)
      if share >= 0.10 { bgL.append(cL[c]); bgA.append(cA[c]); bgB2.append(cB[c]) }
    }
    if bgL.isEmpty { return nil }

    // ── 4) Per-pixel bg candidate: min LAB dist to bg clusters < TAU ────
    let tau: Float = 14.0
    let tauSq = tau * tau
    var bgCand = [Bool](repeating: false, count: count)
    let m = bgL.count
    for i in 0..<count {
      var minD = Float.greatestFiniteMagnitude
      for c in 0..<m {
        let dl = labL[i] - bgL[c]
        let da = labA[i] - bgA[c]
        let db = labB[i] - bgB2[c]
        let d = dl * dl + da * da + db * db
        if d < minD { minD = d }
      }
      bgCand[i] = minD < tauSq
    }

    // ── 5) Keep only bg connected (4-conn) to the image border ──────────
    var bg = [Bool](repeating: false, count: count)
    do {
      var stack = [Int](); stack.reserveCapacity(count)
      func seed(_ p: Int) { if bgCand[p] && !bg[p] { bg[p] = true; stack.append(p) } }
      for x in 0..<w { seed(x); seed((h - 1) * w + x) }
      for y in 0..<h { seed(y * w); seed(y * w + (w - 1)) }
      while let p = stack.popLast() {
        let px = p % w; let py = p / w
        if px > 0 { let q = p - 1; if bgCand[q] && !bg[q] { bg[q] = true; stack.append(q) } }
        if px < w - 1 { let q = p + 1; if bgCand[q] && !bg[q] { bg[q] = true; stack.append(q) } }
        if py > 0 { let q = p - w; if bgCand[q] && !bg[q] { bg[q] = true; stack.append(q) } }
        if py < h - 1 { let q = p + w; if bgCand[q] && !bg[q] { bg[q] = true; stack.append(q) } }
      }
    }

    // fg = NOT bg
    var fg = [Bool](repeating: false, count: count)
    for i in 0..<count { fg[i] = !bg[i] }

    // ── 6a) binary_fill_holes: flood non-fg from border; unreached non-fg
    //        pixels are enclosed holes -> set to fg.
    do {
      var reached = [Bool](repeating: false, count: count)
      var stack = [Int](); stack.reserveCapacity(count)
      func seed(_ p: Int) { if !fg[p] && !reached[p] { reached[p] = true; stack.append(p) } }
      for x in 0..<w { seed(x); seed((h - 1) * w + x) }
      for y in 0..<h { seed(y * w); seed(y * w + (w - 1)) }
      while let p = stack.popLast() {
        let px = p % w; let py = p / w
        if px > 0 { let q = p - 1; if !fg[q] && !reached[q] { reached[q] = true; stack.append(q) } }
        if px < w - 1 { let q = p + 1; if !fg[q] && !reached[q] { reached[q] = true; stack.append(q) } }
        if py > 0 { let q = p - w; if !fg[q] && !reached[q] { reached[q] = true; stack.append(q) } }
        if py < h - 1 { let q = p + w; if !fg[q] && !reached[q] { reached[q] = true; stack.append(q) } }
      }
      for i in 0..<count where !fg[i] && !reached[i] { fg[i] = true }
    }

    // ── 6b) binary_opening (erode then dilate), 3x3 via 4-neighbour ─────
    do {
      var eroded = [Bool](repeating: false, count: count)
      for y in 0..<h {
        for x in 0..<w {
          let i = y * w + x
          if !fg[i] { continue }
          let l = x > 0 ? fg[i - 1] : false
          let r = x < w - 1 ? fg[i + 1] : false
          let u = y > 0 ? fg[i - w] : false
          let d = y < h - 1 ? fg[i + w] : false
          eroded[i] = l && r && u && d
        }
      }
      var dilated = [Bool](repeating: false, count: count)
      for y in 0..<h {
        for x in 0..<w {
          let i = y * w + x
          var on = eroded[i]
          if !on && x > 0 { on = eroded[i - 1] }
          if !on && x < w - 1 { on = eroded[i + 1] }
          if !on && y > 0 { on = eroded[i - w] }
          if !on && y < h - 1 { on = eroded[i + w] }
          dilated[i] = on
        }
      }
      fg = dilated
    }

    // ── 6c) Keep only fg components with area >= 1% of H*W ──────────────
    do {
      let minArea = Int(0.01 * Double(count))
      var visited = [Bool](repeating: false, count: count)
      var stack = [Int](); stack.reserveCapacity(count)
      var comp = [Int](); comp.reserveCapacity(count)
      for start in 0..<count {
        if !fg[start] || visited[start] { continue }
        stack.removeAll(keepingCapacity: true)
        comp.removeAll(keepingCapacity: true)
        visited[start] = true; stack.append(start)
        while let p = stack.popLast() {
          comp.append(p)
          let px = p % w; let py = p / w
          if px > 0 { let q = p - 1; if fg[q] && !visited[q] { visited[q] = true; stack.append(q) } }
          if px < w - 1 { let q = p + 1; if fg[q] && !visited[q] { visited[q] = true; stack.append(q) } }
          if py > 0 { let q = p - w; if fg[q] && !visited[q] { visited[q] = true; stack.append(q) } }
          if py < h - 1 { let q = p + w; if fg[q] && !visited[q] { visited[q] = true; stack.append(q) } }
        }
        if comp.count < minArea {
          for t in comp { fg[t] = false }
        }
      }
    }

    // ── 7) Degenerate guard ─────────────────────────────────────────────
    var fgArea = 0
    for i in 0..<count where fg[i] { fgArea += 1 }
    let frac = Float(fgArea) / Float(count)
    if frac < 0.03 || frac > 0.97 { return nil }

    // ── 8) Feather: gaussian (box-blur approx) then clip ────────────────
    var alphaF = [Float](repeating: 0, count: count)
    for i in 0..<count { alphaF[i] = fg[i] ? 1.0 : 0.0 }
    boxBlur(&alphaF, w: w, h: h, radius: 2, passes: 3)
    for i in 0..<count {
      let v = (alphaF[i] - 0.35) / 0.30
      alphaF[i] = v < 0 ? 0 : (v > 1 ? 1 : v)
    }

    // ── 9) Upscale alpha (bilinear) to original res, apply to original ──
    // Render the full-res original RGBA.
    guard let octx = CGContext(
      data: nil,
      width: ow, height: oh,
      bitsPerComponent: 8,
      bytesPerRow: ow * 4,
      space: colorSpace,
      bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
    ) else { return nil }
    octx.draw(cgImage, in: CGRect(x: 0, y: 0, width: ow, height: oh))
    guard let odata = octx.data else { return nil }
    let optr = odata.assumingMemoryBound(to: UInt8.self)

    let sx: Float = ow > 1 ? Float(w - 1) / Float(ow - 1) : 0
    let sy: Float = oh > 1 ? Float(h - 1) / Float(oh - 1) : 0
    for oy in 0..<oh {
      let fy = Float(oy) * sy
      var y0 = Int(fy)
      if y0 > h - 1 { y0 = h - 1 }
      let y1 = y0 < h - 1 ? y0 + 1 : y0
      let wy = fy - Float(y0)
      for ox in 0..<ow {
        let fx = Float(ox) * sx
        var x0 = Int(fx)
        if x0 > w - 1 { x0 = w - 1 }
        let x1 = x0 < w - 1 ? x0 + 1 : x0
        let wx = fx - Float(x0)
        let a00 = alphaF[y0 * w + x0]
        let a10 = alphaF[y0 * w + x1]
        let a01 = alphaF[y1 * w + x0]
        let a11 = alphaF[y1 * w + x1]
        let top = a00 + (a10 - a00) * wx
        let bot = a01 + (a11 - a01) * wx
        let a = top + (bot - top) * wy
        var alpha = Int((a * 255).rounded())
        if alpha < 0 { alpha = 0 } else if alpha > 255 { alpha = 255 }
        let off = (oy * ow + ox) * 4
        // Premultiplied-last buffer: scale colour channels by alpha.
        let af = Float(alpha) / 255.0
        optr[off]     = UInt8((Float(optr[off]) * af).rounded())
        optr[off + 1] = UInt8((Float(optr[off + 1]) * af).rounded())
        optr[off + 2] = UInt8((Float(optr[off + 2]) * af).rounded())
        optr[off + 3] = UInt8(alpha)
      }
    }

    guard let cutCG = octx.makeImage() else { return nil }
    return saveTransparentPNG(cgImage: cutCG, originalSize: CGSize(width: ow, height: oh))
  }

  /// Separable box blur (in-place) — a fast approximation of a small gaussian.
  /// `passes` repeated box blurs of the given `radius` approximate a gaussian
  /// (3 passes ≈ gaussian). Edges use clamped sampling.
  private static func boxBlur(_ buf: inout [Float], w: Int, h: Int, radius: Int, passes: Int) {
    if radius < 1 { return }
    var tmp = [Float](repeating: 0, count: w * h)
    let win = Float(2 * radius + 1)
    for _ in 0..<passes {
      // Horizontal pass: buf -> tmp.
      for y in 0..<h {
        let row = y * w
        for x in 0..<w {
          var sum: Float = 0
          for k in -radius...radius {
            var xx = x + k
            if xx < 0 { xx = 0 } else if xx > w - 1 { xx = w - 1 }
            sum += buf[row + xx]
          }
          tmp[row + x] = sum / win
        }
      }
      // Vertical pass: tmp -> buf.
      for x in 0..<w {
        for y in 0..<h {
          var sum: Float = 0
          for k in -radius...radius {
            var yy = y + k
            if yy < 0 { yy = 0 } else if yy > h - 1 { yy = h - 1 }
            sum += tmp[yy * w + x]
          }
          buf[y * w + x] = sum / win
        }
      }
    }
  }

  /// sRGB (0..255) -> CIE LAB (D65). Returns (L, a, b).
  private static func rgbToLab(_ r: Int, _ g: Int, _ b: Int) -> (Float, Float, Float) {
    func inv(_ c: Int) -> Double {
      let cs = Double(c) / 255.0
      return cs <= 0.04045 ? cs / 12.92 : pow((cs + 0.055) / 1.055, 2.4)
    }
    let rl = inv(r); let gl = inv(g); let bl = inv(b)
    let x = (rl * 0.4124564 + gl * 0.3575761 + bl * 0.1804375) / 0.95047
    let y = (rl * 0.2126729 + gl * 0.7151522 + bl * 0.0721750) / 1.0
    let z = (rl * 0.0193339 + gl * 0.1191920 + bl * 0.9503041) / 1.08883
    func f(_ t: Double) -> Double { t > 0.008856 ? cbrt(t) : 7.787 * t + 16.0 / 116.0 }
    let fx = f(x); let fy = f(y); let fz = f(z)
    let l = Float(116.0 * fy - 16.0)
    let a = Float(500.0 * (fx - fy))
    let bb = Float(200.0 * (fy - fz))
    return (l, a, bb)
  }

  // MARK: - Save transparent PNG (~1024 long edge)

  /// Scales the image so the long edge ≤ 1024 px, then writes a PNG to the app
  /// cache directory and returns a "file://" URI.
  private static func saveTransparentPNG(cgImage: CGImage, originalSize: CGSize) -> String? {
    let maxLong: CGFloat = 1024
    let w = CGFloat(cgImage.width)
    let h = CGFloat(cgImage.height)
    let scale = min(1.0, maxLong / max(w, h))
    let newW = Int(w * scale)
    let newH = Int(h * scale)

    guard let colorSpace = CGColorSpace(name: CGColorSpace.sRGB) else { return nil }
    guard let ctx = CGContext(
      data: nil,
      width: newW, height: newH,
      bitsPerComponent: 8,
      bytesPerRow: newW * 4,
      space: colorSpace,
      bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
    ) else { return nil }

    ctx.interpolationQuality = .high
    ctx.draw(cgImage, in: CGRect(x: 0, y: 0, width: newW, height: newH))

    guard let resized = ctx.makeImage() else { return nil }

    let filename = "cutout_\(UUID().uuidString).png"
    let cacheDir  = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask).first!
    let fileURL   = cacheDir.appendingPathComponent(filename)

    guard let dest = CGImageDestinationCreateWithURL(
      fileURL as CFURL,
      "public.png" as CFString,
      1, nil
    ) else { return nil }

    CGImageDestinationAddImage(dest, resized, nil)
    guard CGImageDestinationFinalize(dest) else { return nil }

    return "file://" + fileURL.path
  }

  // MARK: - Palette (dominant foreground colours)

  /// Downsamples to a small grid, skips transparent pixels, then runs a
  /// simple k-means (k ≤ 3) over the RGB values. Falls back to the mean
  /// colour when there are too few opaque pixels.
  private static func dominantColors(from cgImage: CGImage, maxColors: Int) -> [[String: Int]] {
    // Render into a small RGBA buffer for speed.
    let side = 64
    guard let colorSpace = CGColorSpace(name: CGColorSpace.sRGB) else { return [] }
    guard let ctx = CGContext(
      data: nil,
      width: side, height: side,
      bitsPerComponent: 8,
      bytesPerRow: side * 4,
      space: colorSpace,
      bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
    ) else { return [] }

    ctx.draw(cgImage, in: CGRect(x: 0, y: 0, width: side, height: side))
    guard let data = ctx.data else { return [] }
    let ptr = data.assumingMemoryBound(to: UInt8.self)

    var pixels: [(Int, Int, Int)] = []
    pixels.reserveCapacity(side * side)
    for i in 0..<(side * side) {
      let off = i * 4
      let a = Int(ptr[off + 3])
      guard a > 30 else { continue }  // skip transparent / near-transparent
      pixels.append((Int(ptr[off]), Int(ptr[off + 1]), Int(ptr[off + 2])))
    }

    guard !pixels.isEmpty else { return [] }

    let clusters = kMeans(pixels: pixels, k: min(maxColors, pixels.count))
    return clusters.map { ["r": $0.0, "g": $0.1, "b": $0.2] }
  }

  /// Naïve k-means over (r,g,b) tuples.  k ≤ 3 and iteration cap = 20 keeps
  /// it fast enough for 64×64 = ~4 000 non-transparent pixels.
  private static func kMeans(pixels: [(Int, Int, Int)], k: Int) -> [(Int, Int, Int)] {
    guard k > 0 else { return [] }

    // Seed centroids evenly spaced through the pixel list.
    var centroids: [(Double, Double, Double)] = stride(
      from: 0, to: pixels.count, by: pixels.count / k
    ).prefix(k).map { i in
      (Double(pixels[i].0), Double(pixels[i].1), Double(pixels[i].2))
    }

    var assignments = [Int](repeating: 0, count: pixels.count)

    for _ in 0..<20 {
      var changed = false

      // Assignment step
      for (idx, p) in pixels.enumerated() {
        var best = 0
        var bestDist = Double.infinity
        for (ci, c) in centroids.enumerated() {
          let d = colorDist(p, c)
          if d < bestDist { bestDist = d; best = ci }
        }
        if assignments[idx] != best { assignments[idx] = best; changed = true }
      }

      if !changed { break }

      // Update step
      var sums   = [(Double, Double, Double)](repeating: (0,0,0), count: k)
      var counts = [Int](repeating: 0, count: k)
      for (idx, p) in pixels.enumerated() {
        let ci = assignments[idx]
        sums[ci].0 += Double(p.0)
        sums[ci].1 += Double(p.1)
        sums[ci].2 += Double(p.2)
        counts[ci] += 1
      }
      for ci in 0..<k {
        if counts[ci] > 0 {
          centroids[ci] = (sums[ci].0/Double(counts[ci]),
                           sums[ci].1/Double(counts[ci]),
                           sums[ci].2/Double(counts[ci]))
        }
      }
    }

    // Sort by cluster size (largest → most dominant)
    var clusterSizes = [Int](repeating: 0, count: k)
    for a in assignments { clusterSizes[a] += 1 }

    let sorted = (0..<k)
      .filter { clusterSizes[$0] > 0 }
      .sorted { clusterSizes[$0] > clusterSizes[$1] }

    return sorted.map { ci in
      (Int(centroids[ci].0.rounded()),
       Int(centroids[ci].1.rounded()),
       Int(centroids[ci].2.rounded()))
    }
  }

  private static func colorDist(_ p: (Int,Int,Int), _ c: (Double,Double,Double)) -> Double {
    let dr = Double(p.0) - c.0
    let dg = Double(p.1) - c.1
    let db = Double(p.2) - c.2
    return dr*dr + dg*dg + db*db
  }

  // MARK: - Image classification (labels)

  private static func classifyImage(cgImage: CGImage) -> [[String: Any]] {
    let request = VNClassifyImageRequest()
    let handler = VNImageRequestHandler(cgImage: cgImage, options: [:])

    do {
      try handler.perform([request])
    } catch {
      return []
    }

    guard let observations = request.results as? [VNClassificationObservation] else {
      return []
    }

    // Return top 5 confident labels, highest confidence first.
    return observations
      .filter { $0.confidence > 0.05 }
      .prefix(5)
      .map { obs in
        ["text": obs.identifier, "confidence": Double(obs.confidence)]
      }
  }

  // MARK: - Text recognition (OCR)

  private static func recognizeText(cgImage: CGImage) -> [String] {
    let request = VNRecognizeTextRequest()
    request.recognitionLevel = .accurate
    request.usesLanguageCorrection = true

    let handler = VNImageRequestHandler(cgImage: cgImage, options: [:])

    do {
      try handler.perform([request])
    } catch {
      return []
    }

    guard let observations = request.results as? [VNRecognizedTextObservation] else {
      return []
    }

    return observations.compactMap { obs in
      obs.topCandidates(1).first?.string
    }
  }
}
