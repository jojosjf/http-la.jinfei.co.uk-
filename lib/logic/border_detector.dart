import 'dart:math' as math;
import 'dart:typed_data';

/// 自动识别的结果：竖线 4 个 x、横线 4 个 y（外左、内左、内右、外右 /
/// 外上、内上、内下、外下），单位为输入图的像素，可带小数。
class DetectedBorders {
  const DetectedBorders({
    required this.xs,
    required this.ys,
    required this.innerFoundX,
    required this.innerFoundY,
  });

  final List<double> xs, ys;

  /// 是否找到了图案内边；没找到时内线按外框的固定比例放置。
  final bool innerFoundX, innerFoundY;
}

/// 在 RGBA 图像上找卡片外边与图案内边。
///
/// 思路：卡片的边都是贯穿整张卡的直线，把颜色变化沿线方向累加，直线处
/// 会形成明显的峰。在左右（上下）两半各取几个最强的峰，挑出最像
/// “外边 + 内边”的组合；再用卡片长宽比（63×88）在横竖组合之间取舍。
/// 第二轮只统计卡片内部的行列，排除背景干扰。
///
/// 找不到可信的外框时返回 null。
DetectedBorders? detectBorders(Uint8List rgba, int width, int height) {
  if (width < 16 || height < 16 || rgba.length < width * height * 4) {
    return null;
  }
  // 第一轮：只看中间一段，避开背景里常见的上下杂物。
  var xCombos = _combos(
    _profile(rgba, width, height,
        vertical: true, from: 0.3 * height, to: 0.7 * height),
    width,
  );
  var yCombos = _combos(
    _profile(rgba, width, height,
        vertical: false, from: 0.3 * width, to: 0.7 * width),
    height,
  );
  var best = _pick(xCombos, yCombos, rgba, width, height);
  if (best == null) return null;

  // 第二轮：只统计外框以内、离开四角的部分。
  for (var round = 0; round < 2; round++) {
    final (bx, by) = best!;
    final mw = 0.12 * (bx.outer2 - bx.outer1);
    final mh = 0.12 * (by.outer2 - by.outer1);
    xCombos = _combos(
      _profile(rgba, width, height,
          vertical: true, from: by.outer1 + mh, to: by.outer2 - mh),
      width,
    );
    yCombos = _combos(
      _profile(rgba, width, height,
          vertical: false, from: bx.outer1 + mw, to: bx.outer2 - mw),
      height,
    );
    best = _pick(xCombos, yCombos, rgba, width, height) ?? best;
  }

  final (bx, by) = best!;
  return DetectedBorders(
    xs: bx.values,
    ys: by.values,
    innerFoundX: bx.innerFound,
    innerFoundY: by.innerFound,
  );
}

/// 边缘强度剖面。vertical 为 true 时找竖直的边：对 [from, to) 之间的每一行，
/// 累加第 i 列左右相邻像素的颜色差；返回每列的平均值。
List<double> _profile(
  Uint8List p,
  int w,
  int h, {
  required bool vertical,
  required double from,
  required double to,
}) {
  final len = vertical ? w : h;
  final span = vertical ? h : w;
  final a = from.floor().clamp(0, span - 1);
  final b = to.ceil().clamp(a + 1, span);
  final out = List<double>.filled(len, 0);
  for (var j = a; j < b; j++) {
    for (var i = 1; i < len - 1; i++) {
      final int p0, p1;
      if (vertical) {
        p0 = (j * w + i - 1) * 4;
        p1 = (j * w + i + 1) * 4;
      } else {
        p0 = ((i - 1) * w + j) * 4;
        p1 = ((i + 1) * w + j) * 4;
      }
      out[i] += (p[p0] - p[p1]).abs() +
          (p[p0 + 1] - p[p1 + 1]).abs() +
          (p[p0 + 2] - p[p1 + 2]).abs();
    }
  }
  final n = (b - a).toDouble();
  // 轻微平滑，压掉单像素噪点。
  final s = List<double>.filled(len, 0);
  for (var i = 1; i < len - 1; i++) {
    s[i] = (out[i - 1] + 2 * out[i] + out[i + 1]) / (4 * n);
  }
  return s;
}

