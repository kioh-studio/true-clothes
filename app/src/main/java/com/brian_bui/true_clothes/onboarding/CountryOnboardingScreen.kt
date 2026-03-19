package com.brian_bui.true_clothes.onboarding

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.location.Geocoder
import android.location.Location
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.core.content.ContextCompat
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import com.brian_bui.true_clothes.shared.components.TrueProgressBar
import com.brian_bui.true_clothes.shared.theme.LocalResponsiveScale
import com.brian_bui.true_clothes.shared.theme.PoppinsFontFamily
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import java.util.Locale

/** design.md: country single_select, required. Simple list for now; can be locale-aware later. */
data class CountryOption(val id: String, val label: String)

private val COUNTRY_OPTIONS = listOf(
    CountryOption("AU", "Australia"),
    CountryOption("CA", "Canada"),
    CountryOption("DE", "Germany"),
    CountryOption("FR", "France"),
    CountryOption("GB", "United Kingdom"),
    CountryOption("IN", "India"),
    CountryOption("JP", "Japan"),
    CountryOption("US", "United States"),
    CountryOption("VN", "Vietnam"),
)

data class CountryFormState(
    val selectedCountry: CountryOption? = null,
)

private data class DetectedPlace(
    val countryCode: String,
    val countryName: String,
    val cityName: String?,
)

/**
 * Country onboarding screen (design.md: onboarding.country).
 * Scrollable body, fixed footer with progress bar and Back/Next.
 */
@Composable
fun CountryOnboardingScreen(
    state: CountryFormState,
    onStateChange: (CountryFormState) -> Unit,
    onBack: () -> Unit,
    onNext: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val context = LocalContext.current
    val fusedLocationClient = remember(context) { LocationServices.getFusedLocationProviderClient(context) }
    val scale = LocalResponsiveScale.current
    val paddingH = scale.scaleDp(33.5f)
    val paddingV = scale.scaleDp(33.5f)
    val fieldHeight = scale.scaleDp(50f)
    val spacingSection = scale.scaleDp(70f)
    val spacingBeforeProgress = scale.scaleDp(78f)
    val titleFontSize = scale.scaleSp(20f)

    var expanded by remember { mutableStateOf(false) }
    var locationError by remember { mutableStateOf<String?>(null) }
    var detectedLocationLabel by remember { mutableStateOf<String?>(null) }

    val permissionLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions(),
    ) { results ->
        val granted = results[Manifest.permission.ACCESS_FINE_LOCATION] == true ||
            results[Manifest.permission.ACCESS_COARSE_LOCATION] == true
        if (granted) {
            detectCountryFromDevice(
                context = context,
                fusedLocationClient = fusedLocationClient,
                onCountryDetected = { detectedPlace ->
                    onStateChange(
                        state.copy(
                            selectedCountry = CountryOption(
                                id = detectedPlace.countryCode,
                                label = detectedPlace.countryName,
                            ),
                        ),
                    )
                    detectedLocationLabel = formatCityCountryLabel(
                        city = detectedPlace.cityName,
                        country = detectedPlace.countryName,
                    )
                    locationError = null
                },
                onError = { message -> locationError = message },
            )
        } else {
            locationError = "Location permission denied. Please select country manually."
        }
    }

    fun requestOrDetectCountry() {
        val hasFine = ContextCompat.checkSelfPermission(
            context,
            Manifest.permission.ACCESS_FINE_LOCATION,
        ) == PackageManager.PERMISSION_GRANTED
        val hasCoarse = ContextCompat.checkSelfPermission(
            context,
            Manifest.permission.ACCESS_COARSE_LOCATION,
        ) == PackageManager.PERMISSION_GRANTED
        if (hasFine || hasCoarse) {
            detectCountryFromDevice(
                context = context,
                fusedLocationClient = fusedLocationClient,
                onCountryDetected = { detectedPlace ->
                    onStateChange(
                        state.copy(
                            selectedCountry = CountryOption(
                                id = detectedPlace.countryCode,
                                label = detectedPlace.countryName,
                            ),
                        ),
                    )
                    detectedLocationLabel = formatCityCountryLabel(
                        city = detectedPlace.cityName,
                        country = detectedPlace.countryName,
                    )
                    locationError = null
                },
                onError = { message -> locationError = message },
            )
        } else {
            permissionLauncher.launch(
                arrayOf(
                    Manifest.permission.ACCESS_FINE_LOCATION,
                    Manifest.permission.ACCESS_COARSE_LOCATION,
                ),
            )
        }
    }

    LaunchedEffect(Unit) {
        if (state.selectedCountry == null) {
            requestOrDetectCountry()
        }
    }

    Column(
        modifier = modifier
            .fillMaxSize()
            .fillMaxWidth(),
    ) {
        Column(
            modifier = Modifier
                .weight(1f)
                .fillMaxWidth()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = paddingH, vertical = paddingV)
                .padding(bottom = spacingBeforeProgress),
        ) {
            Text(
                text = "Where are you?",
                style = MaterialTheme.typography.titleLarge.copy(
                    fontFamily = PoppinsFontFamily,
                    fontSize = titleFontSize,
                    fontWeight = FontWeight.Medium,
                ),
            )
            Spacer(modifier = Modifier.size(spacingSection))

            OutlinedTextField(
                value = detectedLocationLabel ?: state.selectedCountry?.label ?: "",
                onValueChange = {},
                readOnly = true,
                label = { Text("Country") },
                modifier = Modifier
                    .fillMaxWidth()
                    .heightIn(min = fieldHeight)
                    .clickable { expanded = !expanded },
                placeholder = { Text("Select country") },
            )
            Spacer(modifier = Modifier.size(scale.scaleDp(8f)))
            TextButton(onClick = { requestOrDetectCountry() }) {
                Text("Use current location")
            }
            if (locationError != null) {
                Text(
                    text = locationError ?: "",
                    color = MaterialTheme.colorScheme.error,
                    style = MaterialTheme.typography.bodySmall,
                )
            }
            if (expanded) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(top = scale.scaleDp(4f)),
                    verticalArrangement = Arrangement.spacedBy(scale.scaleDp(2f)),
                ) {
                    COUNTRY_OPTIONS.forEach { option ->
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable {
                                    onStateChange(state.copy(selectedCountry = option))
                                    detectedLocationLabel = null
                                    expanded = false
                                }
                                .padding(vertical = scale.scaleDp(12f), horizontal = scale.scaleDp(16f)),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Text(
                                text = option.label,
                                style = MaterialTheme.typography.bodyLarge,
                            )
                        }
                    }
                }
            }
        }

        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = paddingH, vertical = paddingV),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween,
        ) {
            TextButton(onClick = onBack) {
                Text("Back")
            }
            TrueProgressBar(
                totalPoints = 5,
                activeIndices = listOf(1),
                modifier = Modifier.weight(1f).padding(horizontal = scale.scaleDp(8f)),
            )
            TextButton(
                onClick = onNext,
                enabled = state.selectedCountry != null,
            ) {
                Text("Next")
            }
        }
    }
}

