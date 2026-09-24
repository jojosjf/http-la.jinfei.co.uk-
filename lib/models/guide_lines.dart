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

  double outerLeft, innerLeft, innerRight, outerRight;
  double outerTop, innerTop, innerBottom, outerBottom;

  GuideLines copy() => GuideLines(
        outerLeft: outerLeft,
        innerLeft: innerLeft,
        innerRight: innerRight,
        outerRight: outerRight,
        outerTop: outerTop,
        innerTop: innerTop,
        innerBottom: innerBottom,
        outerBottom: outerBottom,
      );
}
