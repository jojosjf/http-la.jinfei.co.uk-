import 'dart:typed_data';

import 'package:card_centering/logic/border_detector.dart';
import 'package:flutter_test/flutter_test.dart';

import 'support/synthetic_card.dart';

void expectNear(List<double> actual, List<double> expected,
    {double tol = 1.0}) {
  for (var i = 0; i < expected.length; i++) {
    expect(actual[i], closeTo(expected[i], tol), reason: 'index $i of $actual');
  }
}

void main() {
  test('finds outer and inner borders of a card on a table', () {
    final s = SyntheticScene(900, 1200);
    s.border(150, 180, 750, 1020);
    s.art(186, 214, 717, 988);
    final d = detectBorders(s.rgba, s.w, s.h)!;
    expect(d.innerFoundX, isTrue);
    expect(d.innerFoundY, isTrue);
    expectNear(d.xs, [150, 186, 717, 750]);
    expectNear(d.ys, [180, 214, 988, 1020]);
  });

  test('handles clearly off-centre borders', () {
    final s = SyntheticScene(900, 1200, seed: 2);
    s.border(150.4, 180, 750.4, 1020);
    // 左右约 70/30，上下约 62/38。
    s.art(206.4, 222, 726.4, 994);
    final d = detectBorders(s.rgba, s.w, s.h)!;
    expectNear(d.xs, [150.4, 206.4, 726.4, 750.4]);
    expectNear(d.ys, [180, 222, 994, 1020]);
  });

  test('uses the image edge when a scan has no background', () {
    final s = SyntheticScene(600, 840, seed: 3);
    s.border(0, 0, 600, 840);
    s.art(30, 32, 571, 806);
    final d = detectBorders(s.rgba, s.w, s.h)!;
    expectNear(d.xs, [0, 30, 571, 600]);
    expectNear(d.ys, [0, 32, 806, 840]);
  });

  test('ignores a straight table edge in the background', () {
    final s = SyntheticScene(900, 1200, seed: 4);
    // 背景左侧一条贯穿上下的桌沿。
    s.fill(0, 0, 70, 1200, (_, __) => [30, 30, 30]);
    s.border(150, 180, 750, 1020);
    s.art(186, 214, 717, 988);
    final d = detectBorders(s.rgba, s.w, s.h)!;
    expectNear(d.xs, [150, 186, 717, 750]);
    expectNear(d.ys, [180, 214, 988, 1020]);
  });

  test('places default inner lines when the card has no border', () {
    final s = SyntheticScene(900, 1200, seed: 5);
    // 全图卡：外框内直接是图案。
    s.art(150, 180, 750, 1020);
    final d = detectBorders(s.rgba, s.w, s.h)!;
    expect(d.xs.first, closeTo(150, 1));
    expect(d.xs.last, closeTo(750, 1));
    expect(d.ys.first, closeTo(180, 1));
    expect(d.ys.last, closeTo(1020, 1));
    for (final v in [d.xs, d.ys]) {
      expect(v, orderedEquals([...v]..sort()));
    }
  });

  test('copes with a blurry photo of a white card on white paper', () {
    final s = SyntheticScene(900, 1200, seed: 6);
    s.fill(0, 0, 900, 1200, (_, __) => [238, 238, 234]);
    s.fill(150, 180, 750, 1020, (_, __) => [250, 250, 250]);
    s.art(186, 214, 717, 988);
    // 5×5 均值模糊，模拟对焦不准。
    final src = Uint8List.fromList(s.rgba);
    for (var y = 2; y < s.h - 2; y++) {
      for (var x = 2; x < s.w - 2; x++) {
        for (var k = 0; k < 3; k++) {
          var sum = 0;
          for (var dy = -2; dy <= 2; dy++) {
            for (var dx = -2; dx <= 2; dx++) {
              sum += src[((y + dy) * s.w + x + dx) * 4 + k];
            }
          }
          s.rgba[(y * s.w + x) * 4 + k] = sum ~/ 25;
        }
      }
    }
    final d = detectBorders(s.rgba, s.w, s.h)!;
    expectNear(d.xs, [150, 186, 717, 750], tol: 1.5);
    expectNear(d.ys, [180, 214, 988, 1020], tol: 1.5);
  });

  test('is not fooled by a text box near the bottom of the artwork', () {
    final s = SyntheticScene(900, 1200, seed: 7);
    s.border(150, 180, 750, 1020);
    s.art(186, 214, 717, 988);
    // 图案下方一个贯穿左右的白色文字框，边缘比真正的内边还明显。
    s.fill(200, 860, 703, 970, (_, __) => [250, 246, 232]);
    final d = detectBorders(s.rgba, s.w, s.h)!;
    expectNear(d.xs, [150, 186, 717, 750]);
    expectNear(d.ys, [180, 214, 988, 1020]);
  });

  test('returns null for a blank image', () {
    final rgba = Uint8List(100 * 100 * 4)..fillRange(0, 100 * 100 * 4, 128);
    expect(detectBorders(rgba, 100, 100), isNull);
  });
}
