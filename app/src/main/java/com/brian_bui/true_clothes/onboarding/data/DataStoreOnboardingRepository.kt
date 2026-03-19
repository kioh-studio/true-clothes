package com.brian_bui.true_clothes.onboarding.data

import com.brian_bui.true_clothes.onboarding.domain.OnboardingRepository
import com.brian_bui.true_clothes.onboarding.domain.OnboardingSnapshot
import kotlinx.coroutines.flow.Flow

class DataStoreOnboardingRepository(
    private val localDataSource: OnboardingLocalDataSource,
) : OnboardingRepository {
    override val snapshotFlow: Flow<OnboardingSnapshot> = localDataSource.snapshotFlow

    override suspend fun load(): OnboardingSnapshot = localDataSource.load()

    override suspend fun savePartial(snapshot: OnboardingSnapshot) {
        localDataSource.save(snapshot)
    }

    override suspend fun setCompleted(completed: Boolean) {
        localDataSource.setCompleted(completed)
    }

    override suspend fun clear() {
        localDataSource.clear()
    }
}
