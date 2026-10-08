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
    return 'P$grade';
  }

  @override
  String get belowStandard => '低于 P3';

  @override
  String borderline(String grade) {
    return '临界：接近 P$grade';
  }

  @override
  String get disclaimer => '参考公开的居中标准，仅供参考';

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
      '使用方法：选好照片后，会自动识别卡片外边和图案边框，把 8 条参考线放到位。识别不准时，拖动手柄调整：外框线（长虚线）对齐卡片外边缘，内框线（短虚线）对齐图案边框。拖动时手指沿线移动，放大镜会跟着查看线上不同的位置；手柄上的小图标出这条线要对准哪一条边。点一下手柄可选中该线，再用箭头按钮每次移动 1 像素。双指可放大，最高 8 倍。照片拍歪时，自动识别会先把卡片摆正（±6° 以内）；也可以点工具栏的“旋转”，拖动刻度盘手动转正（精确到 0.1°），再点“自动识别”重新找边。\n\n测量记录：点“保存”可以给这张卡写个备注，保存比例和参考等级；在“测量记录”里可按时间或等级排列，方便挑选送评的卡，左滑删除。\n\n结果图：点“结果图”生成一张带参考线、比例和参考等级的图片，可保存到相册，方便分享。\n\n隐私：照片只在本机处理，不上传。测量记录只保存数字和备注，不保存照片，也只存在本机。';

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
  String get recordBelowStandard => '低于 3';

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
  String get saveImage => '保存图片';

  @override
  String get imageSaved => '已保存到相册';

  @override
  String get imageShared => '已完成';

  @override
  String get imageDownloaded => '图片已下载';

  @override
  String get imageSaveFailed => '保存失败，请稍后再试';

  @override
  String get privacyPolicy => '隐私政策';

  @override
  String get privacyPromptTitle => '隐私政策提示';

  @override
  String get privacyPromptBody =>
      '欢迎使用卡牌居中检查！\n\n本应用完全离线运行：不收集、不上传任何个人信息，不申请任何设备权限，不含第三方 SDK。您选择的照片只在本机处理，不会上传，也不会保存；您主动保存的测量记录只存在本机，不含照片。\n\n请阅读完整的《隐私政策》了解详细规则。点击“同意”即表示您已阅读并同意《隐私政策》。';

  @override
  String get privacyViewFull => '查看《隐私政策》';

  @override
  String get privacyAgree => '同意';

  @override
  String get privacyDisagree => '不同意';

  @override
  String get privacyDisagreeTitle => '温馨提示';

  @override
  String get privacyDisagreeBody =>
      '本应用不会收集您的任何个人信息，但需要您同意《隐私政策》后才能使用。若您仍不同意，将退出应用。';

  @override
  String get privacyExit => '退出应用';

  @override
  String get privacyBack => '再看看';

  @override
  String get privacyPolicyBody =>
      '更新日期：2026 年 10 月 8 日\n生效日期：2026 年 10 月 8 日\n「卡牌居中检查」（以下简称“本应用”，包名 com.saod.cardcentering）由本政策末尾列明的开发者（以下简称“我们”）开发和运营。我们依据《中华人民共和国个人信息保护法》等法律法规制定本政策，请您在使用前仔细阅读。\n## 一、我们收集的个人信息\n本应用不收集任何个人信息：不需要注册或登录；不收集设备标识符（如 IMEI、OAID、Android ID、MAC 地址）；不收集位置、通讯录、通话记录、短信、已安装应用列表等信息；不读取剪贴板；不进行数据统计、行为分析或广告追踪。本应用不与任何服务器通信。\n## 二、照片的使用方式\n您通过系统自带的照片选择器主动选择一张照片，本应用只能读取您选中的这一张，无法浏览您的相册。\n照片只在设备内存中用于显示、测量和自动识别卡牌边框，不会上传到任何服务器，也不会发送给任何第三方；自动识别完全在设备上计算完成。\n部分系统在选图时会把照片复制一份到本应用的临时目录，本应用读取后立即删除这份副本，不会保存您的照片。\n## 三、测量记录\n只有在您点击“保存”时，本应用才会保存一条测量记录，内容仅包括：左右和上下比例、参考等级、保存时间，以及您自愿填写的备注（如卡牌名称）。\n测量记录不包含照片，也不包含任何设备信息，只保存在本应用在您设备上的私有存储中，不会上传。您可以在“记录”页随时删除单条记录或全部清空；卸载本应用后，记录随之删除。\n## 四、结果图\n结果图由本应用在设备上生成，包含卡牌图片、参考线、比例和参考等级。只有在您点击“保存图片”时才会保存：安卓系统直接保存到相册的“CardCentering”文件夹（Android 10 及以上，无需任何权限）；鸿蒙系统由系统弹出保存确认框，经您确认后保存到图库。本应用不会读取您相册中的其他照片，也不会自动分享结果图。\n## 五、设备权限\n本应用不申请任何设备权限，包括网络、存储、相机、相册读取、位置、电话等权限。本应用没有网络权限，无法联网。\n## 六、第三方 SDK\n本应用未接入任何第三方 SDK，包括广告、统计、推送、登录、支付、分享和崩溃收集类 SDK。\n## 七、本机保存的信息\n除您主动保存的测量记录外，本应用只在本机保存一项设置：您是否已同意本政策，用于避免每次打开都弹出提示。这项设置不含个人信息，卸载本应用即被删除。\n## 八、自启动和关联启动\n本应用没有自启动行为，也没有关联启动行为，只在您主动打开时运行，不在后台常驻。\n## 九、信息的共享、转让和公开披露\n由于本应用不收集任何个人信息，我们不会与任何公司、组织或个人共享、转让或公开披露您的个人信息。\n## 十、您的权利\n我们不持有您的任何个人信息，因此不存在需要向我们申请查阅、更正、删除的个人信息，也没有需要注销的账号。您可以在“记录”页自行删除测量记录，或随时卸载本应用。如果您认为我们的行为损害了您的合法权益，可以联系我们，也可以向网信、工信等监管部门投诉或举报。\n## 十一、未成年人保护\n本应用不收集任何人的个人信息，包括未满 14 周岁的未成年人。若您是未成年人，建议在监护人的陪同下阅读本政策并使用本应用。\n## 十二、免责说明\n本应用给出的参考等级依据公开的居中标准计算，结果仅供参考，不代表实际评级。本应用与任何卡牌评级机构均无关联。\n## 十三、本政策的更新\n如果本应用的功能变化涉及个人信息的处理方式，我们会更新本政策，并在应用内以弹窗方式提示您。\n## 十四、联系我们\n如果您对本政策有任何疑问、意见或投诉，请通过以下方式联系我们，我们将在 15 个工作日内回复：';

  @override
  String get privacyDeveloper => '【开发者姓名】';

  @override
  String get privacyEmail => '【联系邮箱】';

  @override
  String privacyContact(String developer, String email) {
    return '开发者：$developer\n电子邮箱：$email';
  }
}
