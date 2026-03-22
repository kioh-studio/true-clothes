import 'package:flutter/material.dart';
import 'package:flutter/widget_previews.dart';
import 'package:intl/intl.dart';

import '../../core/responsive.dart';
import '../../theme/widget_preview_theme.dart';
import '../../theme/app_fonts.dart';
import '../../widgets/true_progress_bar.dart';
import 'gender_form.dart';

/// Kotlin Material3 [RadioButton] look without deprecated Flutter [Radio] API.
class _Material3RadioDot extends StatelessWidget {
  const _Material3RadioDot({
    required this.selected,
    required this.primary,
    required this.outline,
    required this.size,
  });

  final bool selected;
  final Color primary;
  final Color outline;
  final double size;

  @override
  Widget build(BuildContext context) {
    final borderW = selected ? 2.0 : 1.5;
    final borderColor = selected ? primary : outline;
    return Container(
      width: size,
      height: size,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        border: Border.all(color: borderColor, width: borderW),
        color: Colors.transparent,
      ),
      child: selected
          ? Container(
              width: size * 0.5,
              height: size * 0.5,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: primary,
              ),
            )
          : null,
    );
  }
}

/// Kotlin `GenderOnboardingScreen.kt` / `true-clothes-docs/design/screen/onboarding/gender/design.md`.
class GenderOnboardingScreen extends StatefulWidget {
  const GenderOnboardingScreen({
    super.key,
    required this.state,
    required this.onStateChange,
    required this.onNext,
  });

  final GenderFormState state;
  final ValueChanged<GenderFormState> onStateChange;
  final VoidCallback onNext;

  @override
  State<GenderOnboardingScreen> createState() => _GenderOnboardingScreenState();
}

class _GenderOnboardingScreenState extends State<GenderOnboardingScreen> {
  bool _hasTriedSubmit = false;
  late final TextEditingController _nameCtrl;
  late final TextEditingController _emailCtrl;
  late final TextEditingController _dobCtrl;

  @override
  void initState() {
    super.initState();
    _nameCtrl = TextEditingController(text: widget.state.name);
    _emailCtrl = TextEditingController(text: widget.state.email);
    _dobCtrl = TextEditingController(text: widget.state.dobRaw);
    _nameCtrl.addListener(_onName);
    _emailCtrl.addListener(_onEmail);
  }

  void _onName() {
    widget.onStateChange(widget.state.copyWith(name: _nameCtrl.text));
  }

  void _onEmail() {
    widget.onStateChange(widget.state.copyWith(email: _emailCtrl.text));
  }

