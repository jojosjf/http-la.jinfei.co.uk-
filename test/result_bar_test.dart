import 'package:card_centering/l10n/app_localizations.dart';
import 'package:card_centering/logic/centering.dart';
import 'package:card_centering/main.dart';
import 'package:card_centering/ui/result_bar.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

CenteringResult result({required bool borderline}) => CenteringResult(
  lrBig: borderline ? 56 : 52,
  lrSmall: borderline ? 44 : 48,
  tbBig: 50,
  tbSmall: 50,
  worse: borderline ? 56 : 52,
  grade: borderline ? 9 : 10,
  borderline: borderline,
  nearGrade: borderline ? 10 : null,
);

Widget bar(CenteringResult r) => MaterialApp(
  locale: const Locale('zh'),
  localizationsDelegates: AppLocalizations.localizationsDelegates,
  supportedLocales: AppLocalizations.supportedLocales,
  home: Scaffold(
    body: Align(
      alignment: Alignment.bottomCenter,
      child: ResultBar(result: r),
    ),
  ),
);

void main() {
  testWidgets('临界提示出现与否，结果栏高度不变', (tester) async {
    await tester.pumpWidget(bar(result(borderline: false)));
    final plain = tester.getSize(find.byType(ResultBar)).height;
    expect(find.textContaining('临界'), findsNothing);

    await tester.pumpWidget(bar(result(borderline: true)));
    final withHint = tester.getSize(find.byType(ResultBar)).height;
    expect(find.text('临界：接近 PSA 10'), findsOneWidget);

    expect(withHint, plain);
  });

  Future<String> titleFor(WidgetTester tester, Locale locale) async {
    tester.platformDispatcher.localesTestValue = [locale];
    addTearDown(tester.platformDispatcher.clearLocalesTestValue);
    await tester.pumpWidget(const CardCenteringApp());
    await tester.pumpAndSettle();
    return tester
        .widget<Text>(
          find.descendant(of: find.byType(AppBar), matching: find.byType(Text)),
        )
        .data!;
  }

  testWidgets('默认中文：非英文系统都显示中文', (tester) async {
    expect(await titleFor(tester, const Locale('zh', 'CN')), '卡片居中检查');
    expect(await titleFor(tester, const Locale('ja', 'JP')), '卡片居中检查');
    expect(await titleFor(tester, const Locale('fr', 'FR')), '卡片居中检查');
  });

  testWidgets('英文系统显示英文', (tester) async {
    expect(
      await titleFor(tester, const Locale('en', 'GB')),
      'Card Centering Check',
    );
  });
}
