import 'dart:convert';
import 'dart:js_interop';
import 'dart:typed_data';

import 'save_outcome.dart';

extension type _Anchor._(JSObject _) implements JSObject {
  external set href(String value);
  external set download(String value);
  external void click();
}

@JS('document.createElement')
external _Anchor _createAnchor(String tag);

/// 网页版：让浏览器下载这张 PNG。
Future<SaveOutcome> saveImageToGallery(Uint8List png, String name) async {
  try {
    final a = _createAnchor('a')
      ..href = 'data:image/png;base64,${base64Encode(png)}'
      ..download = name;
    a.click();
    return SaveOutcome.downloaded;
  } catch (_) {
    return SaveOutcome.failed;
  }
}
