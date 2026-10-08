import 'dart:async';
import 'dart:math' as math;
import 'dart:ui' as ui;

import 'package:card_centering/l10n/app_localizations.dart';
import 'package:card_centering/logic/centering.dart';
import 'package:card_centering/logic/record_store.dart';
import 'package:card_centering/main.dart';
import 'package:card_centering/models/guide_lines.dart';
import 'package:card_centering/models/measurement_record.dart';
import 'package:card_centering/ui/auto_detect.dart';
import 'package:card_centering/ui/image_loader.dart';
import 'package:card_centering/ui/measure_page.dart';
import 'package:card_centering/ui/records_page.dart';
import 'package:card_centering/ui/result_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'support/synthetic_card.dart';

Widget app(Widget child) => MaterialApp(
      locale: const Locale('zh'),
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      home: Scaffold(body: child),
    );

Future<ui.Image> imageFromScene(SyntheticScene s) {
  final c = Completer<ui.Image>();
  ui.decodeImageFromPixels(
      s.rgba, s.w, s.h, ui.PixelFormat.rgba8888, c.complete);
  return c.future;
}

/// 900×1200 的合成照片：外框 150–750 × 180–1020，图案 186–717 × 214–988。
SyntheticScene cardScene() => SyntheticScene(900, 1200)
  ..border(150, 180, 750, 1020)
  ..art(186, 214, 717, 988);

Future<ui.Image> rotated(ui.Image src, double degrees) {
  final w = src.width.toDouble(), h = src.height.toDouble();
  final rec = ui.PictureRecorder();
  ui.Canvas(rec)
    ..translate(w / 2, h / 2)
    ..rotate(degrees * math.pi / 180)
    ..translate(-w / 2, -h / 2)
    ..drawImage(src, Offset.zero, Paint()..filterQuality = FilterQuality.high);
  return rec.endRecording().toImage(src.width, src.height);
}

void expectLines(GuideLines g, List<double> expected, double tol) {
  final actual = [for (final id in LineId.values) g[id]];
  for (var i = 0; i < 8; i++) {
    expect(actual[i], closeTo(expected[i], tol), reason: '$i: $actual');
  }
}

const expectedLines = <double>[150, 186, 717, 750, 180, 214, 988, 1020];

/// 等后台的识别或出图完成（进度条消失），最多 60 秒。
Future<void> waitIdle(WidgetTester tester) async {
  for (var i = 0; i < 240; i++) {
    await tester.runAsync(
      () => Future<void>.delayed(const Duration(milliseconds: 250)),
    );
    await tester.pump();
    if (find.byKey(const Key('busy')).evaluate().isEmpty) return;
  }
  fail('still busy');
}

