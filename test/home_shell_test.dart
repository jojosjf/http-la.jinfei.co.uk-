import 'package:card_centering/logic/record_store.dart';
import 'package:card_centering/main.dart';
import 'package:card_centering/ui/about_page.dart';
import 'package:card_centering/ui/measure_page.dart';
import 'package:card_centering/ui/records_page.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

/// 包住 [page] 的那个 TickerMode 是否开启（隐藏页面要关掉，动画才会暂停）。
bool tickersOn(WidgetTester tester, Type page) => tester
    .widget<TickerMode>(find
        .ancestor(
          of: find.byType(page, skipOffstage: false),
          matching: find.byType(TickerMode, skipOffstage: false),
        )
        .first)
    .enabled;

void main() {
  testWidgets('只有当前页面的动画在运行，隐藏页面不绘制', (tester) async {
    await tester.pumpWidget(
      CardCenteringApp(
          store: RecordStore(MemoryRecordBackend()), bottomNav: true),
    );
    await tester.pumpAndSettle();
    expect(tickersOn(tester, MeasurePage), isTrue);
    expect(tickersOn(tester, RecordsPage), isFalse);
    expect(tickersOn(tester, AboutPage), isFalse);

    await tester.tap(find.byIcon(Icons.info_outline));
    await tester.pumpAndSettle();
    expect(tickersOn(tester, MeasurePage), isFalse);
    expect(tickersOn(tester, RecordsPage), isFalse);
    expect(tickersOn(tester, AboutPage), isTrue);
    // 隐藏的测量页不在屏幕上（不绘制），但状态保留。
    expect(find.byType(MeasurePage), findsNothing);
    expect(find.byType(MeasurePage, skipOffstage: false), findsOneWidget);

    // 静止时不再请求新的画面帧。
    await tester.pump(const Duration(seconds: 1));
    expect(tester.binding.hasScheduledFrame, isFalse);
  });

  testWidgets('隐藏页面里正在转的进度圈不会让画面持续刷新', (tester) async {
    var index = 0;
    late StateSetter setIndex;
    await tester.pumpWidget(MaterialApp(
      home: StatefulBuilder(builder: (context, setState) {
        setIndex = setState;
        // 与 HomeShell 相同的结构：第 0 页有一直在转的进度圈。
        return Stack(children: [
          for (final (i, page) in [
            const Center(child: CircularProgressIndicator()),
            const Text('other'),
          ].indexed)
            Offstage(
              offstage: i != index,
              child: TickerMode(enabled: i == index, child: page),
            ),
        ]);
      }),
    ));
    await tester.pump(const Duration(milliseconds: 100));
    expect(tester.binding.hasScheduledFrame, isTrue);

    setIndex(() => index = 1);
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 100));
    expect(tester.binding.hasScheduledFrame, isFalse);
  });
}
