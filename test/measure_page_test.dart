import 'package:card_centering/l10n/app_localizations.dart';
import 'package:card_centering/main.dart';
import 'package:card_centering/ui/image_loader.dart';
import 'package:card_centering/ui/measure_page.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

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
  testWidgets('空状态显示选图按钮', (tester) async {
    await tester.pumpWidget(const CardCenteringApp());
    await tester.pumpAndSettle();
    expect(find.text('Choose a photo of your card'), findsOneWidget);
    expect(find.text('Choose photo'), findsOneWidget);
  });

  testWidgets('默认线位置为 50/50，PSA 10', (tester) async {
    final img = await testImage(tester);
    await tester.pumpWidget(app(MeasureView(image: img)));
    expect(find.text('50/50'), findsNWidgets(2));
    expect(find.text('PSA 10'), findsOneWidget);
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
    String lr() =>
        (tester
                .widgetList<Text>(find.textContaining('/'))
                .map((t) => t.data!)
                .where((t) => t != '50/50'))
            .single;
    final first = lr();
    await g.moveBy(const Offset(5, 0));
    await tester.pump();
    expect(lr(), isNot(first));
    await g.up();
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
    expect(find.text('Below PSA 3'), findsNothing);
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
    final before = {
      for (final n in vertical) n: tester.getCenter(handle(n)).dx,
    };

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
      expect(
        tester.getCenter(handle(n)).dx,
        closeTo(expected, 1e-6),
        reason: n,
      );
      checked++;
    }
    expect(checked, greaterThan(0));
  });
}
