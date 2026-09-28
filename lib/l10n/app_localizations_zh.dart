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
  String get emptyHint => '尽量正对卡片拍摄，让卡片四边完整入镜。选好后会自动识别边框。';

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
  String get about => '说明';

  @override
  String get aboutBody =>
      '使用方法：选好照片后，会自动识别卡片外边和图案边框，把 8 条参考线放到位。识别不准时，拖动手柄调整：外框线（长虚线）对齐卡片外边缘，内框线（短虚线）对齐图案边框。拖动时手指沿线移动，放大镜会跟着查看线上不同的位置；手柄上的小图标出这条线要对准哪一条边。点一下手柄可选中该线，再用箭头按钮每次移动 1 像素。双指可放大，最高 8 倍。照片拍歪时，自动识别会先把卡片摆正（±6° 以内）；也可以点工具栏的“旋转”，拖动刻度盘手动转正（精确到 0.1°），再点“自动识别”重新找边。\n\n测量记录：点“保存”可以给这张卡写个备注，保存比例和参考等级；在“测量记录”里可按时间或等级排列，方便挑选送评的卡，左滑删除。\n\n结果图：点“结果图”生成一张带参考线、比例和参考等级的图片，可保存到相册，方便分享。\n\n隐私：照片只在本机处理，不上传。测量记录只保存数字和备注，不保存照片，也只存在本机。\n\n免责：参考等级按 PSA 公开的正面居中标准给出（背面标准更宽松，用于背面时仅比例可作参考）；结果仅供参考，不代表实际评级。本应用与 PSA 无关联。';

  @override
  String get close => '关闭';

  @override
  String get measureTab => '测量';

  @override
  String get recordsTab => '记录';

  @override
  String get records => '测量记录';

  @override
  String get more => '更多';

  @override
  String get autoDetect => '自动识别';

  @override
  String get autoDetectDone => '已自动识别卡片边框，可拖动手柄微调';

  @override
  String autoDetectStraightened(String angle) {
    return '已自动摆正 $angle° 并识别卡片边框，可拖动手柄微调';
  }

  @override
  String get autoDetectFailed => '没能识别出卡片边框，请手动拖动参考线';

  @override
  String get saveRecord => '保存';

  @override
  String get saveRecordTitle => '保存测量记录';

  @override
  String get noteLabel => '备注（如卡片名称，可不填）';

  @override
  String get save => '保存';

  @override
  String get cancel => '取消';

  @override
  String get recordSaved => '已保存到测量记录';

  @override
  String get noRecords => '还没有测量记录';

  @override
  String get noRecordsHint => '测量完成后，点工具栏的“保存”，结果就会出现在这里。';

  @override
  String get untitledCard => '未命名卡片';

  @override
  String get sortNewest => '最新';

  @override
  String get sortGrade => '等级';

  @override
  String get clearAll => '清空';

  @override
  String get clearAllConfirm => '确定清空全部测量记录吗？此操作无法撤销。';

  @override
  String get recordDeleted => '已删除一条记录';

  @override
  String get undo => '撤销';

  @override
  String get delete => '删除';

  @override
  String recordSummary(String lr, String tb) {
    return '左右 $lr  ·  上下 $tb';
  }

  @override
  String get resultImage => '结果图';

  @override
  String get saveImage => '保存到相册';

  @override
  String get saveImageWeb => '下载图片';

  @override
  String get imageSaved => '已保存到相册';

  @override
  String get imageShared => '已完成';

  @override
  String get imageDownloaded => '图片已下载';

  @override
  String get imageSaveFailed => '保存失败，请稍后再试';
}
