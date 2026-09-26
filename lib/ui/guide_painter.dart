import 'package:flutter/material.dart';

import '../models/guide_lines.dart';
import 'canvas_geometry.dart';

const Color outerLineColor = Color(0xFF00E5FF);
const Color innerLineColor = Color(0xFFFF4081);
const Color selectedLineColor = Color(0xFFFFEA00);

/// 在图片上方绘制 8 条参考线和它们的手柄。
///
/// 外框线与内框线用三重方式区分：颜色（青 / 粉）、线型（实线 / 虚线）、
/// 手柄标签（双框小图示高亮要对准的那条边，旁边写“外左”“内上”等）。
class GuidePainter extends CustomPainter {
  GuidePainter({
    required this.geometry,
    required this.lines,
    required this.selected,
    required this.labelOf,
    required this.labelStyle,
  });

  final CanvasGeometry geometry;
  final GuideLines lines;
  final LineId? selected;

  /// 手柄上的文字，如“外左”“内上”。
  final String Function(LineId id) labelOf;
  final TextStyle labelStyle;

  static const double _dash = 6, _gap = 4;

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
      // 线贯穿图片，并延伸到手柄。外框线实线，内框线虚线。
      if (id.isVertical) {
        final x = handle.dx;
        final top = handle.dy < img.top ? handle.dy : img.top;
        final bottom = handle.dy > img.bottom ? handle.dy : img.bottom;
        _drawLine(canvas, id.isOuter, true, x, top, bottom, line);
      } else {
        final y = handle.dy;
        final left = handle.dx < img.left ? handle.dx : img.left;
        final right = handle.dx > img.right ? handle.dx : img.right;
        _drawLine(canvas, id.isOuter, false, y, left, right, line);
      }
      _paintHandle(canvas, handle, id, color, isSel);
    }
  }

  /// 画一条水平或竖直的线。[at] 是线所在的 x（竖线）或 y（横线），
  /// [from]–[to] 是线的另一方向的范围。虚线的起点对齐到屏幕坐标，
  /// 拖动时纹路不会跟着滑动。
  void _drawLine(
    Canvas canvas,
    bool solid,
    bool vertical,
    double at,
    double from,
    double to,
    Paint paint,
  ) {
    Offset p(double t) => vertical ? Offset(at, t) : Offset(t, at);
    if (solid) {
      canvas.drawLine(p(from), p(to), paint);
      return;
    }
    const period = _dash + _gap;
    var start = (from / period).floorToDouble() * period;
    for (; start < to; start += period) {
      final a = start < from ? from : start;
      final b = start + _dash > to ? to : start + _dash;
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
    // 图示总是靠着线的那一侧，文字在另一侧。
    final Offset glyphAt, textAt;
    if (id.isVertical) {
      final y = rect.center.dy;
      glyphAt = Offset(id.isStartSide ? rect.left + 19 : rect.right - 19, y);
      textAt = Offset(id.isStartSide ? rect.left + 53 : rect.right - 53, y);
    } else {
      final x = rect.center.dx;
      glyphAt = Offset(x, id.isStartSide ? rect.top + 21 : rect.bottom - 21);
      textAt = Offset(x, id.isStartSide ? rect.bottom - 14 : rect.top + 14);
    }
    _paintGlyph(canvas, glyphAt, id, color);
    text.paint(canvas, textAt - Offset(text.width / 2, text.height / 2));
    text.dispose();
  }

  /// 双框小卡片：外框套内框，用线的颜色高亮这条线要对准的那一条边。
  void _paintGlyph(Canvas canvas, Offset c, LineId id, Color color) {
    final outer = Rect.fromCenter(center: c, width: 20, height: 27);
    final inner = Rect.fromCenter(center: c, width: 11, height: 17);
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
  bool shouldRepaint(GuidePainter old) =>
      old.lines != lines ||
      old.selected != selected ||
      old.geometry != geometry ||
      old.labelStyle != labelStyle;
}
