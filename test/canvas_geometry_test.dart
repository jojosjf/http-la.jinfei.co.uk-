import 'package:card_centering/models/guide_lines.dart';
import 'package:card_centering/ui/canvas_geometry.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  const viewport = Size(400, 700);
  const w = 3000.0, h = 4000.0;

  test('未缩放时图片按视口放到最大并居中', () {
    final g = CanvasGeometry(viewport: viewport, imageWidth: w, imageHeight: h);
    // 3000×4000 放进 400×700：宽度先顶满
    expect(g.imageRect.left, closeTo(0, 1e-9));
    expect(g.imageRect.width, closeTo(400, 1e-9));
    expect(g.imageRect.height, closeTo(400 * 4000 / 3000, 1e-9));
    expect(g.imageRect.center.dx, closeTo(200, 1e-9));
    expect(g.imageRect.center.dy, closeTo(350, 1e-9));
  });

  test('8 倍缩放 + 平移时，线的位置与图片用同一个矩阵换算', () {
    final m = Matrix4.identity()
      ..translateByDouble(-900, -1300, 0, 1)
      ..scaleByDouble(8, 8, 1, 1);
    final g = CanvasGeometry(
      viewport: viewport,
      imageWidth: w,
      imageHeight: h,
      transform: m,
    );
    final base = CanvasGeometry(
      viewport: viewport,
      imageWidth: w,
      imageHeight: h,
    );
    for (final p in [
      const Offset(0, 0),
      const Offset(240, 320),
      const Offset(2999, 3999),
    ]) {
      // 图片上某个像素在未缩放画布上的位置，经过同一矩阵变换后应与线的位置一致。
      final child = Offset(
        base.imageRect.left + p.dx * base.fitScale,
        base.imageRect.top + p.dy * base.fitScale,
      );
      final screen = MatrixUtils.transformPoint(m, child);
      expect(g.xToScreen(p.dx), closeTo(screen.dx, 1e-9));
      expect(g.yToScreen(p.dy), closeTo(screen.dy, 1e-9));
    }
  });

  test('屏幕位移除以缩放倍数换算成原图像素', () {
    final m = Matrix4.identity()..scaleByDouble(8, 8, 1, 1);
    final g = CanvasGeometry(
      viewport: viewport,
      imageWidth: w,
      imageHeight: h,
      transform: m,
    );
    // 1 原图像素 = 8 × (400 / 3000) 逻辑像素
    expect(g.screenToImage(8 * 400 / 3000), closeTo(1, 1e-9));
  });

  test('放大后手柄标签仍完整留在视口内', () {
    final m = Matrix4.identity()
      ..translateByDouble(-1400, -2450, 0, 1)
      ..scaleByDouble(8, 8, 1, 1);
    final g = CanvasGeometry(
      viewport: viewport,
      imageWidth: w,
      imageHeight: h,
      transform: m,
    );
    final lines = GuideLines.defaults(w, h);
    final screen = Offset.zero & viewport;
    for (final id in LineId.values) {
      final r = g.handleRect(id, lines);
      expect(screen.intersect(r), r, reason: id.name);
    }
  });

  test('标签在每条边的中间，外框在线外侧、内框在线内侧', () {
    final g = CanvasGeometry(viewport: viewport, imageWidth: w, imageHeight: h);
    // 卡片离照片边缘留有足够空间，外框标签才放得进线外侧。
    final l = GuideLines(
      outerLeft: 600,
      innerLeft: 900,
      innerRight: 2100,
      outerRight: 2400,
      outerTop: 900,
      innerTop: 1200,
      innerBottom: 2800,
      outerBottom: 3100,
    );
    final cx = (g.xToScreen(l.outerLeft) + g.xToScreen(l.outerRight)) / 2;
    final cy = (g.yToScreen(l.outerTop) + g.yToScreen(l.outerBottom)) / 2;
    Rect r(LineId id) => g.handleRect(id, l);
    double x(LineId id) => g.xToScreen(l[id]);
    double y(LineId id) => g.yToScreen(l[id]);

    for (final id in [
      LineId.outerTop,
      LineId.innerTop,
      LineId.innerBottom,
      LineId.outerBottom,
    ]) {
      expect(r(id).center.dx, closeTo(cx, 1e-9), reason: id.name);
    }
    for (final id in [
      LineId.outerLeft,
      LineId.innerLeft,
      LineId.innerRight,
      LineId.outerRight,
    ]) {
      expect(r(id).center.dy, closeTo(cy, 1e-9), reason: id.name);
    }
    expect(r(LineId.outerTop).bottom, lessThan(y(LineId.outerTop)));
    expect(r(LineId.innerTop).top, greaterThan(y(LineId.innerTop)));
    expect(r(LineId.innerBottom).bottom, lessThan(y(LineId.innerBottom)));
    expect(r(LineId.outerBottom).top, greaterThan(y(LineId.outerBottom)));
    expect(r(LineId.outerLeft).right, lessThan(x(LineId.outerLeft)));
    expect(r(LineId.innerLeft).left, greaterThan(x(LineId.innerLeft)));
    expect(r(LineId.innerRight).right, lessThan(x(LineId.innerRight)));
    expect(r(LineId.outerRight).left, greaterThan(x(LineId.outerRight)));
  });
}
