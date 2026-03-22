import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter/widget_previews.dart';

import '../../core/responsive.dart';
import '../../theme/app_fonts.dart';
import '../../theme/widget_preview_theme.dart';
import '../../widgets/onboarding_nav_bar.dart';
import '../../widgets/true_modal.dart';
import 'body_measurement_form.dart';
import 'onboarding_measurement_widgets.dart';
import 'onboarding_units.dart';

/// Kotlin `BodyMeasurementOnboardingScreen.kt`.
class BodyMeasurementOnboardingScreen extends StatefulWidget {
  const BodyMeasurementOnboardingScreen({
    super.key,
    required this.state,
    required this.onStateChange,
    required this.onBack,
    required this.onNext,
    required this.onTopBody,
    required this.onBottomBody,
  });

  final BodyMeasurementFormState state;
  final ValueChanged<BodyMeasurementFormState> onStateChange;
  final VoidCallback onBack;
  final VoidCallback onNext;
  final VoidCallback onTopBody;
  final VoidCallback onBottomBody;

  @override
  State<BodyMeasurementOnboardingScreen> createState() =>
      _BodyMeasurementOnboardingScreenState();
}

class _BodyMeasurementOnboardingScreenState
    extends State<BodyMeasurementOnboardingScreen> {
  bool _hasTriedSubmit = false;
  late final TextEditingController _heightCtrl;
  late final TextEditingController _weightCtrl;

  @override
  void initState() {
    super.initState();
    _heightCtrl = TextEditingController(text: widget.state.heightRaw);
    _weightCtrl = TextEditingController(text: widget.state.weightRaw);
  }

  @override
  void didUpdateWidget(covariant BodyMeasurementOnboardingScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.state.heightRaw != _heightCtrl.text) {
      _heightCtrl.value = TextEditingValue(
        text: widget.state.heightRaw,
        selection: TextSelection.collapsed(offset: widget.state.heightRaw.length),
      );
    }
    if (widget.state.weightRaw != _weightCtrl.text) {
      _weightCtrl.value = TextEditingValue(
        text: widget.state.weightRaw,
        selection: TextSelection.collapsed(offset: widget.state.weightRaw.length),
      );
    }
  }

  @override
  void dispose() {
    _heightCtrl.dispose();
    _weightCtrl.dispose();
    super.dispose();
  }

  void _setState(BodyMeasurementFormState s) => widget.onStateChange(s);

  Future<void> _showInfo(String msg) =>
      showTrueInfoModal(context, message: msg);

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final s = widget.state;
    final fieldErrors = validateBodyMeasurementFormFields(s);

    final paddingH = scaleDp(context, 33.5);
    final paddingV = scaleDp(context, 33.5);
    final fieldHeight = scaleDp(context, 35);
    final titleSize = scaleSp(context, 20);
    final subtitleSize = scaleSp(context, 14);
    final labelSize = scaleSp(context, 18);
    final labelGap = scaleDp(context, 10);
    final unitW = scaleDp(context, 88);
    final unitH = scaleDp(context, 44);
    final helpSize = scaleDp(context, 28);
    final spacingBeforeProgress = scaleDp(context, 78);
    final rowGap = scaleDp(context, 14);

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
                  'Before joining the fashion world, you\nbetter know about your body...',
                  style: AppFonts.poppins(
                    context,
                    fontSize: subtitleSize,
                    color: kOnboardingSubtitleGrey,
                  ),
                ),
                SizedBox(height: scaleDp(context, 44)),
                FieldLabelWithStar(label: 'Height', fontSize: labelSize),
                SizedBox(height: labelGap),
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(
                      child: SizedBox(
                        height: fieldHeight,
                        child: TextField(
                          controller: _heightCtrl,
                          keyboardType: const TextInputType.numberWithOptions(
                            decimal: true,
                          ),
                          inputFormatters: [
                            FilteringTextInputFormatter.allow(
                              RegExp(r'[0-9.]'),
                            ),
                            LengthLimitingTextInputFormatter(6),
                          ],
                          onChanged: (raw) => _setState(
                            s.copyWith(
                              heightRaw: sanitizeDecimal(raw),
                            ),
                          ),
                          style: AppFonts.poppins(
                            context,
                            fontSize: scaleSp(context, 16),
                            color: scheme.onSurface,
                          ),
                          decoration: InputDecoration(
                            hintText: 'our...secret..........',
                            errorText:
                                _hasTriedSubmit ? fieldErrors.height : null,
                          ),
                        ),
                      ),
                    ),
                    SizedBox(width: rowGap),
                    HeightUnitPicker(
                      unit: s.heightUnit,
                      onChanged: (u) => _setState(s.copyWith(heightUnit: u)),
                      width: unitW,
                      height: unitH,
                    ),
                    SizedBox(width: rowGap),
                    HelpQuestionIcon(
                      size: helpSize,
                      onTap: () => _showInfo(
                        'Enter your height. Choose CM or IN from the dropdown.',
                      ),
                    ),
                  ],
                ),
                SizedBox(height: scaleDp(context, 26)),
                Row(
                  children: [
                    Icon(
                      Icons.monitor_weight_outlined,
                      size: scaleDp(context, 28),
                    ),
                    SizedBox(width: scaleDp(context, 12)),
                    Expanded(
                      child: FieldLabelWithStar(
                        label: 'Weight',
                        fontSize: labelSize,
                      ),
                    ),
                  ],
                ),
                SizedBox(height: labelGap),
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(
                      child: SizedBox(
                        height: fieldHeight,
                        child: TextField(
                          controller: _weightCtrl,
                          keyboardType: const TextInputType.numberWithOptions(
                            decimal: true,
                          ),
                          inputFormatters: [
                            FilteringTextInputFormatter.allow(
                              RegExp(r'[0-9.]'),
                            ),
                            LengthLimitingTextInputFormatter(6),
                          ],
                          onChanged: (raw) => _setState(
                            s.copyWith(
                              weightRaw: sanitizeDecimal(raw),
                            ),
                          ),
                          style: AppFonts.poppins(
                            context,
                            fontSize: scaleSp(context, 16),
                            color: scheme.onSurface,
                          ),
                          decoration: InputDecoration(
                            hintText: 'our...secret..........',
                            errorText:
                                _hasTriedSubmit ? fieldErrors.weight : null,
                          ),
                        ),
                      ),
                    ),
                    SizedBox(width: rowGap),
                    WeightUnitPicker(
                      unit: s.weightUnit,
                      onChanged: (u) => _setState(s.copyWith(weightUnit: u)),
                      width: unitW,
                      height: unitH,
                    ),
                    SizedBox(width: rowGap),
                    HelpQuestionIcon(
                      size: helpSize,
                      onTap: () => _showInfo(
                        'Enter your weight. Choose KG or LB from the dropdown.',
                      ),
                    ),
                  ],
                ),
                SizedBox(height: scaleDp(context, 40)),
                Text(
                  'Determine your body measurement',
                  style: AppFonts.poppins(
                    context,
                    fontSize: scaleSp(context, 16),
                    fontWeight: FontWeight.w600,
                    color: scheme.onSurface,
                  ),
                ),
                SizedBox(height: scaleDp(context, 18)),
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          GreyChoiceButton(
                            text: 'Top body',
                            selected:
                                s.measurementMethod == MeasurementMethod.manual,
                            onTap: () {
                              _setState(
                                s.copyWith(
                                  measurementMethod: MeasurementMethod.manual,
                                ),
                              );
                              widget.onTopBody();
                            },
                          ),
                          SizedBox(height: scaleDp(context, 18)),
                          GreyChoiceButton(
                            text: 'Bottom body',
                            selected:
                                s.measurementMethod == MeasurementMethod.manual,
                            onTap: () {
                              _setState(
                                s.copyWith(
                                  measurementMethod: MeasurementMethod.manual,
                                ),
                              );
                              widget.onBottomBody();
                            },
                          ),
                          SizedBox(height: scaleDp(context, 18)),
                          Text(
                            'Manual input your\nbody measurement',
                            style: AppFonts.poppins(
                              context,
                              fontSize: scaleSp(context, 14),
                            ),
                          ),
                        ],
                      ),
                    ),
                    SizedBox(width: scaleDp(context, 14)),
                    Container(
                      width: scaleDp(context, 2),
                      height: scaleDp(context, 170),
                      color: Colors.black.withValues(alpha: 0.6),
                    ),
                    SizedBox(width: scaleDp(context, 14)),
                    Expanded(
                      child: Column(
                        children: [
                          CameraUploadTile(
                            size: scaleDp(context, 104),
                            onTap: () {
                              _setState(
                                s.copyWith(
                                  measurementMethod: MeasurementMethod.aiGuess,
                                ),
                              );
                              _showInfo('AI guess is coming soon.');
                            },
                          ),
                          SizedBox(height: scaleDp(context, 14)),
                          Text(
                            'Let our AI guess\nyour\nmeasurement',
                            textAlign: TextAlign.center,
                            style: AppFonts.poppins(
                              context,
                              fontSize: scaleSp(context, 14),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                SizedBox(height: scaleDp(context, 12)),
                Row(
                  children: [
                    const Spacer(),
                    SizedBox(
                      width: scaleDp(context, 44),
                      child: Center(
                        child: Text(
                          'OR',
                          style: AppFonts.poppins(
                            context,
                            fontSize: scaleSp(context, 14),
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ),
                    ),
                    const Spacer(),
                  ],
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
            if (!validateBodyMeasurementFormFields(widget.state).hasError) {
              widget.onNext();
            }
          },
        ),
      ],
    );
  }
}

class BodyMeasurementOnboardingScreenPreview extends StatefulWidget {
  const BodyMeasurementOnboardingScreenPreview({super.key});

  @override
  State<BodyMeasurementOnboardingScreenPreview> createState() =>
      _BodyMeasurementOnboardingScreenPreviewState();
}

class _BodyMeasurementOnboardingScreenPreviewState
    extends State<BodyMeasurementOnboardingScreenPreview> {
  BodyMeasurementFormState _state = const BodyMeasurementFormState();

  @override
  Widget build(BuildContext context) {
    return BodyMeasurementOnboardingScreen(
      state: _state,
      onStateChange: (s) => setState(() => _state = s),
      onBack: () {},
      onNext: () {},
      onTopBody: () {},
      onBottomBody: () {},
    );
  }
}

@Preview(
  name: 'Body measurement',
  group: 'Onboarding',
  size: Size(402, 874),
  theme: trueClothesPreviewTheme,
)
Widget bodyMeasurementOnboardingWidgetPreview() {
  return const BodyMeasurementOnboardingScreenPreview();
}
