/// Shared enums — Kotlin `BodyMeasurementOnboardingScreen.kt` / `TopBodyMeasurementOnboardingScreen.kt`.
enum HeightUnit {
  cm('cm', 'CM'),
  inUnit('in', 'IN');

  const HeightUnit(this.id, this.label);
  final String id;
  final String label;
}

enum WeightUnit {
  kg('kg', 'KG'),
  lb('lb', 'LB');

  const WeightUnit(this.id, this.label);
  final String id;
  final String label;
}

enum MeasurementMethod {
  manual('manual'),
  aiGuess('ai_guess');

  const MeasurementMethod(this.id);
  final String id;
}
