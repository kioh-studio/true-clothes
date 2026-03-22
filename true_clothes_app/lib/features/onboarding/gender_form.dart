// Ported from Kotlin `GenderOnboardingScreen.kt` + `true-clothes-docs/design/screen/onboarding/gender/design.md`.

const int kNameMaxLength = 100;

final RegExp kDobPattern = RegExp(r'^(\d{2})[-/]?(\d{2})[-/]?(\d{4})$');
final RegExp kEmailPattern = RegExp(r'^[\w.-]+@[\w.-]+\.\w{2,}$');

enum GenderOption {
  man('man', 'Man'),
  woman('woman', 'Woman'),
  other('other', 'Others');

  const GenderOption(this.id, this.label);
  final String id;
  final String label;
}

class GenderFormState {
  const GenderFormState({
    this.name = '',
    this.dobRaw = '',
    this.email = '',
    this.gender,
  });

  final String name;
  final String dobRaw;
  final String email;
  final GenderOption? gender;

  GenderFormState copyWith({
    String? name,
    String? dobRaw,
    String? email,
    GenderOption? gender,
  }) {
    return GenderFormState(
      name: name ?? this.name,
      dobRaw: dobRaw ?? this.dobRaw,
      email: email ?? this.email,
      gender: gender ?? this.gender,
    );
  }
}

class GenderFieldErrors {
  const GenderFieldErrors({
    this.name,
    this.dob,
    this.email,
    this.gender,
  });

  final String? name;
  final String? dob;
  final String? email;
  final String? gender;

  bool get hasError =>
      name != null || dob != null || email != null || gender != null;
}

GenderFieldErrors validateGenderFormFields(GenderFormState state) {
  String? nameError;
  if (state.name.trim().isEmpty) {
    nameError = 'Please enter your name.';
  } else if (state.name.length > kNameMaxLength) {
    nameError = 'Name must be at most $kNameMaxLength characters.';
  }

  final dobTrimmed = state.dobRaw.replaceAll(' ', '');
  String? dobError;
  if (state.dobRaw.trim().isEmpty) {
    dobError = 'Please enter your date of birth.';
  } else if (!kDobPattern.hasMatch(dobTrimmed)) {
    dobError = 'Please enter date of birth in DD-MM-YYYY format.';
  }

  String? emailError;
  if (state.email.isNotEmpty && !kEmailPattern.hasMatch(state.email)) {
    emailError = 'Please enter a valid email address.';
  }

  final genderError =
      state.gender == null ? 'Please select your gender.' : null;

  return GenderFieldErrors(
    name: nameError,
    dob: dobError,
    email: emailError,
    gender: genderError,
  );
}
