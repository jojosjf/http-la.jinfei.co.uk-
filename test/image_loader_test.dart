import 'dart:typed_data';
import 'dart:ui' as ui;

import 'package:card_centering/ui/image_loader.dart';
import 'package:flutter_test/flutter_test.dart';

Future<Uint8List> png(int w, int h) async {
  final image = await createTestImage(width: w, height: h);
  final data = await image.toByteData(format: ui.ImageByteFormat.png);
  image.dispose();
  return data!.buffer.asUint8List();
}

void main() {
  testWidgets('小图按原尺寸解码', (tester) async {
    await tester.runAsync(() async {
      final img = await decodeForDisplay(await png(120, 160));
      expect([img.width, img.height], [120, 160]);
      expect([img.image.width, img.image.height], [120, 160]);
      img.dispose();
    });
  });

  testWidgets('超过像素上限的图缩小显示，但保留原图尺寸', (tester) async {
    await tester.runAsync(() async {
      final img = await decodeForDisplay(await png(400, 300), maxPixels: 12000);
      expect([img.width, img.height], [400, 300]);
      expect(
        img.image.width * img.image.height,
        lessThanOrEqualTo(12000 * 1.05),
      );
      expect(img.image.width / img.image.height, closeTo(4 / 3, 0.05));
      expect(img.displayToOriginal, closeTo(400 / img.image.width, 1e-9));
      img.dispose();
    });
  });

  testWidgets('无法识别的数据报错而不是崩溃', (tester) async {
    await tester.runAsync(() async {
      await expectLater(
        decodeForDisplay(Uint8List.fromList(List.filled(64, 7))),
        throwsA(anything),
      );
    });
  });
}
