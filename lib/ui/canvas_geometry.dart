import 'package:flutter/widgets.dart';

import '../models/guide_lines.dart';

/// 画布几何：图片在视口中按比例放到最大并居中显示；
/// 负责原图像素坐标与屏幕坐标之间的换算，以及手柄标签的摆放。
@immutable
class CanvasGeometry {
  factory CanvasGeometry({
    required Size viewport,
    required double imageWidth,
    required double imageHeight,
    Matrix4? transform,
  }) {
    final avail = Offset.zero & viewport;
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
    this.viewport,
    this.fitScale,
    this.imageRect,
    this.zoom,
    this.pan,
  );

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

  /// 手柄标签的大小：上下两边的标签横放（图示在左、文字在右），
  /// 左右两边的标签竖放（图示在上、文字在下）。
  static const Size horizontalLineHandleSize = Size(76, 36);
  static const Size verticalLineHandleSize = Size(44, 60);

  /// 手柄标签在屏幕上的区域，也是它的触摸区域。
  ///
  /// 每条边的两个标签放在这条边的中间：外框标签在线的外侧，内框标签
  /// 在线的内侧，中间隔着边框，不会重叠。放大后标签沿线移动，停在屏幕上
  /// 可见的那一段，并且整个标签保持在视口内。
  Rect handleRect(LineId id, GuideLines lines) {
    const gap = 2.0;
    final visible = screenImageRect.intersect(Offset.zero & viewport);
    // 朝外：上边的外框线往上、下边的外框线往下；内框线相反。
    final outward = id.isStartSide == id.isOuter;
    Rect r;
    if (id.isVertical) {
      final size = verticalLineHandleSize;
      final x = xToScreen(lines[id]);
      final mid =
          (yToScreen(lines.outerTop) + yToScreen(lines.outerBottom)) / 2;
      final y = _clampInto(mid, visible.top, visible.bottom, size.height);
      final left = outward ? x - gap - size.width : x + gap;
      r = Rect.fromLTWH(left, y - size.height / 2, size.width, size.height);
    } else {
      final size = horizontalLineHandleSize;
      final y = yToScreen(lines[id]);
      final mid =
          (xToScreen(lines.outerLeft) + xToScreen(lines.outerRight)) / 2;
      final x = _clampInto(mid, visible.left, visible.right, size.width);
      final top = outward ? y - gap - size.height : y + gap;
      r = Rect.fromLTWH(x - size.width / 2, top, size.width, size.height);
    }
    // 整个标签保持在视口内（卡片贴着照片边缘时，外框标签会被推回来）。
    final dx = r.left < 0
        ? -r.left
        : (r.right > viewport.width ? viewport.width - r.right : 0.0);
    final dy = r.top < 0
        ? -r.top
        : (r.bottom > viewport.height ? viewport.height - r.bottom : 0.0);
    return r.shift(Offset(dx, dy));
  }

  /// 标签中心。
  Offset handleCenter(LineId id, GuideLines lines) =>
      handleRect(id, lines).center;

  /// 把长度为 [extent] 的标签中心 [v] 夹在 [lo, hi] 区间内；区间放不下时居中。
  static double _clampInto(double v, double lo, double hi, double extent) {
    final a = lo + extent / 2, b = hi - extent / 2;
    if (a > b) return (lo + hi) / 2;
    return _clamp(v, a, b);
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