class _Peak {
  _Peak(this.pos, this.strength);

  /// 边的位置（连续坐标，像素 i 的中心为 i + 0.5）。
  final double pos;

  /// 相对强度，最强的峰为 1。
  final double strength;
}

List<_Peak> _peaks(List<double> s) {
  final len = s.length;
  var maxV = 0.0;
  for (final v in s) {
    if (v > maxV) maxV = v;
  }
  if (maxV <= 0) return [];
  final raw = <(int, double)>[];
  for (var i = 1; i < len - 1; i++) {
    if (s[i] >= s[i - 1] && s[i] > s[i + 1] && s[i] >= 0.02 * maxV) {
      raw.add((i, s[i]));
    }
  }
  raw.sort((x, y) => y.$2.compareTo(x.$2));
  // 非极大值抑制：相距太近的峰只留最强的。
  final radius = math.max(2, (0.006 * len).round());
  final kept = <(int, double)>[];
  for (final c in raw) {
    if (kept.every((k) => (k.$1 - c.$1).abs() > radius)) kept.add(c);
  }
  return [
    for (final (i, v) in kept)
      _Peak(i + 0.5 + _subPixel(s[i - 1], v, s[i + 1]), v / maxV),
  ];
}

/// 抛物线拟合求峰的小数偏移。
double _subPixel(double a, double b, double c) {
  final d = a - 2 * b + c;
  if (d == 0) return 0;
  return (0.5 * (a - c) / d).clamp(-0.5, 0.5);
}

class _Combo {
  _Combo(this.outer1, this.inner1, this.inner2, this.outer2, this.score,
      this.innerFound);

  final double outer1, inner1, inner2, outer2, score;
  final bool innerFound;

  List<double> get values => [outer1, inner1, inner2, outer2];
  double get size => outer2 - outer1;
}

