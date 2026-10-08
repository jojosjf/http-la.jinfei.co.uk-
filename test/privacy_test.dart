import 'package:card_centering/logic/record_store.dart';
import 'package:card_centering/main.dart';
import 'package:card_centering/ui/privacy.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  late List<String> platformCalls;

  setUp(() {
    SharedPreferences.setMockInitialValues({});
    platformCalls = [];
  });

  Future<void> launch(WidgetTester tester,
      {Locale locale = const Locale('zh', 'CN')}) async {
    tester.platformDispatcher.localesTestValue = [locale];
    addTearDown(tester.platformDispatcher.clearLocalesTestValue);
    tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(
      SystemChannels.platform,
      (call) async {
        platformCalls.add(call.method);
        return null;
      },
    );
    addTearDown(
      () => tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(
        SystemChannels.platform,
        null,
      ),
    );
    await tester.pumpWidget(
      CardCenteringApp(
          store: RecordStore(MemoryRecordBackend()), bottomNav: true),
    );
    await tester.pumpAndSettle();
  }

  testWidgets('安卓首次启动弹出隐私提示，同意后不再弹', (tester) async {
    await launch(tester);
    expect(find.text('隐私政策提示'), findsOneWidget);
    await tester.tap(find.text('同意'));
    await tester.pumpAndSettle();
    expect(find.text('隐私政策提示'), findsNothing);
    final prefs = await SharedPreferences.getInstance();
    expect(prefs.getInt('privacy_agreed_version'), 1);

    await tester.pumpWidget(const SizedBox());
    await launch(tester);
    expect(find.text('隐私政策提示'), findsNothing);
  });

  testWidgets('不同意：再看看回到提示，退出应用则关闭 App', (tester) async {
    await launch(tester);
    await tester.tap(find.text('不同意'));
    await tester.pumpAndSettle();
    expect(find.text('温馨提示'), findsOneWidget);
    await tester.tap(find.text('再看看'));
    await tester.pumpAndSettle();
    expect(find.text('隐私政策提示'), findsOneWidget);
    await tester.tap(find.text('不同意'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('退出应用'));
    await tester.pumpAndSettle();
    expect(platformCalls, contains('SystemNavigator.pop'));
  });

  testWidgets('提示里可以打开完整隐私政策，内容包含测量记录和结果图', (tester) async {
    await launch(tester);
    await tester.tap(find.text('查看《隐私政策》'));
    await tester.pumpAndSettle();
    expect(find.text('三、测量记录'), findsOneWidget);
    await tester.scrollUntilVisible(find.text('四、结果图'), 300);
    expect(find.text('四、结果图'), findsOneWidget);
    await tester.tap(find.byTooltip(
        MaterialLocalizations.of(tester.element(find.byType(PrivacyPolicyPage)))
            .backButtonTooltip));
    await tester.pumpAndSettle();
    expect(find.text('隐私政策提示'), findsOneWidget);
  });

  testWidgets('“说明”页里随时可以打开隐私政策', (tester) async {
    SharedPreferences.setMockInitialValues({'privacy_agreed_version': 1});
    await launch(tester);
    await tester.tap(find.byIcon(Icons.info_outline));
    await tester.pumpAndSettle();
    await tester.scrollUntilVisible(
        find.byKey(const Key('about-privacy')), 300);
    await tester.tap(find.byKey(const Key('about-privacy')));
    await tester.pumpAndSettle();
    expect(find.byType(PrivacyPolicyPage), findsOneWidget);
    await tester.scrollUntilVisible(find.textContaining('电子邮箱：'), 300);
    expect(find.textContaining('开发者：'), findsOneWidget);
  });

  testWidgets('iOS 不弹隐私提示', (tester) async {
    debugDefaultTargetPlatformOverride = TargetPlatform.iOS;
    await launch(tester);
    expect(find.text('隐私政策提示'), findsNothing);
    debugDefaultTargetPlatformOverride = null;
  });
}
