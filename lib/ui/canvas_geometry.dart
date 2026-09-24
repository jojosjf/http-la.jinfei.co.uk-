import 'package:flutter/widgets.dart';

import '../models/guide_lines.dart';

/// 画布几何：图片在视口中按比例居中显示，四周留出放手柄的区域；
/// 负责原图像素坐标与屏幕坐标之间的换算。
@immutable
class CanvasGeometry {
  factory CanvasGeometry({
    required Size viewport,
    required double imageWidth,
    required double imageHeight,
    Matrix4? transform,
  }) {
    final avail = (Offset.zero & viewport).deflate(handleBand);
    var fit = avail.width / imageWidth;
    if (avail.height / imageHeight < fit) fit = avail.height / imageHeight;
    if (fit < 0) fit = 0;
    final rect = Rect.fromCenter(
      center: avail.center,
      width: imageWidth * fit,
      height: imageHeight * fit,
    );
    final m = transform ?? Matrix4.identity();
    return CanvasGeometry._(
      viewport,
      fit,
      rect,
      m.getMaxScaleOnAxis(),
      Offset(m.storage[12], m.storage[13]),
    );
  }

  const CanvasGeometry._(
      this.viewport, this.fitScale, this.imageRect, this.zoom, this.pan);

  /// 视口四周放手柄的区域宽度（逻辑像素），等于手柄触摸直径。
  static const double handleBand = 44;

  final Size viewport;

  /// 1 原图像素在未缩放画布上的逻辑像素数。
  final double fitScale;

  /// 图片在未缩放画布上的位置。
  final Rect imageRect;

  /// 当前缩放倍数与平移量（来自画布的变换矩阵，只含缩放和平移）。
  final double zoom;
  final Offset pan;

  /// 1 原图像素在屏幕上的逻辑像素数。
  double get screenPerImagePixel => zoom * fitScale;

  double xToScreen(double px) =>
      zoom * (imageRect.left + px * fitScale) + pan.dx;

  double yToScreen(double py) =>
      zoom * (imageRect.top + py * fitScale) + pan.dy;

  /// 屏幕上的位移换算成原图像素。
  double screenToImage(double delta) =>
      screenPerImagePixel == 0 ? 0 : delta / screenPerImagePixel;

  /// 图片在屏幕上的位置（可能超出视口）。
  Rect get screenImageRect => Rect.fromLTRB(
        xToScreen(0),
        yToScreen(0),
        zoom * imageRect.right + pan.dx,
        zoom * imageRect.bottom + pan.dy,
      );

  /// 手柄中心。竖线：外框线手柄在图片上方，内框线在下方；
  /// 横线：外框线在左侧，内框线在右侧。手柄始终保持在视口内。
  Offset handleCenter(LineId id, GuideLines lines) {
    const half = handleBand / 2;
    final img = screenImageRect;
    if (id.isVertical) {
      final x = xToScreen(lines[id]);
      final y = id.isOuter
          ? _clamp(img.top - half, half, viewport.height - half)
          : _clamp(img.bottom + half, half, viewport.height - half);
      return Offset(x, y);
    } else {
      final y = yToScreen(lines[id]);
      final x = id.isOuter
          ? _clamp(img.left - half, half, viewport.width - half)
          : _clamp(img.right + half, half, viewport.width - half);
      return Offset(x, y);
    }
  }

  static double _clamp(double v, double lo, double hi) =>
      v < lo ? lo : (v > hi ? hi : v);

  @override
  bool operator ==(Object other) =>
      other is CanvasGeometry &&
      other.viewport == viewport &&
      other.fitScale == fitScale &&
      other.imageRect == imageRect &&
      other.zoom == zoom &&
      other.pan == pan;

  @override
  int get hashCode => Object.hash(viewport, fitScale, imageRect, zoom, pan);
}
