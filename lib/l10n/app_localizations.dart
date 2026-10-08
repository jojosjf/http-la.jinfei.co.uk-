import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:intl/intl.dart' as intl;

import 'app_localizations_en.dart';
import 'app_localizations_zh.dart';

// ignore_for_file: type=lint

/// Callers can lookup localized strings with an instance of AppLocalizations
/// returned by `AppLocalizations.of(context)`.
///
/// Applications need to include `AppLocalizations.delegate()` in their app's
/// `localizationDelegates` list, and the locales they support in the app's
/// `supportedLocales` list. For example:
///
/// ```dart
/// import 'l10n/app_localizations.dart';
///
/// return MaterialApp(
///   localizationsDelegates: AppLocalizations.localizationsDelegates,
///   supportedLocales: AppLocalizations.supportedLocales,
///   home: MyApplicationHome(),
/// );
/// ```
///
/// ## Update pubspec.yaml
///
/// Please make sure to update your pubspec.yaml to include the following
/// packages:
///
/// ```yaml
/// dependencies:
///   # Internationalization support.
///   flutter_localizations:
///     sdk: flutter
///   intl: any # Use the pinned version from flutter_localizations
///
///   # Rest of dependencies
/// ```
///
/// ## iOS Applications
///
/// iOS applications define key application metadata, including supported
/// locales, in an Info.plist file that is built into the application bundle.
/// To configure the locales supported by your app, you’ll need to edit this
/// file.
///
/// First, open your project’s ios/Runner.xcworkspace Xcode workspace file.
/// Then, in the Project Navigator, open the Info.plist file under the Runner
/// project’s Runner folder.
///
/// Next, select the Information Property List item, select Add Item from the
/// Editor menu, then select Localizations from the pop-up menu.
///
/// Select and expand the newly-created Localizations item then, for each
/// locale your application supports, add a new item and select the locale
/// you wish to add from the pop-up menu in the Value field. This list should
/// be consistent with the languages listed in the AppLocalizations.supportedLocales
/// property.
abstract class AppLocalizations {
  AppLocalizations(String locale)
      : localeName = intl.Intl.canonicalizedLocale(locale.toString());

  final String localeName;

  static AppLocalizations of(BuildContext context) {
    return Localizations.of<AppLocalizations>(context, AppLocalizations)!;
  }

  static const LocalizationsDelegate<AppLocalizations> delegate =
      _AppLocalizationsDelegate();

  /// A list of this localizations delegate along with the default localizations
  /// delegates.
  ///
  /// Returns a list of localizations delegates containing this delegate along with
  /// GlobalMaterialLocalizations.delegate, GlobalCupertinoLocalizations.delegate,
  /// and GlobalWidgetsLocalizations.delegate.
  ///
  /// Additional delegates can be added by appending to this list in
  /// MaterialApp. This list does not have to be used at all if a custom list
  /// of delegates is preferred or required.
  static const List<LocalizationsDelegate<dynamic>> localizationsDelegates =
      <LocalizationsDelegate<dynamic>>[
    delegate,
    GlobalMaterialLocalizations.delegate,
    GlobalCupertinoLocalizations.delegate,
    GlobalWidgetsLocalizations.delegate,
  ];

  /// A list of this localizations delegate's supported locales.
  static const List<Locale> supportedLocales = <Locale>[
    Locale('en'),
    Locale('zh')
  ];

  /// No description provided for @appTitle.
  ///
  /// In en, this message translates to:
  /// **'Card Centering Check'**
  String get appTitle;

  /// No description provided for @emptyTitle.
  ///
  /// In en, this message translates to:
  /// **'Choose a photo of your card'**
  String get emptyTitle;

  /// No description provided for @emptyHint.
  ///
  /// In en, this message translates to:
  /// **'Shoot straight-on, with all four edges of the card in the frame. The borders are detected automatically.'**
  String get emptyHint;

