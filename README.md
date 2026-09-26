# 卡片居中检查（Card Centering Check）

测量卡片正面四边边框的居中比例，并参考 PSA 公开标准给出参考等级。
一套 Flutter 代码，出安卓（国内商店 APK / Google Play AAB）、iOS、网页三个平台；
鸿蒙计划用鸿蒙版 Flutter 编译，见“鸿蒙”一节。

图片只在本机（或浏览器内）处理，不上传、不保存；App 不申请联网权限。

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
flutter run                                   # 安卓调试（默认国内版，等同 --flavor china）
flutter run -d chrome                         # 网页调试
```

## 构建发布版

```bash
# 安卓：两个版本功能完全相同
flutter build apk --flavor china --release             # 国内安卓商店
flutter build appbundle --flavor googleplay --release  # Google Play

# iOS（仅在 Mac 上）
flutter build ipa --release

# 网页：--no-web-resources-cdn 把渲染引擎一起打包，不依赖谷歌 CDN（国内必需）
flutter build web --release --no-web-resources-cdn
```

产物位置：

- 国内版 APK：`build/app/outputs/flutter-apk/app-china-release.apk`
- Google Play 版 AAB：`build/app/outputs/bundle/googleplayRelease/app-googleplay-release.aab`
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
这里内置了只含界面文字的 Noto Sans SC 子集（`assets/fonts/`，约 220KB）。
修改 `lib/l10n/*.arb` 里的文字后，运行 `python3 tool/subset_web_font.py` 重新生成。

## 代码结构

| 路径 | 内容 |
| --- | --- |
| `lib/main.dart` | 入口、语言设置 |
| `lib/models/guide_lines.dart` | 8 条参考线（原图像素坐标）、默认位置、顺序约束 |
| `lib/logic/centering.dart` | 居中比例、等级、临界判断（纯 Dart，不依赖界面） |
| `lib/logic/psa_table.dart` | PSA 正面阈值表，所有阈值数字只在这里 |
| `lib/ui/measure_page.dart` | 测量页：空状态、画布、手柄拖动、放大镜、微调 |
| `lib/ui/canvas_geometry.dart` | 原图坐标与屏幕坐标换算 |
| `lib/ui/guide_painter.dart` | 绘制参考线和手柄 |
| `lib/ui/result_bar.dart` | 结果栏与免责说明 |
| `lib/ui/image_loader.dart` | 解码、EXIF 摆正、大图缩略 |
| `lib/l10n/` | 中英文界面文字（ARB）与生成的代码 |
| `test/` | 单元测试与 widget 测试 |

## 鸿蒙

计划使用 OpenHarmony 社区的鸿蒙版 Flutter 编译 HAP，需要在装有 DevEco Studio 的电脑上进行。
为兼容它可能较旧的 Flutter 版本，代码刻意只用较早就有的接口，也不用 Dart 3.8 的新语法。
拿到鸿蒙版 Flutter 的版本号后，需要按 `docs/交付说明.md` 中“鸿蒙兼容”一节调整。
