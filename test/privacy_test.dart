import 'package:card_centering/main.dart';
import 'package:card_centering/ui/privacy.dart';
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

  Future<void> launch(WidgetTester tester) async {
    tester.platformDispatcher.localesTestValue = [const Locale('zh', 'CN')];
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
    await tester.pumpWidget(const CardCenteringApp());
    await tester.pumpAndSettle();
  }

  testWidgets('首次启动弹出隐私提示，同意后不再弹', (tester) async {
    await launch(tester);
    expect(find.text('隐私政策提示'), findsOneWidget);

    await tester.tap(find.text('同意'));
    await tester.pumpAndSettle();
    expect(find.text('隐私政策提示'), findsNothing);
    final prefs = await SharedPreferences.getInstance();
    expect(prefs.getInt('privacy_agreed_version'), 1);

    // 再次打开：已同意，不弹。
    await tester.pumpWidget(const SizedBox());
    await launch(tester);
    expect(find.text('隐私政策提示'), findsNothing);
    expect(find.text('选择一张卡片照片'), findsOneWidget);
  });

  testWidgets('点空白处和返回键都关不掉提示', (tester) async {
    await launch(tester);
    await tester.tapAt(const Offset(5, 5));
    await tester.pumpAndSettle();
    expect(find.text('隐私政策提示'), findsOneWidget);

    await tester.binding.handlePopRoute();
    await tester.pumpAndSettle();
    expect(find.text('隐私政策提示'), findsOneWidget);
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
    final prefs = await SharedPreferences.getInstance();
    expect(prefs.getInt('privacy_agreed_version'), isNull);
  });

  testWidgets('提示里可以打开完整隐私政策，看完回到提示', (tester) async {
    await launch(tester);
    await tester.tap(find.text('查看《隐私政策》'));
    await tester.pumpAndSettle();
    expect(find.text('一、我们收集的个人信息'), findsOneWidget);

    await tester.tap(find.byTooltip(
        MaterialLocalizations.of(tester.element(find.byType(PrivacyPolicyPage)))
            .backButtonTooltip));
    await tester.pumpAndSettle();
    expect(find.text('隐私政策提示'), findsOneWidget);
  });

  testWidgets('“说明”里随时可以打开隐私政策', (tester) async {
    SharedPreferences.setMockInitialValues({'privacy_agreed_version': 1});
    await launch(tester);
    await tester.tap(find.byTooltip('说明'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('隐私政策'));
    await tester.pumpAndSettle();
    expect(find.text('一、我们收集的个人信息'), findsOneWidget);
    await tester.scrollUntilVisible(find.textContaining('电子邮箱：'), 300);
    expect(find.textContaining('开发者：'), findsOneWidget);
  });

  testWidgets('英文系统显示英文隐私提示', (tester) async {
    await tester.pumpWidget(const SizedBox());
    tester.platformDispatcher.localesTestValue = [const Locale('en', 'US')];
    addTearDown(tester.platformDispatcher.clearLocalesTestValue);
    await tester.pumpWidget(const CardCenteringApp());
    await tester.pumpAndSettle();
    expect(find.text('Privacy notice'), findsOneWidget);
    expect(find.text('Agree'), findsOneWidget);
  });
}
