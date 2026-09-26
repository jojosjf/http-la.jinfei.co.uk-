import 'package:flutter/material.dart';

import '../l10n/app_localizations.dart';

/// 旋转刻度盘：左右拖动刻度尺调整角度（-180°–180°），左侧显示当前角度，
/// 右侧“归零”“完成”。高度与微调栏相同，切换时画布不跳动。
class AngleDial extends StatelessWidget {
  const AngleDial({
    super.key,
    required this.angle,
    required this.onChanged,
    required this.onDone,
  });

  /// 当前角度（度），顺时针为正。
  final double angle;
  final ValueChanged<double> onChanged;
  final VoidCallback onDone;

  static const double maxAngle = 180;

  /// 每度对应的刻度尺像素；拖 8 点转 1°，0.8 点即 0.1°。
  static const double pixelsPerDegree = 8;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    return Row(
      children: [
        SizedBox(
          width: 64,
          child: Text(
            '${angle.toStringAsFixed(1)}°',
            key: const Key('rotate-angle'),
            style: theme.textTheme.titleMedium?.copyWith(
              fontWeight: FontWeight.w700,
              fontFeatures: const [FontFeature.tabularFigures()],
            ),
          ),
        ),
        Expanded(
          child: GestureDetector(
            key: const Key('rotate-dial'),
            behavior: HitTestBehavior.opaque,
            // 向左拖刻度尺，角度增加（和转动旋钮的手感一致）。
            onHorizontalDragUpdate: (d) => onChanged(
              (angle - d.delta.dx / pixelsPerDegree).clamp(-maxAngle, maxAngle),
            ),
            child: CustomPaint(
              size: const Size.fromHeight(52),
              painter: _DialPainter(
                angle: angle,
                tick: theme.colorScheme.onSurfaceVariant,
                accent: theme.colorScheme.primary,
                labelStyle: DefaultTextStyle.of(context).style.copyWith(
                      fontSize: 9,
                      color: theme.colorScheme.onSurfaceVariant,
                    ),
              ),
            ),
          ),
        ),
        IconButton(
          key: const Key('rotate-reset'),
          tooltip: l10n.rotateReset,
          icon: const Icon(Icons.restart_alt),
          onPressed: angle == 0 ? null : () => onChanged(0),
        ),
        IconButton.filledTonal(
          key: const Key('rotate-done'),
          tooltip: l10n.done,
          icon: const Icon(Icons.check),
          onPressed: onDone,
        ),
      ],
    );
  }
}

class _DialPainter extends CustomPainter {
  _DialPainter({
    required this.angle,
    required this.tick,
    required this.accent,
    required this.labelStyle,
  });

  final double angle;
  final Color tick, accent;
  final TextStyle labelStyle;

  @override
  void paint(Canvas canvas, Size size) {
    canvas.clipRect(Offset.zero & size);
    final cx = size.width / 2;
    const ppd = AngleDial.pixelsPerDegree;
    final half = size.width / 2 / ppd;
    final paint = Paint()
      ..color = tick
      ..strokeWidth = 1;
    final from = (angle - half).floor();
    final to = (angle + half).ceil();
    for (var deg = from; deg <= to; deg++) {
      if (deg.abs() > AngleDial.maxAngle) continue;
      final x = cx + (deg - angle) * ppd;
      final major = deg % 10 == 0;
      final len = major ? 16.0 : (deg % 5 == 0 ? 11.0 : 6.0);
      canvas.drawLine(Offset(x, 30 - len), Offset(x, 30), paint);
      if (major) {
        final t = TextPainter(
          text: TextSpan(text: '$deg', style: labelStyle),
          textDirection: TextDirection.ltr,
        )..layout();
        t.paint(canvas, Offset(x - t.width / 2, 34));
        t.dispose();
      }
    }
    // 中间的指针
    canvas.drawLine(
      Offset(cx, 8),
      Offset(cx, 32),
      Paint()
        ..color = accent
        ..strokeWidth = 2.5
        ..strokeCap = StrokeCap.round,
    );
  }

  @override
  bool shouldRepaint(_DialPainter old) =>
      old.angle != angle || old.tick != tick || old.accent != accent;
}