/// 一个方向上得分最高的几种“外-内-内-外”组合。
List<_Combo> _combos(List<double> profile, int len) {
  final peaks = _peaks(profile);
  if (peaks.isEmpty) return [];
  // 前缀和，用来快速求一段区间的平均边缘强度（以最强峰为 1）。
  var maxV = 0.0;
  for (final v in profile) {
    if (v > maxV) maxV = v;
  }
  final prefix = List<double>.filled(len + 1, 0);
  for (var i = 0; i < len; i++) {
    prefix[i + 1] = prefix[i] + profile[i] / maxV;
  }
  // 边框是纯色的：外边与内边之间应当几乎没有边缘。两端各让开 2 像素。
  double texture(double a, double b) {
    final i = (a + 2).ceil(), j = (b - 2).floor();
    if (j <= i) return 0;
    return (prefix[j] - prefix[i]) / (j - i);
  }

  final half = len / 2;
  List<_Peak> side(bool start) {
    final list = [
      for (final p in peaks)
        if (start ? p.pos < half : p.pos > half) p,
    ]..sort((a, b) => b.strength.compareTo(a.strength));
    if (list.isEmpty) return [_Peak(start ? 0 : len.toDouble(), 0.4)];
    // 外边可能很弱（白卡放在白纸上）：除了最强的几个峰，再加上比最强峰
    // 更靠外的几个峰。
    final strongest = list.first.pos;
    final outside = [
      for (final p in list.skip(8))
        if (start ? p.pos < strongest : p.pos > strongest) p,
    ].take(4);
    // 卡片贴着图片边缘（如扫描件）时，图片边缘本身当作外边的候选。
    return [
      ...list.take(8),
      ...outside,
      _Peak(start ? 0 : len.toDouble(), 0.4),
    ];
  }

  // 图片边缘只在它和内边之间没有任何真实的边时才可信；否则说明
  // 外面还有背景，真正的外边在那段里。
  double edgePenalty(_Peak outer, _Peak inner) {
    if (outer.pos > 0 && outer.pos < len) return 0;
    final a = math.min(outer.pos, inner.pos) + 2;
    final b = math.max(outer.pos, inner.pos) - 2;
    // 明显高于这段的平均起伏才算真实的边，纯色边框里的噪点不算。
    final floor = math.max(0.03, 3 * texture(a - 2, b + 2));
    return peaks.any((p) => p.pos > a && p.pos < b && p.strength >= floor)
        ? 1
        : 0;
  }

  // 外边与内边之间夹着明显的边（如图案里的文字框），说明这不是边框。
  double edgesInside(double a, double b) {
    var sum = 0.0;
    for (final p in peaks) {
      if (p.strength >= 0.1 && p.pos > a + 3 && p.pos < b - 3) {
        sum += p.strength;
      }
    }
    return sum;
  }

  final starts = side(true), ends = side(false);
  final out = <_Combo>[];
  for (final o1 in starts) {
    for (final i1 in starts) {
      if (i1.pos <= o1.pos) continue;
      for (final i2 in ends) {
        for (final o2 in ends) {
          if (o2.pos <= i2.pos) continue;
          final size = o2.pos - o1.pos;
          if (size < 0.3 * len) continue;
          final b1 = i1.pos - o1.pos, b2 = o2.pos - i2.pos;
          final lo = math.max(2.0, 0.004 * size), hi = 0.3 * size;
          if (b1 < lo || b1 > hi || b2 < lo || b2 > hi) continue;
          // 边框一般接近对称：给接近对称的组合少量加分。
          final sym = math.min(b1, b2) / math.max(b1, b2);
          final busy = texture(o1.pos, i1.pos) + texture(i2.pos, o2.pos);
          final inside =
              edgesInside(o1.pos, i1.pos) + edgesInside(i2.pos, o2.pos);
          out.add(_Combo(
            o1.pos,
            i1.pos,
            i2.pos,
            o2.pos,
            o1.strength +
                i1.strength +
                i2.strength +
                o2.strength +
                0.3 * sym -
                8 * busy -
                inside -
                edgePenalty(o1, i1) -
                edgePenalty(o2, i2),
            true,
          ));
        }
      }
    }
  }
  // 只定外框、内线按 5% 放的方案（如无边框的全图卡）。找到的内边
  // 不够可信时，这个方案得分更高。
  for (final o1 in starts) {
    for (final o2 in ends) {
      final size = o2.pos - o1.pos;
      if (size < 0.3 * len) continue;
      out.add(_Combo(o1.pos, o1.pos + 0.05 * size, o2.pos - 0.05 * size, o2.pos,
          o1.strength + o2.strength + 0.3, false));
    }
  }
  out.sort((a, b) => b.score.compareTo(a.score));
  return out.take(24).toList();
}

/// 标准卡片宽高比 63:88。
const double _cardAspect = 63 / 88;

/// 横竖两个方向的组合配对：长宽比接近标准卡片的加分；卡片的四条外边
/// 应当首尾相接——竖直外边恰好在上下外边处结束，反之亦然，不符的扣分。
(_Combo, _Combo)? _pick(
  List<_Combo> xs,
  List<_Combo> ys,
  Uint8List p,
  int w,
  int h,
) {
  (_Combo, _Combo)? best;
  var bestScore = double.negativeInfinity;
  // 许多组合共用同一对外边，检查结果缓存起来。
  final memo = <(double, double, double, double, bool), double>{};
  double extent(List<double> e, _Combo span, bool vertical) =>
      memo[(e[0], e[1], span.outer1, span.outer2, vertical)] ??=
          _extentPenalty(p, w, h, e, span, vertical: vertical);
  for (final x in xs) {
    for (final y in ys) {
      final r = x.size / y.size;
      final d = math.min(
        (math.log(r / _cardAspect)).abs(),
        (math.log(r * _cardAspect)).abs(),
      );
      final score = x.score +
          y.score +
          0.8 * math.max(0, 1 - d / 0.2) -
          extent([x.outer1, x.outer2], y, true) -
          extent([y.outer1, y.outer2], x, false);
      if (score > bestScore) {
        bestScore = score;
        best = (x, y);
      }
    }
  }
  return best;
}

