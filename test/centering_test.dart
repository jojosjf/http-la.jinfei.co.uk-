import 'package:card_centering/logic/centering.dart';
import 'package:card_centering/models/guide_lines.dart';
import 'package:flutter_test/flutter_test.dart';

/// 用四边边框宽度构造参考线：外框 1000×1400，内框按边框宽度内缩。
GuideLines lines({
  required double l,
  required double r,
  double? t,
  double? b,
}) {
  const w = 1000.0, h = 1400.0;
  t ??= 50;
  b ??= 50;
  return GuideLines(
    outerLeft: 0,
    innerLeft: l,
    innerRight: w - r,
    outerRight: w,
    outerTop: 0,
    innerTop: t,
    innerBottom: h - b,
    outerBottom: h,
  );
}

/// 左右边框按 big/100 : (100-big)/100 分配，上下居中。
GuideLines lrRatio(num big) => lines(l: big.toDouble(), r: 100 - big.toDouble());

void main() {
  group('比例计算', () {
    test('完全居中为 50/50', () {
      final r = computeCentering(lines(l: 40, r: 40, t: 60, b: 60));
      expect([r.lrBig, r.lrSmall, r.tbBig, r.tbSmall], [50, 50, 50, 50]);
    });

    test('较宽一侧在右边时同样取较大值', () {
      final r = computeCentering(lines(l: 42, r: 58));
      expect([r.lrBig, r.lrSmall], [58, 42]);
    });

    test('0.5 向上取整', () {
      expect(computeCentering(lines(l: 57.5, r: 42.5)).lrBig, 58);
      expect(computeCentering(lines(l: 57.4, r: 42.6)).lrBig, 57);
      expect(computeCentering(lines(l: 50, r: 50, t: 115, b: 85)).tbBig, 58);
    });

    test('worse 取左右与上下中较差者', () {
      final r = computeCentering(lines(l: 52, r: 48, t: 63, b: 37));
      expect(r.lrBig, 52);
      expect(r.tbBig, 63);
      expect(r.worse, 63);
      expect(r.grade, 8);
    });

    test('默认线位置为 50/50，PSA 10', () {
      final r = computeCentering(GuideLines.defaults(3024, 4032));
      expect(r.worse, 50);
      expect(r.grade, 10);
      expect(r.borderline, isFalse);
    });
  });

  group('等级判定（阈值边界）', () {
    const cases = <int, double?>{
      50: 10, 55: 10, 56: 9, 60: 9, 61: 8, 65: 8, 66: 7, 70: 7,
      71: 6, 80: 6, 81: 5, 85: 5, 86: 3, 90: 3, 91: null, 99: null,
    };
    cases.forEach((worse, grade) {
      test('$worse → ${grade ?? '低于标准'}', () {
        final r = computeCentering(lrRatio(worse));
        expect(r.worse, worse);
        expect(r.grade, grade);
      });
    });
  });

  group('临界判断', () {
    void expectBorder(int worse, double grade, double? near) {
      final r = computeCentering(lrRatio(worse));
      expect(r.grade, grade, reason: 'grade @$worse');
      expect(r.borderline, near != null, reason: 'borderline @$worse');
      expect(r.nearGrade, near, reason: 'nearGrade @$worse');
    }

    test('文档示例：56 → PSA 9，临界接近 PSA 10', () => expectBorder(56, 9, 10));
    test('文档示例：72 → PSA 6，临界接近 PSA 7', () => expectBorder(72, 6, 7));
    test('超出 3 个百分点仍算临界', () {
      expectBorder(58, 9, 10);
      expectBorder(63, 8, 9);
      expectBorder(68, 7, 8);
      expectBorder(73, 6, 7);
    });
    test('超出 4 个百分点不再临界', () {
      expectBorder(59, 9, null);
      expectBorder(74, 6, null);
    });
    test('正好在阈值上不算临界', () {
      expectBorder(55, 10, null);
      expectBorder(60, 9, null);
    });
    test('上一级低于 PSA 7 时不做临界提示', () {
      expectBorder(81, 5, null); // 上一级 PSA 6
      expectBorder(86, 3, null); // 上一级 PSA 5
      final r = computeCentering(lrRatio(91)); // 上一级 PSA 3
      expect(r.grade, isNull);
      expect(r.borderline, isFalse);
      expect(r.nearGrade, isNull);
    });
  });
}
