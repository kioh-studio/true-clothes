package com.brian_bui.true_clothes.onboarding.presentation

import com.brian_bui.true_clothes.onboarding.BodyMeasurementFormState
import com.brian_bui.true_clothes.onboarding.BottomMeasurementFormState
import com.brian_bui.true_clothes.onboarding.ColourFormState
import com.brian_bui.true_clothes.onboarding.CountryFormState
import com.brian_bui.true_clothes.onboarding.GenderFormState
import com.brian_bui.true_clothes.onboarding.TopMeasurementFormState
import com.brian_bui.true_clothes.onboarding.validateBodyMeasurementForm
import com.brian_bui.true_clothes.onboarding.validateGenderForm
import com.brian_bui.true_clothes.onboarding.domain.OnboardingStep

fun validateForStep(
    step: OnboardingStep,
    genderState: GenderFormState,
    countryState: CountryFormState,
    bodyMeasurementState: BodyMeasurementFormState,
    topMeasurementState: TopMeasurementFormState,
    bottomMeasurementState: BottomMeasurementFormState,
    colourState: ColourFormState,
): String? = when (step) {
    OnboardingStep.Gender -> validateGenderForm(genderState)
    OnboardingStep.Country -> if (countryState.selectedCountry == null) "Please select your country." else null
    OnboardingStep.BodyMeasurement -> validateBodyMeasurementForm(bodyMeasurementState)
    OnboardingStep.TopBodyMeasurement -> validateTopMeasurements(topMeasurementState)
    OnboardingStep.BottomBodyMeasurement -> validateBottomMeasurements(bottomMeasurementState)
    OnboardingStep.Colour -> if (colourState.colourPreference == null) "Please choose a colour preference." else null
    OnboardingStep.AddingWardrobe,
    OnboardingStep.Completed,
    -> null
}

private fun validateOptionalNonNegative(raw: String): String? {
    val trimmed = raw.trim()
    if (trimmed.isEmpty()) return null
    val value = trimmed.toFloatOrNull() ?: return "Please enter a valid number."
    return if (value < 0f) "Value must be >= 0." else null
}

private fun validateTopMeasurements(state: TopMeasurementFormState): String? {
    return validateOptionalNonNegative(state.shoulderWidthRaw)
        ?: validateOptionalNonNegative(state.bicepRaw)
        ?: validateOptionalNonNegative(state.sleevesRaw)
        ?: validateOptionalNonNegative(state.chestRaw)
        ?: validateOptionalNonNegative(state.neckRaw)
}

private fun validateBottomMeasurements(state: BottomMeasurementFormState): String? {
    return validateOptionalNonNegative(state.waistRaw)
        ?: validateOptionalNonNegative(state.hipRaw)
        ?: validateOptionalNonNegative(state.inseamRaw)
        ?: validateOptionalNonNegative(state.thighRaw)
        ?: validateOptionalNonNegative(state.ankleRaw)
}
