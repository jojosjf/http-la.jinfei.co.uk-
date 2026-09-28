import 'package:flutter/material.dart';

import '../l10n/app_localizations.dart';
import '../logic/record_store.dart';
import '../models/measurement_record.dart';
import 'result_bar.dart';

enum _Sort { newest, grade }

/// “测量记录”页：按时间或等级排列，左滑删除（可撤销），可清空。
class RecordsPage extends StatefulWidget {
  const RecordsPage({super.key, required this.store});

  final RecordStore store;

  @override
  State<RecordsPage> createState() => _RecordsPageState();
}

class _RecordsPageState extends State<RecordsPage> {
  _Sort _sort = _Sort.newest;

  @override
  void initState() {
    super.initState();
    widget.store.load();
  }

  List<MeasurementRecord> _sorted(List<MeasurementRecord> list) {
    if (_sort == _Sort.newest) return list;
    // 等级高的在前；同等级时较差一侧的比例越小越好；低于标准的排最后。
    return [...list]..sort((a, b) {
        final ga = a.grade ?? -1, gb = b.grade ?? -1;
        if (ga != gb) return gb.compareTo(ga);
        if (a.worse != b.worse) return a.worse.compareTo(b.worse);
        return b.time.compareTo(a.time);
      });
  }

  Future<void> _confirmClear() async {
    final l10n = AppLocalizations.of(context);
    final ok = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        content: Text(l10n.clearAllConfirm),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: Text(l10n.cancel),
          ),
          TextButton(
            key: const Key('clear-confirm'),
            onPressed: () => Navigator.of(context).pop(true),
            child: Text(l10n.clearAll),
          ),
        ],
      ),
    );
    if (ok == true) await widget.store.clear();
  }

  void _delete(MeasurementRecord r) {
    final l10n = AppLocalizations.of(context);
    final index = widget.store.records.indexOf(r);
    widget.store.remove(r.id);
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(
        SnackBar(
          content: Text(l10n.recordDeleted),
          action: SnackBarAction(
            label: l10n.undo,
            onPressed: () => widget.store.restore(r, index),
          ),
        ),
      );
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return ListenableBuilder(
      listenable: widget.store,
      builder: (context, _) {
        final records = _sorted(widget.store.records);
        return Scaffold(
          appBar: AppBar(
            title: Text(l10n.records),
            actions: [
              if (records.isNotEmpty)
                TextButton(
                  key: const Key('records-clear'),
                  onPressed: _confirmClear,
                  child: Text(l10n.clearAll),
                ),
            ],
          ),
          body: records.isEmpty
              ? const _EmptyRecords()
              : Column(
                  children: [
                    Padding(
                      padding: const EdgeInsets.fromLTRB(16, 8, 16, 4),
                      child: SegmentedButton<_Sort>(
                        segments: [
                          ButtonSegment(
                            value: _Sort.newest,
                            label: Text(l10n.sortNewest),
                            icon: const Icon(Icons.schedule),
                          ),
                          ButtonSegment(
                            value: _Sort.grade,
                            label: Text(l10n.sortGrade),
                            icon: const Icon(Icons.military_tech_outlined),
                          ),
                        ],
                        selected: {_sort},
                        onSelectionChanged: (s) =>
                            setState(() => _sort = s.first),
                      ),
                    ),
                    Expanded(
                      child: ListView.builder(
                        padding: const EdgeInsets.fromLTRB(12, 4, 12, 16),
                        itemCount: records.length,
                        itemBuilder: (context, i) {
                          final r = records[i];
                          return Dismissible(
                            key: ValueKey('record-${r.id}'),
                            direction: DismissDirection.endToStart,
                            background: Container(
                              alignment: Alignment.centerRight,
                              padding: const EdgeInsets.only(right: 24),
                              color:
                                  Theme.of(context).colorScheme.errorContainer,
                              child: Icon(
                                Icons.delete_outline,
                                semanticLabel: l10n.delete,
                              ),
                            ),
                            onDismissed: (_) => _delete(r),
                            child: _RecordTile(record: r),
                          );
                        },
                      ),
                    ),
                  ],
                ),
        );
      },
    );
  }
}

class _RecordTile extends StatelessWidget {
  const _RecordTile({required this.record});

  final MeasurementRecord record;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final r = record;
    final grade = r.grade;
    final t = r.time;
    String two(int v) => v.toString().padLeft(2, '0');
    final date =
        '${t.year}-${two(t.month)}-${two(t.day)} ${two(t.hour)}:${two(t.minute)}';
    return Card(
      margin: const EdgeInsets.symmetric(vertical: 4),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    r.note.isEmpty ? l10n.untitledCard : r.note,
                    style: theme.textTheme.titleMedium,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 4),
                  Text(
                    l10n.recordSummary(
                      '${r.lrBig}/${r.lrSmall}',
                      '${r.tbBig}/${r.tbSmall}',
                    ),
                    style: theme.textTheme.bodyMedium,
                  ),
                  const SizedBox(height: 2),
                  Text(
                    date,
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: theme.colorScheme.onSurfaceVariant,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 12),
            Text(
              grade == null
                  ? l10n.belowStandard
                  : l10n.gradeValue(formatGrade(grade)),
              style: theme.textTheme.titleLarge?.copyWith(
                fontWeight: FontWeight.w700,
                color: theme.colorScheme.primary,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _EmptyRecords extends StatelessWidget {
  const _EmptyRecords();

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              Icons.bookmarks_outlined,
              size: 64,
              color: theme.colorScheme.primary,
            ),
            const SizedBox(height: 16),
            Text(l10n.noRecords, style: theme.textTheme.titleLarge),
            const SizedBox(height: 8),
            Text(
              l10n.noRecordsHint,
              style: theme.textTheme.bodyMedium,
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }
}
