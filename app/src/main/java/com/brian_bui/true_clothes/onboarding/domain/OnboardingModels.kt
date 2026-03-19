package com.brian_bui.true_clothes.onboarding.domain

import com.brian_bui.true_clothes.onboarding.AddingWardrobeFormState
import com.brian_bui.true_clothes.onboarding.BodyMeasurementFormState
import com.brian_bui.true_clothes.onboarding.BottomMeasurementFormState
import com.brian_bui.true_clothes.onboarding.ColourFormState
import com.brian_bui.true_clothes.onboarding.CountryFormState
import com.brian_bui.true_clothes.onboarding.GenderFormState
import com.brian_bui.true_clothes.onboarding.TopMeasurementFormState

enum class OnboardingStep(val id: Int) {
    Gender(0),
    Country(1),
    BodyMeasurement(2),
    TopBodyMeasurement(20),
    BottomBodyMeasurement(21),
    Colour(3),
    AddingWardrobe(4),
    Completed(999),
    ;

    companion object {
        fun fromId(value: Int): OnboardingStep = entries.firstOrNull { it.id == value } ?: Gender
    }
}

enum class FieldPrivacy {
    Shareable,
    Private,
}

data class OnboardingSnapshot(
    val schemaVersion: Int = 1,
    val lastUpdatedEpochMs: Long = System.currentTimeMillis(),
    val isCompleted: Boolean = false,
    val currentStep: OnboardingStep = OnboardingStep.Gender,
    val genderState: GenderFormState = GenderFormState(),
    val countryState: CountryFormState = CountryFormState(),
    val bodyMeasurementState: BodyMeasurementFormState = BodyMeasurementFormState(),
    val topMeasurementState: TopMeasurementFormState = TopMeasurementFormState(),
    val bottomMeasurementState: BottomMeasurementFormState = BottomMeasurementFormState(),
    val colourState: ColourFormState = ColourFormState(),
    val addingWardrobeState: AddingWardrobeFormState = AddingWardrobeFormState(),
) {
    fun privacyByField(): Map<String, FieldPrivacy> = mapOf(
        "name" to FieldPrivacy.Shareable,
        "dobRaw" to FieldPrivacy.Shareable,
        "email" to FieldPrivacy.Shareable,
        "gender" to FieldPrivacy.Shareable,
        "country" to FieldPrivacy.Shareable,
        "colourPreference" to FieldPrivacy.Shareable,
        "uploadedCount" to FieldPrivacy.Shareable,
        "heightRaw" to FieldPrivacy.Private,
        "weightRaw" to FieldPrivacy.Private,
        "topMeasurements" to FieldPrivacy.Private,
        "bottomMeasurements" to FieldPrivacy.Private,
    )
}