  /// No description provided for @pickPhoto.
  ///
  /// In en, this message translates to:
  /// **'Choose photo'**
  String get pickPhoto;

  /// No description provided for @changePhoto.
  ///
  /// In en, this message translates to:
  /// **'Change photo'**
  String get changePhoto;

  /// No description provided for @rotate.
  ///
  /// In en, this message translates to:
  /// **'Rotate'**
  String get rotate;

  /// No description provided for @rotateReset.
  ///
  /// In en, this message translates to:
  /// **'Reset'**
  String get rotateReset;

  /// No description provided for @done.
  ///
  /// In en, this message translates to:
  /// **'Done'**
  String get done;

  /// No description provided for @imageLoadFailed.
  ///
  /// In en, this message translates to:
  /// **'Couldn\'t read this image. Please try a JPG or PNG.'**
  String get imageLoadFailed;

  /// No description provided for @leftRight.
  ///
  /// In en, this message translates to:
  /// **'Left / Right'**
  String get leftRight;

  /// No description provided for @topBottom.
  ///
  /// In en, this message translates to:
  /// **'Top / Bottom'**
  String get topBottom;

  /// No description provided for @referenceGrade.
  ///
  /// In en, this message translates to:
  /// **'Reference grade'**
  String get referenceGrade;

  /// No description provided for @gradeValue.
  ///
  /// In en, this message translates to:
  /// **'P{grade}'**
  String gradeValue(String grade);

  /// No description provided for @belowStandard.
  ///
  /// In en, this message translates to:
  /// **'Below P3'**
  String get belowStandard;

  /// No description provided for @borderline.
  ///
  /// In en, this message translates to:
  /// **'Borderline: close to P{grade}'**
  String borderline(String grade);

  /// No description provided for @disclaimer.
  ///
  /// In en, this message translates to:
  /// **'Based on published centering standards · for reference only'**
  String get disclaimer;

  /// No description provided for @lineName.
  ///
  /// In en, this message translates to:
  /// **'{line, select, outerLeft{Outer left} innerLeft{Inner left} innerRight{Inner right} outerRight{Outer right} outerTop{Outer top} innerTop{Inner top} innerBottom{Inner bottom} outerBottom{Outer bottom} other{Line}}'**
  String lineName(String line);

  /// No description provided for @moveOnePixel.
  ///
  /// In en, this message translates to:
  /// **'Move 1 pixel'**
  String get moveOnePixel;

  /// No description provided for @handleLabel.
  ///
  /// In en, this message translates to:
  /// **'{line, select, outerLeft{OL} innerLeft{IL} innerRight{IR} outerRight{OR} outerTop{OT} innerTop{IT} innerBottom{IB} outerBottom{OB} other{?}}'**
  String handleLabel(String line);

  /// No description provided for @about.
  ///
  /// In en, this message translates to:
  /// **'About'**
  String get about;

  /// No description provided for @aboutBody.
  ///
  /// In en, this message translates to:
  /// **'How to use: after you choose a photo, the card\'s outer edges and artwork border are detected and the 8 lines are placed for you. If they are off, drag the handles so the outer lines (long dashes) sit on the card\'s outer edges and the inner lines (short dashes) on the artwork border; while dragging, slide your finger along the line to magnify different parts of it; the small picture on each handle shows which edge that line belongs on. Tap a handle to select its line, then use the arrows to move it 1 pixel at a time. Pinch to zoom (up to 8×). If the photo is tilted by up to 6°, auto detect straightens it first; you can also tap \"Rotate\" in the toolbar and drag the dial (0.1° steps), then tap \"Auto detect\" to find the edges again.\n\nRecords: tap \"Save\" to add a note and keep the ratios and reference grade. In Records you can sort by date or grade to pick cards worth submitting; swipe left to delete.\n\nResult image: tap \"Image\" to make a picture with the lines, ratios and reference grade that you can save to Photos and share.\n\nPrivacy: your photo is processed only on this device and never uploaded. Records keep only numbers and your note, never the photo, and stay on this device.'**
  String get aboutBody;

