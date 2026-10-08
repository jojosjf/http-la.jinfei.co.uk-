import 'dart:math' as math;

import 'package:card_centering/l10n/app_localizations.dart';
import 'package:card_centering/main.dart';
import 'package:card_centering/ui/guide_painter.dart';
import 'package:card_centering/ui/image_loader.dart';
import 'package:card_centering/ui/measure_page.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

Widget app(Widget child, {Locale locale = const Locale('zh')}) => MaterialApp(
      locale: locale,
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      home: Scaffold(body: child),
    );

Future<LoadedImage> testImage(WidgetTester tester) async {
  final image = await tester.runAsync(
    () => createTestImage(width: 100, height: 140),
  );
  // 显示图 100×140，原图按 1000×1400 计，模拟大图缩略显示。
  return LoadedImage(image!, 1000, 1400);
}

Finder handle(String name) => find.byKey(ValueKey('handle-$name'));

void main() {
  // 已同意隐私政策，不弹首次启动提示。
  setUp(() =>
      SharedPreferences.setMockInitialValues({'privacy_agreed_version': 1}));

  testWidgets('空状态显示选图按钮', (tester) async {
    await tester.pumpWidget(const CardCenteringApp());
    await tester.pumpAndSettle();
    expect(find.text('Choose a photo of your card'), findsOneWidget);
    expect(find.text('Choose photo'), findsOneWidget);
  });

  testWidgets('默认线位置为 50/50，P10', (tester) async {
    final img = await testImage(tester);
    await tester.pumpWidget(app(MeasureView(image: img)));
    expect(find.text('50/50'), findsNWidgets(2));
    expect(find.text('P10'), findsOneWidget);
    for (final n in [
      'outerLeft',
      'innerLeft',
      'innerRight',
      'outerRight',
      'outerTop',
      'innerTop',
      'innerBottom',
      'outerBottom',
    ]) {
      expect(handle(n), findsOneWidget, reason: n);
    }
  });

  testWidgets('拖动中结果实时变化', (tester) async {
    final img = await testImage(tester);
    await tester.pumpWidget(app(MeasureView(image: img)));
    final g = await tester.startGesture(tester.getCenter(handle('innerLeft')));
    // 超过起拖距离后，手指还没松开结果就已变化。
    await g.moveBy(const Offset(40, 0));
    await tester.pump();
    expect(find.text('50/50'), findsOneWidget, reason: '只剩上下仍为 50/50');
    String lr() => (tester
        .widgetList<Text>(find.textContaining('/'))
        .map((t) => t.data!)
        .where((t) => t != '50/50')).single;
    final first = lr();
    await g.moveBy(const Offset(5, 0));
    await tester.pump();
    expect(lr(), isNot(first));
    await g.up();
  });

  testWidgets('重复的移动事件不会让线跑得比手指快', (tester) async {
    final img = await testImage(tester);
    await tester.pumpWidget(app(MeasureView(image: img)));
    String lr() => tester
        .widgetList<Text>(find.textContaining('/'))
        .map((t) => t.data!)
        .first;

    final start = tester.getCenter(handle('innerLeft'));
    final end = start + const Offset(40, 0);
    await tester.sendEventToBinding(
      PointerDownEvent(pointer: 7, position: start),
    );
    await tester.sendEventToBinding(
      PointerMoveEvent(
        pointer: 7,
        position: end,
        delta: const Offset(40, 0),
      ),
    );
    await tester.pump();
    final once = lr();
    // 有的平台会把同一次移动再发一遍（位置相同，位移也相同）。
    await tester.sendEventToBinding(
      PointerMoveEvent(
        pointer: 7,
        position: end,
        delta: const Offset(40, 0),
      ),
    );
    await tester.pump();
    expect(lr(), once);
    await tester.sendEventToBinding(
      PointerUpEvent(pointer: 7, position: end),
    );
  });

  group('抬手时触点偏移', () {
    Future<double> dragAndRelease(
      WidgetTester tester,
      List<(int, double)> moves, // （毫秒, 相对按下点的水平位移）
      int upAt,
    ) async {
      final start = tester.getCenter(handle('innerLeft'));
      await tester.sendEventToBinding(
        PointerDownEvent(pointer: 9, position: start),
      );
      var last = start;
      for (final (t, dx) in moves) {
        final pos = start + Offset(dx, 0);
        await tester.sendEventToBinding(PointerMoveEvent(
          pointer: 9,
          position: pos,
          delta: pos - last,
          timeStamp: Duration(milliseconds: t),
        ));
        last = pos;
      }
      await tester.sendEventToBinding(PointerUpEvent(
        pointer: 9,
        position: last,
        timeStamp: Duration(milliseconds: upAt),
      ));
      await tester.pump();
      return tester.getCenter(handle('innerLeft')).dx - start.dx;
    }

    testWidgets('停住对准后抬手偏了几像素，线回到停住时的位置', (tester) async {
      final img = await testImage(tester);
      await tester.pumpWidget(app(MeasureView(image: img)));
      final settled = await dragAndRelease(tester, [(16, 20), (32, 40)], 40);

      await tester.pumpWidget(const SizedBox());
      await tester.pumpWidget(app(MeasureView(image: img)));
      final jittered = await dragAndRelease(
        tester,
        [(16, 20), (32, 40), (400, 43), (410, 45)],
        420,
      );
      expect(jittered, settled);
    });

    testWidgets('快速拖动后松手，线停在最后的位置', (tester) async {
      final img = await testImage(tester);
      await tester.pumpWidget(app(MeasureView(image: img)));
      final moved = await dragAndRelease(
        tester,
        [for (var i = 1; i <= 8; i++) (16 * i, 10.0 * i)],
        136,
      );
      expect(moved, closeTo(80, 1));
    });
  });

  testWidgets('任何拖法都无法越过相邻线', (tester) async {
    final img = await testImage(tester);
    await tester.pumpWidget(app(MeasureView(image: img)));

    // 内左线往左拖到底：停在外左线右侧 1 像素，L = 1，R = 60。
    await tester.drag(handle('innerLeft'), const Offset(-2000, 0));
    await tester.pump();
    expect(find.text('98/2'), findsOneWidget);

    // 外左线往右拖到底：停在内左线左侧 1 像素，仍是 L = 1。
    await tester.drag(handle('outerLeft'), const Offset(2000, 0));
    await tester.pump();
    expect(find.text('98/2'), findsOneWidget);

    // 内下线往上拖到底：停在内上线下方 1 像素，不会越过。
    await tester.drag(handle('innerBottom'), const Offset(0, -5000));
    await tester.pump();
    // B = 1288 - 197 = 1091，T = 84 → 93/7。
    expect(find.text('93/7'), findsOneWidget);
    expect(find.text('Below P3'), findsNothing);
  });

  testWidgets('点手柄选中出现微调按钮，点空白取消', (tester) async {
    final img = await testImage(tester);
    await tester.pumpWidget(app(MeasureView(image: img)));
    expect(find.byKey(const Key('nudge-plus')), findsNothing);
    await tester.tap(handle('outerTop'));
    await tester.pump();
    expect(find.text('外框上线'), findsOneWidget);
    expect(find.byIcon(Icons.arrow_upward), findsOneWidget);
    await tester.tapAt(tester.getCenter(find.byType(InteractiveViewer)));
    await tester.pump();
    expect(find.byKey(const Key('nudge-plus')), findsNothing);
  });

  testWidgets('微调每次正好移动 1 个原图像素', (tester) async {
    final img = await testImage(tester);
    await tester.pumpWidget(app(MeasureView(image: img)));
    // 先把内左线拖到外左线旁：L = 1，R = 60。
    await tester.drag(handle('innerLeft'), const Offset(-2000, 0));
    await tester.pump();
    expect(find.text('98/2'), findsOneWidget);
    await tester.tap(find.byKey(const Key('nudge-plus')));
    await tester.pump();
    expect(find.text('97/3'), findsOneWidget); // L = 2：60/62
    await tester.tap(find.byKey(const Key('nudge-plus')));
    await tester.pump();
    expect(find.text('95/5'), findsOneWidget); // L = 3：60/63
    await tester.tap(find.byKey(const Key('nudge-minus')));
    await tester.pump();
    expect(find.text('97/3'), findsOneWidget);
    // 到了相邻线也不会越过：L 最小为 1。
    for (var i = 0; i < 5; i++) {
      await tester.tap(find.byKey(const Key('nudge-minus')));
      await tester.pump();
    }
    expect(find.text('98/2'), findsOneWidget);
  });

  testWidgets('放大镜只在拖动时出现', (tester) async {
    final img = await testImage(tester);
    await tester.pumpWidget(app(MeasureView(image: img)));
    expect(find.byKey(const Key('magnifier')), findsNothing);
    final g = await tester.startGesture(tester.getCenter(handle('outerRight')));
    await g.moveBy(const Offset(-40, 0));
    await tester.pump();
    expect(find.byType(RawMagnifier), findsOneWidget);
    await g.up();
    await tester.pump();
    expect(find.byType(RawMagnifier), findsNothing);
  });

  testWidgets('双指放大后，竖线手柄仍与图片按同一矩阵对齐', (tester) async {
    final img = await testImage(tester);
    await tester.pumpWidget(app(MeasureView(image: img)));
    const vertical = ['outerLeft', 'innerLeft', 'innerRight', 'outerRight'];
    // 外框标签在线外侧、内框在线内侧，由贴线的那条边推出线的位置；
    // 被推回视口内的标签不贴线，跳过。
    final view = tester.getRect(find.byType(InteractiveViewer));
    double? lineX(String n) {
      final r = tester.getRect(handle(n));
      if (r.left <= view.left + 0.5 || r.right >= view.right - 0.5) return null;
      final leftOfLine = n == 'outerLeft' || n == 'innerRight';
      return leftOfLine ? r.right + 2 : r.left - 2;
    }

    final before = {for (final n in vertical) n: lineX(n)!};

    final viewer = tester.getCenter(find.byType(InteractiveViewer));
    final a = await tester.startGesture(viewer - const Offset(20, 0));
    final b = await tester.startGesture(
      viewer + const Offset(20, 0),
      pointer: 2,
    );
    await a.moveBy(const Offset(-120, 0));
    await b.moveBy(const Offset(120, 0));
    await tester.pump();
    await a.up();
    await b.up();
    await tester.pumpAndSettle();
    final m = tester
        .widget<InteractiveViewer>(find.byType(InteractiveViewer))
        .transformationController!
        .value;
    expect(m.getMaxScaleOnAxis(), greaterThan(1.5));

    var checked = 0;
    for (final n in vertical) {
      if (handle(n).evaluate().isEmpty) continue; // 已移出视口
      final expected = MatrixUtils.transformPoint(m, Offset(before[n]!, 0)).dx;
      final x = lineX(n);
      if (x == null) continue;
      expect(x, closeTo(expected, 1e-6), reason: n);
      checked++;
    }
    expect(checked, greaterThan(0));
  });

  testWidgets('放大镜跟随手指：拖竖线取手指高度，拖横线取手指水平位置', (tester) async {
    final img = await testImage(tester);
    await tester.pumpWidget(app(MeasureView(image: img)));

    Offset focus() {
      final m = tester.widget<RawMagnifier>(find.byType(RawMagnifier));
      return tester.getCenter(find.byType(RawMagnifier)) + m.focalPointOffset;
    }

    // 竖线：先横向拖过起拖距离，再往下移 60 点
    final start = tester.getCenter(handle('outerLeft'));
    final g = await tester.startGesture(start);
    await g.moveBy(const Offset(40, 0));
    await tester.pump();
    final lr = tester.widgetList<Text>(find.textContaining('/')).first.data;
    final f1 = focus();
    await g.moveBy(const Offset(0, 60));
    await tester.pump();
    final f2 = focus();
    expect(f2.dy - f1.dy, closeTo(60, 1e-6), reason: '放大位置跟随手指高度');
    expect(f2.dx, closeTo(f1.dx, 1e-6), reason: '仍在同一条线上');
    expect(
      tester.widgetList<Text>(find.textContaining('/')).first.data,
      lr,
      reason: '手指沿线移动不改变线的位置',
    );
    await g.up();
    await tester.pump();

    // 横线：先纵向拖过起拖距离，再往右移 50 点
    final g2 = await tester.startGesture(tester.getCenter(handle('innerTop')));
    await g2.moveBy(const Offset(0, 40));
    await tester.pump();
    final h1 = focus();
    await g2.moveBy(const Offset(50, 0));
    await tester.pump();
    final h2 = focus();
    expect(h2.dx - h1.dx, closeTo(50, 1e-6));
    expect(h2.dy, closeTo(h1.dy, 1e-6));
    await g2.up();
  });

  testWidgets('拖线时隐藏标签，松手后恢复', (tester) async {
    final img = await testImage(tester);
    await tester.pumpWidget(app(MeasureView(image: img)));
    bool shown() => tester
        .widgetList<CustomPaint>(find.byType(CustomPaint))
        .map((c) => c.painter)
        .whereType<GuidePainter>()
        .single
        .showHandles;

    expect(shown(), isTrue);
    final g = await tester.startGesture(tester.getCenter(handle('innerRight')));
    await g.moveBy(const Offset(-40, 0));
    await tester.pump();
    expect(shown(), isFalse);
    expect(find.byType(RawMagnifier), findsOneWidget);
    await g.up();
    await tester.pump();
    expect(shown(), isTrue);
  });

  group('旋转刻度盘', () {
    double imageAngle(WidgetTester tester) {
      final t = tester.widget<Transform>(
        find.byKey(const Key('rotated-image')),
      );
      // 从变换矩阵还原角度（度）。
      final m = t.transform.storage;
      return math.atan2(m[1], m[0]) * 180 / math.pi;
    }

    String angleText(WidgetTester tester) =>
        tester.widget<Text>(find.byKey(const Key('rotate-angle'))).data!;

    testWidgets('拖动刻度盘旋转图片，参考线与结果不变，画布不跳动', (tester) async {
      final img = await testImage(tester);
      await tester.pumpWidget(app(MeasureView(image: img)));
      final canvasBefore = tester.getSize(find.byType(InteractiveViewer));
      final handleBefore = tester.getRect(handle('outerLeft'));

      await tester.tap(find.byKey(const Key('rotate-open')));
      await tester.pump();
      expect(find.byKey(const Key('rotate-dial')), findsOneWidget);
      expect(tester.getSize(find.byType(InteractiveViewer)), canvasBefore);

      // 向左拖 40 点 = 顺时针 5°
      await tester.drag(
        find.byKey(const Key('rotate-dial')),
        const Offset(-40, 0),
        touchSlopX: 0,
      );
      await tester.pump();
      expect(imageAngle(tester), closeTo(5, 0.3));
      expect(angleText(tester), startsWith('5.'));
      expect(find.text('50/50'), findsNWidgets(2));
      expect(tester.getRect(handle('outerLeft')), handleBefore);

      // 归零
      await tester.tap(find.byKey(const Key('rotate-reset')));
      await tester.pump();
      expect(imageAngle(tester), closeTo(0, 1e-9));
      expect(angleText(tester), '0.0°');

      // 完成后收起刻度盘，恢复提示与旋转按钮
      await tester.tap(find.byKey(const Key('rotate-done')));
      await tester.pump();
      expect(find.byKey(const Key('rotate-dial')), findsNothing);
      expect(find.byKey(const Key('rotate-open')), findsOneWidget);
    });

    testWidgets('角度限制在 ±180°', (tester) async {
      final img = await testImage(tester);
      await tester.pumpWidget(app(MeasureView(image: img)));
      await tester.tap(find.byKey(const Key('rotate-open')));
      await tester.pump();
      for (var i = 0; i < 10; i++) {
        await tester.drag(
          find.byKey(const Key('rotate-dial')),
          const Offset(400, 0),
          touchSlopX: 0,
        );
        await tester.pump();
      }
      expect(angleText(tester), '-180.0°');
    });

    testWidgets('点手柄会收起刻度盘，进入微调', (tester) async {
      final img = await testImage(tester);
      await tester.pumpWidget(app(MeasureView(image: img)));
      await tester.tap(find.byKey(const Key('rotate-open')));
      await tester.pump();
      await tester.tap(handle('innerTop'));
      await tester.pump();
      expect(find.byKey(const Key('rotate-dial')), findsNothing);
      expect(find.byKey(const Key('nudge-plus')), findsOneWidget);
    });
  });
}
