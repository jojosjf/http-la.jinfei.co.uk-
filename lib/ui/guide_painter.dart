import 'package:flutter/material.dart';

import '../models/guide_lines.dart';
import 'canvas_geometry.dart';

const Color outerLineColor = Color(0xFF00E5FF);
const Color innerLineColor = Color(0xFFFF4081);
const Color selectedLineColor = Color(0xFFFFEA00);

/// 在图片上方绘制 8 条参考线和它们的手柄。
///
/// 外框线与内框线用三重方式区分：颜色（青 / 粉）、线型（实线 / 虚线）、
/// 手柄上的文字（“外” / “内”）。
class GuidePainter extends CustomPainter {
  GuidePainter({
    required this.geometry,
    required this.lines,
    required this.selected,
    required this.outerLabel,
    required this.innerLabel,
    required this.labelStyle,
  });

  final CanvasGeometry geometry;
  final GuideLines lines;
  final LineId? selected;

  /// 手柄上的文字，如“外”“内”。
  final String outerLabel, innerLabel;
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
    final r = isSel ? 15.0 : 13.0;
    canvas.drawCircle(c, r + 2, Paint()..color = Colors.white);
    canvas.drawCircle(c, r, Paint()..color = color);
    final text = TextPainter(
      text: TextSpan(
        text: id.isOuter ? outerLabel : innerLabel,
        style: labelStyle.copyWith(
          color: Colors.black,
          fontSize: isSel ? 15 : 13,
          fontWeight: FontWeight.w700,
          height: 1,
        ),
      ),
      textDirection: TextDirection.ltr,
    )..layout();
    text.paint(canvas, c - Offset(text.width / 2, text.height / 2));
    text.dispose();
  }

  @override
  bool shouldRepaint(GuidePainter old) =>
      old.lines != lines ||
      old.selected != selected ||
      old.geometry != geometry ||
      old.outerLabel != outerLabel ||
      old.innerLabel != innerLabel ||
      old.labelStyle != labelStyle;
}
