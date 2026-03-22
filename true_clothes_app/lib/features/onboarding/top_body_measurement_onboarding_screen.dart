import 'package:flutter/material.dart';
import 'package:flutter/widget_previews.dart';

import '../../core/responsive.dart';
import '../../theme/app_fonts.dart';
import '../../theme/widget_preview_theme.dart';
import '../../widgets/onboarding_nav_bar.dart';
import '../../widgets/true_modal.dart';
import 'onboarding_measurement_widgets.dart';
import 'top_measurement_form.dart';

/// Kotlin `TopBodyMeasurementOnboardingScreen.kt` — progress stays on step 3.
class TopBodyMeasurementOnboardingScreen extends StatefulWidget {
  const TopBodyMeasurementOnboardingScreen({
    super.key,
    required this.state,
    required this.onStateChange,
    required this.onBack,
    required this.onNext,
  });

  final TopMeasurementFormState state;
  final ValueChanged<TopMeasurementFormState> onStateChange;
  final VoidCallback onBack;
  final VoidCallback onNext;

  @override
  State<TopBodyMeasurementOnboardingScreen> createState() =>
      _TopBodyMeasurementOnboardingScreenState();
}

class _TopBodyMeasurementOnboardingScreenState
    extends State<TopBodyMeasurementOnboardingScreen> {
  bool _hasTriedSubmit = false;

  void _set(TopMeasurementFormState s) => widget.onStateChange(s);

  Future<void> _help(String msg) => showTrueInfoModal(context, message: msg);

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final s = widget.state;
    final err = validateTopMeasurementFields(s);

    final paddingH = scaleDp(context, 33.5);
    final paddingV = scaleDp(context, 33.5);
    final fieldH = scaleDp(context, 50);
    final spacingBeforeProgress = scaleDp(context, 78);
    final titleSize = scaleSp(context, 20);
    final subtitleSize = scaleSp(context, 14);
    final unitW = scaleDp(context, 88);
    final unitH = scaleDp(context, 44);
    final helpSize = scaleDp(context, 28);
    final sectionGap = scaleDp(context, 40);
    final headerToFirst = sectionGap + scaleDp(context, 60);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Expanded(
          child: SingleChildScrollView(
            padding: EdgeInsets.fromLTRB(
              paddingH,
              paddingV,
              paddingH,
              spacingBeforeProgress,
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(
                  'Better understand your body',
                  style: AppFonts.poppins(
                    context,
                    fontSize: titleSize,
                    fontWeight: FontWeight.w500,
                    color: scheme.onSurface,
                  ),
                ),
                SizedBox(height: scaleDp(context, 18)),
                Text(
                  'The measurement bring you best shirts, jackets,.. that makes people change the way they see you',
                  style: AppFonts.poppins(
                    context,
                    fontSize: subtitleSize,
                    color: kOnboardingSubtitleGrey,
                  ),
                ),
                SizedBox(height: headerToFirst),
                TopBottomMeasurementRow(
                  label: 'Shoulder width',
                  valueRaw: s.shoulderWidthRaw,
                  unit: s.shoulderWidthUnit,
                  onValueChange: (v) => _set(s.copyWith(shoulderWidthRaw: v)),
                  onUnitChange: (u) => _set(s.copyWith(shoulderWidthUnit: u)),
                  onHelp: () => _help('Enter your shoulder width in CM or IN.'),
                  fieldHeight: fieldH,
                  unitBoxWidth: unitW,
                  unitBoxHeight: unitH,
                  helpSize: helpSize,
                  errorText: _hasTriedSubmit ? err.shoulderWidth : null,
                ),
                SizedBox(height: sectionGap),
                TopBottomMeasurementRow(
                  label: 'Bicep',
                  valueRaw: s.bicepRaw,
                  unit: s.bicepUnit,
                  onValueChange: (v) => _set(s.copyWith(bicepRaw: v)),
                  onUnitChange: (u) => _set(s.copyWith(bicepUnit: u)),
                  onHelp: () => _help('Enter your bicep in CM or IN.'),
                  fieldHeight: fieldH,
                  unitBoxWidth: unitW,
                  unitBoxHeight: unitH,
                  helpSize: helpSize,
                  errorText: _hasTriedSubmit ? err.bicep : null,
                ),
                SizedBox(height: sectionGap),
                TopBottomMeasurementRow(
                  label: 'Sleeves',
                  valueRaw: s.sleevesRaw,
                  unit: s.sleevesUnit,
                  onValueChange: (v) => _set(s.copyWith(sleevesRaw: v)),
                  onUnitChange: (u) => _set(s.copyWith(sleevesUnit: u)),
                  onHelp: () => _help('Enter your sleeves in CM or IN.'),
                  fieldHeight: fieldH,
                  unitBoxWidth: unitW,
                  unitBoxHeight: unitH,
                  helpSize: helpSize,
                  errorText: _hasTriedSubmit ? err.sleeves : null,
                ),
                SizedBox(height: sectionGap),
                TopBottomMeasurementRow(
                  label: 'Chest',
                  valueRaw: s.chestRaw,
                  unit: s.chestUnit,
                  onValueChange: (v) => _set(s.copyWith(chestRaw: v)),
                  onUnitChange: (u) => _set(s.copyWith(chestUnit: u)),
                  onHelp: () => _help('Enter your chest in CM or IN.'),
                  fieldHeight: fieldH,
                  unitBoxWidth: unitW,
                  unitBoxHeight: unitH,
                  helpSize: helpSize,
                  errorText: _hasTriedSubmit ? err.chest : null,
                ),
                SizedBox(height: sectionGap),
                TopBottomMeasurementRow(
                  label: 'Neck',
                  valueRaw: s.neckRaw,
                  unit: s.neckUnit,
                  onValueChange: (v) => _set(s.copyWith(neckRaw: v)),
                  onUnitChange: (u) => _set(s.copyWith(neckUnit: u)),
                  onHelp: () => _help('Enter your neck in CM or IN.'),
                  fieldHeight: fieldH,
                  unitBoxWidth: unitW,
                  unitBoxHeight: unitH,
                  helpSize: helpSize,
                  errorText: _hasTriedSubmit ? err.neck : null,
                ),
              ],
            ),
          ),
        ),
        OnboardingNavBar(
          activeIndices: const [2],
          footerVerticalDesignDp: 33.5,
          onBack: widget.onBack,
          onNext: () {
            setState(() => _hasTriedSubmit = true);
            if (!validateTopMeasurementFields(widget.state).hasError) {
              widget.onNext();
            }
          },
        ),
      ],
    );
  }
}

class TopBodyMeasurementOnboardingScreenPreview extends StatefulWidget {
  const TopBodyMeasurementOnboardingScreenPreview({super.key});

  @override
  State<TopBodyMeasurementOnboardingScreenPreview> createState() =>
      _TopBodyMeasurementOnboardingScreenPreviewState();
}

class _TopBodyMeasurementOnboardingScreenPreviewState
    extends State<TopBodyMeasurementOnboardingScreenPreview> {
  TopMeasurementFormState _state = const TopMeasurementFormState();

  @override
  Widget build(BuildContext context) {
    return TopBodyMeasurementOnboardingScreen(
      state: _state,
      onStateChange: (s) => setState(() => _state = s),
      onBack: () {},
      onNext: () {},
    );
  }
}

@Preview(
  name: 'Top body measurement',
  group: 'Onboarding',
  size: Size(402, 874),
  theme: trueClothesPreviewTheme,
)
Widget topBodyMeasurementOnboardingWidgetPreview() {
  return const TopBodyMeasurementOnboardingScreenPreview();
}
