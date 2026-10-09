import 'dart:io' show Platform;

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../l10n/app_localizations.dart';
import '../logic/privacy_consent.dart';

/// 打开完整的隐私政策页面。
void showPrivacyPolicy(BuildContext context) {
  Navigator.of(context).push(
    MaterialPageRoute<void>(builder: (_) => const PrivacyPolicyPage()),
  );
}

/// 首次启动时弹出隐私政策提示，同意后才能使用。
///
/// 国内安卓应用商店要求 App 首次启动时用弹窗告知隐私规则。
/// 只在安卓上弹：鸿蒙版接入了华为应用市场的隐私声明托管，由系统在首次打开时
/// 弹出，App 再弹一次会被审核拒绝；App Store 没有这个要求；网页也没有“退出应用”。
/// 各平台都能从“说明”里打开完整的隐私政策。
class PrivacyGate extends StatefulWidget {
  const PrivacyGate({super.key, required this.child});

  final Widget child;

  @override
  State<PrivacyGate> createState() => _PrivacyGateState();
}

/// 是否需要 App 自己弹隐私提示。鸿蒙版 Flutter 的 [operatingSystem] 是 'ohos'。
@visibleForTesting
bool needsPrivacyPrompt({
  required bool isWeb,
  required TargetPlatform platform,
  required String operatingSystem,
}) =>
    !isWeb && platform == TargetPlatform.android && operatingSystem != 'ohos';

class _PrivacyGateState extends State<PrivacyGate> {
  @override
  void initState() {
    super.initState();
    if (needsPrivacyPrompt(
      isWeb: kIsWeb,
      platform: defaultTargetPlatform,
      operatingSystem: kIsWeb ? '' : Platform.operatingSystem,
    )) {
      _checkConsent();
    }
  }

  Future<void> _checkConsent() async {
    if (await hasAgreedToPrivacyPolicy() || !mounted) return;
    while (mounted) {
      if (await _ask(_PromptDialog.new)) {
        await recordPrivacyAgreement();
        return;
      }
      if (!mounted) return;
      if (await _ask(_DisagreeDialog.new)) {
        // “再看看”：回到隐私提示。
        continue;
      }
      await SystemNavigator.pop();
      return;
    }
  }

  /// 弹出不能点空白处或返回键关闭的对话框，返回用户是否点了主按钮。
  Future<bool> _ask(Widget Function() dialog) async {
    final result = await showDialog<bool>(
      context: context,
      barrierDismissible: false,
      builder: (_) => PopScope(canPop: false, child: dialog()),
    );
    return result ?? false;
  }

  @override
  Widget build(BuildContext context) => widget.child;
}

class _PromptDialog extends StatelessWidget {
  const _PromptDialog();

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return AlertDialog(
      title: Text(l10n.privacyPromptTitle),
      content: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(l10n.privacyPromptBody),
            const SizedBox(height: 8),
            TextButton(
              style: TextButton.styleFrom(padding: EdgeInsets.zero),
              onPressed: () => showPrivacyPolicy(context),
              child: Text(l10n.privacyViewFull),
            ),
          ],
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(false),
          child: Text(l10n.privacyDisagree),
        ),
        FilledButton(
          onPressed: () => Navigator.of(context).pop(true),
          child: Text(l10n.privacyAgree),
        ),
      ],
    );
  }
}

class _DisagreeDialog extends StatelessWidget {
  const _DisagreeDialog();

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return AlertDialog(
      title: Text(l10n.privacyDisagreeTitle),
      content: Text(l10n.privacyDisagreeBody),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(false),
          child: Text(l10n.privacyExit),
        ),
        FilledButton(
          onPressed: () => Navigator.of(context).pop(true),
          child: Text(l10n.privacyBack),
        ),
      ],
    );
  }
}

/// 完整的隐私政策。正文里以“## ”开头的行是小标题。
class PrivacyPolicyPage extends StatelessWidget {
  const PrivacyPolicyPage({super.key});

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final lines = [
      ...l10n.privacyPolicyBody.split('\n'),
      ...l10n
          .privacyContact(l10n.privacyDeveloper, l10n.privacyEmail)
          .split('\n'),
    ];
    return Scaffold(
      appBar: AppBar(title: Text(l10n.privacyPolicy)),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(20, 8, 20, 32),
          children: [
            for (final line in lines)
              if (line.startsWith('## '))
                Padding(
                  padding: const EdgeInsets.only(top: 20, bottom: 6),
                  child: Text(
                    line.substring(3),
                    style: theme.textTheme.titleMedium,
                  ),
                )
              else if (line.isNotEmpty)
                Padding(
                  padding: const EdgeInsets.only(bottom: 6),
                  child: Text(
                    line,
                    style: theme.textTheme.bodyMedium?.copyWith(height: 1.6),
                  ),
                ),
          ],
        ),
      ),
    );
  }
}
