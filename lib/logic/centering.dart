import 'dart:math' as math;

import '../models/guide_lines.dart';
import 'psa_table.dart';

class CenteringResult {
  const CenteringResult({
    required this.lrBig,
    required this.lrSmall,
    required this.tbBig,
    required this.tbSmall,
    required this.worse,
    required this.grade,
    required this.borderline,
    required this.nearGrade,
  });

  final int lrBig, lrSmall; // 如 58 / 42
  final int tbBig, tbSmall;
  final int worse; // max(lrBig, tbBig)
  final double? grade; // 10、9 … 3；null 表示低于标准
  final bool borderline; // 是否临界
  final double? nearGrade; // 临界时接近的更高等级
}

/// 较宽一侧所占百分比，四舍五入（0.5 向上）。
int bigPercent(double a, double b) {
  final sum = a + b;
  if (sum <= 0) return 50;
  // 加一个极小量，避免 57.5 这类值因浮点误差被舍成 57。
  return (100 * math.max(a, b) / sum + 0.5 + 1e-9).floor();
}

CenteringResult computeCentering(GuideLines g) {
  final l = g.innerLeft - g.outerLeft;
  final r = g.outerRight - g.innerRight;
  final t = g.innerTop - g.outerTop;
  final b = g.outerBottom - g.innerBottom;

  final lrBig = bigPercent(l, r);
  final tbBig = bigPercent(t, b);
  final worse = math.max(lrBig, tbBig);

  double? grade;
  PsaThreshold? higher; // 比所得等级高一级的阈值
  for (final th in psaFrontThresholds) {
    if (worse <= th.maxWorse) {
      grade = th.grade;
      break;
    }
    higher = th;
  }

  var borderline = false;
  double? nearGrade;
  if (higher != null && higher.grade >= borderlineMinGrade) {
    final over = worse - higher.maxWorse;
    if (over >= borderlineMinOver && over <= borderlineMaxOver) {
      borderline = true;
      nearGrade = higher.grade;
    }
  }

  return CenteringResult(
    lrBig: lrBig,
    lrSmall: 100 - lrBig,
    tbBig: tbBig,
    tbSmall: 100 - tbBig,
    worse: worse,
    grade: grade,
    borderline: borderline,
    nearGrade: nearGrade,
  );
}
