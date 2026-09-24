import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';

import '../l10n/app_localizations.dart';
import '../logic/centering.dart';
import '../models/guide_lines.dart';
import 'canvas_geometry.dart';
import 'guide_painter.dart';
import 'image_loader.dart';
import 'picked_file_cleanup.dart';
import 'result_bar.dart';

/// 唯一的页面：空状态，或图片 + 参考线 + 结果栏。
class MeasurePage extends StatefulWidget {
  const MeasurePage({super.key});

  @override
  State<MeasurePage> createState() => _MeasurePageState();
}

class _MeasurePageState extends State<MeasurePage> {
  LoadedImage? _image;
  bool _loading = false;

  @override
  void dispose() {
    _image?.dispose();
    super.dispose();
  }

  Future<void> _pick() async {
    final l10n = AppLocalizations.of(context);
    final messenger = ScaffoldMessenger.of(context);
    final XFile? file;
    try {
      // requestFullMetadata: false —— iOS 上不需要相册访问权限。
      file = await ImagePicker().pickImage(
        source: ImageSource.gallery,
        requestFullMetadata: false,
      );
    } catch (_) {
      messenger.showSnackBar(SnackBar(content: Text(l10n.imageLoadFailed)));
      return;
    }
    if (file == null) return;

    setState(() => _loading = true);
    LoadedImage? loaded;
    try {
      final bytes = await file.readAsBytes();
      await deletePickedCopy(file.path);
      loaded = await decodeForDisplay(bytes);
    } catch (_) {
      loaded = null;
    }
    if (!mounted) {
      loaded?.dispose();
      return;
    }
    setState(() {
      _loading = false;
      if (loaded != null) {
        _image?.dispose();
        _image = loaded;
      }
    });
    if (loaded == null) {
      messenger.showSnackBar(SnackBar(content: Text(l10n.imageLoadFailed)));
    }
  }

  void _showAbout() {
    final l10n = AppLocalizations.of(context);
    showDialog<void>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(l10n.about),
        content: SingleChildScrollView(child: Text(l10n.aboutBody)),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: Text(l10n.close),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final image = _image;
    return Scaffold(
      appBar: AppBar(
        title: Text(l10n.appTitle),
        actions: [
          if (image != null)
            IconButton(
              tooltip: l10n.changePhoto,
              icon: const Icon(Icons.photo_library_outlined),
              onPressed: _loading ? null : _pick,
            ),
          IconButton(
            tooltip: l10n.about,
            icon: const Icon(Icons.info_outline),
            onPressed: _showAbout,
          ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : image == null
              ? _EmptyState(onPick: _pick)
              : MeasureView(key: ObjectKey(image), image: image),
    );
  }
}

class _EmptyState extends StatelessWidget {
  const _EmptyState({required this.onPick});

  final VoidCallback onPick;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.crop_portrait,
                size: 72, color: theme.colorScheme.primary),
            const SizedBox(height: 16),
            Text(l10n.emptyTitle,
                style: theme.textTheme.titleLarge, textAlign: TextAlign.center),
            const SizedBox(height: 8),
            Text(l10n.emptyHint,
                style: theme.textTheme.bodyMedium, textAlign: TextAlign.center),
            const SizedBox(height: 24),
            FilledButton.icon(
              onPressed: onPick,
              icon: const Icon(Icons.photo_library_outlined),
              label: Text(l10n.pickPhoto),
            ),
          ],
        ),
      ),
    );
  }
}

/// 图片测量区域：图片、参考线、结果栏。
class MeasureView extends StatefulWidget {
  const MeasureView({super.key, required this.image});

  final LoadedImage image;

  @override
  State<MeasureView> createState() => _MeasureViewState();
}

class _MeasureViewState extends State<MeasureView> {
  late final ValueNotifier<GuideLines> _lines = ValueNotifier(
      GuideLines.defaults(widget.image.width, widget.image.height));
  LineId? _selected;

  // 拖动中的状态：起始位置 + 累计的屏幕位移，避免夹住后手指与线错位。
  LineId? _dragging;
  double _dragStart = 0;
  double _dragDelta = 0;

