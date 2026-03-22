import 'package:flutter/widget_previews.dart';

import 'app_theme.dart';

/// Use with [@Preview](theme: trueClothesPreviewTheme) in the Flutter Widget Previewer
/// (`flutter widget-preview start` or IDE "Flutter Widget Preview" tab).
PreviewThemeData trueClothesPreviewTheme() {
  return PreviewThemeData(
    materialLight: buildAppTheme(),
    materialDark: buildAppTheme(),
  );
}