  /// No description provided for @close.
  ///
  /// In en, this message translates to:
  /// **'Close'**
  String get close;

  /// No description provided for @measureTab.
  ///
  /// In en, this message translates to:
  /// **'Measure'**
  String get measureTab;

  /// No description provided for @recordsTab.
  ///
  /// In en, this message translates to:
  /// **'Records'**
  String get recordsTab;

  /// No description provided for @records.
  ///
  /// In en, this message translates to:
  /// **'Records'**
  String get records;

  /// No description provided for @more.
  ///
  /// In en, this message translates to:
  /// **'More'**
  String get more;

  /// No description provided for @autoDetect.
  ///
  /// In en, this message translates to:
  /// **'Auto detect'**
  String get autoDetect;

  /// No description provided for @autoDetectDone.
  ///
  /// In en, this message translates to:
  /// **'Borders detected. Drag the handles to fine-tune.'**
  String get autoDetectDone;

  /// No description provided for @autoDetectStraightened.
  ///
  /// In en, this message translates to:
  /// **'Straightened by {angle}° and detected the borders. Drag the handles to fine-tune.'**
  String autoDetectStraightened(String angle);

  /// No description provided for @autoDetectFailed.
  ///
  /// In en, this message translates to:
  /// **'Couldn\'t find the card borders. Please drag the lines by hand.'**
  String get autoDetectFailed;

  /// No description provided for @saveRecord.
  ///
  /// In en, this message translates to:
  /// **'Save'**
  String get saveRecord;

  /// No description provided for @saveRecordTitle.
  ///
  /// In en, this message translates to:
  /// **'Save measurement'**
  String get saveRecordTitle;

  /// No description provided for @noteLabel.
  ///
  /// In en, this message translates to:
  /// **'Note (e.g. card name, optional)'**
  String get noteLabel;

  /// No description provided for @save.
  ///
  /// In en, this message translates to:
  /// **'Save'**
  String get save;

  /// No description provided for @cancel.
  ///
  /// In en, this message translates to:
  /// **'Cancel'**
  String get cancel;

  /// No description provided for @recordSaved.
  ///
  /// In en, this message translates to:
  /// **'Saved to Records'**
  String get recordSaved;

  /// No description provided for @noRecords.
  ///
  /// In en, this message translates to:
  /// **'No measurements yet'**
  String get noRecords;

  /// No description provided for @noRecordsHint.
  ///
  /// In en, this message translates to:
  /// **'After measuring a card, tap \"Save\" in the toolbar and it will appear here.'**
  String get noRecordsHint;

  /// No description provided for @recordBelowStandard.
  ///
  /// In en, this message translates to:
  /// **'Below 3'**
  String get recordBelowStandard;

  /// No description provided for @untitledCard.
  ///
  /// In en, this message translates to:
  /// **'Untitled card'**
  String get untitledCard;

  /// No description provided for @sortNewest.
  ///
  /// In en, this message translates to:
  /// **'Newest'**
  String get sortNewest;

  /// No description provided for @sortGrade.
  ///
  /// In en, this message translates to:
  /// **'Grade'**
  String get sortGrade;

  /// No description provided for @clearAll.
  ///
  /// In en, this message translates to:
  /// **'Clear'**
  String get clearAll;

  /// No description provided for @clearAllConfirm.
  ///
  /// In en, this message translates to:
  /// **'Delete all records? This can\'t be undone.'**
  String get clearAllConfirm;

  /// No description provided for @recordDeleted.
  ///
  /// In en, this message translates to:
  /// **'Record deleted'**
  String get recordDeleted;

  /// No description provided for @undo.
  ///
  /// In en, this message translates to:
  /// **'Undo'**
  String get undo;

  /// No description provided for @delete.
  ///
  /// In en, this message translates to:
  /// **'Delete'**
  String get delete;

