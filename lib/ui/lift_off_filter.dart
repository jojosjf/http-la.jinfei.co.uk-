/// 抬手偏移过滤。
///
/// 手指抬起的一瞬间，指腹与屏幕的接触面变小，系统报告的触点会偏几个像素，
/// 线也跟着偏离刚刚对准的位置。做法参考 iOS 滑块精度的常见处理：松手时往回
/// 找最近一个手指停留了至少 [dwell] 的位置，如果它离松手处不超过 [slop] 个
/// 逻辑像素，就把线退回到那里。手指一直在移动、没有停留过时保留最后的位置。
class LiftOffFilter {
  LiftOffFilter({
    this.dwell = const Duration(milliseconds: 50),
    this.slop = 12,
  });

  final Duration dwell;
  final double slop;

  // 只看抬手前这么久内的点，更早的不会被退回。
  static const Duration _history = Duration(milliseconds: 500);

  // （时间, 手指在拖动方向上的屏幕坐标, 线的位置）
  final List<(Duration, double, double)> _samples = [];

  void start(Duration time, double screen, double value) {
    _samples
      ..clear()
      ..add((time, screen, value));
  }

  void add(Duration time, double screen, double value) {
    _samples.add((time, screen, value));
    while (_samples.length > 2 && time - _samples[1].$1 >= _history) {
      _samples.removeAt(0);
    }
  }

  /// 在 [upTime] 抬手时线应当退回的位置；不需要退回时返回 null。
  /// 不知道抬手时间时传 null，最后一个点按没有停留处理。
  double? settle(Duration? upTime) {
    if (_samples.length < 2) return null;
    final last = _samples.last;
    for (var i = _samples.length - 1; i >= 0; i--) {
      final s = _samples[i];
      if ((s.$2 - last.$2).abs() > slop) return null;
      final until =
          i + 1 < _samples.length ? _samples[i + 1].$1 : (upTime ?? s.$1);
      if (until - s.$1 >= dwell) {
        // 最后停留的位置就是松手处，不用退回。
        return i == _samples.length - 1 || s.$3 == last.$3 ? null : s.$3;
      }
    }
    return null;
  }
}
