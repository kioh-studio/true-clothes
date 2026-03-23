import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter/material.dart';
import 'package:flutter/widget_previews.dart';
import 'package:geocoding/geocoding.dart';
import 'package:geolocator/geolocator.dart';

import '../../core/responsive.dart';
import '../../theme/app_fonts.dart';
import '../../theme/widget_preview_theme.dart';
import '../../widgets/onboarding_nav_bar.dart';
import 'country_form.dart';

/// Kotlin `CountryOnboardingScreen.kt` / country `design.md`.
class CountryOnboardingScreen extends StatefulWidget {
  const CountryOnboardingScreen({
    super.key,
    required this.state,
    required this.onStateChange,
    required this.onBack,
    required this.onNext,
  });

  final CountryFormState state;
  final ValueChanged<CountryFormState> onStateChange;
  final VoidCallback onBack;
  final VoidCallback onNext;

  @override
  State<CountryOnboardingScreen> createState() =>
      _CountryOnboardingScreenState();
}

class _CountryOnboardingScreenState extends State<CountryOnboardingScreen> {
  bool _listExpanded = false;
  String? _locationError;
  String? _detectedLocationLabel;
  late final TextEditingController _displayCtrl;
  bool _didAttemptInitialLocate = false;

  @override
  void initState() {
    super.initState();
    _displayCtrl = TextEditingController(text: _fieldDisplay);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_didAttemptInitialLocate || kIsWeb) return;
      _didAttemptInitialLocate = true;
      _requestOrDetectCountry();
    });
  }

  @override
  void dispose() {
    _displayCtrl.dispose();
    super.dispose();
  }

  @override
  void didUpdateWidget(covariant CountryOnboardingScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    _syncDisplayController();
  }

  void _syncDisplayController() {
    final t = _fieldDisplay;
    if (_displayCtrl.text != t) {
      _displayCtrl.value = TextEditingValue(
        text: t,
        selection: TextSelection.collapsed(offset: t.length),
      );
    }
  }

  Future<void> _requestOrDetectCountry() async {
    if (kIsWeb) return;

    setState(() => _locationError = null);

    final serviceOn = await Geolocator.isLocationServiceEnabled();
    if (!serviceOn) {
      setState(() {
        _locationError =
            'Location services are off. Turn them on or choose country manually.';
      });
      return;
    }

    var permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
    }
    if (permission == LocationPermission.denied ||
        permission == LocationPermission.deniedForever) {
      setState(() {
        _locationError =
            'Location permission denied. Please select country manually.';
      });
      return;
    }

    try {
      final pos = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.medium,
        ),
      );
      final marks = await placemarkFromCoordinates(
        pos.latitude,
        pos.longitude,
      );
      if (marks.isEmpty) {
        setState(() {
          _locationError =
              'Unable to detect country. Please select country manually.';
        });
        return;
      }
      final p = marks.first;
      final code = p.isoCountryCode?.toUpperCase();
      if (code == null || code.isEmpty) {
        setState(() {
          _locationError =
              'Unable to detect country. Please select country manually.';
        });
        return;
      }
      final matched = countryOptionForIsoCode(code);
      final option = matched ??
          CountryOption(
            id: code,
            label: (p.country ?? '').trim().isEmpty ? code : p.country!.trim(),
          );
      final label = _formatCityCountry(
        city: p.locality ?? p.subAdministrativeArea ?? p.administrativeArea,
        country: option.label,
      );
      widget.onStateChange(CountryFormState(selectedCountry: option));
      setState(() {
        _detectedLocationLabel = label;
        _locationError = null;
      });
      _displayCtrl.value = TextEditingValue(
        text: label,
        selection: TextSelection.collapsed(offset: label.length),
      );
    } catch (_) {
      setState(() {
        _locationError =
            'Unable to get your location. Please select country manually.';
      });
    }
  }

  String _formatCityCountry({String? city, required String country}) {
    final c = city?.trim() ?? '';
    if (c.isEmpty) return country;
    return '$c, $country';
  }

  String get _fieldDisplay {
    if (_detectedLocationLabel != null) return _detectedLocationLabel!;
    return widget.state.selectedCountry?.label ?? '';
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final paddingH = scaleDp(context, 33.5);
    final paddingV = scaleDp(context, 33.5);
    final spacingSection = scaleDp(context, 70);
    final spacingBeforeProgress = scaleDp(context, 78);
    final titleSize = scaleSp(context, 20);

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
                  'Where are you?',
                  style: AppFonts.poppins(
                    context,
                    fontSize: titleSize,
                    fontWeight: FontWeight.w500,
                    color: scheme.onSurface,
                  ),
                ),
                SizedBox(height: spacingSection),
                TextField(
                  readOnly: true,
                  onTap: () =>
                      setState(() => _listExpanded = !_listExpanded),
                  controller: _displayCtrl,
                  style: AppFonts.poppins(
                    context,
                    fontSize: scaleSp(context, 16),
                    color: scheme.onSurface,
                  ),
                  decoration: const InputDecoration(
                    labelText: 'Country',
                    hintText: 'Detecting location…',
                  ),
                ),
                SizedBox(height: scaleDp(context, 8)),
                Align(
                  alignment: Alignment.centerLeft,
                  child: TextButton(
                    onPressed: _requestOrDetectCountry,
                    child: Text(
                      'Use current location',
                      style: AppFonts.poppins(
                        context,
                        fontSize: scaleSp(context, 14),
                        color: scheme.primary,
                      ),
                    ),
                  ),
                ),
                if (_locationError != null)
                  Text(
                    _locationError!,
                    style: AppFonts.poppins(
                      context,
                      fontSize: scaleSp(context, 12),
                      color: scheme.error,
                    ),
                  ),
                if (_listExpanded) ...[
                  SizedBox(height: scaleDp(context, 4)),
                  ...kCountryOptions.map((option) {
                    return Material(
                      color: Colors.transparent,
                      child: InkWell(
                        onTap: () {
                          widget.onStateChange(
                            CountryFormState(selectedCountry: option),
                          );
                          setState(() {
                            _detectedLocationLabel = null;
                            _listExpanded = false;
                          });
                        },
                        child: Padding(
                          padding: EdgeInsets.symmetric(
                            vertical: scaleDp(context, 12),
                            horizontal: scaleDp(context, 16),
                          ),
                          child: Align(
                            alignment: Alignment.centerLeft,
                            child: Text(
                              option.label,
                              style: AppFonts.poppins(
                                context,
                                fontSize: scaleSp(context, 16),
                              ),
                            ),
                          ),
                        ),
                      ),
                    );
                  }),
                ],
              ],
            ),
          ),
        ),
        OnboardingNavBar(
          activeIndices: const [1],
          footerVerticalDesignDp: 33.5,
          onBack: widget.onBack,
          onNext: widget.onNext,
          nextEnabled: widget.state.selectedCountry != null,
        ),
      ],
    );
  }
}

class CountryOnboardingScreenPreview extends StatefulWidget {
  const CountryOnboardingScreenPreview({super.key});

  @override
  State<CountryOnboardingScreenPreview> createState() =>
      _CountryOnboardingScreenPreviewState();
}

class _CountryOnboardingScreenPreviewState
    extends State<CountryOnboardingScreenPreview> {
  CountryFormState _state = const CountryFormState();

  @override
  Widget build(BuildContext context) {
    return CountryOnboardingScreen(
      state: _state,
      onStateChange: (s) => setState(() => _state = s),
      onBack: () {},
      onNext: () {},
    );
  }
}

@Preview(
  name: 'Country onboarding',
  group: 'Onboarding',
  size: Size(402, 874),
  theme: trueClothesPreviewTheme,
)
Widget countryOnboardingWidgetPreview() {
  return const CountryOnboardingScreenPreview();
}
