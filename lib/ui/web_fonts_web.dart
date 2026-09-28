import 'dart:js_interop';

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';

/// 常用字备用字体的族名，与 main.dart 里的 fontFamilyFallback 一致。
const String commonChineseFontFamily = 'NotoSansSCCommon';

extension type _Response._(JSObject _) implements JSObject {
  external bool get ok;
  external JSPromise<JSArrayBuffer> arrayBuffer();
}

@JS('fetch')
external JSPromise<_Response> _fetch(JSString url);

/// 网页版：在后台下载常用字字体（web/fonts/，只随网页部署）。下载完成后
/// 界面自动重排，用户输入的卡片名称等界面字体里没有的字就能正常显示。
/// 下载失败时这些字仍会显示成方框，但不影响其他功能。
Future<void> loadCommonChineseFont() async {
  try {
    final res = await _fetch('fonts/NotoSansSC-Common-400.ttf'.toJS).toDart;
    if (!res.ok) return;
    final bytes = (await res.arrayBuffer().toDart).toDart;
    final loader = FontLoader(commonChineseFontFamily)
      ..addFont(Future.value(ByteData.view(bytes)));
    await loader.load();
  } catch (e) {
    debugPrint('Loading the common Chinese font failed: $e');
  }
}
