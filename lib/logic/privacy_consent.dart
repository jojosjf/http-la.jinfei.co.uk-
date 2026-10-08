import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// 隐私政策版本。政策有实质变化时加 1，已同意旧版的用户会再次看到提示。
const int privacyPolicyVersion = 1;

const String _agreedKey = 'privacy_agreed_version';

/// 用户是否已同意当前版本的隐私政策。读取失败时按未同意处理，宁可多弹一次。
Future<bool> hasAgreedToPrivacyPolicy() async {
  try {
    final prefs = await SharedPreferences.getInstance();
    return (prefs.getInt(_agreedKey) ?? 0) >= privacyPolicyVersion;
  } catch (e) {
    debugPrint('Failed to read privacy consent: $e');
    return false;
  }
}

/// 记下用户已同意当前版本。只存一个版本号，不含个人信息。
Future<void> recordPrivacyAgreement() async {
  try {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setInt(_agreedKey, privacyPolicyVersion);
  } catch (e) {
    debugPrint('Failed to save privacy consent: $e');
  }
}