  @override
  void didUpdateWidget(covariant GenderOnboardingScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.state.name != oldWidget.state.name &&
        widget.state.name != _nameCtrl.text) {
      _nameCtrl.text = widget.state.name;
    }
    if (widget.state.email != oldWidget.state.email &&
        widget.state.email != _emailCtrl.text) {
      _emailCtrl.text = widget.state.email;
    }
    if (widget.state.dobRaw != oldWidget.state.dobRaw &&
        widget.state.dobRaw != _dobCtrl.text) {
      _dobCtrl.text = widget.state.dobRaw;
    }
  }

  @override
  void dispose() {
    _nameCtrl.dispose();
    _emailCtrl.dispose();
    _dobCtrl.dispose();
    super.dispose();
  }

  Future<void> _pickDob() async {
    final now = DateTime.now();
    final initial = _parseDob(widget.state.dobRaw) ??
        DateTime(now.year - 25, now.month, now.day);
    final picked = await showDatePicker(
      context: context,
      initialDate: initial,
      firstDate: DateTime(1900),
      lastDate: now,
    );
    if (picked != null && mounted) {
      final formatted = DateFormat('dd-MM-yyyy').format(picked);
      _dobCtrl.text = formatted;
      widget.onStateChange(widget.state.copyWith(dobRaw: formatted));
    }
  }

  DateTime? _parseDob(String raw) {
    final m = kDobPattern.firstMatch(raw.replaceAll(' ', ''));
    if (m == null) return null;
    final day = int.tryParse(m.group(1)!);
    final month = int.tryParse(m.group(2)!);
    final year = int.tryParse(m.group(3)!);
    if (day == null || month == null || year == null) return null;
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    try {
      return DateTime(year, month, day);
    } catch (_) {
      return null;
    }
  }

  @override
  Widget build(BuildContext context) {
    final s = widget.state;
    final fieldErrors = validateGenderFormFields(s);
    final scheme = Theme.of(context).colorScheme;

    final paddingH = scaleDp(context, 33.5);
    final paddingV = scaleDp(context, 50.5);
    final fieldHeight = scaleDp(context, 50);
    final spacingSection = scaleDp(context, 70);
    final spacingAfterEmail = scaleDp(context, 78);
    final spacingGenderRows = scaleDp(context, 32);
    final spacingBeforeProgress = scaleDp(context, 78);
    final radioSize = scaleDp(context, 16);
    final radioGap = scaleDp(context, 8);
    final titleSize = scaleSp(context, 20);
    final footerPadH = scaleDp(context, 8);

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
                  'Tell us about you',
                  style: AppFonts.poppins(
                    context,
                    fontSize: titleSize,
                    fontWeight: FontWeight.w500,
                    color: scheme.onSurface,
                  ),
                ),
                SizedBox(height: spacingSection),
                SizedBox(
                  height: fieldHeight,
                  child: TextField(
                    controller: _nameCtrl,
                    maxLength: kNameMaxLength,
                    style: AppFonts.poppins(
                      context,
                      fontSize: scaleSp(context, 16),
                      color: scheme.onSurface,
                    ),
                    decoration: InputDecoration(
                      labelText: 'Name',
                      errorText: _hasTriedSubmit ? fieldErrors.name : null,
                      counterText: '',
                    ),
                  ),
                ),
                SizedBox(height: spacingSection),
                SizedBox(
                  height: fieldHeight,
                  child: Stack(
                    children: [
                      TextField(
                        readOnly: true,
                        controller: _dobCtrl,
                        style: AppFonts.poppins(
                          context,
                          fontSize: scaleSp(context, 16),
                          color: scheme.onSurface,
                        ),
                        decoration: InputDecoration(
                          labelText: 'Date of birth (DD-MM-YYYY)',
                          errorText: _hasTriedSubmit ? fieldErrors.dob : null,
                        ),
                      ),
                      Positioned.fill(
                        child: Material(
                          color: Colors.transparent,
                          child: InkWell(onTap: _pickDob),
                        ),
                      ),
                    ],
                  ),
                ),
                SizedBox(height: spacingSection),
                SizedBox(
                  height: fieldHeight,
                  child: TextField(
                    controller: _emailCtrl,
                    keyboardType: TextInputType.emailAddress,
                    style: AppFonts.poppins(
                      context,
                      fontSize: scaleSp(context, 16),
                      color: scheme.onSurface,
                    ),
                    decoration: InputDecoration(
                      labelText: 'Email',
                      hintText: 'Optional',
                      hintStyle: AppFonts.poppins(
                        context,
                        fontSize: scaleSp(context, 16),
                        color: scheme.onSurfaceVariant,
                      ),
                      errorText: _hasTriedSubmit ? fieldErrors.email : null,
                    ),
                  ),
                ),
                SizedBox(height: spacingAfterEmail),
                Text(
                  'Gender',
                  style: AppFonts.poppins(
                    context,
                    fontSize: scaleSp(context, 14),
                    fontWeight: FontWeight.w600,
                    color: scheme.onSurface,
                  ),
                ),
                SizedBox(height: spacingGenderRows),
                ...GenderOption.values.map((opt) {
                  final selected = s.gender == opt;
                  return Padding(
                    padding: EdgeInsets.only(bottom: spacingGenderRows),
                    child: InkWell(
                      onTap: () =>
                          widget.onStateChange(s.copyWith(gender: opt)),
                      child: Row(
                        children: [
                          SizedBox(
                            width: radioSize,
                            height: radioSize,
                            child: _Material3RadioDot(
                              selected: selected,
                              primary: scheme.primary,
                              outline: scheme.outline,
                              size: radioSize,
                            ),
                          ),
                          SizedBox(width: radioGap),
                          Expanded(
                            child: Text(
                              opt.label,
                              style: AppFonts.poppins(
                                context,
                                fontSize: scaleSp(context, 14),
                                color: scheme.onSurface,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  );
                }),
                if (_hasTriedSubmit && fieldErrors.gender != null)
                  Text(
                    fieldErrors.gender!,
                    style: AppFonts.poppins(
                      context,
                      fontSize: scaleSp(context, 12),
                      color: scheme.error,
                    ),
                  ),
              ],
            ),
          ),
        ),
        Padding(
          padding: EdgeInsets.symmetric(horizontal: paddingH, vertical: paddingV),
          child: Row(
            children: [
              TextButton(
                onPressed: null,
                child: Text(
                  'Back',
                  style: AppFonts.poppins(
                    context,
                    fontSize: scaleSp(context, 14),
                    color: scheme.onSurface.withValues(alpha: 0.38),
                  ),
                ),
              ),
              Expanded(
                child: Padding(
                  padding: EdgeInsets.symmetric(horizontal: footerPadH),
                  child: const TrueProgressBar(
                    totalPoints: 5,
                    activeIndices: [0],
                  ),
                ),
              ),
              TextButton(
                onPressed: () {
                  setState(() => _hasTriedSubmit = true);
                  if (!validateGenderFormFields(widget.state).hasError) {
                    widget.onNext();
                  }
                },
                child: Text(
                  'Next',
                  style: AppFonts.poppins(
                    context,
                    fontSize: scaleSp(context, 14),
                    color: scheme.primary,
                  ),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

// -----------------------------------------------------------------------------
// Screen preview (same file as Kotlin `@Preview` — see bottom of
// `GenderOnboardingScreen.kt`). Flutter has no Compose-style embedded preview;
// open this widget from `lib/preview/preview_main.dart` or Android Studio run
// config "UI Previews".
// -----------------------------------------------------------------------------

/// Kotlin: `@Preview private fun GenderOnboardingScreenPreview()`
class GenderOnboardingScreenPreview extends StatefulWidget {
  const GenderOnboardingScreenPreview({super.key});

  @override
  State<GenderOnboardingScreenPreview> createState() =>
      _GenderOnboardingScreenPreviewState();
}

class _GenderOnboardingScreenPreviewState
    extends State<GenderOnboardingScreenPreview> {
  GenderFormState _state = const GenderFormState();

  @override
  Widget build(BuildContext context) {
    return GenderOnboardingScreen(
      state: _state,
      onStateChange: (s) => setState(() => _state = s),
      onNext: () {},
    );
  }
}

// Flutter Widget Previewer (like Compose @Preview in Android Studio).
// Run: flutter widget-preview start — see https://docs.flutter.dev/tools/widget-previewer
@Preview(
  name: 'Gender onboarding',
  group: 'Onboarding',
  size: Size(402, 874),
  theme: trueClothesPreviewTheme,
)
Widget genderOnboardingWidgetPreview() {
  return const GenderOnboardingScreenPreview();
}