/// 检查外边 [edges]（vertical 为 true 时是竖线的 x）是否正好在另一方向的
/// 外框 [span] 之内出现、之外消失。外框内边缘断断续续，或者越过外框
/// 还在延续（说明选中的外框偏小，比如把图案里的文字框当成了边框），都扣分。
double _extentPenalty(
  Uint8List p,
  int w,
  int h,
  List<double> edges,
  _Combo span, {
  required bool vertical,
}) {
  final len = vertical ? w : h; // 边所在的坐标轴
  final along = vertical ? h : w; // 沿着边的方向
  final a = span.outer1, b = span.outer2;
  final win = math.max(4.0, 0.05 * (b - a));

  // 位置 i 处、沿边方向第 t 行（列）的颜色差。
  int diff(int i, int t) {
    final int p0, p1;
    if (vertical) {
      p0 = (t * w + i - 1) * 4;
      p1 = (t * w + i + 1) * 4;
    } else {
      p0 = ((i - 1) * w + t) * 4;
      p1 = ((i + 1) * w + t) * 4;
    }
    return (p[p0] - p[p1]).abs() +
        (p[p0 + 1] - p[p1 + 1]).abs() +
        (p[p0 + 2] - p[p1 + 2]).abs();
  }

  int maxDiff(int from, int to, int t) {
    var m = 0;
    for (var i = math.max(1, from); i <= math.min(len - 2, to); i++) {
      final v = diff(i, t);
      if (v > m) m = v;
    }
    return m;
  }

  // 第 t 行（列）上，位置 e 处是否有边：比两侧稍远处的起伏明显更强。
  // 容许 ±3 像素的倾斜误差。
  bool present(double e, int t) {
    final c = e.floor();
    final on = maxDiff(c - 3, c + 3, t);
    final off = math.max(maxDiff(c - 12, c - 8, t), maxDiff(c + 8, c + 12, t));
    return on >= 1.5 * off + 6;
  }

  var total = 0.0;
  var count = 0;
  for (final e in edges) {
    // 图片边缘当作外边时没有可检查的边。
    if (e < 2 || e > len - 2) continue;
    final inside = <bool>[
      for (var t = (a + win).ceil(); t < b - win && t < along; t += 2)
        if (t >= 0) present(e, t),
    ];
    if (inside.isEmpty) continue;
    final insideFrac = inside.where((v) => v).length / inside.length;
    final outside = <bool>[
      for (var t = (b + 2).ceil(); t <= b + win && t < along; t += 2)
        present(e, t),
      for (var t = (a - 2).floor(); t >= a - win && t >= 0; t -= 2)
        present(e, t),
    ];
    final outsideFrac =
        outside.isEmpty ? 0.0 : outside.where((v) => v).length / outside.length;
    total += 1.5 * outsideFrac + (1 - insideFrac);
    count++;
  }
  return count == 0 ? 0 : total / count;
}

/// 图片“横平竖直”的程度，用于自动摆正：卡片的边与横竖方向对齐时，
/// 边缘集中在少数几行几列，剖面的峰最尖，这个值最大。
double alignmentScore(Uint8List rgba, int width, int height) {
  double sharpness(List<double> s) {
    // 去掉两端 6%：旋转后四角露出的空白会形成斜边。
    final a = (0.06 * s.length).round(), b = s.length - a;
    var sum = 0.0, sq = 0.0;
    for (var i = a; i < b; i++) {
      sum += s[i];
      sq += s[i] * s[i];
    }
    return sum <= 0 ? 0 : sq * (b - a) / (sum * sum);
  }

  return sharpness(_profile(rgba, width, height,
          vertical: true, from: 0.2 * height, to: 0.8 * height)) +
      sharpness(_profile(rgba, width, height,
          vertical: false, from: 0.2 * width, to: 0.8 * width));
}
