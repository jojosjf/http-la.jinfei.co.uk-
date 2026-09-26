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
    } catch (e) {
      debugPrint('Photo picker failed: $e');
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
    } catch (e) {
      // 只记录错误类型与信息，不含图片内容。
      debugPrint('Failed to load picked photo: $e');
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
            Icon(
              Icons.crop_portrait,
              size: 72,
              color: theme.colorScheme.primary,
            ),
            const SizedBox(height: 16),
            Text(
              l10n.emptyTitle,
              style: theme.textTheme.titleLarge,
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 8),
            Text(
              l10n.emptyHint,
              style: theme.textTheme.bodyMedium,
              textAlign: TextAlign.center,
            ),
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
    GuideLines.defaults(widget.image.width, widget.image.height),
  );
  final TransformationController _transform = TransformationController();
  final GlobalKey _canvasKey = GlobalKey();
  LineId? _selected;

  /// 最近一次布局的画布几何，拖动时用来换算坐标。
  CanvasGeometry? _geo;

  // 拖动中的状态：起始位置 + 累计的屏幕位移，避免夹住后手指与线错位。
  LineId? _dragging;
  double _dragStart = 0;
  double _dragDelta = 0;

  /// 拖动时手指在画布上的位置，用于放大镜；null 表示不显示。
  Offset? _finger;

  static const double _magnifierSize = 110;
  static const double _magnifierLift = 80;
  static const double _magnification = 3;

  @override
  void dispose() {
    _lines.dispose();
    _transform.dispose();
    super.dispose();
  }

  void _moveLine(LineId id, double value) {
    _lines.value = _lines.value.withLine(
      id,
      value,
      width: widget.image.width,
      height: widget.image.height,
    );
  }

  Offset? _toCanvas(Offset global) {
    final box = _canvasKey.currentContext?.findRenderObject() as RenderBox?;
    return box?.globalToLocal(global);
  }

  void _onDragStart(LineId id, DragStartDetails d) {
    setState(() {
      _selected = id;
      _dragging = id;
      _finger = _toCanvas(d.globalPosition);
    });
    _dragStart = _lines.value[id];
    _dragDelta = 0;
  }

  void _onDragUpdate(DragUpdateDetails d) {
    final id = _dragging;
    final geo = _geo;
    if (id == null || geo == null) return;
    _dragDelta += id.isVertical ? d.delta.dx : d.delta.dy;
    // 屏幕位移 ÷ 当前缩放倍数，换算成原图像素。
    _moveLine(id, _dragStart + geo.screenToImage(_dragDelta));
    setState(() => _finger = _toCanvas(d.globalPosition));
  }

  void _onDragEnd() {
    setState(() {
      _dragging = null;
      _finger = null;
    });
  }

  void _nudge(int direction) {
    final id = _selected;
    if (id == null) return;
    _moveLine(id, _lines.value[id] + direction);
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Expanded(
          child: LayoutBuilder(
            builder: (context, constraints) {
              final viewport = constraints.biggest;
              final base = CanvasGeometry(
                viewport: viewport,
                imageWidth: widget.image.width,
                imageHeight: widget.image.height,
              );
              return ClipRect(
                child: ColoredBox(
                  color: Colors.black,
                  child: Stack(
                    key: _canvasKey,
                    children: [
                      Positioned.fill(
                        child: InteractiveViewer(
                          transformationController: _transform,
                          minScale: 1,
                          maxScale: 8,
                          child: GestureDetector(
                            behavior: HitTestBehavior.opaque,
                            onTap: () => setState(() => _selected = null),
                            child: SizedBox.fromSize(
                              size: viewport,
                              child: Stack(
                                children: [
                                  Positioned.fromRect(
                                    rect: base.imageRect,
                                    child: RawImage(
                                      image: widget.image.image,
                                      fit: BoxFit.fill,
                                      filterQuality: FilterQuality.medium,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                        ),
                      ),
                      // 参考线与手柄画在缩放层之外，用同一个变换矩阵换算位置，
                      // 这样线宽和手柄大小不随缩放变化，位置始终与图片对齐。
                      Positioned.fill(
                        child: AnimatedBuilder(
                          animation: Listenable.merge([_transform, _lines]),
                          builder: (context, _) {
                            final geo = CanvasGeometry(
                              viewport: viewport,
                              imageWidth: widget.image.width,
                              imageHeight: widget.image.height,
                              transform: _transform.value,
                            );
                            _geo = geo;
                            return Stack(children: _overlay(geo, _lines.value));
                          },
                        ),
                      ),
                    ],
                  ),
                ),
              );
            },
          ),
        ),
        _nudgeBar(_selected),
        ValueListenableBuilder<GuideLines>(
          valueListenable: _lines,
          builder: (context, lines, _) =>
              ResultBar(result: computeCentering(lines)),
        ),
      ],
    );
  }

  /// 参考线绘制层、每个手柄一块触摸区域（半径 22 点）、拖动时的放大镜。
  List<Widget> _overlay(CanvasGeometry geo, GuideLines lines) {
    const touch = CanvasGeometry.handleBand;
    // 选中的手柄放在最上层，重叠时优先响应。
    final ids = [
      for (final id in LineId.values)
        if (id != _selected) id,
      if (_selected != null) _selected!,
    ];
    final finger = _finger;
    final dragging = _dragging;
    return [
      Positioned.fill(
        child: IgnorePointer(
          child: CustomPaint(
            painter: GuidePainter(
              geometry: geo,
              lines: lines,
              selected: _selected,
              outerLabel: AppLocalizations.of(context).handleOuter,
              innerLabel: AppLocalizations.of(context).handleInner,
              labelStyle: DefaultTextStyle.of(context).style,
            ),
          ),
        ),
      ),
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
              onPanStart: (d) => _onDragStart(id, d),
              onPanUpdate: _onDragUpdate,
              onPanEnd: (_) => _onDragEnd(),
              onPanCancel: _onDragEnd,
            ),
          ),
      if (finger != null && dragging != null)
        ..._magnifier(geo, lines, dragging, finger),
    ];
  }

  /// 放大镜显示在手指上方 80 点（放不下时改到下方），
  /// 放大的是被拖动的线穿过卡片中部的位置，方便对准卡片边缘。
  List<Widget> _magnifier(
    CanvasGeometry geo,
    GuideLines lines,
    LineId id,
    Offset finger,
  ) {
    const r = _magnifierSize / 2;
    final vp = geo.viewport;
    var center = finger - const Offset(0, _magnifierLift);
    if (center.dy - r < 0) center = finger + const Offset(0, _magnifierLift);
    center = Offset(
      center.dx.clamp(r, vp.width - r).toDouble(),
      center.dy.clamp(r, vp.height - r).toDouble(),
    );

    final img = geo.screenImageRect.intersect(Offset.zero & vp);
    final Offset focus;
    if (id.isVertical) {
      final mid =
          (geo.yToScreen(lines.outerTop) + geo.yToScreen(lines.outerBottom)) /
          2;
      focus = Offset(
        geo.xToScreen(lines[id]),
        mid.clamp(img.top, img.bottom).toDouble(),
      );
    } else {
      final mid =
          (geo.xToScreen(lines.outerLeft) + geo.xToScreen(lines.outerRight)) /
          2;
      focus = Offset(
        mid.clamp(img.left, img.right).toDouble(),
        geo.yToScreen(lines[id]),
      );
    }
    return [
      Positioned(
        left: center.dx - r,
        top: center.dy - r,
        child: RawMagnifier(
          key: const Key('magnifier'),
          size: const Size.square(_magnifierSize),
          magnificationScale: _magnification,
          focalPointOffset: focus - center,
          decoration: MagnifierDecoration(
            shape: CircleBorder(
              side: BorderSide(
                color: GuidePainter.colorOf(id, selected: true),
                width: 3,
              ),
            ),
          ),
        ),
      ),
    ];
  }

  /// 微调栏始终占位，选中与否都不改变画布大小，避免拖动开始时图片跳动。
  Widget _nudgeBar(LineId? id) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    return Material(
      color: theme.colorScheme.surface,
      child: Container(
        height: 52,
        padding: const EdgeInsets.symmetric(horizontal: 16),
        alignment: Alignment.centerLeft,
        child: id == null
            ? Text(
                l10n.nudgeHint,
                style: theme.textTheme.bodyMedium?.copyWith(
                  color: theme.colorScheme.onSurfaceVariant,
                ),
              )
            : Row(
                children: [
                  Icon(
                    Icons.circle,
                    size: 12,
                    color: GuidePainter.colorOf(id, selected: true),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      l10n.lineName(id.name),
                      style: theme.textTheme.titleSmall,
                    ),
                  ),
                  IconButton.filledTonal(
                    key: const Key('nudge-minus'),
                    tooltip: l10n.moveOnePixel,
                    icon: Icon(
                      id.isVertical ? Icons.arrow_back : Icons.arrow_upward,
                    ),
                    onPressed: () => _nudge(-1),
                  ),
                  const SizedBox(width: 12),
                  IconButton.filledTonal(
                    key: const Key('nudge-plus'),
                    tooltip: l10n.moveOnePixel,
                    icon: Icon(
                      id.isVertical
                          ? Icons.arrow_forward
                          : Icons.arrow_downward,
                    ),
                    onPressed: () => _nudge(1),
                  ),
                ],
              ),
      ),
    );
  }

  static bool _onScreen(CanvasGeometry geo, Offset c) =>
      c.dx >= 0 &&
      c.dx <= geo.viewport.width &&
      c.dy >= 0 &&
      c.dy <= geo.viewport.height;
}
