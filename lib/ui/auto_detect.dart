import 'dart:math' as math;
import 'dart:ui' as ui;

import 'package:flutter/foundation.dart';
import 'package:flutter/painting.dart';

import '../logic/border_detector.dart';
import '../models/guide_lines.dart';
import 'image_loader.dart';

/// 识别用的图最长边。再大精度提升有限，计算却成倍增加。
const int detectMaxSide = 1200;

/// 自动摆正时用的小图最长边。
const int straightenMaxSide = 400;

/// 自动摆正在当前角度左右搜索的范围（度）。
const double straightenRange = 6;

class AutoDetectResult {
  const AutoDetectResult(this.lines, this.angle);

  /// 8 条参考线，原图像素坐标。
  final GuideLines lines;

  /// 识别时使用的旋转角度（度，顺时针为正）。开启自动摆正时可能与传入的
  /// 角度不同。
  final double angle;
}

/// 自动识别 8 条参考线。[straighten] 为 true 时先在 [angle] 左右
/// ±[straightenRange]° 内找出让卡片最横平竖直的角度，再在该角度下识别。
/// 识别不出时返回 null。
///
/// 图由引擎缩小、旋转后画到一张小图上（与屏幕上的旋转方式一致：
/// 绕图片中心、顺时针为正），再在后台计算。
Future<AutoDetectResult?> autoDetect(
  LoadedImage image, {
  double angle = 0,
  bool straighten = true,
}) async {
  var best = angle;
  if (straighten) best = await _straighten(image, angle);

  final (bytes, w, h) = await _render(image.image, detectMaxSide, best);
  // 网页端没有后台线程，compute 也是在主线程上跑，直接算即可。
  final found = kIsWeb
      ? detectBorders(bytes, w, h)
      : await compute(_detect, (bytes, w, h));
  if (found == null) return null;

  final sx = image.width / w, sy = image.height / h;
  return AutoDetectResult(
    GuideLines.fromValues(
      [for (final x in found.xs) x * sx, for (final y in found.ys) y * sy],
      width: image.width,
      height: image.height,
    ),
    best,
  );
}

/// 先以 0.5° 粗找，再以 0.1° 细找。改进不明显时保持原角度。
Future<double> _straighten(LoadedImage image, double angle) async {
  Future<double> score(double a) async {
    final (bytes, w, h) = await _render(image.image, straightenMaxSide, a);
    return alignmentScore(bytes, w, h);
  }

  final base = await score(angle);
  var best = angle, bestScore = base;
  Future<void> search(double from, double to, double step) async {
    final center = best;
    for (var d = from; d <= to + 1e-9; d += step) {
      final a = center + d;
      if (a == angle) continue;
      final s = await score(a);
      if (s > bestScore) {
        bestScore = s;
        best = a;
      }
    }
  }

  await search(-straightenRange, straightenRange, 0.5);
  await search(-0.4, 0.4, 0.1);
  if (bestScore < base * 1.02) return angle;
  // 保留一位小数，与刻度盘一致。
  return ((best * 10).round() / 10).clamp(-180.0, 180.0);
}

/// 把图缩小到最长边 [maxSide]、按 [angle] 度旋转，返回 RGBA 像素。
Future<(Uint8List, int, int)> _render(
  ui.Image src,
  int maxSide,
  double angle,
) async {
  final scale = math.min(1.0, maxSide / math.max(src.width, src.height));
  final w = math.max(16, (src.width * scale).round());
  final h = math.max(16, (src.height * scale).round());

  final recorder = ui.PictureRecorder();
  ui.Canvas(recorder)
    ..translate(w / 2, h / 2)
    ..rotate(angle * math.pi / 180)
    ..translate(-w / 2, -h / 2)
    ..drawImageRect(
      src,
      Rect.fromLTWH(0, 0, src.width.toDouble(), src.height.toDouble()),
      Rect.fromLTWH(0, 0, w.toDouble(), h.toDouble()),
      Paint()..filterQuality = FilterQuality.medium,
    );
  final picture = recorder.endRecording();
  final small = await picture.toImage(w, h);
  picture.dispose();
  final data = await small.toByteData(format: ui.ImageByteFormat.rawRgba);
  small.dispose();
  return (
    data!.buffer.asUint8List(data.offsetInBytes, data.lengthInBytes),
    w,
    h,
  );
}

DetectedBorders? _detect((Uint8List, int, int) a) =>
    detectBorders(a.$1, a.$2, a.$3);
