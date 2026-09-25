import 'dart:math' as math;
import 'dart:ui' as ui;

import 'package:flutter/foundation.dart';

/// 超过这个像素数的图片只解码一张缩小的显示图。
const int maxDisplayPixels = 12000000;

/// 已解码、可显示的图片。
class LoadedImage {
  LoadedImage(this.image, this.width, this.height);

  /// 显示用图片，可能比原图小。
  final ui.Image image;

  /// 原图尺寸（已按 EXIF 摆正），参考线坐标以此为准。
  final double width, height;

  /// 显示图每像素对应的原图像素数。
  double get displayToOriginal => width / image.width;

  void dispose() => image.dispose();
}

/// 解码图片。解码由引擎在后台线程完成，并按 EXIF 摆正方向；
/// 超过 [maxPixels] 的图直接按比例解码成缩略图，避免占用大量内存。
Future<LoadedImage> decodeForDisplay(
  Uint8List bytes, {
  int maxPixels = maxDisplayPixels,
}) async {
  int? w, h;
  final ui.Codec codec;
  if (kIsWeb) {
    // 网页端解码前拿不到原图尺寸，交给浏览器完整解码。
    codec = await ui.instantiateImageCodec(bytes);
  } else {
    // 注意：不能自己创建 ImageDescriptor 并在取帧前释放它——解码发生在
    // getNextFrame 时，提前释放会导致引擎解码线程崩溃。这里交给引擎管理，
    // buffer 也由它负责释放。
    final buffer = await ui.ImmutableBuffer.fromUint8List(bytes);
    codec = await ui.instantiateImageCodecWithSize(
      buffer,
      getTargetSize: (iw, ih) {
        w = iw;
        h = ih;
        if (iw * ih <= maxPixels) return const ui.TargetImageSize();
        return ui.TargetImageSize(
          width: (iw * math.sqrt(maxPixels / (iw * ih))).round(),
        );
      },
    );
  }
  final ui.FrameInfo frame;
  try {
    frame = await codec.getNextFrame();
  } finally {
    codec.dispose();
  }
  final image = frame.image;

  var ow = (w ?? image.width).toDouble();
  var oh = (h ?? image.height).toDouble();
  // 引擎给的是未旋转的尺寸；EXIF 旋转 90° 的图解码后宽高互换。
  if ((image.width > image.height) != (ow > oh) &&
      image.width != image.height) {
    final t = ow;
    ow = oh;
    oh = t;
  }
  return LoadedImage(image, ow, oh);
}
