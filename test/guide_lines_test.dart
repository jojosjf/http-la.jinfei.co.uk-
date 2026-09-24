import 'package:card_centering/models/guide_lines.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  const w = 1000.0, h = 1400.0;
  final g = GuideLines.defaults(w, h);

  GuideLines move(LineId id, double v) => g.withLine(id, v, width: w, height: h);

  test('默认位置', () {
    expect(
      [g.outerLeft, g.innerLeft, g.innerRight, g.outerRight],
      [80, 140, 860, 920],
    );
    final ys = [g.outerTop, g.innerTop, g.innerBottom, g.outerBottom];
    const expected = [112, 196, 1204, 1288];
    for (var i = 0; i < 4; i++) {
      expect(ys[i], closeTo(expected[i], 1e-9));
    }
  });

  test('范围内移动不受影响', () {
    expect(move(LineId.innerLeft, 120)[LineId.innerLeft], 120);
    expect(move(LineId.outerBottom, 1300)[LineId.outerBottom], 1300);
  });

  test('不能越过相邻线，至少相隔 1 像素', () {
    expect(move(LineId.innerLeft, 50)[LineId.innerLeft], 81);
    expect(move(LineId.innerLeft, 5000)[LineId.innerLeft], 859);
    expect(move(LineId.outerLeft, 500)[LineId.outerLeft], 139);
    expect(move(LineId.innerBottom, 100)[LineId.innerBottom], closeTo(197, 1e-9));
    expect(move(LineId.innerTop, 1300)[LineId.innerTop], 1203);
  });

  test('最外侧的线不超出图片', () {
    expect(move(LineId.outerLeft, -30)[LineId.outerLeft], 0);
    expect(move(LineId.outerRight, 2000)[LineId.outerRight], w);
    expect(move(LineId.outerTop, -1)[LineId.outerTop], 0);
    expect(move(LineId.outerBottom, 1e9)[LineId.outerBottom], h);
  });

  test('只改动指定的那条线，原对象不变', () {
    final m = move(LineId.innerRight, 800);
    for (final id in LineId.values) {
      expect(m[id], id == LineId.innerRight ? 800 : g[id]);
    }
    expect(g.innerRight, 860);
  });
}
