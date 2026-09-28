import 'dart:convert';

import 'package:card_centering/logic/centering.dart';
import 'package:card_centering/logic/record_store.dart';
import 'package:card_centering/models/guide_lines.dart';
import 'package:card_centering/models/measurement_record.dart';
import 'package:flutter_test/flutter_test.dart';

MeasurementRecord record(String note, {int ms = 0, double shiftLeft = 0}) {
  final g = GuideLines.defaults(1000, 1400);
  final lines = g.withLine(
    LineId.innerLeft,
    g.innerLeft + shiftLeft,
    width: 1000,
    height: 1400,
  );
  return MeasurementRecord.fromResult(
    computeCentering(lines),
    note: note,
    time: DateTime.fromMillisecondsSinceEpoch(1700000000000 + ms),
  );
}

void main() {
  test('新记录在最前，并写入存储', () async {
    final backend = MemoryRecordBackend();
    final store = RecordStore(backend);
    await store.add(record('A', ms: 1));
    await store.add(record('B', ms: 2));
    expect(store.records.map((r) => r.note), ['B', 'A']);

    final reloaded = RecordStore(backend);
    await reloaded.load();
    expect(reloaded.records.map((r) => r.note), ['B', 'A']);
    expect(reloaded.records.first.lrBig, 50);
    expect(reloaded.records.first.grade, 10);
  });

  test('只保存数字和备注', () async {
    final backend = MemoryRecordBackend();
    await RecordStore(backend).add(record('  Pikachu  ', shiftLeft: 30));
    final saved = (jsonDecode(backend.data!) as List).single as Map;
    expect(saved.keys.toSet(), {
      'id',
      'time',
      'note',
      'lrBig',
      'lrSmall',
      'tbBig',
      'tbSmall',
      'grade',
    });
    expect(saved['note'], 'Pikachu');
    expect(saved['lrBig'], 60);
    expect(saved['grade'], 9);
  });

  test('删除后可以在原位置撤销', () async {
    final store = RecordStore(MemoryRecordBackend());
    for (final n in ['A', 'B', 'C']) {
      await store.add(record(n, ms: n.codeUnitAt(0)));
    }
    final b = store.records[1];
    await store.remove(b.id);
    expect(store.records.map((r) => r.note), ['C', 'A']);
    await store.restore(b, 1);
    expect(store.records.map((r) => r.note), ['C', 'B', 'A']);
    await store.clear();
    expect(store.records, isEmpty);
  });

  test('超过上限时丢掉最旧的', () async {
    final store = RecordStore(MemoryRecordBackend());
    for (var i = 0; i < RecordStore.maxRecords + 3; i++) {
      await store.add(record('$i', ms: i));
    }
    expect(store.records.length, RecordStore.maxRecords);
    expect(store.records.first.note, '${RecordStore.maxRecords + 2}');
    expect(store.records.last.note, '3');
  });

  test('存储内容损坏时当作没有记录，仍可继续保存', () async {
    final backend = MemoryRecordBackend('not json');
    final store = RecordStore(backend);
    await store.load();
    expect(store.records, isEmpty);
    await store.add(record('A'));
    expect(store.records.single.note, 'A');
  });

  test('低于标准的记录等级为空', () async {
    final store = RecordStore(MemoryRecordBackend());
    await store.add(record('bad', shiftLeft: -59));
    expect(store.records.single.grade, isNull);
  });
}
