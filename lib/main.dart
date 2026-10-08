import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';

import 'app_config.dart';
import 'l10n/app_localizations.dart';
import 'logic/record_store.dart';
import 'ui/home_shell.dart';
import 'ui/privacy.dart';
import 'ui/web_fonts.dart';

void main() {
  runApp(const CardCenteringApp());
  // 网页版在后台加载常用汉字字体，不耽误首屏。
  loadCommonChineseFont();
}

class CardCenteringApp extends StatefulWidget {
  const CardCenteringApp(
      {super.key, this.store, this.bottomNav = showBottomNav});

  /// 测量记录；不传时存在本机。
  final RecordStore? store;

  /// 是否显示底部导航，默认见 [showBottomNav]。
  final bool bottomNav;

  @override
  State<CardCenteringApp> createState() => _CardCenteringAppState();
}

class _CardCenteringAppState extends State<CardCenteringApp> {
  late final RecordStore _store =
      widget.store ?? RecordStore(PrefsRecordBackend());

  @override
  void initState() {
    super.initState();
    _store.load();
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      onGenerateTitle: (context) => AppLocalizations.of(context).appTitle,
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: Colors.indigo),
        // 网页版用内置字体，不从谷歌服务器下载（国内常加载失败）；
        // 手机上用系统字体。
        fontFamily: kIsWeb ? 'NotoSansSCSubset' : null,
        // 界面字体只含界面用到的字；用户输入的其他汉字用常用字字体显示。
        fontFamilyFallback: kIsWeb ? const ['NotoSansSCCommon'] : null,
      ),
      localizationsDelegates: const [
        AppLocalizations.delegate,
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      supportedLocales: AppLocalizations.supportedLocales,
      // 主要面向国内市场：只有英文系统显示英文，其他语言一律显示中文。
      localeResolutionCallback: (locale, supported) =>
          locale?.languageCode == 'en'
              ? const Locale('en')
              : const Locale('zh'),
      home: PrivacyGate(
          child: HomeShell(store: _store, bottomNav: widget.bottomNav)),
    );
  }
}
