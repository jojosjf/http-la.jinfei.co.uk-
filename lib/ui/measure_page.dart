import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';

import '../l10n/app_localizations.dart';
import 'image_loader.dart';
import 'picked_file_cleanup.dart';

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

/// 图片测量区域。
class MeasureView extends StatefulWidget {
  const MeasureView({super.key, required this.image});

  final LoadedImage image;

  @override
  State<MeasureView> createState() => _MeasureViewState();
}

class _MeasureViewState extends State<MeasureView> {
  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(builder: (context, constraints) {
      final geo = CanvasGeometry(constraints.biggest, widget.image);
      return ColoredBox(
        color: Colors.black,
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
      );
    });
  }
}

/// 画布几何：图片在视口中按比例居中显示，四周留出手柄带。
class CanvasGeometry {
  CanvasGeometry(this.viewport, LoadedImage image) {
    final avail = Rect.fromLTWH(0, 0, viewport.width, viewport.height)
        .deflate(handleBand);
    final w = image.width, h = image.height;
    final scale = (avail.width / w) < (avail.height / h)
        ? avail.width / w
        : avail.height / h;
    fitScale = scale > 0 ? scale : 0;
    imageRect = Rect.fromCenter(
      center: avail.center,
      width: w * fitScale,
      height: h * fitScale,
    );
  }

  /// 视口四周放手柄的区域宽度（逻辑像素），等于手柄触摸直径。
  static const double handleBand = 44;

  final Size viewport;

  /// 1 原图像素在未缩放画布上的逻辑像素数。
  late final double fitScale;

  /// 图片在未缩放画布上的位置。
  late final Rect imageRect;
}
