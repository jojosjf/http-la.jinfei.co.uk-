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
      'Shoot straight-on, with all four edges of the card in the frame. The borders are detected automatically.';

  @override
  String get pickPhoto => 'Choose photo';

  @override
  String get changePhoto => 'Change photo';

  @override
  String get rotate => 'Rotate';

  @override
  String get rotateReset => 'Reset';

  @override
  String get done => 'Done';

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
    return 'P$grade';
  }

  @override
  String get belowStandard => 'Below P3';

  @override
  String borderline(String grade) {
    return 'Borderline: close to P$grade';
  }

  @override
  String get disclaimer =>
      'Based on published centering standards · for reference only';

  @override
  String lineName(String line) {
    String _temp0 = intl.Intl.selectLogic(
      line,
      {
        'outerLeft': 'Outer left',
        'innerLeft': 'Inner left',
        'innerRight': 'Inner right',
        'outerRight': 'Outer right',
        'outerTop': 'Outer top',
        'innerTop': 'Inner top',
        'innerBottom': 'Inner bottom',
        'outerBottom': 'Outer bottom',
        'other': 'Line',
      },
    );
    return '$_temp0';
  }

  @override
  String get moveOnePixel => 'Move 1 pixel';

  @override
  String handleLabel(String line) {
    String _temp0 = intl.Intl.selectLogic(
      line,
      {
        'outerLeft': 'OL',
        'innerLeft': 'IL',
        'innerRight': 'IR',
        'outerRight': 'OR',
        'outerTop': 'OT',
        'innerTop': 'IT',
        'innerBottom': 'IB',
        'outerBottom': 'OB',
        'other': '?',
      },
    );
    return '$_temp0';
  }

  @override
  String get about => 'About';

  @override
  String get aboutBody =>
      'How to use: after you choose a photo, the card\'s outer edges and artwork border are detected and the 8 lines are placed for you. If they are off, drag the handles so the outer lines (long dashes) sit on the card\'s outer edges and the inner lines (short dashes) on the artwork border; while dragging, slide your finger along the line to magnify different parts of it; the small picture on each handle shows which edge that line belongs on. Tap a handle to select its line, then use the arrows to move it 1 pixel at a time. Pinch to zoom (up to 8×). If the photo is tilted by up to 6°, auto detect straightens it first; you can also tap \"Rotate\" in the toolbar and drag the dial (0.1° steps), then tap \"Auto detect\" to find the edges again.\n\nRecords: tap \"Save\" to add a note and keep the ratios and reference grade. In Records you can sort by date or grade to pick cards worth submitting; swipe left to delete.\n\nResult image: tap \"Image\" to make a picture with the lines, ratios and reference grade that you can save to Photos and share.\n\nPrivacy: your photo is processed only on this device and never uploaded. Records keep only numbers and your note, never the photo, and stay on this device.';

  @override
  String get close => 'Close';

  @override
  String get measureTab => 'Measure';

  @override
  String get recordsTab => 'Records';

  @override
  String get records => 'Records';

  @override
  String get more => 'More';

  @override
  String get autoDetect => 'Auto detect';

  @override
  String get autoDetectDone =>
      'Borders detected. Drag the handles to fine-tune.';

  @override
  String autoDetectStraightened(String angle) {
    return 'Straightened by $angle° and detected the borders. Drag the handles to fine-tune.';
  }

  @override
  String get autoDetectFailed =>
      'Couldn\'t find the card borders. Please drag the lines by hand.';

  @override
  String get saveRecord => 'Save';

  @override
  String get saveRecordTitle => 'Save measurement';

  @override
  String get noteLabel => 'Note (e.g. card name, optional)';

  @override
  String get save => 'Save';

  @override
  String get cancel => 'Cancel';

  @override
  String get recordSaved => 'Saved to Records';

  @override
  String get noRecords => 'No measurements yet';

  @override
  String get noRecordsHint =>
      'After measuring a card, tap \"Save\" in the toolbar and it will appear here.';

  @override
  String get recordBelowStandard => 'Below 3';

  @override
  String get untitledCard => 'Untitled card';

  @override
  String get sortNewest => 'Newest';

  @override
  String get sortGrade => 'Grade';

  @override
  String get clearAll => 'Clear';

  @override
  String get clearAllConfirm => 'Delete all records? This can\'t be undone.';

  @override
  String get recordDeleted => 'Record deleted';

  @override
  String get undo => 'Undo';

  @override
  String get delete => 'Delete';

  @override
  String recordSummary(String lr, String tb) {
    return 'L/R $lr  ·  T/B $tb';
  }

  @override
  String get resultImage => 'Image';

  @override
  String get saveImage => 'Save image';

  @override
  String get imageSaved => 'Saved to Photos';

  @override
  String get imageShared => 'Done';

  @override
  String get imageDownloaded => 'Image downloaded';

  @override
  String get imageSaveFailed => 'Couldn\'t save the image. Please try again.';

  @override
  String get privacyPolicy => 'Privacy policy';

  @override
  String get privacyPromptTitle => 'Privacy notice';

  @override
  String get privacyPromptBody =>
      'Welcome to Card Centering Check!\n\nThe app works entirely offline: it collects and uploads no personal information, requests no device permissions and contains no third-party SDKs. The photo you choose is processed only on this device and is never uploaded or saved; measurements you choose to save stay on this device and contain no photos.\n\nPlease read the full privacy policy for details. Tapping \"Agree\" means you have read and agree to the privacy policy.';

  @override
  String get privacyViewFull => 'Read the privacy policy';

  @override
  String get privacyAgree => 'Agree';

  @override
  String get privacyDisagree => 'Disagree';

  @override
  String get privacyDisagreeTitle => 'Before you go';

  @override
  String get privacyDisagreeBody =>
      'The app collects none of your personal information, but you need to agree to the privacy policy to use it. If you still disagree, the app will close.';

  @override
  String get privacyExit => 'Close app';

  @override
  String get privacyBack => 'Go back';

  @override
  String get privacyPolicyBody =>
      'Last updated: 8 October 2026\nEffective: 8 October 2026\nCard Centering Check (\"the app\") is developed and operated by the developer named at the end of this policy (\"we\"). Please read this policy before using the app.\n## 1. Personal information we collect\nThe app collects no personal information. There is no sign-up or login. It does not collect device identifiers (such as IMEI, OAID, Android ID or MAC address), location, contacts, call logs, messages or the list of installed apps. It does not read the clipboard, does no analytics, tracking or advertising, and does not communicate with any server.\n## 2. How your photo is used\nYou choose one photo with the system photo picker; the app can read only that photo and cannot browse your library.\nThe photo is used only in memory on your device for display, measuring and edge detection. It is never uploaded or sent to anyone; edge detection runs entirely on the device.\nSome systems copy the chosen photo into the app\'s temporary folder; the app deletes that copy right after reading it and never keeps your photo.\n## 3. Saved measurements\nOnly when you tap \"Save\" does the app store a measurement: the left/right and top/bottom ratios, the reference grade, the time and an optional note you type (such as the card name).\nRecords contain no photos or device information, stay in the app\'s private storage on your device and are never uploaded. You can delete one record or clear all of them in Records at any time; they are removed when you uninstall the app.\n## 4. Result image\nThe result image is created on your device and shows the card, guide lines, ratios and reference grade. It is saved only when you tap \"Save image\": on Android it goes straight to the \"CardCentering\" album (Android 10 and later, no permission needed); on HarmonyOS the system asks you to confirm before saving it to the gallery. The app never reads other photos in your library and never shares the image on its own.\n## 5. Device permissions\nThe app requests no device permissions, including network, storage, camera, photos, location and phone. Without network permission it cannot connect to the internet.\n## 6. Third-party SDKs\nThe app contains no third-party SDKs, including advertising, analytics, push, login, payment, sharing and crash reporting SDKs.\n## 7. Information kept on your device\nBesides the measurements you choose to save, the app keeps one setting on your device: whether you have agreed to this policy, so the notice is not shown every time. It contains no personal information and is removed when you uninstall the app.\n## 8. Auto-start and chained start\nThe app does not start by itself and does not start or get started by other apps. It runs only when you open it and does not stay in the background.\n## 9. Sharing and disclosure\nAs the app collects no personal information, we do not share, transfer or disclose any personal information.\n## 10. Your rights\nWe hold no personal information about you, so there is nothing to request access to, correct or delete, and no account to close. You can delete your records in the app or uninstall it at any time. If you believe your rights have been harmed, you can contact us or complain to the relevant authorities.\n## 11. Children\nThe app collects no personal information from anyone, including children under 14. Minors should read this policy and use the app with a parent or guardian.\n## 12. Disclaimer\nThe reference grade is calculated from published centering standards and is for reference only; it is not an actual grade. The app is not affiliated with any card grading company.\n## 13. Changes to this policy\nIf a change to the app affects how personal information is handled, we will update this policy and tell you in the app with a notice.\n## 14. Contact us\nIf you have any questions or complaints about this policy, contact us and we will reply within 15 working days:';

  @override
  String get privacyDeveloper => '[Developer name]';

  @override
  String get privacyEmail => '[Contact email]';

  @override
  String privacyContact(String developer, String email) {
    return 'Developer: $developer\nEmail: $email';
  }
}
