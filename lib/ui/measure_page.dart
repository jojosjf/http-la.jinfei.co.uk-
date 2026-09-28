import 'dart:math' as math;

import 'package:flutter/foundation.dart';
import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';

import '../l10n/app_localizations.dart';
import '../logic/centering.dart';
import '../logic/record_store.dart';
import '../models/guide_lines.dart';
import '../models/measurement_record.dart';
import 'about_page.dart';
import 'angle_dial.dart';
import 'auto_detect.dart';
import 'canvas_geometry.dart';
import 'guide_painter.dart';
import 'image_loader.dart';
import 'image_saver.dart';
import 'picked_file_cleanup.dart';
import 'records_page.dart';
import 'result_bar.dart';
import 'result_image.dart';

/// 测量页：空状态，或图片 + 参考线 + 工具栏 + 结果栏。
class MeasurePage extends StatefulWidget {
  const MeasurePage({super.key, this.store, this.showMenu = false});

  /// 测量记录；为 null 时不显示“保存”。
  final RecordStore? store;

  /// 没有底部导航时，在右上角“更多”菜单里放“测量记录”和“说明”。
  final bool showMenu;

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

  void _open(Widget page) {
    Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => page));
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
          if (widget.showMenu)
            PopupMenuButton<int>(
              key: const Key('more-menu'),
              tooltip: l10n.more,
              onSelected: (v) {
                final store = widget.store;
                if (v == 0 && store != null) {
                  _open(RecordsPage(store: store));
                } else if (v == 1) {
                  _open(const AboutPage());
                }
              },
              itemBuilder: (context) => [
                if (widget.store != null)
                  PopupMenuItem(value: 0, child: Text(l10n.records)),
                PopupMenuItem(value: 1, child: Text(l10n.about)),
              ],
            ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : image == null
              ? _EmptyState(onPick: _pick)
              : MeasureView(
                  key: ObjectKey(image),
                  image: image,
                  store: widget.store,
                  autoDetectOnLoad: true,
                ),
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
  const MeasureView({
    super.key,
    required this.image,
    this.store,
    this.autoDetectOnLoad = false,
  });

  final LoadedImage image;

  /// 测量记录；为 null 时工具栏不显示“保存”。
  final RecordStore? store;

  /// 显示后立即自动识别边框。
  final bool autoDetectOnLoad;

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

  /// 图片旋转角度（度，顺时针为正）与是否显示刻度盘。参考线不随图片转，
  /// 用户把歪斜的卡片转正，对齐到水平、竖直的参考线上。
  double _angle = 0;
  bool _rotating = false;

  /// 最近一次布局的画布几何，拖动时用来换算坐标。
  CanvasGeometry? _geo;

  // 拖动中的状态：起始位置 + 累计的屏幕位移，避免夹住后手指与线错位。
  LineId? _dragging;
  double _dragStart = 0;
  double _dragDelta = 0;

  /// 拖动时手指在画布上的位置，用于放大镜；null 表示不显示。
  Offset? _finger;

  /// 正在自动识别、正在生成结果图。
  bool _detecting = false;
  bool _rendering = false;

  static const double _magnifierSize = 110;
  static const double _magnifierLift = 80;
  static const double _magnification = 3;

  @override
  void initState() {
    super.initState();
    if (widget.autoDetectOnLoad) {
      WidgetsBinding.instance.addPostFrameCallback((_) => _autoDetect());
    }
  }

  @override
  void dispose() {
    _lines.dispose();
    _transform.dispose();
    super.dispose();
  }

  void _toast(String text) {
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(SnackBar(content: Text(text)));
  }

  /// 在当前旋转角度下自动识别 8 条参考线。
  Future<void> _autoDetect() async {
    if (_detecting || !mounted) return;
    final l10n = AppLocalizations.of(context);
    setState(() {
      _detecting = true;
      _rotating = false;
      _selected = null;
    });
    AutoDetectResult? found;
    try {
      found = await autoDetect(widget.image, angle: _angle);
    } catch (e) {
      debugPrint('Auto detection failed: $e');
    }
    if (!mounted) return;
    final straightened = found != null && found.angle != _angle;
    setState(() {
      _detecting = false;
      if (found != null) _angle = found.angle;
    });
    if (found != null) _lines.value = found.lines;
    _toast(
      found == null
          ? l10n.autoDetectFailed
          : straightened
              ? l10n.autoDetectStraightened(found.angle.toStringAsFixed(1))
              : l10n.autoDetectDone,
    );
  }

  Future<void> _saveRecord() async {
    final store = widget.store;
    if (store == null) return;
    final l10n = AppLocalizations.of(context);
    final result = computeCentering(_lines.value);
    final note = await showDialog<String>(
      context: context,
      builder: (context) => _SaveRecordDialog(result: result),
    );
    if (note == null || !mounted) return;
    await store.add(MeasurementRecord.fromResult(result, note: note));
    if (mounted) _toast(l10n.recordSaved);
  }

  Future<void> _showResultImage() async {
    if (_rendering) return;
    final l10n = AppLocalizations.of(context);
    setState(() => _rendering = true);
    ResultImage? rendered;
    try {
      rendered = await renderResultImage(
        image: widget.image,
        angle: _angle,
        lines: _lines.value,
        result: computeCentering(_lines.value),
        l10n: l10n,
      );
    } catch (e) {
      debugPrint('Rendering result image failed: $e');
    }
    if (!mounted) {
      rendered?.dispose();
      return;
    }
    setState(() => _rendering = false);
    if (rendered == null) {
      _toast(l10n.imageSaveFailed);
      return;
    }
    final result = rendered;
    final outcome = await showDialog<SaveOutcome>(
      context: context,
      builder: (context) => _ResultImageDialog(result: result),
    );
    if (!mounted || outcome == null) return;
    final text = switch (outcome) {
      SaveOutcome.saved => l10n.imageSaved,
      SaveOutcome.shared => l10n.imageShared,
      SaveOutcome.downloaded => l10n.imageDownloaded,
      SaveOutcome.failed => l10n.imageSaveFailed,
      SaveOutcome.cancelled => null,
    };
    if (text != null) _toast(text);
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
      _rotating = false;
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
                                    // 绕图片中心旋转，超出原图范围的部分裁掉。
                                    child: ClipRect(
                                      child: Transform.rotate(
                                        key: const Key('rotated-image'),
                                        angle: _angle * math.pi / 180,
                                        child: RawImage(
                                          image: widget.image.image,
                                          fit: BoxFit.fill,
                                          filterQuality: FilterQuality.medium,
                                        ),
                                      ),
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
                      if (_detecting || _rendering)
                        const Positioned(
                          left: 0,
                          right: 0,
                          top: 0,
                          child: LinearProgressIndicator(
                            key: Key('busy'),
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

  /// 参考线绘制层、每个手柄标签一块触摸区域、拖动时的放大镜。
  List<Widget> _overlay(CanvasGeometry geo, GuideLines lines) {
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
              labelOf: (id) =>
                  AppLocalizations.of(context).handleLabel(id.name),
              labelStyle: DefaultTextStyle.of(context).style,
              showHandles: _dragging == null,
            ),
          ),
        ),
      ),
      for (final id in ids)
        if (_onScreen(geo, geo.handleCenter(id, lines)))
          Positioned(
            // key 放在最外层：选中后手柄会调整层级，保持同一个手势不中断。
            key: ValueKey('handle-${id.name}'),
            left: geo.handleRect(id, lines).left,
            top: geo.handleRect(id, lines).top,
            width: geo.handleRect(id, lines).width,
            height: geo.handleRect(id, lines).height,
            child: GestureDetector(
              behavior: HitTestBehavior.opaque,
              dragStartBehavior: DragStartBehavior.down,
              onTap: () => setState(() {
                _rotating = false;
                _selected = id;
              }),
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

  /// 放大镜显示在手指上方 80 点（放不下时改到下方），放大被拖动的线上
  /// 与手指对应的那一点：拖竖线时取手指的高度，拖横线时取手指的水平位置。
  /// 手指沿线方向移动不会改变线的位置，只换放大的地方，可以沿线逐段检查。
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
    final Offset focus = id.isVertical
        ? Offset(
            geo.xToScreen(lines[id]),
            finger.dy.clamp(img.top, img.bottom).toDouble(),
          )
        : Offset(
            finger.dx.clamp(img.left, img.right).toDouble(),
            geo.yToScreen(lines[id]),
          );
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

  /// 工具栏始终占位：平时是工具按钮，选中线时是微调按钮，旋转时是刻度盘；
  /// 高度不变，画布不会跳动。
  Widget _nudgeBar(LineId? id) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    return Material(
      color: theme.colorScheme.surface,
      child: Container(
        height: 52,
        padding: const EdgeInsets.symmetric(horizontal: 16),
        alignment: Alignment.centerLeft,
        child: _rotating
            ? AngleDial(
                angle: _angle,
                onChanged: (a) => setState(() => _angle = a),
                onDone: () => setState(() => _rotating = false),
              )
            : id == null
                ? Row(
                    children: [
                      _ToolButton(
                        key: const Key('tool-auto'),
                        icon: Icons.auto_fix_high,
                        label: l10n.autoDetect,
                        onPressed: _detecting ? null : _autoDetect,
                      ),
                      _ToolButton(
                        key: const Key('rotate-open'),
                        icon: Icons.rotate_right,
                        label: _angle == 0
                            ? l10n.rotate
                            : '${l10n.rotate} ${_angle.toStringAsFixed(1)}°',
                        onPressed: () => setState(() => _rotating = true),
                      ),
                      if (widget.store != null)
                        _ToolButton(
                          key: const Key('tool-save'),
                          icon: Icons.bookmark_add_outlined,
                          label: l10n.saveRecord,
                          onPressed: _saveRecord,
                        ),
                      _ToolButton(
                        key: const Key('tool-image'),
                        icon: Icons.image_outlined,
                        label: l10n.resultImage,
                        onPressed: _rendering ? null : _showResultImage,
                      ),
                    ],
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

/// 工具栏按钮：图标在上、文字在下。
class _ToolButton extends StatelessWidget {
  const _ToolButton({
    super.key,
    required this.icon,
    required this.label,
    required this.onPressed,
  });

  final IconData icon;
  final String label;
  final VoidCallback? onPressed;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final color =
        onPressed == null ? theme.disabledColor : theme.colorScheme.primary;
    return Expanded(
      child: InkWell(
        borderRadius: BorderRadius.circular(8),
        onTap: onPressed,
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(icon, size: 22, color: color),
            const SizedBox(height: 2),
            Text(
              label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: theme.textTheme.labelSmall?.copyWith(color: color),
            ),
          ],
        ),
      ),
    );
  }
}

/// 保存记录：显示本次结果，填写备注。确定时返回备注（可为空字符串）。
class _SaveRecordDialog extends StatefulWidget {
  const _SaveRecordDialog({required this.result});

  final CenteringResult result;

  @override
  State<_SaveRecordDialog> createState() => _SaveRecordDialogState();
}

class _SaveRecordDialogState extends State<_SaveRecordDialog> {
  final TextEditingController _note = TextEditingController();

  @override
  void dispose() {
    _note.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final r = widget.result;
    final grade = r.grade;
    return AlertDialog(
      title: Text(l10n.saveRecordTitle),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            '${l10n.recordSummary('${r.lrBig}/${r.lrSmall}', '${r.tbBig}/${r.tbSmall}')}'
            '  ·  '
            '${grade == null ? l10n.belowStandard : l10n.gradeValue(formatGrade(grade))}',
          ),
          const SizedBox(height: 12),
          TextField(
            key: const Key('record-note'),
            controller: _note,
            autofocus: true,
            maxLength: 40,
            decoration: InputDecoration(labelText: l10n.noteLabel),
            onSubmitted: (v) => Navigator.of(context).pop(v),
          ),
        ],
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(),
          child: Text(l10n.cancel),
        ),
        FilledButton(
          key: const Key('record-save'),
          onPressed: () => Navigator.of(context).pop(_note.text),
          child: Text(l10n.save),
        ),
      ],
    );
  }
}

