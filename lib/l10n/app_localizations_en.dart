// ignore: unused_import
import 'package:intl/intl.dart' as intl;

import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for English (`en`).
class AppLocalizationsEn extends AppLocalizations {
  AppLocalizationsEn([String locale = 'en']) : super(locale);

  @override
  String get appTitle => 'Card Centering Check';

  @override
  String get emptyTitle => 'Choose a photo of your card';

  @override
  String get emptyHint =>
      'Shoot straight-on, with all four edges of the card in the frame.';

  @override
  String get pickPhoto => 'Choose photo';

  @override
  String get changePhoto => 'Change photo';

  @override
  String get imageLoadFailed =>
      'Couldn\'t read this image. Please try a JPG or PNG.';

  @override
  String get leftRight => 'Left / Right';

  @override
  String get topBottom => 'Top / Bottom';

  @override
  String get referenceGrade => 'Reference grade';

  @override
  String gradeValue(String grade) {
    return 'PSA $grade';
  }

  @override
  String get belowStandard => 'Below PSA 3';

  @override
  String borderline(String grade) {
    return 'Borderline: close to PSA $grade';
  }

  @override
  String get disclaimer =>
      'Front centering only, based on PSA\'s published standards. Not an actual grade; not affiliated with PSA.';

  @override
  String lineName(String line) {
    String _temp0 = intl.Intl.selectLogic(line, {
      'outerLeft': 'Outer left',
      'innerLeft': 'Inner left',
      'innerRight': 'Inner right',
      'outerRight': 'Outer right',
      'outerTop': 'Outer top',
      'innerTop': 'Inner top',
      'innerBottom': 'Inner bottom',
      'outerBottom': 'Outer bottom',
      'other': 'Line',
    });
    return '$_temp0';
  }

  @override
  String get moveOnePixel => 'Move 1 pixel';

  @override
  String get handleOuter => 'O';

  @override
  String get handleInner => 'I';

  @override
  String get nudgeHint => 'Tap a handle to select a line for fine-tuning';

  @override
  String get about => 'About';

  @override
  String get aboutBody =>
      'How to use: drag the handles so the outer lines (solid, handle marked \"O\") sit on the card\'s outer edges and the inner lines (dashed, handle marked \"I\") on the artwork border. Tap a handle to select its line, then use the arrows to move it 1 pixel at a time. Pinch to zoom (up to 8×).\n\nPrivacy: your photo is processed only on this device. It is never uploaded or saved, and is released when you leave the page.\n\nDisclaimer: this app measures front centering only, based on PSA\'s published standards. The result is for reference and is not an actual grade. This app is not affiliated with PSA.';

  @override
  String get close => 'Close';
}
