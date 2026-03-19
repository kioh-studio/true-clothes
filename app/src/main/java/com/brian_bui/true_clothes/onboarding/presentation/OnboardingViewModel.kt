package com.brian_bui.true_clothes.onboarding.presentation

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.brian_bui.true_clothes.onboarding.AddingWardrobeFormState
import com.brian_bui.true_clothes.onboarding.BodyMeasurementFormState
import com.brian_bui.true_clothes.onboarding.BottomMeasurementFormState
import com.brian_bui.true_clothes.onboarding.ColourFormState
import com.brian_bui.true_clothes.onboarding.CountryFormState
import com.brian_bui.true_clothes.onboarding.GenderFormState
import com.brian_bui.true_clothes.onboarding.MeasurementMethod
import com.brian_bui.true_clothes.onboarding.TopMeasurementFormState
import com.brian_bui.true_clothes.onboarding.data.local.OnboardingSQLiteHelper
import com.brian_bui.true_clothes.onboarding.data.local.SQLiteOnboardingRepository
import com.brian_bui.true_clothes.onboarding.domain.OnboardingRepository
import com.brian_bui.true_clothes.onboarding.domain.OnboardingSnapshot
import com.brian_bui.true_clothes.onboarding.domain.OnboardingStep
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class OnboardingUiState(
    val isLoaded: Boolean = false,
    val isCompleted: Boolean = false,
    val currentStep: OnboardingStep = OnboardingStep.Gender,
    val genderState: GenderFormState = GenderFormState(),
    val countryState: CountryFormState = CountryFormState(),
    val bodyMeasurementState: BodyMeasurementFormState = BodyMeasurementFormState(),
    val topMeasurementState: TopMeasurementFormState = TopMeasurementFormState(),
    val bottomMeasurementState: BottomMeasurementFormState = BottomMeasurementFormState(),
    val colourState: ColourFormState = ColourFormState(),
    val addingWardrobeState: AddingWardrobeFormState = AddingWardrobeFormState(),
    val validationError: String? = null,
)

