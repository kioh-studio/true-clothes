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
// an empty mask): sample the 4 corner pixels; if they form a near-uniform background
// colour, make all near-matching pixels transparent ("chroma key"). If even that fails,
// return the original uri and set usedFallback = true. Never throws for "no subject".
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
  ///           → corner-pixel chroma-key (any iOS)
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

    // ── Corner-pixel chroma-key fallback ─────────────────────────────────
    if let uri = chromaKey(cgImage: cgImage) {
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

  // MARK: Corner-pixel chroma keying

  /// Samples the 4 corners; if they are within tolerance of each other (uniform BG),
  /// makes all pixels within that tolerance transparent. Returns nil when the background
  /// is not uniform.
  private static func chromaKey(cgImage: CGImage) -> String? {
    guard
      let data = cgImage.dataProvider?.data,
      let ptr  = CFDataGetBytePtr(data)
    else { return nil }

    let w = cgImage.width, h = cgImage.height
    let bpp = cgImage.bitsPerPixel / 8           // bytes per pixel (3 or 4)
    let bpr = cgImage.bytesPerRow

    guard bpp >= 3 else { return nil }

    // Sample corners
    func pixel(_ x: Int, _ y: Int) -> (Int, Int, Int) {
      let offset = y * bpr + x * bpp
      return (Int(ptr[offset]), Int(ptr[offset + 1]), Int(ptr[offset + 2]))
    }

    let corners = [
      pixel(0, 0), pixel(w - 1, 0), pixel(0, h - 1), pixel(w - 1, h - 1)
    ]

    // Average the corners for the "background colour"
    let bgR = corners.map(\.0).reduce(0, +) / 4
    let bgG = corners.map(\.1).reduce(0, +) / 4
    let bgB = corners.map(\.2).reduce(0, +) / 4

    // Check corner spread — if too varied, not a uniform background.
    let spread = corners.map { c in
      abs(c.0 - bgR) + abs(c.1 - bgG) + abs(c.2 - bgB)
    }.max() ?? 999

    let uniformityThreshold = 60
    guard spread <= uniformityThreshold else { return nil }

    // Build a new RGBA image, keying out background colour.
    let keyTolerance = 40
    guard let colorSpace = CGColorSpace(name: CGColorSpace.sRGB) else { return nil }
    guard let ctx = CGContext(
      data: nil,
      width: w, height: h,
      bitsPerComponent: 8,
      bytesPerRow: w * 4,
      space: colorSpace,
      bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
    ) else { return nil }

    ctx.draw(cgImage, in: CGRect(x: 0, y: 0, width: w, height: h))

    guard let outData = ctx.data else { return nil }
    let outPtr = outData.assumingMemoryBound(to: UInt8.self)

    for y in 0..<h {
      for x in 0..<w {
        let offset = (y * w + x) * 4
        let r = Int(outPtr[offset])
        let g = Int(outPtr[offset + 1])
        let b = Int(outPtr[offset + 2])
        let dist = abs(r - bgR) + abs(g - bgG) + abs(b - bgB)
        if dist <= keyTolerance {
          outPtr[offset]     = 0
          outPtr[offset + 1] = 0
          outPtr[offset + 2] = 0
          outPtr[offset + 3] = 0 // transparent
        }
      }
    }

    guard let keyedCG = ctx.makeImage() else { return nil }
    return saveTransparentPNG(cgImage: keyedCG, originalSize: CGSize(width: w, height: h))
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
