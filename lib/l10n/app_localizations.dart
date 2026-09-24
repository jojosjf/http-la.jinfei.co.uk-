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
    Locale('zh'),
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
  /// **'Shoot straight-on, with all four edges of the card in the frame.'**
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
  /// **'PSA {grade}'**
  String gradeValue(String grade);

  /// No description provided for @belowStandard.
  ///
  /// In en, this message translates to:
  /// **'Below PSA 3'**
  String get belowStandard;

  /// No description provided for @borderline.
  ///
  /// In en, this message translates to:
  /// **'Borderline: close to PSA {grade}'**
  String borderline(String grade);

  /// No description provided for @disclaimer.
  ///
  /// In en, this message translates to:
  /// **'Front centering only, based on PSA\'s published standards. Not an actual grade; not affiliated with PSA.'**
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

  /// No description provided for @about.
  ///
  /// In en, this message translates to:
  /// **'About'**
  String get about;

  /// No description provided for @aboutBody.
  ///
  /// In en, this message translates to:
  /// **'How to use: drag the handles so the outer lines sit on the card\'s outer edges and the inner lines on the artwork border. Tap a handle to select its line, then use the arrows to move it 1 pixel at a time. Pinch to zoom (up to 8×).\n\nPrivacy: your photo is processed only on this device. It is never uploaded or saved, and is released when you leave the page.\n\nDisclaimer: this app measures front centering only, based on PSA\'s published standards. The result is for reference and is not an actual grade. This app is not affiliated with PSA.'**
  String get aboutBody;

  /// No description provided for @close.
  ///
  /// In en, this message translates to:
  /// **'Close'**
  String get close;
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
    'that was used.',
  );
}