class OnboardingViewModel(
    application: Application,
    private val repository: OnboardingRepository,
) : AndroidViewModel(application) {
    constructor(application: Application) : this(
        application = application,
        repository = SQLiteOnboardingRepository(
            OnboardingSQLiteHelper(application.applicationContext),
        ),
    )

    private val _uiState = MutableStateFlow(OnboardingUiState())
    val uiState: StateFlow<OnboardingUiState> = _uiState.asStateFlow()

    init {
        viewModelScope.launch {
            val snapshot = repository.load()
            _uiState.value = snapshot.toUiState(isLoaded = true)
        }
    }

    fun onGenderStateChange(newState: GenderFormState) = updateAndPersist { it.copy(genderState = newState) }
    fun onCountryStateChange(newState: CountryFormState) = updateAndPersist { it.copy(countryState = newState) }
    fun onBodyMeasurementStateChange(newState: BodyMeasurementFormState) = updateAndPersist { it.copy(bodyMeasurementState = newState) }
    fun onTopMeasurementStateChange(newState: TopMeasurementFormState) = updateAndPersist { it.copy(topMeasurementState = newState) }
    fun onBottomMeasurementStateChange(newState: BottomMeasurementFormState) = updateAndPersist { it.copy(bottomMeasurementState = newState) }
    fun onColourStateChange(newState: ColourFormState) = updateAndPersist { it.copy(colourState = newState) }
    fun onAddingWardrobeStateChange(newState: AddingWardrobeFormState) = updateAndPersist { it.copy(addingWardrobeState = newState) }

    fun onValidationErrorDismiss() {
        _uiState.update { it.copy(validationError = null) }
    }

    fun onBack() {
        val nextStep = when (_uiState.value.currentStep) {
            OnboardingStep.Gender -> OnboardingStep.Gender
            OnboardingStep.Country -> OnboardingStep.Gender
            OnboardingStep.BodyMeasurement -> OnboardingStep.Country
            OnboardingStep.TopBodyMeasurement -> OnboardingStep.BodyMeasurement
            OnboardingStep.BottomBodyMeasurement -> OnboardingStep.BodyMeasurement
            OnboardingStep.Colour -> OnboardingStep.BodyMeasurement
            OnboardingStep.AddingWardrobe -> OnboardingStep.Colour
            OnboardingStep.Completed -> OnboardingStep.Completed
        }
        updateAndPersist { it.copy(currentStep = nextStep, validationError = null) }
    }

    fun openTopMeasurement() {
        updateAndPersist {
            it.copy(
                bodyMeasurementState = it.bodyMeasurementState.copy(measurementMethod = MeasurementMethod.Manual),
                currentStep = OnboardingStep.TopBodyMeasurement,
                validationError = null,
            )
        }
    }

    fun openBottomMeasurement() {
        updateAndPersist {
            it.copy(
                bodyMeasurementState = it.bodyMeasurementState.copy(measurementMethod = MeasurementMethod.Manual),
                currentStep = OnboardingStep.BottomBodyMeasurement,
                validationError = null,
            )
        }
    }

    fun onNext() {
        val current = _uiState.value
        val error = validateForStep(
            step = current.currentStep,
            genderState = current.genderState,
            countryState = current.countryState,
            bodyMeasurementState = current.bodyMeasurementState,
            topMeasurementState = current.topMeasurementState,
            bottomMeasurementState = current.bottomMeasurementState,
            colourState = current.colourState,
        )
        if (error != null) {
            _uiState.update { it.copy(validationError = error) }
            return
        }

        when (current.currentStep) {
            OnboardingStep.Gender -> updateAndPersist { it.copy(currentStep = OnboardingStep.Country, validationError = null) }
            OnboardingStep.Country -> updateAndPersist { it.copy(currentStep = OnboardingStep.BodyMeasurement, validationError = null) }
            OnboardingStep.BodyMeasurement -> updateAndPersist { it.copy(currentStep = OnboardingStep.Colour, validationError = null) }
            OnboardingStep.TopBodyMeasurement,
            OnboardingStep.BottomBodyMeasurement,
            -> updateAndPersist { it.copy(currentStep = OnboardingStep.BodyMeasurement, validationError = null) }
            OnboardingStep.Colour -> updateAndPersist { it.copy(currentStep = OnboardingStep.AddingWardrobe, validationError = null) }
            OnboardingStep.AddingWardrobe -> completeOnboarding()
            OnboardingStep.Completed -> Unit
        }
    }

    private fun completeOnboarding() {
        _uiState.update {
            it.copy(
                isCompleted = true,
                currentStep = OnboardingStep.Completed,
                validationError = null,
            )
        }
        viewModelScope.launch {
            repository.savePartial(_uiState.value.toSnapshot())
            repository.setCompleted(true)
        }
    }

    private fun updateAndPersist(transform: (OnboardingUiState) -> OnboardingUiState) {
        _uiState.update(transform)
        viewModelScope.launch {
            repository.savePartial(_uiState.value.toSnapshot())
        }
    }
}

private fun OnboardingSnapshot.toUiState(isLoaded: Boolean): OnboardingUiState = OnboardingUiState(
    isLoaded = isLoaded,
    isCompleted = isCompleted,
    currentStep = currentStep,
    genderState = genderState,
    countryState = countryState,
    bodyMeasurementState = bodyMeasurementState,
    topMeasurementState = topMeasurementState,
    bottomMeasurementState = bottomMeasurementState,
    colourState = colourState,
    addingWardrobeState = addingWardrobeState,
)

private fun OnboardingUiState.toSnapshot(): OnboardingSnapshot = OnboardingSnapshot(
    schemaVersion = 1,
    lastUpdatedEpochMs = System.currentTimeMillis(),
    isCompleted = isCompleted,
    currentStep = currentStep,
    genderState = genderState,
    countryState = countryState,
    bodyMeasurementState = bodyMeasurementState,
    topMeasurementState = topMeasurementState,
    bottomMeasurementState = bottomMeasurementState,
    colourState = colourState,
    addingWardrobeState = addingWardrobeState,
)
