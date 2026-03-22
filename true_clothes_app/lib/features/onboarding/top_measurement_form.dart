import 'onboarding_units.dart';

/// Kotlin `TopBodyMeasurementOnboardingScreen.kt`.
class TopMeasurementFormState {
  const TopMeasurementFormState({
    this.shoulderWidthRaw = '',
    this.shoulderWidthUnit = HeightUnit.cm,
    this.bicepRaw = '',
    this.bicepUnit = HeightUnit.cm,
    this.sleevesRaw = '',
    this.sleevesUnit = HeightUnit.cm,
    this.chestRaw = '',
    this.chestUnit = HeightUnit.cm,
    this.neckRaw = '',
    this.neckUnit = HeightUnit.cm,
  });

  final String shoulderWidthRaw;
  final HeightUnit shoulderWidthUnit;
  final String bicepRaw;
  final HeightUnit bicepUnit;
  final String sleevesRaw;
  final HeightUnit sleevesUnit;
  final String chestRaw;
  final HeightUnit chestUnit;
  final String neckRaw;
  final HeightUnit neckUnit;

  TopMeasurementFormState copyWith({
    String? shoulderWidthRaw,
    HeightUnit? shoulderWidthUnit,
    String? bicepRaw,
    HeightUnit? bicepUnit,
    String? sleevesRaw,
    HeightUnit? sleevesUnit,
    String? chestRaw,
    HeightUnit? chestUnit,
    String? neckRaw,
    HeightUnit? neckUnit,
  }) {
    return TopMeasurementFormState(
      shoulderWidthRaw: shoulderWidthRaw ?? this.shoulderWidthRaw,
      shoulderWidthUnit: shoulderWidthUnit ?? this.shoulderWidthUnit,
      bicepRaw: bicepRaw ?? this.bicepRaw,
      bicepUnit: bicepUnit ?? this.bicepUnit,
      sleevesRaw: sleevesRaw ?? this.sleevesRaw,
      sleevesUnit: sleevesUnit ?? this.sleevesUnit,
      chestRaw: chestRaw ?? this.chestRaw,
      chestUnit: chestUnit ?? this.chestUnit,
      neckRaw: neckRaw ?? this.neckRaw,
      neckUnit: neckUnit ?? this.neckUnit,
    );
  }
}

class TopMeasurementFieldErrors {
  const TopMeasurementFieldErrors({
    this.shoulderWidth,
    this.bicep,
    this.sleeves,
    this.chest,
    this.neck,
  });

  final String? shoulderWidth;
  final String? bicep;
  final String? sleeves;
  final String? chest;
  final String? neck;

  bool get hasError =>
      shoulderWidth != null ||
      bicep != null ||
      sleeves != null ||
      chest != null ||
      neck != null;
}

String? _validateOptionalNonNegative(String raw) {
  final t = raw.trim();
  if (t.isEmpty) return null;
  final v = double.tryParse(t);
  if (v == null) return 'Please enter a valid number.';
  if (v < 0) return 'Value must be >= 0.';
  return null;
}

TopMeasurementFieldErrors validateTopMeasurementFields(
  TopMeasurementFormState state,
) {
  return TopMeasurementFieldErrors(
    shoulderWidth: _validateOptionalNonNegative(state.shoulderWidthRaw),
    bicep: _validateOptionalNonNegative(state.bicepRaw),
    sleeves: _validateOptionalNonNegative(state.sleevesRaw),
    chest: _validateOptionalNonNegative(state.chestRaw),
    neck: _validateOptionalNonNegative(state.neckRaw),
  );
}
