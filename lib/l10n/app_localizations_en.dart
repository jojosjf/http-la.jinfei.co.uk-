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
}
