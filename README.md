# 卡片居中检查（card_centering）

Flutter 应用：测量卡片正面四边边框的居中比例，并对照 PSA 公开标准给出参考等级。

## 环境

- Flutter 3.47.5 stable（Dart 3.13.4）
- Android 构建需要 Android SDK；iOS 构建需要装有 Xcode 的 Mac

## 常用命令

```bash
flutter pub get
flutter test
```

## 进度

- [x] 1 计算模块：`lib/models/guide_lines.dart`、`lib/logic/centering.dart`、`lib/logic/psa_table.dart`，测试见 `test/centering_test.dart`
- [ ] 2 选图与显示
- [ ] 3 参考线
- [ ] 4 缩放与微调
- [ ] 5 收尾
