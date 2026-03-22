import 'package:flutter/material.dart';
import 'package:flutter/widget_previews.dart';

import '../../core/responsive.dart';
import '../../theme/app_fonts.dart';
import '../../theme/widget_preview_theme.dart';
import '../../widgets/onboarding_nav_bar.dart';
import '../../widgets/true_modal.dart';
import 'bottom_measurement_form.dart';
import 'onboarding_measurement_widgets.dart';

/// Kotlin `BottomBodyMeasurementOnboardingScreen.kt`.
class BottomBodyMeasurementOnboardingScreen extends StatefulWidget {
  const BottomBodyMeasurementOnboardingScreen({
    super.key,
    required this.state,
    required this.onStateChange,
    required this.onBack,
    required this.onNext,
  });

  final BottomMeasurementFormState state;
  final ValueChanged<BottomMeasurementFormState> onStateChange;
  final VoidCallback onBack;
  final VoidCallback onNext;

  @override
  State<BottomBodyMeasurementOnboardingScreen> createState() =>
      _BottomBodyMeasurementOnboardingScreenState();
}

class _BottomBodyMeasurementOnboardingScreenState
    extends State<BottomBodyMeasurementOnboardingScreen> {
  bool _hasTriedSubmit = false;

  void _set(BottomMeasurementFormState s) => widget.onStateChange(s);

  Future<void> _help(String msg) => showTrueInfoModal(context, message: msg);

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final s = widget.state;
    final err = validateBottomMeasurementFields(s);

    final paddingH = scaleDp(context, 33.5);
    final paddingV = scaleDp(context, 33.5);
    final fieldH = scaleDp(context, 50);
    final spacingBeforeProgress = scaleDp(context, 78);
    final titleSize = scaleSp(context, 20);
    final subtitleSize = scaleSp(context, 14);
    final unitW = scaleDp(context, 88);
    final unitH = scaleDp(context, 44);
    final helpSize = scaleDp(context, 28);
    final sectionGap = scaleDp(context, 80);
    final headerToFirst = sectionGap + scaleDp(context, 30);

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
                  'Under your bottom can guide you to choose best pants and shoes, which building your main silhouette',
                  style: AppFonts.poppins(
                    context,
                    fontSize: subtitleSize,
                    color: kOnboardingSubtitleGrey,
                  ),
                ),
                SizedBox(height: headerToFirst),
                TopBottomMeasurementRow(
                  label: 'Waist',
                  valueRaw: s.waistRaw,
                  unit: s.waistUnit,
                  onValueChange: (v) => _set(s.copyWith(waistRaw: v)),
                  onUnitChange: (u) => _set(s.copyWith(waistUnit: u)),
                  onHelp: () => _help('Enter your waist in CM or IN.'),
                  fieldHeight: fieldH,
                  unitBoxWidth: unitW,
                  unitBoxHeight: unitH,
                  helpSize: helpSize,
                  errorText: _hasTriedSubmit ? err.waist : null,
                ),
                SizedBox(height: sectionGap),
                TopBottomMeasurementRow(
                  label: 'Hip',
                  valueRaw: s.hipRaw,
                  unit: s.hipUnit,
                  onValueChange: (v) => _set(s.copyWith(hipRaw: v)),
                  onUnitChange: (u) => _set(s.copyWith(hipUnit: u)),
                  onHelp: () => _help('Enter your hip in CM or IN.'),
                  fieldHeight: fieldH,
                  unitBoxWidth: unitW,
                  unitBoxHeight: unitH,
                  helpSize: helpSize,
                  errorText: _hasTriedSubmit ? err.hip : null,
                ),
                SizedBox(height: sectionGap),
                TopBottomMeasurementRow(
                  label: 'Inseam',
                  valueRaw: s.inseamRaw,
                  unit: s.inseamUnit,
                  onValueChange: (v) => _set(s.copyWith(inseamRaw: v)),
                  onUnitChange: (u) => _set(s.copyWith(inseamUnit: u)),
                  onHelp: () => _help('Enter your inseam in CM or IN.'),
                  fieldHeight: fieldH,
                  unitBoxWidth: unitW,
                  unitBoxHeight: unitH,
                  helpSize: helpSize,
                  errorText: _hasTriedSubmit ? err.inseam : null,
                ),
                SizedBox(height: sectionGap),
                TopBottomMeasurementRow(
                  label: 'Thigh',
                  valueRaw: s.thighRaw,
                  unit: s.thighUnit,
                  onValueChange: (v) => _set(s.copyWith(thighRaw: v)),
                  onUnitChange: (u) => _set(s.copyWith(thighUnit: u)),
                  onHelp: () => _help('Enter your thigh in CM or IN.'),
                  fieldHeight: fieldH,
                  unitBoxWidth: unitW,
                  unitBoxHeight: unitH,
                  helpSize: helpSize,
                  errorText: _hasTriedSubmit ? err.thigh : null,
                ),
                SizedBox(height: sectionGap),
                TopBottomMeasurementRow(
                  label: 'Ankle',
                  valueRaw: s.ankleRaw,
                  unit: s.ankleUnit,
                  onValueChange: (v) => _set(s.copyWith(ankleRaw: v)),
                  onUnitChange: (u) => _set(s.copyWith(ankleUnit: u)),
                  onHelp: () => _help('Enter your ankle in CM or IN.'),
                  fieldHeight: fieldH,
                  unitBoxWidth: unitW,
                  unitBoxHeight: unitH,
                  helpSize: helpSize,
                  errorText: _hasTriedSubmit ? err.ankle : null,
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
            if (!validateBottomMeasurementFields(widget.state).hasError) {
              widget.onNext();
            }
          },
        ),
      ],
    );
  }
}

class BottomBodyMeasurementOnboardingScreenPreview extends StatefulWidget {
  const BottomBodyMeasurementOnboardingScreenPreview({super.key});

  @override
  State<BottomBodyMeasurementOnboardingScreenPreview> createState() =>
      _BottomBodyMeasurementOnboardingScreenPreviewState();
}

class _BottomBodyMeasurementOnboardingScreenPreviewState
    extends State<BottomBodyMeasurementOnboardingScreenPreview> {
  BottomMeasurementFormState _state = const BottomMeasurementFormState();

  @override
  Widget build(BuildContext context) {
    return BottomBodyMeasurementOnboardingScreen(
      state: _state,
      onStateChange: (s) => setState(() => _state = s),
      onBack: () {},
      onNext: () {},
    );
  }
}

@Preview(
  name: 'Bottom body measurement',
  group: 'Onboarding',
  size: Size(402, 874),
  theme: trueClothesPreviewTheme,
)
Widget bottomBodyMeasurementOnboardingWidgetPreview() {
  return const BottomBodyMeasurementOnboardingScreenPreview();
}
