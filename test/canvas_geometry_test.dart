import 'package:card_centering/models/guide_lines.dart';
import 'package:card_centering/ui/canvas_geometry.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  const viewport = Size(400, 700);
  const w = 3000.0, h = 4000.0;

  test('未缩放时图片居中，四周留出手柄区', () {
    final g = CanvasGeometry(viewport: viewport, imageWidth: w, imageHeight: h);
    expect(g.imageRect.left, closeTo(44, 1e-9));
    expect(g.imageRect.width, closeTo(312, 1e-9));
    expect(g.imageRect.center, const Offset(200, 350));
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
    // 1 原图像素 = 8 × (312 / 3000) 逻辑像素
    expect(g.screenToImage(8 * 312 / 3000), closeTo(1, 1e-9));
  });

  test('放大后手柄仍停在视口内', () {
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
    for (final id in LineId.values) {
      final c = g.handleCenter(id, lines);
      if (id.isVertical) {
        expect(
          c.dy,
          inInclusiveRange(22, viewport.height - 22),
          reason: id.name,
        );
      } else {
        expect(
          c.dx,
          inInclusiveRange(22, viewport.width - 22),
          reason: id.name,
        );
      }
    }
  });
}
