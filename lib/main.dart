import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';

import 'l10n/app_localizations.dart';
import 'ui/measure_page.dart';

void main() {
  runApp(const CardCenteringApp());
}

class CardCenteringApp extends StatelessWidget {
  const CardCenteringApp({super.key});

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
      home: const MeasurePage(),
    );
  }
}
