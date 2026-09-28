import 'dart:math' as math;
import 'dart:typed_data';

/// 合成一张“桌面上的卡片”照片：带噪点的背景、黄色边框、花哨的图案区。
/// 所有矩形用连续坐标 [left, right)，边缘做 1 像素的过渡，模拟轻微模糊。
class SyntheticScene {
  SyntheticScene(this.w, this.h, {int seed = 1}) : _rnd = math.Random(seed) {
    for (var y = 0; y < h; y++) {
      for (var x = 0; x < w; x++) {
        // 背景：木纹似的横向条纹 + 噪点。
        final v = 90 + 25 * math.sin(y / 7.0) + _rnd.nextInt(30);
        _set(x, y, [v, v * 0.8, v * 0.6]);
      }
    }
  }

  final int w, h;
  final math.Random _rnd;
  late final Uint8List rgba = Uint8List(w * h * 4);

  void _set(int x, int y, List<num> c) {
    final i = (y * w + x) * 4;
    rgba[i] = c[0].round().clamp(0, 255);
    rgba[i + 1] = c[1].round().clamp(0, 255);
    rgba[i + 2] = c[2].round().clamp(0, 255);
    rgba[i + 3] = 255;
  }

  List<int> _get(int x, int y) {
    final i = (y * w + x) * 4;
    return [rgba[i], rgba[i + 1], rgba[i + 2]];
  }

  /// 用颜色函数填充矩形，边缘按覆盖比例混合。
  void fill(double l, double t, double r, double b,
      List<num> Function(int x, int y) color) {
    for (var y = math.max(0, t.floor()); y < math.min(h, b.ceil()); y++) {
      final cy =
          (math.min(b, y + 1.0) - math.max(t, y.toDouble())).clamp(0.0, 1.0);
      for (var x = math.max(0, l.floor()); x < math.min(w, r.ceil()); x++) {
        final cx =
            (math.min(r, x + 1.0) - math.max(l, x.toDouble())).clamp(0.0, 1.0);
        final a = cx * cy;
        final src = color(x, y), dst = _get(x, y);
        _set(x, y, [
          for (var k = 0; k < 3; k++) src[k] * a + dst[k] * (1 - a),
        ]);
      }
    }
  }

  void border(double l, double t, double r, double b) => fill(
      l,
      t,
      r,
      b,
      (_, __) => [
            230 + _rnd.nextInt(10),
            200 + _rnd.nextInt(10),
            40 + _rnd.nextInt(10),
          ]);

  /// 图案：大色块 + 噪点，内部有很多短边，但没有贯穿的直线。
  void art(double l, double t, double r, double b) => fill(l, t, r, b, (x, y) {
        final bx = (x / 37).floor(), by = (y / 29).floor();
        final seed = (bx * 7919 + by * 104729) % 255;
        return [
          (seed * 3) % 200 + _rnd.nextInt(20),
          (seed * 5) % 180 + 40 + _rnd.nextInt(20),
          (seed * 11) % 160 + 60 + _rnd.nextInt(20),
        ];
      });
}
