import 'dart:io';

import 'package:card_centering/ui/picked_file_cleanup_io.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  late Directory root;
  setUp(() => root = Directory.systemTemp.createTempSync('cleanup_test'));
  tearDown(() => root.deleteSync(recursive: true));

  test('删除选图副本及其随机子目录', () async {
    final dir = Directory('${root.path}/cache/9f1c-uuid')
      ..createSync(recursive: true);
    final file = File('${dir.path}/photo.jpg')..writeAsStringSync('x');
    await deletePickedCopy(file.path);
    expect(file.existsSync(), isFalse);
    expect(dir.existsSync(), isFalse);
    expect(Directory('${root.path}/cache').existsSync(), isTrue);
  });

  test('直接放在缓存根目录的副本只删文件', () async {
    final cache = Directory('${root.path}/cache')..createSync();
    final file = File('${cache.path}/photo.jpg')..writeAsStringSync('x');
    await deletePickedCopy(file.path);
    expect(file.existsSync(), isFalse);
    expect(cache.existsSync(), isTrue);
  });

  test('子目录里还有别的文件时不删目录', () async {
    final dir = Directory('${root.path}/cache/shared')
      ..createSync(recursive: true);
    final file = File('${dir.path}/photo.jpg')..writeAsStringSync('x');
    final other = File('${dir.path}/keep.txt')..writeAsStringSync('x');
    await deletePickedCopy(file.path);
    expect(file.existsSync(), isFalse);
    expect(other.existsSync(), isTrue);
  });

  test('不在缓存或临时目录的文件绝不删除', () async {
    final pics = Directory('/var/lib/cleanup_test_pictures')
      ..createSync(recursive: true);
    final file = File('${pics.path}/original.jpg')..writeAsStringSync('x');
    await deletePickedCopy(file.path);
    expect(file.existsSync(), isTrue);
    pics.deleteSync(recursive: true);
  });
}
