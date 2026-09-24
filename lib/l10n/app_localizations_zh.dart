// ignore: unused_import
import 'package:intl/intl.dart' as intl;

import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for Chinese (`zh`).
class AppLocalizationsZh extends AppLocalizations {
  AppLocalizationsZh([String locale = 'zh']) : super(locale);

  @override
  String get appTitle => '卡片居中检查';

  @override
  String get emptyTitle => '选择一张卡片照片';

  @override
  String get emptyHint => '尽量正对卡片拍摄，让卡片四边完整入镜。';

  @override
  String get pickPhoto => '从相册选择';

  @override
  String get changePhoto => '更换图片';

  @override
  String get imageLoadFailed => '无法读取这张图片，请换一张 JPG 或 PNG 图片。';

  @override
  String get leftRight => '左右';

  @override
  String get topBottom => '上下';

  @override
  String get referenceGrade => '参考等级';

  @override
  String gradeValue(String grade) {
    return 'PSA $grade';
  }

  @override
  String get belowStandard => '低于 PSA 3';

  @override
  String borderline(String grade) {
    return '临界：接近 PSA $grade';
  }

  @override
  String get disclaimer => '仅测量正面居中，参考 PSA 公开标准；结果仅供参考，不代表实际评级，本应用与 PSA 无关联。';

  @override
  String lineName(String line) {
    String _temp0 = intl.Intl.selectLogic(line, {
      'outerLeft': '外框左线',
      'innerLeft': '内框左线',
      'innerRight': '内框右线',
      'outerRight': '外框右线',
      'outerTop': '外框上线',
      'innerTop': '内框上线',
      'innerBottom': '内框下线',
      'outerBottom': '外框下线',
      'other': '参考线',
    });
    return '$_temp0';
  }

  @override
  String get moveOnePixel => '移动 1 像素';

  @override
  String get about => '说明';

  @override
  String get aboutBody =>
      '使用方法：拖动手柄，把外框线对齐卡片外边缘，把内框线对齐图案边框。点一下手柄可选中该线，再用箭头按钮每次移动 1 像素。双指可放大，最高 8 倍。\n\n隐私：图片只在本机处理，不上传、不保存，离开页面即释放。\n\n免责：本应用仅测量正面居中，参考 PSA 公开标准；结果仅供参考，不代表实际评级。本应用与 PSA 无关联。';

  @override
  String get close => '关闭';
}
