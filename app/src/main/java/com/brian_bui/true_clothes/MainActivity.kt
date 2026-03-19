package com.brian_bui.true_clothes

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.tooling.preview.PreviewScreenSizes
import androidx.compose.ui.unit.dp
import com.brian_bui.true_clothes.onboarding.CountryOnboardingScreen
import com.brian_bui.true_clothes.onboarding.BodyMeasurementOnboardingScreen
import com.brian_bui.true_clothes.onboarding.BottomBodyMeasurementOnboardingScreen
import com.brian_bui.true_clothes.onboarding.GenderOnboardingScreen
import com.brian_bui.true_clothes.onboarding.TopBodyMeasurementOnboardingScreen
import com.brian_bui.true_clothes.onboarding.ColourOnboardingScreen
import com.brian_bui.true_clothes.onboarding.AddingWardrobeOnboardingScreen
import com.brian_bui.true_clothes.onboarding.GenderFormState
import com.brian_bui.true_clothes.onboarding.domain.OnboardingStep
import com.brian_bui.true_clothes.onboarding.presentation.OnboardingViewModel
import com.brian_bui.true_clothes.shared.theme.TrueclothesTheme
import com.brian_bui.true_clothes.home.HomeMainScreen

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            TrueclothesTheme {
                TrueclothesApp()
            }
        }
    }
}

@PreviewScreenSizes
@Composable
fun TrueclothesApp(
    viewModel: OnboardingViewModel = androidx.lifecycle.viewmodel.compose.viewModel(),
) {
    val uiState by viewModel.uiState.collectAsState()

    if (!uiState.isLoaded) {
        PlaceholderScreen(title = "Loading onboarding", onBack = {})
        return
    }

    if (uiState.isCompleted) {
        HomeEntryScreen()
        return
    }

    when (uiState.currentStep) {
        OnboardingStep.Gender -> GenderOnboardingScreen(
            state = uiState.genderState,
            onStateChange = viewModel::onGenderStateChange,
            onNext = viewModel::onNext,
            validationError = uiState.validationError,
            onValidationErrorDismiss = viewModel::onValidationErrorDismiss,
        )
        OnboardingStep.Country -> CountryOnboardingScreen(
            state = uiState.countryState,
            onStateChange = viewModel::onCountryStateChange,
            onBack = viewModel::onBack,
            onNext = viewModel::onNext,
        )
        OnboardingStep.BodyMeasurement -> BodyMeasurementOnboardingScreen(
            state = uiState.bodyMeasurementState,
            onStateChange = viewModel::onBodyMeasurementStateChange,
            onBack = viewModel::onBack,
            onNext = viewModel::onNext,
            onTopBody = viewModel::openTopMeasurement,
            onBottomBody = viewModel::openBottomMeasurement,
        )
        OnboardingStep.TopBodyMeasurement -> TopBodyMeasurementOnboardingScreen(
            state = uiState.topMeasurementState,
            onStateChange = viewModel::onTopMeasurementStateChange,
            onBack = viewModel::onBack,
            onNext = viewModel::onNext,
        )
        OnboardingStep.BottomBodyMeasurement -> BottomBodyMeasurementOnboardingScreen(
            state = uiState.bottomMeasurementState,
            onStateChange = viewModel::onBottomMeasurementStateChange,
            onBack = viewModel::onBack,
            onNext = viewModel::onNext,
        )
        OnboardingStep.Colour -> ColourOnboardingScreen(
            state = uiState.colourState,
            onStateChange = viewModel::onColourStateChange,
            onBack = viewModel::onBack,
            onNext = viewModel::onNext,
        )
        OnboardingStep.AddingWardrobe -> AddingWardrobeOnboardingScreen(
            state = uiState.addingWardrobeState,
            onStateChange = viewModel::onAddingWardrobeStateChange,
            onBack = viewModel::onBack,
            onNext = viewModel::onNext,
        )
        OnboardingStep.Completed -> HomeEntryScreen()
    }
}

@Composable
private fun HomeEntryScreen() {
    HomeMainScreen()
}

@Composable
private fun PlaceholderScreen(
    title: String,
    onBack: () -> Unit,
) {
    Surface {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(24.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            Text(text = "$title screen (TODO)")
            TextButton(onClick = onBack) {
                Text("Back")
            }
        }
    }
}

@Preview(showBackground = true)
@Composable
private fun TrueclothesAppPreview() {
    TrueclothesTheme {
        GenderOnboardingScreen(
            state = GenderFormState(),
            onStateChange = {},
        )
    }
}