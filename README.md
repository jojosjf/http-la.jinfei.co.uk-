# 卡片居中检查（Card Centering Check）

测量卡片正面四边边框的居中比例，并参考 PSA 公开标准给出参考等级。
自动识别并摆正卡片边框，可保存测量记录、生成结果图。
一套 Flutter 代码，出安卓（国内商店 APK / Google Play AAB）、iOS、网页、鸿蒙四个平台；
鸿蒙用鸿蒙版 Flutter 编译，见“鸿蒙”一节。

图片只在本机（或浏览器内）处理，不上传；测量记录只存数字和备注，只在本机。
安卓、鸿蒙版不申请任何权限（包括联网）。

底部导航（测量 / 记录 / 说明）由 `lib/app_config.dart` 里的 `showBottomNav` 控制，
改成 `false` 即去掉，记录和说明移到右上角“更多”菜单。

## 环境版本

| 工具 | 版本 |
| --- | --- |
| Flutter | 3.47.5 stable（Dart 3.13.4） |
| JDK | 21 |
| Android SDK | platform 36、build-tools 36.0.0 |
| Android Gradle Plugin / Kotlin / Gradle | 9.1.0 / 2.4.0 / 9.3.1（由 flutter create 生成） |
| iOS | 需要装有 Xcode 的 Mac |

## 常用命令

```bash
flutter pub get
flutter analyze
flutter test                                  # 计算模块单元测试 + 页面 widget 测试
flutter run                                   # 在连接的手机或模拟器上调试（安卓、iOS 都一样）
flutter run -d chrome                         # 网页调试
```

## 构建发布版

```bash
# 安卓：同一份代码和配置，只是打包格式不同
flutter build apk --release                   # 国内安卓商店（APK）
flutter build appbundle --release             # Google Play（AAB）

# iOS（仅在 Mac 上）
flutter build ipa --release

# 网页：--no-web-resources-cdn 把渲染引擎一起打包，不依赖谷歌 CDN（国内必需）
flutter build web --release --no-web-resources-cdn
```

产物位置：

- 国内版 APK：`build/app/outputs/flutter-apk/app-release.apk`
- Google Play 版 AAB：`build/app/outputs/bundle/release/app-release.aab`
- 网页：`build/web/`，整个目录作为静态文件部署即可

### 安卓签名

签名文件与密码不进仓库。发布前在 `android/key.properties` 写入：

```properties
storePassword=…
keyPassword=…
keyAlias=upload
storeFile=/签名文件的绝对路径/upload-keystore.jks
```

没有这个文件时，构建会回退到调试签名（只能本地安装，不能上架）。

### 应用图标

`assets/icon/icon_1024.png` 目前是占位图标。替换成正式图标（1024×1024 PNG，
安卓自适应图标前景为 `icon_foreground_1024.png`）后运行：

```bash
dart run flutter_launcher_icons
```

### 网页版字体

网页版默认会从谷歌服务器下载中文字体，国内常失败并显示方框。
这里内置了只含界面文字的 Noto Sans SC 子集（`assets/fonts/`，4 种粗细共约 320KB），
另加一个常用字备用字体（GB2312 一级汉字，约 1.1MB，放在 `web/fonts/`，只随网页部署、不进手机安装包，
网页打开后在后台加载），用户输入的卡片名称等其他汉字从这里取。
修改 `lib/l10n/*.arb` 里的文字后，运行 `python3 tool/subset_web_font.py` 重新生成
（需要 `pip install fonttools`）。

## 代码结构

| 路径 | 内容 |
| --- | --- |
| `lib/main.dart` | 入口、语言设置 |
| `lib/app_config.dart` | 底部导航开关 |
| `lib/logic/border_detector.dart` | 自动识别边框、自动摆正的算法（纯 Dart） |
| `lib/logic/record_store.dart` | 测量记录的存取（shared_preferences） |
| `lib/ui/home_shell.dart` | 底部导航 |
| `lib/ui/auto_detect.dart` | 把图缩小、旋转后交给识别算法 |
| `lib/ui/records_page.dart`、`about_page.dart` | 测量记录页、说明页 |
| `lib/ui/result_image.dart` | 生成结果图 |
| `lib/ui/image_saver*.dart` | 保存结果图：安卓、iOS、鸿蒙走原生通道，网页为下载 |
| `tool/ohos/EntryAbility.ets` | 鸿蒙端保存结果图的原生代码，复制到鸿蒙工程使用 |
| `lib/models/guide_lines.dart` | 8 条参考线（原图像素坐标）、默认位置、顺序约束 |
| `lib/logic/centering.dart` | 居中比例、等级、临界判断（纯 Dart，不依赖界面） |
| `lib/logic/psa_table.dart` | PSA 正面阈值表，所有阈值数字只在这里 |
| `lib/ui/measure_page.dart` | 测量页：空状态、画布、手柄拖动、放大镜、工具栏、微调 |
| `lib/ui/canvas_geometry.dart` | 原图坐标与屏幕坐标换算 |
| `lib/ui/guide_painter.dart` | 绘制参考线和手柄 |
| `lib/ui/result_bar.dart` | 结果栏与免责说明 |
| `lib/ui/image_loader.dart` | 解码、EXIF 摆正、大图缩略 |
| `lib/l10n/` | 中英文界面文字（ARB）与生成的代码 |
| `test/` | 单元测试与 widget 测试 |

## 鸿蒙

用鸿蒙版 Flutter 分支 `br_3.27.4-ohos-1.0.4` 编译（适配 DevEco 6.x、API 24 以下的 SDK）。
代码只用 Flutter 3.27 就有的接口，官方 3.27.4、3.35.7、3.47.5 都验证过。
鸿蒙工程（`ohos/` 目录）不在本仓库，需要：

1. `pubspec.yaml` 的 `dependency_overrides` 把 `image_picker`、`shared_preferences` 指向社区鸿蒙适配版；
2. 把 `tool/ohos/EntryAbility.ets` 复制到 `ohos/entry/src/main/ets/entryability/`（保存结果图）；
3. 上架前删掉 `module.json5` 里的 INTERNET 权限，改用发布签名。
