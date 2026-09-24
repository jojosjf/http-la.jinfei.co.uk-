/// PSA 正面居中阈值表（参考 PSA 公开标准）。
///
/// 所有与 PSA 标准相关的数字只允许出现在本文件中。
library;

class PsaThreshold {
  const PsaThreshold(this.grade, this.maxWorse);

  /// 等级，如 10、9 … 3。
  final double grade;

  /// 该等级允许的较大一侧最大百分比（如 55 表示 55/45）。
  final int maxWorse;
}

/// 正面阈值，按等级从高到低排列。
const List<PsaThreshold> psaFrontThresholds = [
  PsaThreshold(10, 55),
  PsaThreshold(9, 60),
  PsaThreshold(8, 65),
  PsaThreshold(7, 70),
  PsaThreshold(6, 80),
  PsaThreshold(5, 85),
  PsaThreshold(3, 90),
];

/// 临界判断：超出上一级阈值的最小、最大百分点。
const int borderlineMinOver = 1;
const int borderlineMaxOver = 3;

/// 只有不低于此等级的“上一级”才做临界提示（PSA 对 7–10 级正面约有 5% 宽限）。
const double borderlineMinGrade = 7;
