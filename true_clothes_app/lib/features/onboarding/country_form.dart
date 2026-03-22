/// Kotlin `CountryOnboardingScreen.kt` — design: `true-clothes-docs/design/screen/onboarding/country/design.md`.
class CountryOption {
  const CountryOption({required this.id, required this.label});

  final String id;
  final String label;
}

const List<CountryOption> kCountryOptions = [
  CountryOption(id: 'AU', label: 'Australia'),
  CountryOption(id: 'CA', label: 'Canada'),
  CountryOption(id: 'DE', label: 'Germany'),
  CountryOption(id: 'FR', label: 'France'),
  CountryOption(id: 'GB', label: 'United Kingdom'),
  CountryOption(id: 'IN', label: 'India'),
  CountryOption(id: 'JP', label: 'Japan'),
  CountryOption(id: 'US', label: 'United States'),
  CountryOption(id: 'VN', label: 'Vietnam'),
];

class CountryFormState {
  const CountryFormState({this.selectedCountry});

  final CountryOption? selectedCountry;
}

CountryOption? countryOptionForIsoCode(String? code) {
  if (code == null || code.isEmpty) return null;
  final upper = code.toUpperCase();
  for (final o in kCountryOptions) {
    if (o.id.toUpperCase() == upper) return o;
  }
  return null;
}
