import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';

import 'save_outcome.dart';

const MethodChannel _channel = MethodChannel('card_centering/image_saver');

/// 把 PNG 保存到系统相册。各平台的原生实现：
/// 安卓用 MediaStore 直接写入“图片/CardCentering”（无需权限，Android 10 及以上）；
/// iOS 打开系统分享面板，由用户选“存储图像”；鸿蒙弹出系统的保存确认框。
Future<SaveOutcome> saveImageToGallery(Uint8List png, String name) async {
  try {
    final r = await _channel.invokeMethod<String>(
      'saveImage',
      {'bytes': png, 'name': name},
    );
    return switch (r) {
      'saved' => SaveOutcome.saved,
      'shared' => SaveOutcome.shared,
      'cancelled' => SaveOutcome.cancelled,
      _ => SaveOutcome.failed,
    };
  } catch (e) {
    debugPrint('Saving image failed: $e');
    return SaveOutcome.failed;
  }
}
