import 'package:flutter/material.dart';
import 'package:flutter/widget_previews.dart';

import '../app_shell.dart';
import '../theme/widget_preview_theme.dart';
import '../features/home/home_main_screen.dart';
import '../features/onboarding/adding_wardrobe_onboarding_screen.dart';
import '../features/onboarding/body_measurement_onboarding_screen.dart';
import '../features/onboarding/bottom_body_measurement_onboarding_screen.dart';
import '../features/onboarding/colour_onboarding_screen.dart';
import '../features/onboarding/country_onboarding_screen.dart';
import '../features/onboarding/gender_onboarding_screen.dart';
import '../features/onboarding/top_body_measurement_onboarding_screen.dart';
import '../widgets/true_modal.dart';
import '../widgets/true_progress_bar.dart';

// ---------------------------------------------------------------------------
// Gallery wiring only. Each screen defines @Preview in its source file.
// Run: flutter run -t lib/preview/preview_main.dart
// ---------------------------------------------------------------------------

Widget previewTrueclothesApp(BuildContext context) {
  return const AppShell();
}

Widget previewGenderOnboarding(BuildContext context) {
  return const GenderOnboardingScreenPreview();
}

Widget previewCountryOnboarding(BuildContext context) {
  return const CountryOnboardingScreenPreview();
}

Widget previewBodyMeasurementOnboarding(BuildContext context) {
  return const BodyMeasurementOnboardingScreenPreview();
}

Widget previewTopBodyMeasurementOnboarding(BuildContext context) {
  return const TopBodyMeasurementOnboardingScreenPreview();
}

Widget previewBottomBodyMeasurementOnboarding(BuildContext context) {
  return const BottomBodyMeasurementOnboardingScreenPreview();
}

Widget previewColourOnboarding(BuildContext context) {
  return const ColourOnboardingScreenPreview();
}

Widget previewAddingWardrobeOnboarding(BuildContext context) {
  return const AddingWardrobeOnboardingScreenPreview();
}

Widget previewHomeMain(BuildContext context) {
  return const HomeMainScreenPreview();
}

Widget previewTrueProgressBarGallery(BuildContext context) {
  return const TrueProgressBarPreviewGallery();
}

Widget previewTrueModalSamples(BuildContext context) {
  return Center(
    child: Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        FilledButton(
          onPressed: () => showTrueInfoModal(
            context,
            message: 'Sample — matches Kotlin TrueModal (close only).',
          ),
          child: const Text('Show TrueModal sample'),
        ),
      ],
    ),
  );
}

Widget previewOutfitDetailStub(BuildContext context) {
  return Center(
    child: Padding(
      padding: const EdgeInsets.all(24),
      child: Text(
        'Outfit detail — preview stub.\nPort from OutfitDetailScreen.kt + design/screen/home/outfit/design.md',
        textAlign: TextAlign.center,
        style: Theme.of(context).textTheme.bodyLarge,
      ),
    ),
  );
}

Widget previewItemDetailStub(BuildContext context) {
  return Center(
    child: Padding(
      padding: const EdgeInsets.all(24),
      child: Text(
        'Item detail — preview stub.\nPort from ItemDetailScreen.kt + design/screen/home/item/design.md',
        textAlign: TextAlign.center,
        style: Theme.of(context).textTheme.bodyLarge,
      ),
    ),
  );
}

@Preview(
  name: 'TrueModal (stub)',
  group: 'Home',
  size: Size(402, 200),
  theme: trueClothesPreviewTheme,
)
Widget previewTrueModalWidgetPreview() {
  return Builder(builder: previewTrueModalSamples);
}

@Preview(
  name: 'Outfit detail (stub)',
  group: 'Home',
  size: Size(402, 874),
  theme: trueClothesPreviewTheme,
)
Widget previewOutfitDetailWidgetPreview() {
  return Builder(builder: previewOutfitDetailStub);
}

@Preview(
  name: 'Item detail (stub)',
  group: 'Home',
  size: Size(402, 874),
  theme: trueClothesPreviewTheme,
)
Widget previewItemDetailWidgetPreview() {
  return Builder(builder: previewItemDetailStub);
}

@Preview(
  name: 'TrueclothesApp',
  group: 'App',
  size: Size(402, 874),
  theme: trueClothesPreviewTheme,
)
Widget previewTrueclothesAppWidgetPreview() {
  return Builder(builder: previewTrueclothesApp);
}
