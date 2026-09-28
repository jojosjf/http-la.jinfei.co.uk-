import '../logic/centering.dart';

/// 一条测量记录。只保存数字和备注，不保存照片。
class MeasurementRecord {
  const MeasurementRecord({
    required this.id,
    required this.time,
    required this.note,
    required this.lrBig,
    required this.lrSmall,
    required this.tbBig,
    required this.tbSmall,
    required this.grade,
  });

  factory MeasurementRecord.fromResult(
    CenteringResult r, {
    required String note,
    DateTime? time,
  }) {
    final t = time ?? DateTime.now();
    return MeasurementRecord(
      id: t.microsecondsSinceEpoch.toString(),
      time: t,
      note: note.trim(),
      lrBig: r.lrBig,
      lrSmall: r.lrSmall,
      tbBig: r.tbBig,
      tbSmall: r.tbSmall,
      grade: r.grade,
    );
  }

  factory MeasurementRecord.fromJson(Map<String, dynamic> j) =>
      MeasurementRecord(
        id: j['id'] as String,
        time: DateTime.fromMillisecondsSinceEpoch(j['time'] as int),
        note: j['note'] as String? ?? '',
        lrBig: j['lrBig'] as int,
        lrSmall: j['lrSmall'] as int,
        tbBig: j['tbBig'] as int,
        tbSmall: j['tbSmall'] as int,
        grade: (j['grade'] as num?)?.toDouble(),
      );

  final String id;
  final DateTime time;
  final String note;
  final int lrBig, lrSmall, tbBig, tbSmall;

  /// 参考等级；null 表示低于标准。
  final double? grade;

  /// 左右、上下中较差的一侧，用于同等级时排序。
  int get worse => lrBig > tbBig ? lrBig : tbBig;

  Map<String, dynamic> toJson() => {
        'id': id,
        'time': time.millisecondsSinceEpoch,
        'note': note,
        'lrBig': lrBig,
        'lrSmall': lrSmall,
        'tbBig': tbBig,
        'tbSmall': tbSmall,
        'grade': grade,
      };
}
