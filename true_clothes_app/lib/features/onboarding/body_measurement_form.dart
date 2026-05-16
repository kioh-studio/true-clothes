import 'onboarding_units.dart';

/// Kotlin `BodyMeasurementOnboardingScreen.kt`.
class BodyMeasurementFormState {
  const BodyMeasurementFormState({
    this.heightRaw = '',
    this.heightUnit = HeightUnit.cm,
    this.weightRaw = '',
    this.weightUnit = WeightUnit.kg,
    this.measurementMethod,
  });

  final String heightRaw;
  final HeightUnit heightUnit;
  final String weightRaw;
  final WeightUnit weightUnit;
  final MeasurementMethod? measurementMethod;

  BodyMeasurementFormState copyWith({
    String? heightRaw,
    HeightUnit? heightUnit,
    String? weightRaw,
    WeightUnit? weightUnit,
    MeasurementMethod? measurementMethod,
  }) {
    return BodyMeasurementFormState(
      heightRaw: heightRaw ?? this.heightRaw,
      heightUnit: heightUnit ?? this.heightUnit,
      weightRaw: weightRaw ?? this.weightRaw,
      weightUnit: weightUnit ?? this.weightUnit,
      measurementMethod: measurementMethod ?? this.measurementMethod,
    );
  }
}

class BodyMeasurementFieldErrors {
  const BodyMeasurementFieldErrors({this.height, this.weight});

  final String? height;
  final String? weight;

  String? get firstError => height ?? weight;

  bool get hasError => firstError != null;
}

BodyMeasurementFieldErrors validateBodyMeasurementFormFields(
  BodyMeasurementFormState state,
) {
  final height = state.heightRaw.trim();
  final h = height.isEmpty ? null : double.tryParse(height);
  final heightError =
      (h == null || h <= 0) ? 'Please enter a valid height.' : null;

  final weight = state.weightRaw.trim();
  final w = weight.isEmpty ? null : double.tryParse(weight);
  final weightError =
      (w == null || w <= 0) ? 'Please enter a valid weight.' : null;

  return BodyMeasurementFieldErrors(height: heightError, weight: weightError);
}

/// Parsed height in centimetres when [BodyMeasurementFormState] fields are valid.
double? parseHeightCm(BodyMeasurementFormState state) {
  final raw = state.heightRaw.trim();
  if (raw.isEmpty) return null;
  final v = double.tryParse(raw);
  if (v == null || v <= 0) return null;
  return state.heightUnit == HeightUnit.cm ? v : v * 2.54;
}

/// Parsed weight in kilograms when valid.
double? parseWeightKg(BodyMeasurementFormState state) {
  final raw = state.weightRaw.trim();
  if (raw.isEmpty) return null;
  final v = double.tryParse(raw);
  if (v == null || v <= 0) return null;
  return state.weightUnit == WeightUnit.kg ? v : v * 0.45359237;
}
