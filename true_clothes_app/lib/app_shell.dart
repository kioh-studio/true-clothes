import 'package:flutter/material.dart';
import 'package:flutter/widget_previews.dart';

import 'features/home/home_main_screen.dart';
import 'features/onboarding/adding_wardrobe_form.dart';
import 'features/onboarding/adding_wardrobe_onboarding_screen.dart';
import 'features/onboarding/body_measurement_form.dart';
import 'features/onboarding/body_measurement_onboarding_screen.dart';
import 'features/onboarding/bottom_body_measurement_onboarding_screen.dart';
import 'features/onboarding/bottom_measurement_form.dart';
import 'features/onboarding/colour_form.dart';
import 'features/onboarding/colour_onboarding_screen.dart';
import 'features/onboarding/country_form.dart';
import 'features/onboarding/country_onboarding_screen.dart';
import 'features/onboarding/gender_form.dart';
import 'features/onboarding/gender_onboarding_screen.dart';
import 'features/onboarding/top_body_measurement_onboarding_screen.dart';
import 'features/onboarding/top_measurement_form.dart';
import 'theme/app_colors.dart';
import 'theme/widget_preview_theme.dart';

/// Root navigation mirroring Kotlin `MainActivity` / `OnboardingViewModel` flow.
/// Design: `true-clothes-docs/design/screen/onboarding/design.md`.
class AppShell extends StatefulWidget {
  const AppShell({super.key});

  @override
  State<AppShell> createState() => _AppShellState();
}

enum _Flow {
  gender,
  country,
  body,
  topBody,
  bottomBody,
  colour,
  wardrobe,
  home,
}

class _AppShellState extends State<AppShell> {
  _Flow _flow = _Flow.gender;
  GenderFormState _gender = const GenderFormState();
  CountryFormState _country = const CountryFormState();
  BodyMeasurementFormState _body = const BodyMeasurementFormState();
  TopMeasurementFormState _top = const TopMeasurementFormState();
  BottomMeasurementFormState _bottom = const BottomMeasurementFormState();
  ColourFormState _colour = const ColourFormState();
  final AddingWardrobeFormState _wardrobe = const AddingWardrobeFormState();

  void _go(_Flow f) => setState(() => _flow = f);

  @override
  Widget build(BuildContext context) {
    if (_flow == _Flow.home) {
      return const HomeMainScreen();
    }

    Widget body;
    switch (_flow) {
      case _Flow.gender:
        body = GenderOnboardingScreen(
          state: _gender,
          onStateChange: (g) => setState(() => _gender = g),
          onNext: () => _go(_Flow.country),
        );
        break;
      case _Flow.country:
        body = CountryOnboardingScreen(
          state: _country,
          onStateChange: (c) => setState(() => _country = c),
          onBack: () => _go(_Flow.gender),
          onNext: () => _go(_Flow.body),
        );
        break;
      case _Flow.body:
        body = BodyMeasurementOnboardingScreen(
          state: _body,
          onStateChange: (b) => setState(() => _body = b),
          onBack: () => _go(_Flow.country),
          onNext: () => _go(_Flow.colour),
          onTopBody: () => _go(_Flow.topBody),
          onBottomBody: () => _go(_Flow.bottomBody),
        );
        break;
      case _Flow.topBody:
        body = TopBodyMeasurementOnboardingScreen(
          state: _top,
          onStateChange: (t) => setState(() => _top = t),
          onBack: () => _go(_Flow.body),
          onNext: () => _go(_Flow.body),
        );
        break;
      case _Flow.bottomBody:
        body = BottomBodyMeasurementOnboardingScreen(
          state: _bottom,
          onStateChange: (b) => setState(() => _bottom = b),
          onBack: () => _go(_Flow.body),
          onNext: () => _go(_Flow.body),
        );
        break;
      case _Flow.colour:
        body = ColourOnboardingScreen(
          state: _colour,
          onStateChange: (c) => setState(() => _colour = c),
          onBack: () => _go(_Flow.body),
          onNext: () => _go(_Flow.wardrobe),
        );
        break;
      case _Flow.wardrobe:
        body = AddingWardrobeOnboardingScreen(
          state: _wardrobe,
          onBack: () => _go(_Flow.colour),
          onNext: () => _go(_Flow.home),
        );
        break;
      case _Flow.home:
        body = const SizedBox.shrink();
    }

    return Scaffold(
      backgroundColor: AppColors.mainBackground,
      body: SafeArea(child: body),
    );
  }
}

@Preview(
  name: 'App shell (onboarding flow)',
  group: 'App',
  size: Size(402, 874),
  theme: trueClothesPreviewTheme,
)
Widget appShellWidgetPreview() {
  return const AppShell();
}
