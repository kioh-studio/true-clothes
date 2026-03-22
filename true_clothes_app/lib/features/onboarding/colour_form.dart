/// Kotlin `ColourOnboardingScreen.kt`.
enum ColourPreference {
  unknown('unknown', "I don't know"),
  customLater('custom_later', "I'll set this later");

  const ColourPreference(this.id, this.label);
  final String id;
  final String label;
}

class ColourFormState {
  const ColourFormState({this.colourPreference});

  final ColourPreference? colourPreference;

  ColourFormState copyWith({ColourPreference? colourPreference}) {
    return ColourFormState(
      colourPreference: colourPreference ?? this.colourPreference,
    );
  }
}