/// 结果图预览：可保存到相册（网页版为下载）。关闭时返回保存结果。
/// 对话框关闭（退场动画结束）后释放图像。
class _ResultImageDialog extends StatefulWidget {
  const _ResultImageDialog({required this.result});

  final ResultImage result;

  @override
  State<_ResultImageDialog> createState() => _ResultImageDialogState();
}

class _ResultImageDialogState extends State<_ResultImageDialog> {
  bool _saving = false;

  @override
  void dispose() {
    widget.result.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    setState(() => _saving = true);
    final t = DateTime.now();
    final outcome = await saveImageToGallery(
      widget.result.png,
      'card_centering_${t.millisecondsSinceEpoch}.png',
    );
    if (!mounted) return;
    if (outcome == SaveOutcome.cancelled) {
      setState(() => _saving = false);
      return;
    }
    Navigator.of(context).pop(outcome);
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final maxH = MediaQuery.sizeOf(context).height * 0.6;
    return AlertDialog(
      contentPadding: const EdgeInsets.fromLTRB(16, 20, 16, 0),
      content: ConstrainedBox(
        constraints: BoxConstraints(maxHeight: maxH),
        // 直接显示生成的图像，不再解码 PNG。
        child: RawImage(
          key: const Key('result-image'),
          image: widget.result.image,
          fit: BoxFit.contain,
        ),
      ),
      actions: [
        TextButton(
          onPressed: _saving ? null : () => Navigator.of(context).pop(),
          child: Text(l10n.close),
        ),
        FilledButton.icon(
          key: const Key('result-image-save'),
          onPressed: _saving ? null : _save,
          icon: const Icon(Icons.download),
          label: Text(kIsWeb ? l10n.saveImageWeb : l10n.saveImage),
        ),
      ],
    );
  }
}
