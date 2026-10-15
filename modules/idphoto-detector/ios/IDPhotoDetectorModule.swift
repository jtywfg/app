import ExpoModulesCore
import Foundation
import ImageIO
import Vision
import CoreGraphics
import UIKit
import CoreImage
import CoreVideo

public class IDPhotoDetectorModule: Module {
  public func definition() -> ModuleDefinition {
    Name("PinPicIDPhotoDetector")

    AsyncFunction("detectFace") { (uri: URL) -> [String: Any] in
      guard let source = CGImageSourceCreateWithURL(uri as CFURL, nil),
            let image = CGImageSourceCreateImageAtIndex(source, 0, nil) else {
        throw NSError(domain: "PinPicIDPhoto", code: 1, userInfo: [NSLocalizedDescriptionKey: "无法读取照片。"])
      }
      let request = VNDetectFaceRectanglesRequest()
      request.usesCPUOnly = true
      try VNImageRequestHandler(cgImage: image, options: [:]).perform([request])
      let faces = request.results ?? []
      guard faces.count == 1, let face = faces.first else {
        return ["valid": false, "reason": faces.isEmpty ? "没有检测到清晰正脸，请选择正面、光线充足的单人照片。" : "照片中检测到多个人，请选择只包含一人的照片。"]
      }
      let box = face.boundingBox
      let normalized = ["x": box.origin.x, "y": 1 - box.origin.y - box.height, "width": box.width, "height": box.height]
      let valid = box.width > 0.055 && box.height > 0.075 && box.width < 0.72 && box.height < 0.78 && box.midX > 0.15 && box.midX < 0.85 && box.midY > 0.20 && box.midY < 0.88
      return ["valid": valid, "reason": valid ? "" : "人像位置或大小不符合证件照要求，请调整后重新选择。", "face": normalized]
    }

    AsyncFunction("replaceBackground") { (uri: URL, colorHex: String, beauty: Int, makeup: Int) async throws -> [String: Any] in
      guard let source = CGImageSourceCreateWithURL(uri as CFURL, nil),
            let image = CGImageSourceCreateImageAtIndex(source, 0, nil) else {
        throw NSError(domain: "PinPicIDPhoto", code: 2, userInfo: [NSLocalizedDescriptionKey: "无法处理照片。"])
      }
      let width = image.width
      let height = image.height
      guard width * height <= 1_600_000 else {
        throw NSError(domain: "PinPicIDPhoto", code: 3, userInfo: [NSLocalizedDescriptionKey: "照片尺寸过大，请重新选取或裁剪照片。"])
      }
      // Apple's on-device person segmentation includes the whole person,
      // rather than treating similarly colored clothing as background.
      let request = VNGeneratePersonSegmentationRequest()
      request.qualityLevel = .accurate
      request.outputPixelFormat = kCVPixelFormatType_OneComponent8
      let faceRequest = VNDetectFaceRectanglesRequest()
      let handler = VNImageRequestHandler(cgImage: image, options: [:])
      try handler.perform([request])
      if beauty > 0 || makeup > 0 { try handler.perform([faceRequest]) }
      guard let observation = request.results?.first else {
        throw NSError(domain: "PinPicIDPhoto", code: 4, userInfo: [NSLocalizedDescriptionKey: "未能识别人物，请更换清晰的单人照片。"])
      }
      let maskImage = CIImage(cvPixelBuffer: observation.pixelBuffer)
      let scaledMask = maskImage.transformed(by: CGAffineTransform(
        scaleX: CGFloat(width) / maskImage.extent.width,
        y: CGFloat(height) / maskImage.extent.height
      ))
      guard let maskCG = CIContext().createCGImage(scaledMask, from: CGRect(x: 0, y: 0, width: width, height: height)) else {
        throw NSError(domain: "PinPicIDPhoto", code: 5, userInfo: [NSLocalizedDescriptionKey: "无法生成人像分割。"])
      }
      var mask = [UInt8](repeating: 0, count: width * height)
      let maskDecoded = mask.withUnsafeMutableBytes { buffer -> Bool in
        guard let context = CGContext(data: buffer.baseAddress, width: width, height: height, bitsPerComponent: 8, bytesPerRow: width, space: CGColorSpaceCreateDeviceGray(), bitmapInfo: CGImageAlphaInfo.none.rawValue) else { return false }
        context.interpolationQuality = .high
        context.draw(maskCG, in: CGRect(x: 0, y: 0, width: width, height: height))
        return true
      }
      var pixels = [UInt8](repeating: 0, count: width * height * 4)
      let decoded = pixels.withUnsafeMutableBytes { buffer -> Bool in
        guard let context = CGContext(data: buffer.baseAddress, width: width, height: height, bitsPerComponent: 8, bytesPerRow: width * 4, space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue | CGBitmapInfo.byteOrder32Big.rawValue) else { return false }
        context.draw(image, in: CGRect(x: 0, y: 0, width: width, height: height))
        return true
      }
      guard decoded && maskDecoded else {
        throw NSError(domain: "PinPicIDPhoto", code: 6, userInfo: [NSLocalizedDescriptionKey: "无法解码照片。"])
      }
      let hex = colorHex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
      let color = UInt64(hex, radix: 16) ?? 0x438EFF
      let background = [Double((color >> 16) & 255), Double((color >> 8) & 255), Double(color & 255)]
      let face = faceRequest.results?.first?.boundingBox
      var foregroundCount = 0
      for index in 0..<(width * height) {
        let offset = index * 4
        let alpha = max(0, min(1, (Double(mask[index]) / 255 - 0.1) / 0.8))
        if alpha > 0.95 { foregroundCount += 1 }
        var weight = 0.0
        if let face, alpha > 0.95 {
          let x = Double(index % width) / Double(width)
          let y = Double(index / width) / Double(height)
          let dx = (x - face.midX) / max(0.001, face.width / 2)
          let dy = (y - (1 - face.midY)) / max(0.001, face.height / 2)
          weight = max(0, 1 - dx * dx - dy * dy)
        }
        let light = 1.0 + Double(max(0, min(beauty, 3))) * 0.035 * weight
        let warmth = Double(max(0, min(makeup, 3))) * 3 * weight
        let shifts = [warmth, warmth / 2, -warmth / 2]
        for channel in 0..<3 {
          let retained = max(0, min(255, Double(pixels[offset + channel]) * light + shifts[channel]))
          pixels[offset + channel] = UInt8(max(0, min(255, (retained * alpha + background[channel] * (1 - alpha)).rounded())))
        }
        pixels[offset + 3] = 255
      }
      guard foregroundCount > width * height / 50 && foregroundCount < width * height * 99 / 100 else {
        throw NSError(domain: "PinPicIDPhoto", code: 7, userInfo: [NSLocalizedDescriptionKey: "未能可靠分离人物与背景，请选用正面、清晰的单人照片。"])
      }
      let output = pixels.withUnsafeMutableBytes { buffer -> CGImage? in
        CGContext(data: buffer.baseAddress, width: width, height: height, bitsPerComponent: 8, bytesPerRow: width * 4, space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue | CGBitmapInfo.byteOrder32Big.rawValue)?.makeImage()
      }
      guard let output, let data = UIImage(cgImage: output).pngData() else {
        throw NSError(domain: "PinPicIDPhoto", code: 8, userInfo: [NSLocalizedDescriptionKey: "合成背景失败。"])
      }
      let destination = FileManager.default.temporaryDirectory.appendingPathComponent("PinPic_ID_\(UUID().uuidString).png")
      try data.write(to: destination)
      return ["uri": destination.absoluteString, "width": width, "height": height]
    }
  }
}
