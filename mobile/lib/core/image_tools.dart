import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:image/image.dart' as img;

enum ImageOutput { jpg, png, webp }

extension ImageOutputX on ImageOutput {
  String get label => switch (this) { ImageOutput.jpg => 'JPG', ImageOutput.png => 'PNG', ImageOutput.webp => 'WEBP' };
  String get ext => switch (this) { ImageOutput.jpg => 'jpg', ImageOutput.png => 'png', ImageOutput.webp => 'webp' };
  bool get lossy => this != ImageOutput.png;
}

class ImageJobResult {
  ImageJobResult({
    required this.bytes,
    required this.width,
    required this.height,
    required this.originalBytes,
  });

  final Uint8List bytes;
  final int width;
  final int height;
  final int originalBytes;

  int get size => bytes.length;
  double get saving => originalBytes == 0 ? 0 : (originalBytes - size) / originalBytes;
}

class _JobRequest {
  _JobRequest(this.bytes, this.output, this.quality, this.targetWidth, this.targetHeight);
  final Uint8List bytes;
  final ImageOutput output;
  final int quality;
  final int? targetWidth;
  final int? targetHeight;
}

/// Runs on a background isolate — a 4000px photo would jank the UI otherwise.
ImageJobResult _process(_JobRequest r) {
  final decoded = img.decodeImage(r.bytes);
  if (decoded == null) {
    throw const FormatException('That file is not an image this device can read.');
  }

  var image = decoded;

  if (r.targetWidth != null || r.targetHeight != null) {
    image = img.copyResize(
      image,
      width: r.targetWidth,
      height: r.targetHeight,
      interpolation: img.Interpolation.cubic,
      maintainAspect: r.targetWidth == null || r.targetHeight == null,
    );
  }

  // JPG has no alpha channel: flatten onto white rather than emit black boxes
  if (r.output == ImageOutput.jpg && image.hasAlpha) {
    final flat = img.Image(width: image.width, height: image.height, numChannels: 3);
    img.fill(flat, color: img.ColorRgb8(255, 255, 255));
    img.compositeImage(flat, image);
    image = flat;
  }

  final out = switch (r.output) {
    ImageOutput.jpg => img.encodeJpg(image, quality: r.quality),
    ImageOutput.png => img.encodePng(image),
    ImageOutput.webp => img.encodeJpg(image, quality: r.quality), // webp encoding is not available on-device
  };

  return ImageJobResult(
    bytes: Uint8List.fromList(out),
    width: image.width,
    height: image.height,
    originalBytes: r.bytes.length,
  );
}

class ImageTools {
  ImageTools._();

  /// WEBP can be decoded but not encoded by package:image, so the picker hides it.
  static const supportedOutputs = [ImageOutput.jpg, ImageOutput.png];

  static Future<ImageJobResult> run(
    File file, {
    required ImageOutput output,
    int quality = 85,
    int? width,
    int? height,
  }) async {
    final bytes = await file.readAsBytes();
    return compute(_process, _JobRequest(bytes, output, quality, width, height));
  }

  static Future<({int width, int height})?> dimensions(File file) async {
    try {
      final decoded = img.decodeImage(await file.readAsBytes());
      if (decoded == null) return null;
      return (width: decoded.width, height: decoded.height);
    } catch (_) {
      return null;
    }
  }
}
