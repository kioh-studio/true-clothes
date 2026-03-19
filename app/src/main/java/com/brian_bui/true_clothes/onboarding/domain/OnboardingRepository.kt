package com.brian_bui.true_clothes.onboarding.domain

import kotlinx.coroutines.flow.Flow

interface OnboardingRepository {
    val snapshotFlow: Flow<OnboardingSnapshot>

    suspend fun load(): OnboardingSnapshot

    suspend fun savePartial(snapshot: OnboardingSnapshot)

    suspend fun setCompleted(completed: Boolean)

    suspend fun clear()
}
