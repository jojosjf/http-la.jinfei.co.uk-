/// 参考线编号。前 4 条是竖线（x 坐标），后 4 条是横线（y 坐标），
/// 各自按从左到右、从上到下排列。
enum LineId {
  outerLeft,
  innerLeft,
  innerRight,
  outerRight,
  outerTop,
  innerTop,
  innerBottom,
  outerBottom;

  bool get isVertical => index < 4;

  /// 在同方向 4 条线中的位置，0–3。
  int get order => index % 4;

  bool get isOuter => order == 0 || order == 3;

  /// 是否为左侧或上侧的线（否则为右侧或下侧）。
  bool get isStartSide => order < 2;
}

/// 相邻两线之间的最小间距（原图像素）。
const double minLineGap = 1;

/// 8 条参考线的位置，全部为原图像素坐标；x 为竖线，y 为横线。
class GuideLines {
  GuideLines({
    required this.outerLeft,
    required this.innerLeft,
    required this.innerRight,
    required this.outerRight,
    required this.outerTop,
    required this.innerTop,
    required this.innerBottom,
    required this.outerBottom,
  });

  /// 默认位置：外 8%、内 14%，右/下侧对称（W、H 为原图宽高）。
  factory GuideLines.defaults(double width, double height) => GuideLines(
        outerLeft: 0.08 * width,
        innerLeft: 0.14 * width,
        innerRight: 0.86 * width,
        outerRight: 0.92 * width,
        outerTop: 0.08 * height,
        innerTop: 0.14 * height,
        innerBottom: 0.86 * height,
        outerBottom: 0.92 * height,
      );

  /// 由 8 个值（竖线 4 个、横线 4 个，顺序同 [LineId]）建立参考线。
  /// 值会被夹在图片范围内，并保证同方向相邻两线至少相隔 [minLineGap]。
  factory GuideLines.fromValues(
    List<double> values, {
    required double width,
    required double height,
  }) {
    List<double> fix(List<double> a, double limit) {
      final out = [for (final v in a) v.clamp(0.0, limit).toDouble()];
      for (var i = 1; i < 4; i++) {
        if (out[i] < out[i - 1] + minLineGap) out[i] = out[i - 1] + minLineGap;
      }
      for (var i = 3; i >= 0; i--) {
        final hi = i == 3 ? limit : out[i + 1] - minLineGap;
        if (out[i] > hi) out[i] = hi;
      }
      return out;
    }

    return GuideLines._fromList([
      ...fix(values.sublist(0, 4), width),
      ...fix(values.sublist(4, 8), height),
    ]);
  }

  factory GuideLines._fromList(List<double> v) => GuideLines(
        outerLeft: v[0],
        innerLeft: v[1],
        innerRight: v[2],
        outerRight: v[3],
        outerTop: v[4],
        innerTop: v[5],
        innerBottom: v[6],
        outerBottom: v[7],
      );

  double outerLeft, innerLeft, innerRight, outerRight;
  double outerTop, innerTop, innerBottom, outerBottom;

  List<double> _toList() => [
        outerLeft,
        innerLeft,
        innerRight,
        outerRight,
        outerTop,
        innerTop,
        innerBottom,
        outerBottom,
      ];

  double operator [](LineId id) => _toList()[id.index];

  GuideLines copy() => GuideLines._fromList(_toList());

  /// 返回把 [id] 移到 [value] 后的新参考线。位置会被夹在相邻两线之间
  /// （至少相隔 [minLineGap]），最外侧的线不超出图片 [width]×[height]。
  GuideLines withLine(
    LineId id,
    double value, {
    required double width,
    required double height,
  }) {
    final v = _toList();
    final base = id.isVertical ? 0 : 4;
    final limit = id.isVertical ? width : height;
    final o = id.order;
    final lo = o == 0 ? 0.0 : v[base + o - 1] + minLineGap;
    final hi = o == 3 ? limit : v[base + o + 1] - minLineGap;
    v[id.index] = value < lo ? lo : (value > hi ? hi : value);
    return GuideLines._fromList(v);
  }
}
