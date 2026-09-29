// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for Chinese (`zh`).
class AppLocalizationsZh extends AppLocalizations {
  AppLocalizationsZh([String locale = 'zh']) : super(locale);

  @override
  String get appTitle => '卡牌居中检查';

  @override
  String get emptyTitle => '选择一张卡片照片';

  @override
  String get emptyHint => '尽量正对卡片拍摄，让卡片四边完整入镜。';

  @override
  String get pickPhoto => '从相册选择';

  @override
  String get changePhoto => '更换图片';

  @override
  String get rotate => '旋转';

  @override
  String get rotateReset => '归零';

  @override
  String get done => '完成';

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
  String get disclaimer => '参考 PSA 公开标准，仅供参考，与 PSA 无关联';

  @override
  String lineName(String line) {
    String _temp0 = intl.Intl.selectLogic(
      line,
      {
        'outerLeft': '外框左线',
        'innerLeft': '内框左线',
        'innerRight': '内框右线',
        'outerRight': '外框右线',
        'outerTop': '外框上线',
        'innerTop': '内框上线',
        'innerBottom': '内框下线',
        'outerBottom': '外框下线',
        'other': '参考线',
      },
    );
    return '$_temp0';
  }

  @override
  String get moveOnePixel => '移动 1 像素';

  @override
  String handleLabel(String line) {
    String _temp0 = intl.Intl.selectLogic(
      line,
      {
        'outerLeft': '外左',
        'innerLeft': '内左',
        'innerRight': '内右',
        'outerRight': '外右',
        'outerTop': '外上',
        'innerTop': '内上',
        'innerBottom': '内下',
        'outerBottom': '外下',
        'other': '线',
      },
    );
    return '$_temp0';
  }

  @override
  String get nudgeHint => '点一下手柄选中参考线，可逐像素微调';

  @override
  String get about => '说明';

  @override
  String get aboutBody =>
      '使用方法：拖动手柄，把外框线（长虚线）对齐卡片外边缘，把内框线（短虚线）对齐图案边框；拖动时手指沿线移动，放大镜会跟着查看线上不同的位置；手柄上的小图会标出这条线要对准哪一条边。点一下手柄可选中该线，再用箭头按钮每次移动 1 像素。双指可放大，最高 8 倍。照片拍歪了，点底部的“旋转”，左右拖动刻度盘把卡片转正（精确到 0.1°）。\n\n隐私：图片只在本机处理，不上传、不保存，离开页面即释放。';

  @override
  String get close => '关闭';
}
