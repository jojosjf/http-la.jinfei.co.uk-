import 'package:flutter/material.dart';

import '../models/guide_lines.dart';
import 'canvas_geometry.dart';

const Color outerLineColor = Color(0xFF00E5FF);
const Color innerLineColor = Color(0xFFFF4081);
const Color selectedLineColor = Color(0xFFFFEA00);

/// 在图片上方绘制 8 条参考线和它们的手柄。
class GuidePainter extends CustomPainter {
  GuidePainter({
    required this.geometry,
    required this.lines,
    required this.selected,
  });

  final CanvasGeometry geometry;
  final GuideLines lines;
  final LineId? selected;

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
      // 线贯穿图片，并延伸到手柄。
      if (id.isVertical) {
        final x = handle.dx;
        final top = handle.dy < img.top ? handle.dy : img.top;
        final bottom = handle.dy > img.bottom ? handle.dy : img.bottom;
        canvas.drawLine(Offset(x, top), Offset(x, bottom), line);
      } else {
        final y = handle.dy;
        final left = handle.dx < img.left ? handle.dx : img.left;
        final right = handle.dx > img.right ? handle.dx : img.right;
        canvas.drawLine(Offset(left, y), Offset(right, y), line);
      }
      _paintHandle(canvas, handle, id, color, isSel);
    }
  }

  void _paintHandle(
      Canvas canvas, Offset c, LineId id, Color color, bool isSel) {
    final r = isSel ? 13.0 : 11.0;
    canvas.drawCircle(c, r + 2, Paint()..color = Colors.white);
    canvas.drawCircle(c, r, Paint()..color = color);
    // 手柄上画一对小箭头，提示可拖动的方向。
    final arrow = Paint()
      ..color = Colors.black87
      ..strokeWidth = 1.6
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round;
    const a = 5.0, b = 3.0;
    if (id.isVertical) {
      canvas.drawPath(
          Path()
            ..moveTo(c.dx - a + b, c.dy - b)
            ..lineTo(c.dx - a, c.dy)
            ..lineTo(c.dx - a + b, c.dy + b)
            ..moveTo(c.dx + a - b, c.dy - b)
            ..lineTo(c.dx + a, c.dy)
            ..lineTo(c.dx + a - b, c.dy + b),
          arrow);
    } else {
      canvas.drawPath(
          Path()
            ..moveTo(c.dx - b, c.dy - a + b)
            ..lineTo(c.dx, c.dy - a)
            ..lineTo(c.dx + b, c.dy - a + b)
            ..moveTo(c.dx - b, c.dy + a - b)
            ..lineTo(c.dx, c.dy + a)
            ..lineTo(c.dx + b, c.dy + a - b),
          arrow);
    }
  }

  @override
  bool shouldRepaint(GuidePainter old) =>
      old.lines != lines ||
      old.selected != selected ||
      old.geometry != geometry;
}