  /// No description provided for @recordSummary.
  ///
  /// In en, this message translates to:
  /// **'L/R {lr}  ·  T/B {tb}'**
  String recordSummary(String lr, String tb);

  /// No description provided for @resultImage.
  ///
  /// In en, this message translates to:
  /// **'Image'**
  String get resultImage;

  /// No description provided for @saveImage.
  ///
  /// In en, this message translates to:
  /// **'Save image'**
  String get saveImage;

  /// No description provided for @imageSaved.
  ///
  /// In en, this message translates to:
  /// **'Saved to Photos'**
  String get imageSaved;

  /// No description provided for @imageShared.
  ///
  /// In en, this message translates to:
  /// **'Done'**
  String get imageShared;

  /// No description provided for @imageDownloaded.
  ///
  /// In en, this message translates to:
  /// **'Image downloaded'**
  String get imageDownloaded;

  /// No description provided for @imageSaveFailed.
  ///
  /// In en, this message translates to:
  /// **'Couldn\'t save the image. Please try again.'**
  String get imageSaveFailed;

  /// No description provided for @privacyPolicy.
  ///
  /// In en, this message translates to:
  /// **'Privacy policy'**
  String get privacyPolicy;

  /// No description provided for @privacyPromptTitle.
  ///
  /// In en, this message translates to:
  /// **'Privacy notice'**
  String get privacyPromptTitle;

  /// No description provided for @privacyPromptBody.
  ///
  /// In en, this message translates to:
  /// **'Welcome to Card Centering Check!\n\nThe app works entirely offline: it collects and uploads no personal information, requests no device permissions and contains no third-party SDKs. The photo you choose is processed only on this device and is never uploaded or saved; measurements you choose to save stay on this device and contain no photos.\n\nPlease read the full privacy policy for details. Tapping \"Agree\" means you have read and agree to the privacy policy.'**
  String get privacyPromptBody;

  /// No description provided for @privacyViewFull.
  ///
  /// In en, this message translates to:
  /// **'Read the privacy policy'**
  String get privacyViewFull;

  /// No description provided for @privacyAgree.
  ///
  /// In en, this message translates to:
  /// **'Agree'**
  String get privacyAgree;

  /// No description provided for @privacyDisagree.
  ///
  /// In en, this message translates to:
  /// **'Disagree'**
  String get privacyDisagree;

  /// No description provided for @privacyDisagreeTitle.
  ///
  /// In en, this message translates to:
  /// **'Before you go'**
  String get privacyDisagreeTitle;

  /// No description provided for @privacyDisagreeBody.
  ///
  /// In en, this message translates to:
  /// **'The app collects none of your personal information, but you need to agree to the privacy policy to use it. If you still disagree, the app will close.'**
  String get privacyDisagreeBody;

  /// No description provided for @privacyExit.
  ///
  /// In en, this message translates to:
  /// **'Close app'**
  String get privacyExit;

  /// No description provided for @privacyBack.
  ///
  /// In en, this message translates to:
  /// **'Go back'**
  String get privacyBack;

