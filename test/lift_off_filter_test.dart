import 'package:card_centering/ui/lift_off_filter.dart';
import 'package:flutter_test/flutter_test.dart';

Duration ms(int v) => Duration(milliseconds: v);

void main() {
  test('停住对准后抬手偏了几像素：退回停住的位置', () {
    final f = LiftOffFilter()..start(ms(0), 100, 10);
    f.add(ms(16), 120, 30);
    f.add(ms(32), 140, 50); // 手指在这里停住对准
    f.add(ms(400), 143, 53); // 抬手时触点偏移
    f.add(ms(410), 145, 55);
    expect(f.settle(ms(420)), 50);
  });

  test('一直在移动、没有停留过（甩动）：保留最后位置', () {
    final f = LiftOffFilter()..start(ms(0), 100, 10);
    for (var i = 1; i <= 8; i++) {
      f.add(ms(16 * i), 100.0 + 10 * i, 10.0 + 10 * i);
    }
    expect(f.settle(ms(136)), isNull);
  });

  test('慢慢移动到最后、没有停顿：保留最后位置', () {
    final f = LiftOffFilter()..start(ms(0), 100, 10);
    for (var i = 1; i <= 20; i++) {
      f.add(ms(16 * i), 100.0 + i, 10.0 + i);
    }
    expect(f.settle(ms(330)), isNull);
  });

  test('停在最后的位置一会儿再抬手：不修正', () {
    final f = LiftOffFilter()..start(ms(0), 100, 10);
    f.add(ms(16), 140, 50);
    expect(f.settle(ms(300)), isNull);
  });

  test('停留处离松手处超过阈值：不修正', () {
    final f = LiftOffFilter()..start(ms(0), 100, 10);
    f.add(ms(16), 140, 50); // 停住
    f.add(ms(300), 160, 70); // 之后又快速拖了 20 像素
    expect(f.settle(ms(310)), isNull);
  });

  test('不知道抬手时间时也能退回到停住的位置', () {
    final f = LiftOffFilter()..start(ms(0), 100, 10);
    f.add(ms(16), 140, 50);
    f.add(ms(300), 143, 53);
    expect(f.settle(null), 50);
  });
}
