package com.brian_bui.true_clothes.onboarding.data.local

data class OnboardingProfileEntity(
    val id: Int = 1,
    val fullName: String = "",
    val dateOfBirth: String = "",
    val email: String? = null,
    val gender: String = "",
    val countryCode: String = "",
    val countryLabel: String = "",
    val colourPreference: String? = null,
    val uploadedCount: Int = 0,
    val onboardingStep: Int = 0,
    val onboardingCompleted: Boolean = false,
    val onboardingCompletedAt: Long? = null,
    val schemaVersion: Int = 1,
    val updatedAt: Long = System.currentTimeMillis(),
    val createdAt: Long = System.currentTimeMillis(),
)