  /// No description provided for @privacyPolicyBody.
  ///
  /// In en, this message translates to:
  /// **'Last updated: 8 October 2026\nEffective: 8 October 2026\nCard Centering Check (\"the app\") is developed and operated by the developer named at the end of this policy (\"we\"). Please read this policy before using the app.\n## 1. Personal information we collect\nThe app collects no personal information. There is no sign-up or login. It does not collect device identifiers (such as IMEI, OAID, Android ID or MAC address), location, contacts, call logs, messages or the list of installed apps. It does not read the clipboard, does no analytics, tracking or advertising, and does not communicate with any server.\n## 2. How your photo is used\nYou choose one photo with the system photo picker; the app can read only that photo and cannot browse your library.\nThe photo is used only in memory on your device for display, measuring and edge detection. It is never uploaded or sent to anyone; edge detection runs entirely on the device.\nSome systems copy the chosen photo into the app\'s temporary folder; the app deletes that copy right after reading it and never keeps your photo.\n## 3. Saved measurements\nOnly when you tap \"Save\" does the app store a measurement: the left/right and top/bottom ratios, the reference grade, the time and an optional note you type (such as the card name).\nRecords contain no photos or device information, stay in the app\'s private storage on your device and are never uploaded. You can delete one record or clear all of them in Records at any time; they are removed when you uninstall the app.\n## 4. Result image\nThe result image is created on your device and shows the card, guide lines, ratios and reference grade. It is saved only when you tap \"Save image\": on Android it goes straight to the \"CardCentering\" album (Android 10 and later, no permission needed); on HarmonyOS the system asks you to confirm before saving it to the gallery. The app never reads other photos in your library and never shares the image on its own.\n## 5. Device permissions\nThe app requests no device permissions, including network, storage, camera, photos, location and phone. Without network permission it cannot connect to the internet.\n## 6. Third-party SDKs\nThe app contains no third-party SDKs, including advertising, analytics, push, login, payment, sharing and crash reporting SDKs.\n## 7. Information kept on your device\nBesides the measurements you choose to save, the app keeps one setting on your device: whether you have agreed to this policy, so the notice is not shown every time. It contains no personal information and is removed when you uninstall the app.\n## 8. Auto-start and chained start\nThe app does not start by itself and does not start or get started by other apps. It runs only when you open it and does not stay in the background.\n## 9. Sharing and disclosure\nAs the app collects no personal information, we do not share, transfer or disclose any personal information.\n## 10. Your rights\nWe hold no personal information about you, so there is nothing to request access to, correct or delete, and no account to close. You can delete your records in the app or uninstall it at any time. If you believe your rights have been harmed, you can contact us or complain to the relevant authorities.\n## 11. Children\nThe app collects no personal information from anyone, including children under 14. Minors should read this policy and use the app with a parent or guardian.\n## 12. Disclaimer\nThe reference grade is calculated from published centering standards and is for reference only; it is not an actual grade. The app is not affiliated with any card grading company.\n## 13. Changes to this policy\nIf a change to the app affects how personal information is handled, we will update this policy and tell you in the app with a notice.\n## 14. Contact us\nIf you have any questions or complaints about this policy, contact us and we will reply within 15 working days:'**
  String get privacyPolicyBody;

  /// No description provided for @privacyDeveloper.
  ///
  /// In en, this message translates to:
  /// **'[Developer name]'**
  String get privacyDeveloper;

  /// No description provided for @privacyEmail.
  ///
  /// In en, this message translates to:
  /// **'[Contact email]'**
  String get privacyEmail;

  /// No description provided for @privacyContact.
  ///
  /// In en, this message translates to:
  /// **'Developer: {developer}\nEmail: {email}'**
  String privacyContact(String developer, String email);
}

class _AppLocalizationsDelegate
    extends LocalizationsDelegate<AppLocalizations> {
  const _AppLocalizationsDelegate();

  @override
  Future<AppLocalizations> load(Locale locale) {
    return SynchronousFuture<AppLocalizations>(lookupAppLocalizations(locale));
  }

  @override
  bool isSupported(Locale locale) =>
      <String>['en', 'zh'].contains(locale.languageCode);

  @override
  bool shouldReload(_AppLocalizationsDelegate old) => false;
}

AppLocalizations lookupAppLocalizations(Locale locale) {
  // Lookup logic when only language code is specified.
  switch (locale.languageCode) {
    case 'en':
      return AppLocalizationsEn();
    case 'zh':
      return AppLocalizationsZh();
  }

  throw FlutterError(
      'AppLocalizations.delegate failed to load unsupported locale "$locale". This is likely '
      'an issue with the localizations generation tool. Please file an issue '
      'on GitHub with a reproducible sample app and the gen-l10n configuration '
      'that was used.');
}
