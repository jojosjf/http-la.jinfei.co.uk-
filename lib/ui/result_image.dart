import 'dart:math' as math;
import 'dart:ui' as ui;

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';

import '../l10n/app_localizations.dart';
import '../logic/centering.dart';
import '../models/guide_lines.dart';
import 'guide_painter.dart';
import 'image_loader.dart';
import 'result_bar.dart';

/// 结果图宽度（像素），适合手机相册和聊天软件。
const double resultImageWidth = 1080;

const double _pad = 48;
const Color _bg = Color(0xFF1C1C1E);
const Color _muted = Color(0xFFA0A3A8);
const Color _accent = Color(0xFF8C9EFF);

/// 生成的结果图：用于预览的图像和用于保存的 PNG。用完调用 [dispose]。
class ResultImage {
  ResultImage(this.image, this.png);

  final ui.Image image;
  final Uint8List png;

  void dispose() => image.dispose();
}

/// 生成一张结果图（PNG）：卡片裁切图 + 8 条参考线，下方是左右、上下比例、
/// 参考等级、日期与免责说明。图片按 [angle] 度旋转，与屏幕上看到的一致。
Future<ResultImage> renderResultImage({
  required LoadedImage image,
  required double angle,
  required GuideLines lines,
  required CenteringResult result,
  required AppLocalizations l10n,
  DateTime? time,
}) async {
  // 裁切范围：外框四周留出卡片尺寸 5% 的余量（原图坐标）。
  final cardW = lines.outerRight - lines.outerLeft;
  final cardH = lines.outerBottom - lines.outerTop;
  final m = 0.05 * math.max(cardW, cardH);
  final crop = Rect.fromLTRB(
    lines.outerLeft - m,
    lines.outerTop - m,
    lines.outerRight + m,
    lines.outerBottom + m,
  );
  var k = (resultImageWidth - 2 * _pad) / crop.width;
  const maxCardHeight = 1500.0;
  if (crop.height * k > maxCardHeight) k = maxCardHeight / crop.height;
  final dest = Rect.fromLTWH(
    (resultImageWidth - crop.width * k) / 2,
    _pad,
    crop.width * k,
    crop.height * k,
  );

  final recorder = ui.PictureRecorder();
  final canvas = Canvas(recorder);
  canvas.drawRect(
    const Rect.fromLTWH(0, 0, resultImageWidth, 4000),
    Paint()..color = _bg,
  );

  // 卡片图：与屏幕上一样，绕原图中心旋转。
  final src = image.image;
  canvas
    ..save()
    ..clipRect(dest)
    ..translate(dest.left - crop.left * k, dest.top - crop.top * k)
    ..scale(k)
    ..translate(image.width / 2, image.height / 2)
    ..rotate(angle * math.pi / 180)
    ..translate(-image.width / 2, -image.height / 2)
    ..drawImageRect(
      src,
      Rect.fromLTWH(0, 0, src.width.toDouble(), src.height.toDouble()),
      Rect.fromLTWH(0, 0, image.width, image.height),
      Paint()..filterQuality = FilterQuality.high,
    )
    ..restore();

  // 参考线：外框长虚线、内框短虚线，颜色与应用内一致。
  for (final id in LineId.values) {
    final paint = Paint()
      ..color = GuidePainter.colorOf(id, selected: false)
      ..strokeWidth = 4;
    final dash = id.isOuter ? 28.0 : 10.0;
    final gap = id.isOuter ? 12.0 : 10.0;
    if (id.isVertical) {
      final x = dest.left + (lines[id] - crop.left) * k;
      _dashed(canvas, Offset(x, dest.top), Offset(x, dest.bottom), dash, gap,
          paint);
    } else {
      final y = dest.top + (lines[id] - crop.top) * k;
      _dashed(canvas, Offset(dest.left, y), Offset(dest.right, y), dash, gap,
          paint);
    }
  }

  // 下方文字。
  var y = dest.bottom + 40;
  final cellW = (resultImageWidth - 2 * _pad) / 3;
  final grade = result.grade;
  final cells = [
    (l10n.leftRight, '${result.lrBig}/${result.lrSmall}', Colors.white),
    (l10n.topBottom, '${result.tbBig}/${result.tbSmall}', Colors.white),
    (
      l10n.referenceGrade,
      grade == null ? l10n.belowStandard : l10n.gradeValue(formatGrade(grade)),
      _accent,
    ),
  ];
  var rowH = 0.0;
  for (var i = 0; i < cells.length; i++) {
    final (label, value, color) = cells[i];
    final x = _pad + i * cellW;
    final lh = _text(canvas, label, Offset(x, y), cellW,
        size: 28, color: _muted, center: true);
    final vh = _text(canvas, value, Offset(x, y + lh + 8), cellW,
        size: 56, color: color, weight: FontWeight.w700, center: true);
    rowH = math.max(rowH, lh + 8 + vh);
  }
  y += rowH + 20;

  final near = result.nearGrade;
  if (result.borderline && near != null) {
    y += _text(canvas, l10n.borderline(formatGrade(near)), Offset(_pad, y),
            resultImageWidth - 2 * _pad,
            size: 30,
            color: Colors.orange.shade400,
            weight: FontWeight.w600,
            center: true) +
        16;
  }

  final t = time ?? DateTime.now();
  String two(int v) => v.toString().padLeft(2, '0');
  final date = '${t.year}-${two(t.month)}-${two(t.day)}';
  y += _text(canvas, '${l10n.appTitle}  ·  $date', Offset(_pad, y),
          resultImageWidth - 2 * _pad,
          size: 26, color: _muted, center: true) +
      8;
  y += _text(
      canvas, l10n.disclaimer, Offset(_pad, y), resultImageWidth - 2 * _pad,
      size: 22, color: _muted, center: true);
  final height = (y + _pad).ceil();

  final picture = recorder.endRecording();
  final img = await picture.toImage(resultImageWidth.toInt(), height);
  picture.dispose();
  try {
    final data = await img.toByteData(format: ui.ImageByteFormat.png);
    return ResultImage(
      img,
      data!.buffer.asUint8List(data.offsetInBytes, data.lengthInBytes),
    );
  } catch (_) {
    img.dispose();
    rethrow;
  }
}

void _dashed(Canvas c, Offset a, Offset b, double dash, double gap, Paint p) {
  final len = (b - a).distance;
  final dir = (b - a) / len;
  for (var s = 0.0; s < len; s += dash + gap) {
    c.drawLine(a + dir * s, a + dir * math.min(s + dash, len), p);
  }
}

/// 画一段文字，返回它的高度。
double _text(
  Canvas canvas,
  String text,
  Offset at,
  double width, {
  required double size,
  required Color color,
  FontWeight weight = FontWeight.w400,
  bool center = false,
}) {
  final tp = TextPainter(
    text: TextSpan(
      text: text,
      style: TextStyle(
        fontSize: size,
        color: color,
        fontWeight: weight,
        // 网页版用内置的中文字体，与界面一致。
        fontFamily: kIsWeb ? 'NotoSansSCSubset' : null,
        fontFamilyFallback: kIsWeb ? const ['NotoSansSCCommon'] : null,
      ),
    ),
    textAlign: center ? TextAlign.center : TextAlign.left,
    textDirection: TextDirection.ltr,
    maxLines: 2,
    ellipsis: '…',
  )..layout(minWidth: width, maxWidth: width);
  tp.paint(canvas, at);
  final h = tp.height;
  tp.dispose();
  return h;
}