  @override
  void dispose() {
    _lines.dispose();
    super.dispose();
  }

  void _moveLine(LineId id, double value) {
    _lines.value = _lines.value.withLine(id, value,
        width: widget.image.width, height: widget.image.height);
  }

  void _onDragStart(LineId id) {
    setState(() {
      _selected = id;
      _dragging = id;
    });
    _dragStart = _lines.value[id];
    _dragDelta = 0;
  }

  void _onDragUpdate(CanvasGeometry geo, DragUpdateDetails d) {
    final id = _dragging;
    if (id == null) return;
    _dragDelta += id.isVertical ? d.delta.dx : d.delta.dy;
    _moveLine(id, _dragStart + geo.screenToImage(_dragDelta));
  }

  void _onDragEnd() {
    setState(() => _dragging = null);
  }

  @override
  Widget build(BuildContext context) {
    return Column(children: [
      Expanded(
        child: LayoutBuilder(builder: (context, constraints) {
          final geo = CanvasGeometry(
            viewport: constraints.biggest,
            imageWidth: widget.image.width,
            imageHeight: widget.image.height,
          );
          return ClipRect(
            child: ColoredBox(
              color: Colors.black,
              child: Stack(children: [
                Positioned.fill(
                  child: GestureDetector(
                    behavior: HitTestBehavior.opaque,
                    onTap: () => setState(() => _selected = null),
                    child: Stack(children: [
                      Positioned.fromRect(
                        rect: geo.imageRect,
                        child: RawImage(
                          image: widget.image.image,
                          fit: BoxFit.fill,
                          filterQuality: FilterQuality.medium,
                        ),
                      ),
                    ]),
                  ),
                ),
                ..._overlay(geo),
              ]),
            ),
          );
        }),
      ),
      ValueListenableBuilder<GuideLines>(
        valueListenable: _lines,
        builder: (context, lines, _) =>
            ResultBar(result: computeCentering(lines)),
      ),
    ]);
  }

  /// 参考线绘制层 + 每个手柄一块触摸区域（半径 22 点）。
  List<Widget> _overlay(CanvasGeometry geo) {
    const touch = CanvasGeometry.handleBand;
    return [
      Positioned.fill(
        child: IgnorePointer(
          child: ValueListenableBuilder<GuideLines>(
            valueListenable: _lines,
            builder: (context, lines, _) => CustomPaint(
              painter: GuidePainter(
                  geometry: geo, lines: lines, selected: _selected),
            ),
          ),
        ),
      ),
      ValueListenableBuilder<GuideLines>(
        valueListenable: _lines,
        builder: (context, lines, _) {
          // 选中的手柄放在最上层，重叠时优先响应。
          final ids = [
            for (final id in LineId.values)
              if (id != _selected) id,
            if (_selected != null) _selected!,
          ];
          return Stack(children: [
            for (final id in ids)
              if (_onScreen(geo, geo.handleCenter(id, lines)))
                Positioned(
                  // key 放在最外层：选中后手柄会调整层级，保持同一个手势不中断。
                  key: ValueKey('handle-${id.name}'),
                  left: geo.handleCenter(id, lines).dx - touch / 2,
                  top: geo.handleCenter(id, lines).dy - touch / 2,
                  width: touch,
                  height: touch,
                  child: GestureDetector(
                    behavior: HitTestBehavior.opaque,
                    dragStartBehavior: DragStartBehavior.down,
                    onTap: () => setState(() => _selected = id),
                    onPanStart: (_) => _onDragStart(id),
                    onPanUpdate: (d) => _onDragUpdate(geo, d),
                    onPanEnd: (_) => _onDragEnd(),
                    onPanCancel: _onDragEnd,
                  ),
                ),
          ]);
        },
      ),
    ];
  }

  static bool _onScreen(CanvasGeometry geo, Offset c) =>
      c.dx >= 0 &&
      c.dx <= geo.viewport.width &&
      c.dy >= 0 &&
      c.dy <= geo.viewport.height;
}
