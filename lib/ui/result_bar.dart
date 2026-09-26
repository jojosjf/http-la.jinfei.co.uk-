import 'package:flutter/material.dart';

import '../l10n/app_localizations.dart';
import '../logic/centering.dart';

String formatGrade(double g) =>
    g == g.roundToDouble() ? g.toInt().toString() : g.toString();

/// 底部结果栏：左右、上下比例，参考等级，临界提示与免责说明。
class ResultBar extends StatelessWidget {
  const ResultBar({super.key, required this.result});

  final CenteringResult result;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final r = result;
    final grade = r.grade;
    final near = r.nearGrade;
    return Material(
      color: theme.colorScheme.surfaceContainerHighest,
      child: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Row(
                children: [
                  _Cell(
                    label: l10n.leftRight,
                    value: '${r.lrBig}/${r.lrSmall}',
                  ),
                  _Cell(
                    label: l10n.topBottom,
                    value: '${r.tbBig}/${r.tbSmall}',
                  ),
                  _Cell(
                    label: l10n.referenceGrade,
                    value: grade == null
                        ? l10n.belowStandard
                        : l10n.gradeValue(formatGrade(grade)),
                    emphasize: true,
                  ),
                ],
              ),
              // 临界提示始终占一行：出现或消失时结果栏高度不变，图片不会跳动。
              Padding(
                padding: const EdgeInsets.only(top: 6),
                child: Text(
                  r.borderline && near != null
                      ? l10n.borderline(formatGrade(near))
                      : '',
                  key: const Key('borderline'),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: theme.textTheme.bodyMedium?.copyWith(
                    color: Colors.orange.shade800,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
              Padding(
                padding: const EdgeInsets.only(top: 6),
                child: Text(
                  l10n.disclaimer,
                  textAlign: TextAlign.center,
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: theme.colorScheme.onSurfaceVariant,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _Cell extends StatelessWidget {
  const _Cell({
    required this.label,
    required this.value,
    this.emphasize = false,
  });

  final String label, value;
  final bool emphasize;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Expanded(
      child: Column(
        children: [
          Text(label, style: theme.textTheme.labelMedium),
          const SizedBox(height: 2),
          FittedBox(
            fit: BoxFit.scaleDown,
            child: Text(
              value,
              style: theme.textTheme.titleLarge?.copyWith(
                fontWeight: FontWeight.w700,
                color: emphasize ? theme.colorScheme.primary : null,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
