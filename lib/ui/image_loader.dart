import 'dart:math' as math;
import 'dart:typed_data';
import 'dart:ui' as ui;

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
/// 超过 [maxDisplayPixels] 的图直接按比例解码成缩略图，避免占用大量内存。
Future<LoadedImage> decodeForDisplay(Uint8List bytes) async {
  final buffer = await ui.ImmutableBuffer.fromUint8List(bytes);
  final descriptor = await ui.ImageDescriptor.encoded(buffer);

  // 网页端拿不到原图尺寸，交给浏览器完整解码。
  int? w, h;
  try {
    w = descriptor.width;
    h = descriptor.height;
  } on UnsupportedError {
    w = h = null;
  }

  int? targetWidth;
  if (w != null && h != null && w * h > maxDisplayPixels) {
    targetWidth = (w * math.sqrt(maxDisplayPixels / (w * h))).round();
  }

  final ui.Codec codec;
  try {
    codec = await descriptor.instantiateCodec(targetWidth: targetWidth);
  } finally {
    descriptor.dispose();
    buffer.dispose();
  }
  final frame = await codec.getNextFrame();
  codec.dispose();
  final image = frame.image;

  var ow = (w ?? image.width).toDouble();
  var oh = (h ?? image.height).toDouble();
  // 描述符给的是未旋转的尺寸；EXIF 旋转 90° 的图解码后宽高互换。
  if ((image.width > image.height) != (ow > oh) && image.width != image.height) {
    final t = ow;
    ow = oh;
    oh = t;
  }
  return LoadedImage(image, ow, oh);
}
