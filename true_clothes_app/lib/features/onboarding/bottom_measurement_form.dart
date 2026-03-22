import 'onboarding_units.dart';

/// Kotlin `BottomBodyMeasurementOnboardingScreen.kt`.
class BottomMeasurementFormState {
  const BottomMeasurementFormState({
    this.waistRaw = '',
    this.waistUnit = HeightUnit.cm,
    this.hipRaw = '',
    this.hipUnit = HeightUnit.cm,
    this.inseamRaw = '',
    this.inseamUnit = HeightUnit.cm,
    this.thighRaw = '',
    this.thighUnit = HeightUnit.cm,
    this.ankleRaw = '',
    this.ankleUnit = HeightUnit.cm,
  });

  final String waistRaw;
  final HeightUnit waistUnit;
  final String hipRaw;
  final HeightUnit hipUnit;
  final String inseamRaw;
  final HeightUnit inseamUnit;
  final String thighRaw;
  final HeightUnit thighUnit;
  final String ankleRaw;
  final HeightUnit ankleUnit;

  BottomMeasurementFormState copyWith({
    String? waistRaw,
    HeightUnit? waistUnit,
    String? hipRaw,
    HeightUnit? hipUnit,
    String? inseamRaw,
    HeightUnit? inseamUnit,
    String? thighRaw,
    HeightUnit? thighUnit,
    String? ankleRaw,
    HeightUnit? ankleUnit,
  }) {
    return BottomMeasurementFormState(
      waistRaw: waistRaw ?? this.waistRaw,
      waistUnit: waistUnit ?? this.waistUnit,
      hipRaw: hipRaw ?? this.hipRaw,
      hipUnit: hipUnit ?? this.hipUnit,
      inseamRaw: inseamRaw ?? this.inseamRaw,
      inseamUnit: inseamUnit ?? this.inseamUnit,
      thighRaw: thighRaw ?? this.thighRaw,
      thighUnit: thighUnit ?? this.thighUnit,
      ankleRaw: ankleRaw ?? this.ankleRaw,
      ankleUnit: ankleUnit ?? this.ankleUnit,
    );
  }
}

class BottomMeasurementFieldErrors {
  const BottomMeasurementFieldErrors({
    this.waist,
    this.hip,
    this.inseam,
    this.thigh,
    this.ankle,
  });

  final String? waist;
  final String? hip;
  final String? inseam;
  final String? thigh;
  final String? ankle;

  bool get hasError =>
      waist != null ||
      hip != null ||
      inseam != null ||
      thigh != null ||
      ankle != null;
}

String? _validateOptionalNonNegative(String raw) {
  final t = raw.trim();
  if (t.isEmpty) return null;
  final v = double.tryParse(t);
  if (v == null) return 'Please enter a valid number.';
  if (v < 0) return 'Value must be >= 0.';
  return null;
}

BottomMeasurementFieldErrors validateBottomMeasurementFields(
  BottomMeasurementFormState state,
) {
  return BottomMeasurementFieldErrors(
    waist: _validateOptionalNonNegative(state.waistRaw),
    hip: _validateOptionalNonNegative(state.hipRaw),
    inseam: _validateOptionalNonNegative(state.inseamRaw),
    thigh: _validateOptionalNonNegative(state.thighRaw),
    ankle: _validateOptionalNonNegative(state.ankleRaw),
  );
}
