import 'package:flutter/material.dart';

import '../l10n/app_localizations.dart';
import 'privacy.dart';

/// “说明”页：使用方法、测量记录、结果图、隐私与免责。
class AboutPage extends StatelessWidget {
  const AboutPage({super.key});

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    return Scaffold(
      appBar: AppBar(title: Text(l10n.about)),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(20, 12, 20, 32),
          children: [
            for (final para in l10n.aboutBody.split('\n\n'))
              Padding(
                padding: const EdgeInsets.only(bottom: 16),
                child: Text(
                  para,
                  style: theme.textTheme.bodyLarge?.copyWith(height: 1.6),
                ),
              ),
            Align(
              alignment: Alignment.centerLeft,
              child: OutlinedButton.icon(
                key: const Key('about-privacy'),
                onPressed: () => showPrivacyPolicy(context),
                icon: const Icon(Icons.privacy_tip_outlined),
                label: Text(l10n.privacyPolicy),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
