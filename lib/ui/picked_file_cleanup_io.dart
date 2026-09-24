import 'dart:io';

/// 系统选图器会把所选图片复制到 App 的临时目录；读完字节后删掉这份副本，
/// 保证不在 App 目录里留下用户图片。只删临时目录下的文件，绝不碰原图。
Future<void> deletePickedCopy(String path) async {
  final p = path.replaceAll('\\', '/');
  if (!p.contains('/cache/') && !p.contains('/tmp/')) return;
  try {
    await File(path).delete();
  } catch (_) {
    // 删除失败不影响使用，系统会自行清理临时目录。
  }
}
