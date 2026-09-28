import 'dart:collection';
import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../models/measurement_record.dart';

/// 记录的存取方式：整份记录存成一段 JSON 文本。
abstract class RecordBackend {
  Future<String?> read();
  Future<void> write(String data);
}

/// 存在本机的应用偏好设置里（网页版为浏览器的本地存储）。
class PrefsRecordBackend implements RecordBackend {
  static const _key = 'measurement_records_v1';

  @override
  Future<String?> read() async =>
      (await SharedPreferences.getInstance()).getString(_key);

  @override
  Future<void> write(String data) async =>
      (await SharedPreferences.getInstance()).setString(_key, data);
}

/// 只在内存里，用于测试。
class MemoryRecordBackend implements RecordBackend {
  MemoryRecordBackend([this.data]);

  String? data;

  @override
  Future<String?> read() async => data;

  @override
  Future<void> write(String data) async => this.data = data;
}

/// 测量记录，最新的在前。
class RecordStore extends ChangeNotifier {
  RecordStore(this._backend);

  /// 最多保留的条数，超出时丢掉最旧的。
  static const int maxRecords = 500;

  final RecordBackend _backend;
  List<MeasurementRecord> _records = [];
  Future<void>? _loading;
  bool _loaded = false;

  UnmodifiableListView<MeasurementRecord> get records =>
      UnmodifiableListView(_records);

  /// 读取已保存的记录；多次调用只读一次。读取失败时当作没有记录。
  Future<void> load() => _loading ??= _load();

  Future<void> _load() async {
    try {
      final raw = await _backend.read();
      if (raw != null && raw.isNotEmpty) {
        final list = jsonDecode(raw) as List<dynamic>;
        _records = [
          for (final e in list)
            MeasurementRecord.fromJson(e as Map<String, dynamic>),
        ];
      }
    } catch (e) {
      debugPrint('Failed to load records: $e');
    }
    _loaded = true;
    notifyListeners();
  }

  Future<void> add(MeasurementRecord r) async {
    if (!_loaded) await load();
    _records = [r, ..._records].take(maxRecords).toList();
    notifyListeners();
    await _save();
  }

  /// 按原来的位置放回（撤销删除用）。
  Future<void> restore(MeasurementRecord r, int index) async {
    if (!_loaded) await load();
    _records = [..._records]..insert(index.clamp(0, _records.length), r);
    notifyListeners();
    await _save();
  }

  Future<void> remove(String id) async {
    if (!_loaded) await load();
    _records = [
      for (final r in _records)
        if (r.id != id) r,
    ];
    notifyListeners();
    await _save();
  }

  Future<void> clear() async {
    if (!_loaded) await load();
    _records = [];
    notifyListeners();
    await _save();
  }

  Future<void> _save() async {
    try {
      await _backend.write(
        jsonEncode([for (final r in _records) r.toJson()]),
      );
    } catch (e) {
      debugPrint('Failed to save records: $e');
    }
  }
}
