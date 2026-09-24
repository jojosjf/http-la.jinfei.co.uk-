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
      ),
      localizationsDelegates: const [
        AppLocalizations.delegate,
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      supportedLocales: AppLocalizations.supportedLocales,
      // 中文系统用中文，其他语言一律用英文。
      localeResolutionCallback: (locale, supported) =>
          locale?.languageCode == 'zh' ? const Locale('zh') : const Locale('en'),
      home: const MeasurePage(),
    );
  }
}