private fun detectCountryFromDevice(
    context: Context,
    fusedLocationClient: com.google.android.gms.location.FusedLocationProviderClient,
    onCountryDetected: (DetectedPlace) -> Unit,
    onError: (String) -> Unit,
) {
    val hasFine = ContextCompat.checkSelfPermission(
        context,
        Manifest.permission.ACCESS_FINE_LOCATION,
    ) == PackageManager.PERMISSION_GRANTED
    val hasCoarse = ContextCompat.checkSelfPermission(
        context,
        Manifest.permission.ACCESS_COARSE_LOCATION,
    ) == PackageManager.PERMISSION_GRANTED
    if (!hasFine && !hasCoarse) {
        onError("Location permission denied. Please select country manually.")
        return
    }

    fusedLocationClient.lastLocation
        .addOnSuccessListener { location ->
            if (location != null) {
                resolveCountryFromLocation(context, location, onCountryDetected, onError)
            } else {
                fusedLocationClient.getCurrentLocation(Priority.PRIORITY_BALANCED_POWER_ACCURACY, null)
                    .addOnSuccessListener { freshLocation ->
                        if (freshLocation == null) {
                            onError("Unable to get your location. Please select country manually.")
                        } else {
                            resolveCountryFromLocation(context, freshLocation, onCountryDetected, onError)
                        }
                    }
                    .addOnFailureListener {
                        onError("Unable to get your location. Please select country manually.")
                    }
            }
        }
        .addOnFailureListener {
            onError("Unable to get your location. Please select country manually.")
        }
}

private fun getDetectedPlace(context: Context, latitude: Double, longitude: Double): DetectedPlace? {
    if (!Geocoder.isPresent()) return null
    val geocoder = Geocoder(context, Locale.getDefault())
    @Suppress("DEPRECATION")
    return runCatching {
        val address = geocoder.getFromLocation(latitude, longitude, 1)
            ?.firstOrNull()
            ?: return@runCatching null
        val countryCode = address.countryCode?.uppercase(Locale.US) ?: return@runCatching null
        val countryName = address.countryName?.takeIf { it.isNotBlank() } ?: countryCode
        val city = address.locality
            ?: address.subAdminArea
            ?: address.adminArea
        DetectedPlace(
            countryCode = countryCode,
            countryName = countryName,
            cityName = city?.takeIf { it.isNotBlank() },
        )
    }.getOrNull()
}

private fun resolveCountryFromLocation(
    context: Context,
    location: Location,
    onCountryDetected: (DetectedPlace) -> Unit,
    onError: (String) -> Unit,
) {
    val detectedPlace = getDetectedPlace(context, location.latitude, location.longitude)
    if (detectedPlace == null) {
        onError("Unable to detect country. Please select country manually.")
        return
    }
    val selectedOption = COUNTRY_OPTIONS.firstOrNull { it.id.equals(detectedPlace.countryCode, ignoreCase = true) }
        ?: CountryOption(detectedPlace.countryCode, detectedPlace.countryName)
    onCountryDetected(
        detectedPlace.copy(
            countryCode = selectedOption.id,
            countryName = selectedOption.label,
        ),
    )
}

private fun formatCityCountryLabel(city: String?, country: String): String {
    val cityTrimmed = city?.trim().orEmpty()
    if (cityTrimmed.isBlank()) return country
    return "$cityTrimmed, $country"
}