void main() {
  // 已同意隐私政策，不弹首次启动提示。
  setUp(() =>
      SharedPreferences.setMockInitialValues({'privacy_agreed_version': 1}));

  group('自动识别', () {
    testWidgets('在缩小的图上识别，换算回原图坐标', (tester) async {
      await tester.runAsync(() async {
        final img = await imageFromScene(cardScene());
        // 显示图 900×1200，原图按 2700×3600 计。
        final found = await autoDetect(LoadedImage(img, 2700, 3600));
        expect(found!.angle, 0);
        expectLines(
            found.lines, [for (final v in expectedLines) v * 3], 3 * 1.5);
        img.dispose();
      });
    });

    testWidgets('按当前旋转角度识别', (tester) async {
      await tester.runAsync(() async {
        final straight = await imageFromScene(cardScene());
        // 照片里的卡片逆时针歪了 4°；用户把图顺时针转 4° 摆正后再识别。
        final tilted = await rotated(straight, -4);
        final found = await autoDetect(
          LoadedImage(tilted, 900, 1200),
          angle: 4,
          straighten: false,
        );
        expect(found!.angle, 4);
        expectLines(found.lines, expectedLines, 2.5);
        straight.dispose();
        tilted.dispose();
      });
    });

    testWidgets('照片歪了会先自动摆正', (tester) async {
      await tester.runAsync(() async {
        final straight = await imageFromScene(cardScene());
        final tilted = await rotated(straight, -3.5);
        final found = await autoDetect(LoadedImage(tilted, 900, 1200));
        expect(found!.angle, closeTo(3.5, 0.25));
        expectLines(found.lines, expectedLines, 3);
        straight.dispose();
        tilted.dispose();
      });
    });

    testWidgets('点“自动识别”后参考线就位并提示', (tester) async {
      final img = await tester.runAsync(() => imageFromScene(cardScene()));
      await tester
          .pumpWidget(app(MeasureView(image: LoadedImage(img!, 900, 1200))));
      expect(find.text('50/50'), findsNWidgets(2));
      await tester.tap(find.byKey(const Key('tool-auto')));
      await tester.pump();
      expect(find.byKey(const Key('busy')), findsOneWidget);
      await waitIdle(tester);
      // L 36、R 33，T 34、B 32，都约为 52/48（识别误差 1 像素以内）。
      expect(find.text('50/50'), findsNothing);
      expect(find.textContaining(RegExp(r'^5[1-3]/4[7-9]$')), findsNWidgets(2));
      expect(find.text('已自动识别卡片边框，可拖动手柄微调'), findsOneWidget);
      expect(find.byKey(const Key('busy')), findsNothing);
    });

    testWidgets('识别不出时保留原来的线并提示手动调整', (tester) async {
      final img = await tester.runAsync(
        () => createTestImage(width: 100, height: 140),
      );
      await tester
          .pumpWidget(app(MeasureView(image: LoadedImage(img!, 100, 140))));
      await tester.tap(find.byKey(const Key('tool-auto')));
      await tester.pump();
      await waitIdle(tester);
      expect(find.text('50/50'), findsNWidgets(2));
      expect(find.text('没能识别出卡片边框，请手动拖动参考线'), findsOneWidget);
    });
  });

  group('测量记录', () {
    testWidgets('保存记录：填备注后出现在记录页', (tester) async {
      final store = RecordStore(MemoryRecordBackend());
      final img = await tester.runAsync(
        () => createTestImage(width: 100, height: 140),
      );
      await tester.pumpWidget(
        app(MeasureView(image: LoadedImage(img!, 1000, 1400), store: store)),
      );
      await tester.tap(find.byKey(const Key('tool-save')));
      await tester.pumpAndSettle();
      expect(find.text('保存测量记录'), findsOneWidget);
      await tester.enterText(find.byKey(const Key('record-note')), '皮卡丘');
      await tester.tap(find.byKey(const Key('record-save')));
      await tester.pumpAndSettle();
      expect(find.text('已保存到测量记录'), findsOneWidget);
      expect(store.records.single.note, '皮卡丘');
      expect(store.records.single.grade, 10);
    });

    testWidgets('没有记录功能时不显示“保存”', (tester) async {
      final img = await tester.runAsync(
        () => createTestImage(width: 100, height: 140),
      );
      await tester
          .pumpWidget(app(MeasureView(image: LoadedImage(img!, 1000, 1400))));
      expect(find.byKey(const Key('tool-save')), findsNothing);
      expect(find.byKey(const Key('tool-auto')), findsOneWidget);
      expect(find.byKey(const Key('tool-image')), findsOneWidget);
    });

    Future<RecordStore> filledStore() async {
      final store = RecordStore(MemoryRecordBackend());
      final g = GuideLines.defaults(1000, 1400);
      Future<void> add(String note, double shift, int minute) => store.add(
            MeasurementRecord.fromResult(
              computeCentering(
                g.withLine(
                  LineId.innerLeft,
                  g.innerLeft + shift,
                  width: 1000,
                  height: 1400,
                ),
              ),
              note: note,
              time: DateTime(2026, 9, 28, 10, minute),
            ),
          );
      await add('中等', 30, 1); // 60/40 → 9
      await add('最好', 0, 2); // 50/50 → 10
      await add('最差', -59, 3); // 低于标准
      await add('', 12, 4); // 54/46 → 10，未命名
      return store;
    }

    List<String> titles(WidgetTester tester) => [
          for (final t in tester.widgetList<Text>(
            find.descendant(of: find.byType(Card), matching: find.byType(Text)),
          ))
            if (const ['中等', '最好', '最差', 'Untitled card'].contains(t.data))
              t.data!,
        ];

    testWidgets('记录页按时间或等级排列', (tester) async {
      final store = await tester.runAsync(filledStore);
      await tester.pumpWidget(CardCenteringApp(store: store, bottomNav: true));
      await tester.pumpAndSettle();
      // 测试环境默认英文界面。
      await tester.tap(find.text('Records'));
      await tester.pumpAndSettle();
      expect(titles(tester), ['Untitled card', '最差', '最好', '中等']);
      // 列表里等级只写数字，不出现“PSA”。
      final page = find.byType(RecordsPage);
      expect(
        find.descendant(of: page, matching: find.textContaining('PSA')),
        findsNothing,
      );
      expect(find.descendant(of: page, matching: find.text('10')),
          findsNWidgets(2));
      expect(find.descendant(of: page, matching: find.text('Below 3')),
          findsOneWidget);
      await tester.tap(find.text('Grade'));
      await tester.pumpAndSettle();
      // 同为 10 级时，较差一侧比例小的在前。
      expect(titles(tester), ['最好', 'Untitled card', '中等', '最差']);
    });

    testWidgets('左滑删除，可以撤销；清空需确认', (tester) async {
      final store = await tester.runAsync(filledStore);
      await tester.pumpWidget(CardCenteringApp(store: store, bottomNav: true));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Records'));
      await tester.pumpAndSettle();

      await tester.drag(find.text('最差'), const Offset(-500, 0));
      await tester.pumpAndSettle();
      expect(find.text('最差'), findsNothing);
      expect(store!.records.length, 3);
      await tester.tap(find.text('Undo'));
      await tester.pumpAndSettle();
      expect(titles(tester), ['Untitled card', '最差', '最好', '中等']);

      await tester.tap(find.byKey(const Key('records-clear')));
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const Key('clear-confirm')));
      await tester.pumpAndSettle();
      expect(store.records, isEmpty);
      expect(find.text('No measurements yet'), findsOneWidget);
    });
  });

  group('结果图', () {
    testWidgets('生成 1080 宽的 PNG，含整张卡片', (tester) async {
      await tester.runAsync(() async {
        final img = await imageFromScene(cardScene());
        final loaded = LoadedImage(img, 900, 1200);
        final lines =
            GuideLines.fromValues(expectedLines, width: 900, height: 1200);
        final l10n = await AppLocalizations.delegate.load(const Locale('zh'));
        final rendered = await renderResultImage(
          image: loaded,
          angle: 0,
          lines: lines,
          result: computeCentering(lines),
          l10n: l10n,
        );
        expect(rendered.image.width, 1080);
        final codec = await ui.instantiateImageCodec(rendered.png);
        final frame = (await codec.getNextFrame()).image;
        expect(frame.width, 1080);
        // 卡片 600×840 按 984 宽缩放（含 5% 余量）后高约 1307，再加文字区。
        expect(frame.height, greaterThan(1400));
        expect(frame.height, lessThan(1900));
        frame.dispose();
        rendered.dispose();
        img.dispose();
      });
    });

    testWidgets('预览后保存到相册', (tester) async {
      final calls = <MethodCall>[];
      const channel = MethodChannel('card_centering/image_saver');
      final messenger = tester.binding.defaultBinaryMessenger;
      messenger.setMockMethodCallHandler(channel, (call) async {
        calls.add(call);
        return 'saved';
      });
      addTearDown(() => messenger.setMockMethodCallHandler(channel, null));
      final img = await tester.runAsync(
        () => createTestImage(width: 100, height: 140),
      );
      await tester
          .pumpWidget(app(MeasureView(image: LoadedImage(img!, 1000, 1400))));
      await tester.tap(find.byKey(const Key('tool-image')));
      await tester.pump();
      await tester
          .runAsync(() => Future<void>.delayed(const Duration(seconds: 2)));
      await tester.pumpAndSettle();
      expect(find.byKey(const Key('result-image')), findsOneWidget);
      await tester.tap(find.byKey(const Key('result-image-save')));
      await tester.pumpAndSettle();
      expect(find.byKey(const Key('result-image')), findsNothing);
      expect(find.text('已保存到相册'), findsOneWidget);
      expect(calls.single.method, 'saveImage');
      final args = calls.single.arguments as Map;
      expect(args['name'], matches(RegExp(r'^card_centering_\d+\.png$')));
      expect((args['bytes'] as List).length, greaterThan(1000));
    });

    testWidgets('没有原生实现时提示保存失败', (tester) async {
      final img = await tester.runAsync(
        () => createTestImage(width: 100, height: 140),
      );
      await tester
          .pumpWidget(app(MeasureView(image: LoadedImage(img!, 1000, 1400))));
      await tester.tap(find.byKey(const Key('tool-image')));
      await tester.pump();
      await tester
          .runAsync(() => Future<void>.delayed(const Duration(seconds: 2)));
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const Key('result-image-save')));
      // 没有原生实现时，平台通道在真实的异步中返回“未实现”。
      await tester.runAsync(
          () => Future<void>.delayed(const Duration(milliseconds: 200)));
      await tester.pumpAndSettle();
      expect(find.byKey(const Key('result-image')), findsNothing);
      expect(find.text('保存失败，请稍后再试'), findsOneWidget);
    });
  });

  group('底部导航开关', () {
    testWidgets('打开时有测量、记录、说明三个页面', (tester) async {
      await tester.pumpWidget(
        CardCenteringApp(
            store: RecordStore(MemoryRecordBackend()), bottomNav: true),
      );
      await tester.pumpAndSettle();
      expect(find.byType(NavigationBar), findsOneWidget);
      expect(find.byKey(const Key('more-menu')), findsNothing);
      await tester.tap(find.byIcon(Icons.info_outline));
      await tester.pumpAndSettle();
      expect(find.textContaining('How to use'), findsOneWidget);
      await tester.tap(find.byIcon(Icons.crop_free));
      await tester.pumpAndSettle();
      expect(find.text('Choose photo'), findsOneWidget);
    });

    testWidgets('关闭时没有导航栏，记录和说明在“更多”菜单里', (tester) async {
      await tester.pumpWidget(
        CardCenteringApp(
            store: RecordStore(MemoryRecordBackend()), bottomNav: false),
      );
      await tester.pumpAndSettle();
      expect(find.byType(NavigationBar), findsNothing);
      expect(find.byType(MeasurePage), findsOneWidget);
      await tester.tap(find.byKey(const Key('more-menu')));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Records'));
      await tester.pumpAndSettle();
      expect(find.text('No measurements yet'), findsOneWidget);
      await tester.pageBack();
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const Key('more-menu')));
      await tester.pumpAndSettle();
      await tester.tap(find.text('About'));
      await tester.pumpAndSettle();
      expect(find.textContaining('How to use'), findsOneWidget);
    });
  });
}
