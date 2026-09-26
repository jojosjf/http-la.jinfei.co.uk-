import 'package:flutter/material.dart';

import '../models/guide_lines.dart';
import 'canvas_geometry.dart';

const Color outerLineColor = Color(0xFF00E5FF);
const Color innerLineColor = Color(0xFFFF4081);
const Color selectedLineColor = Color(0xFFFFEA00);

/// 在图片上方绘制 8 条参考线和它们的手柄。
///
/// 外框线与内框线用三重方式区分：颜色（青 / 粉）、线型（长虚线 / 短虚线）、
/// 手柄标签（双框小图示高亮要对准的那条边，旁边写“外左”“内上”等）。
class GuidePainter extends CustomPainter {
  GuidePainter({
    required this.geometry,
    required this.lines,
    required this.selected,
    required this.labelOf,
    required this.labelStyle,
    this.showHandles = true,
  });

  final CanvasGeometry geometry;
  final GuideLines lines;
  final LineId? selected;

  /// 手柄上的文字，如“外左”“内上”。
  final String Function(LineId id) labelOf;
  final TextStyle labelStyle;

  /// 是否画手柄标签。拖线时隐藏，免得标签被放大镜放大、挡住卡片边缘。
  final bool showHandles;

  /// 外框线长虚线、内框线短虚线：空隙露出底下的卡片边缘，不会把边缘挡住。
  static const double _outerDash = 14, _outerGap = 6;
  static const double _innerDash = 5, _innerGap = 5;

  static Color colorOf(LineId id, {required bool selected}) => selected
      ? selectedLineColor
      : (id.isOuter ? outerLineColor : innerLineColor);

  @override
  void paint(Canvas canvas, Size size) {
    canvas.clipRect(Offset.zero & size);
    final img = geometry.screenImageRect;

    // 选中的线最后画，压在其他线上面。
    final order = [
      for (final id in LineId.values)
        if (id != selected) id,
      if (selected != null) selected!,
    ];
    for (final id in order) {
      final isSel = id == selected;
      final color = colorOf(id, selected: isSel);
      final handle = geometry.handleCenter(id, lines);
      final line = Paint()
        ..color = color
        ..strokeWidth = isSel ? 2.5 : 1.5;
      // 线贯穿图片。外框线长虚线，内框线短虚线。
      if (id.isVertical) {
        final x = geometry.xToScreen(lines[id]);
        _drawLine(canvas, id.isOuter, true, x, img.top, img.bottom, line);
      } else {
        final y = geometry.yToScreen(lines[id]);
        _drawLine(canvas, id.isOuter, false, y, img.left, img.right, line);
      }
      if (showHandles) _paintHandle(canvas, handle, id, color, isSel);
    }
  }

  /// 画一条水平或竖直的虚线。[at] 是线所在的 x（竖线）或 y（横线），
  /// [from]–[to] 是线的另一方向的范围。外框线长虚线、内框线短虚线；
  /// 虚线的起点对齐到屏幕坐标，拖动时纹路不会跟着滑动。
  void _drawLine(
    Canvas canvas,
    bool outer,
    bool vertical,
    double at,
    double from,
    double to,
    Paint paint,
  ) {
    Offset p(double t) => vertical ? Offset(at, t) : Offset(t, at);
    final dash = outer ? _outerDash : _innerDash;
    final period = dash + (outer ? _outerGap : _innerGap);
    var start = (from / period).floorToDouble() * period;
    for (; start < to; start += period) {
      final a = start < from ? from : start;
      final b = start + dash > to ? to : start + dash;
      if (b > a) canvas.drawLine(p(a), p(b), paint);
    }
  }

  void _paintHandle(
    Canvas canvas,
    Offset c,
    LineId id,
    Color color,
    bool isSel,
  ) {
    final rect = geometry.handleRect(id, lines);
    final rr = RRect.fromRectAndRadius(rect, const Radius.circular(10));
    canvas.drawRRect(rr, Paint()..color = const Color(0xD91C1C1E));
    if (isSel) {
      canvas.drawRRect(
        rr.deflate(1),
        Paint()
          ..color = color
          ..style = PaintingStyle.stroke
          ..strokeWidth = 2,
      );
    }
    final text = TextPainter(
      text: TextSpan(
        text: labelOf(id),
        style: labelStyle.copyWith(
          color: color,
          fontSize: 13,
          fontWeight: FontWeight.w700,
          height: 1,
        ),
      ),
      textDirection: TextDirection.ltr,
    )..layout();
    // 左右两边的标签竖放：图示在上、文字在下；上下两边的标签横放：图示在左、文字在右。
    final Offset glyphAt, textAt;
    if (id.isVertical) {
      glyphAt = Offset(rect.center.dx, rect.top + 19);
      textAt = Offset(rect.center.dx, rect.bottom - 13);
    } else {
      glyphAt = Offset(rect.left + 18, rect.center.dy);
      textAt = Offset(rect.left + 50, rect.center.dy);
    }
    _paintGlyph(canvas, glyphAt, id, color);
    text.paint(canvas, textAt - Offset(text.width / 2, text.height / 2));
    text.dispose();
  }

  /// 双框小卡片：外框套内框，用线的颜色高亮这条线要对准的那一条边。
  void _paintGlyph(Canvas canvas, Offset c, LineId id, Color color) {
    final outer = Rect.fromCenter(center: c, width: 18, height: 25);
    final inner = Rect.fromCenter(center: c, width: 10, height: 15);
    final stroke = Paint()
      ..color = const Color(0xFFC8C8CD)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.2;
    canvas.drawRect(outer, stroke);
    canvas.drawRect(inner, stroke);
    final r = id.isOuter ? outer : inner;
    final edge = switch (id) {
      LineId.outerLeft || LineId.innerLeft => [r.topLeft, r.bottomLeft],
      LineId.outerRight || LineId.innerRight => [r.topRight, r.bottomRight],
      LineId.outerTop || LineId.innerTop => [r.topLeft, r.topRight],
      LineId.outerBottom || LineId.innerBottom => [r.bottomLeft, r.bottomRight],
    };
    canvas.drawLine(
      edge[0],
      edge[1],
      Paint()
        ..color = color
        ..strokeWidth = 3
        ..strokeCap = StrokeCap.square,
    );
  }

  @override
  bool shouldRepaint(GuidePainter oldDelegate) =>
      oldDelegate.lines != lines ||
      oldDelegate.selected != selected ||
      oldDelegate.geometry != geometry ||
      oldDelegate.labelStyle != labelStyle ||
      oldDelegate.showHandles != showHandles;
}
