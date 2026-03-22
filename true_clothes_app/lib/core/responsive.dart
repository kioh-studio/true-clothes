import 'package:flutter/widgets.dart';

/// Matches Kotlin [REFERENCE_DESIGN_WIDTH_DP] in `app/.../theme/Responsive.kt`.
/// Design docs: `true-clothes-docs/design/responsive-ui.md`.
const double kReferenceDesignWidth = 402;

double layoutScaleOf(BuildContext context) {
  final w = MediaQuery.sizeOf(context).width;
  if (w <= 0) return 1;
  return w / kReferenceDesignWidth;
}

double scaleDp(BuildContext context, double designDp) =>
    designDp * layoutScaleOf(context);

double scaleSp(BuildContext context, double designSp) =>
    designSp * layoutScaleOf(context);
