import 'package:flutter/material.dart';

import '../l10n/app_localizations.dart';
import '../logic/record_store.dart';
import 'about_page.dart';
import 'measure_page.dart';
import 'records_page.dart';

/// 主界面。[bottomNav] 为 true 时底部有“测量 / 记录 / 说明”三个页面；
/// 为 false 时只有测量页，另外两页从右上角“更多”菜单进入。
class HomeShell extends StatefulWidget {
  const HomeShell({super.key, required this.store, required this.bottomNav});

  final RecordStore store;
  final bool bottomNav;

  @override
  State<HomeShell> createState() => _HomeShellState();
}

class _HomeShellState extends State<HomeShell> {
  int _index = 0;

  @override
  Widget build(BuildContext context) {
    if (!widget.bottomNav) {
      return MeasurePage(store: widget.store, showMenu: true);
    }
    final l10n = AppLocalizations.of(context);
    return Scaffold(
      // 切换页面时保留测量页的图片和参考线。隐藏的页面不绘制，动画也暂停
      // （IndexedStack 会让隐藏页面的动画继续运行，白白耗电）。
      body: Stack(
        fit: StackFit.expand,
        children: [
          for (final (i, page) in [
            MeasurePage(store: widget.store),
            RecordsPage(store: widget.store),
            const AboutPage(),
          ].indexed)
            Offstage(
              key: ValueKey('tab-$i'),
              offstage: i != _index,
              child: TickerMode(enabled: i == _index, child: page),
            ),
        ],
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _index,
        onDestinationSelected: (i) => setState(() => _index = i),
        destinations: [
          NavigationDestination(
            icon: const Icon(Icons.crop_free),
            label: l10n.measureTab,
          ),
          NavigationDestination(
            icon: const Icon(Icons.bookmarks_outlined),
            selectedIcon: const Icon(Icons.bookmarks),
            label: l10n.recordsTab,
          ),
          NavigationDestination(
            icon: const Icon(Icons.info_outline),
            selectedIcon: const Icon(Icons.info),
            label: l10n.about,
          ),
        ],
      ),
    );
  }
}
