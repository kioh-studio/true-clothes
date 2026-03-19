package com.brian_bui.true_clothes.onboarding.data

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.emptyPreferences
import androidx.datastore.preferences.core.intPreferencesKey
import androidx.datastore.preferences.core.longPreferencesKey
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import com.brian_bui.true_clothes.onboarding.AddingWardrobeFormState
import com.brian_bui.true_clothes.onboarding.BodyMeasurementFormState
import com.brian_bui.true_clothes.onboarding.BottomMeasurementFormState
import com.brian_bui.true_clothes.onboarding.ColourFormState
import com.brian_bui.true_clothes.onboarding.ColourPreference
import com.brian_bui.true_clothes.onboarding.CountryFormState
import com.brian_bui.true_clothes.onboarding.CountryOption
import com.brian_bui.true_clothes.onboarding.GenderFormState
import com.brian_bui.true_clothes.onboarding.GenderOption
import com.brian_bui.true_clothes.onboarding.HeightUnit
import com.brian_bui.true_clothes.onboarding.MeasurementMethod
import com.brian_bui.true_clothes.onboarding.TopMeasurementFormState
import com.brian_bui.true_clothes.onboarding.WeightUnit
import com.brian_bui.true_clothes.onboarding.domain.OnboardingSnapshot
import com.brian_bui.true_clothes.onboarding.domain.OnboardingStep
import java.io.IOException
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map

private val Context.onboardingStore: DataStore<Preferences> by preferencesDataStore(name = "onboarding_store")

class OnboardingLocalDataSource(context: Context) {
    private val dataStore = context.onboardingStore

    val snapshotFlow: Flow<OnboardingSnapshot> = dataStore.data
        .catch { error ->
            if (error is IOException) {
                emit(emptyPreferences())
            } else {
                throw error
            }
        }
        .map(::preferencesToSnapshot)

    suspend fun load(): OnboardingSnapshot = preferencesToSnapshot(
        dataStore.data
            .catch { if (it is IOException) emit(emptyPreferences()) else throw it }
            .first(),
    )

    suspend fun save(snapshot: OnboardingSnapshot) {
        dataStore.edit { p ->
            p[Keys.schemaVersion] = snapshot.schemaVersion
            p[Keys.lastUpdatedEpochMs] = snapshot.lastUpdatedEpochMs
            p[Keys.isCompleted] = snapshot.isCompleted
            p[Keys.currentStep] = snapshot.currentStep.id

            p[Keys.name] = snapshot.genderState.name
            p[Keys.dobRaw] = snapshot.genderState.dobRaw
            p[Keys.email] = snapshot.genderState.email
            p[Keys.gender] = snapshot.genderState.gender?.id.orEmpty()

            p[Keys.countryId] = snapshot.countryState.selectedCountry?.id.orEmpty()
            p[Keys.countryLabel] = snapshot.countryState.selectedCountry?.label.orEmpty()

            p[Keys.heightRaw] = snapshot.bodyMeasurementState.heightRaw
            p[Keys.heightUnit] = snapshot.bodyMeasurementState.heightUnit.id
            p[Keys.weightRaw] = snapshot.bodyMeasurementState.weightRaw
            p[Keys.weightUnit] = snapshot.bodyMeasurementState.weightUnit.id
            p[Keys.measurementMethod] = snapshot.bodyMeasurementState.measurementMethod?.id.orEmpty()

            p[Keys.shoulderWidthRaw] = snapshot.topMeasurementState.shoulderWidthRaw
            p[Keys.shoulderWidthUnit] = snapshot.topMeasurementState.shoulderWidthUnit.id
            p[Keys.bicepRaw] = snapshot.topMeasurementState.bicepRaw
            p[Keys.bicepUnit] = snapshot.topMeasurementState.bicepUnit.id
            p[Keys.sleevesRaw] = snapshot.topMeasurementState.sleevesRaw
            p[Keys.sleevesUnit] = snapshot.topMeasurementState.sleevesUnit.id
            p[Keys.chestRaw] = snapshot.topMeasurementState.chestRaw
            p[Keys.chestUnit] = snapshot.topMeasurementState.chestUnit.id
            p[Keys.neckRaw] = snapshot.topMeasurementState.neckRaw
            p[Keys.neckUnit] = snapshot.topMeasurementState.neckUnit.id

            p[Keys.waistRaw] = snapshot.bottomMeasurementState.waistRaw
            p[Keys.waistUnit] = snapshot.bottomMeasurementState.waistUnit.id
            p[Keys.hipRaw] = snapshot.bottomMeasurementState.hipRaw
            p[Keys.hipUnit] = snapshot.bottomMeasurementState.hipUnit.id
            p[Keys.inseamRaw] = snapshot.bottomMeasurementState.inseamRaw
            p[Keys.inseamUnit] = snapshot.bottomMeasurementState.inseamUnit.id
            p[Keys.thighRaw] = snapshot.bottomMeasurementState.thighRaw
            p[Keys.thighUnit] = snapshot.bottomMeasurementState.thighUnit.id
            p[Keys.ankleRaw] = snapshot.bottomMeasurementState.ankleRaw
            p[Keys.ankleUnit] = snapshot.bottomMeasurementState.ankleUnit.id

            p[Keys.colourPreference] = snapshot.colourState.colourPreference?.id.orEmpty()
            p[Keys.uploadedCount] = snapshot.addingWardrobeState.uploadedCount
        }
    }

    suspend fun setCompleted(completed: Boolean) {
        dataStore.edit { p -> p[Keys.isCompleted] = completed }
    }

    suspend fun clear() {
        dataStore.edit { it.clear() }
    }

    private fun preferencesToSnapshot(p: Preferences): OnboardingSnapshot {
        val genderState = GenderFormState(
            name = p[Keys.name].orEmpty(),
            dobRaw = p[Keys.dobRaw].orEmpty(),
            email = p[Keys.email].orEmpty(),
            gender = GenderOption.entries.firstOrNull { it.id == p[Keys.gender].orEmpty() },
        )
        val countryId = p[Keys.countryId].orEmpty()
        val countryLabel = p[Keys.countryLabel].orEmpty()
        val country = if (countryId.isNotBlank() && countryLabel.isNotBlank()) {
            CountryOption(id = countryId, label = countryLabel)
        } else {
            null
        }
        val body = BodyMeasurementFormState(
            heightRaw = p[Keys.heightRaw].orEmpty(),
            heightUnit = HeightUnit.entries.firstOrNull { it.id == p[Keys.heightUnit].orEmpty() } ?: HeightUnit.Cm,
            weightRaw = p[Keys.weightRaw].orEmpty(),
            weightUnit = WeightUnit.entries.firstOrNull { it.id == p[Keys.weightUnit].orEmpty() } ?: WeightUnit.Kg,
            measurementMethod = MeasurementMethod.entries.firstOrNull { it.id == p[Keys.measurementMethod].orEmpty() },
        )
        val top = TopMeasurementFormState(
            shoulderWidthRaw = p[Keys.shoulderWidthRaw].orEmpty(),
            shoulderWidthUnit = HeightUnit.entries.firstOrNull { it.id == p[Keys.shoulderWidthUnit].orEmpty() } ?: HeightUnit.Cm,
            bicepRaw = p[Keys.bicepRaw].orEmpty(),
            bicepUnit = HeightUnit.entries.firstOrNull { it.id == p[Keys.bicepUnit].orEmpty() } ?: HeightUnit.Cm,
            sleevesRaw = p[Keys.sleevesRaw].orEmpty(),
            sleevesUnit = HeightUnit.entries.firstOrNull { it.id == p[Keys.sleevesUnit].orEmpty() } ?: HeightUnit.Cm,
            chestRaw = p[Keys.chestRaw].orEmpty(),
            chestUnit = HeightUnit.entries.firstOrNull { it.id == p[Keys.chestUnit].orEmpty() } ?: HeightUnit.Cm,
            neckRaw = p[Keys.neckRaw].orEmpty(),
            neckUnit = HeightUnit.entries.firstOrNull { it.id == p[Keys.neckUnit].orEmpty() } ?: HeightUnit.Cm,
        )
        val bottom = BottomMeasurementFormState(
            waistRaw = p[Keys.waistRaw].orEmpty(),
            waistUnit = HeightUnit.entries.firstOrNull { it.id == p[Keys.waistUnit].orEmpty() } ?: HeightUnit.Cm,
            hipRaw = p[Keys.hipRaw].orEmpty(),
            hipUnit = HeightUnit.entries.firstOrNull { it.id == p[Keys.hipUnit].orEmpty() } ?: HeightUnit.Cm,
            inseamRaw = p[Keys.inseamRaw].orEmpty(),
            inseamUnit = HeightUnit.entries.firstOrNull { it.id == p[Keys.inseamUnit].orEmpty() } ?: HeightUnit.Cm,
            thighRaw = p[Keys.thighRaw].orEmpty(),
            thighUnit = HeightUnit.entries.firstOrNull { it.id == p[Keys.thighUnit].orEmpty() } ?: HeightUnit.Cm,
            ankleRaw = p[Keys.ankleRaw].orEmpty(),
            ankleUnit = HeightUnit.entries.firstOrNull { it.id == p[Keys.ankleUnit].orEmpty() } ?: HeightUnit.Cm,
        )

        return OnboardingSnapshot(
            schemaVersion = p[Keys.schemaVersion] ?: 1,
            lastUpdatedEpochMs = p[Keys.lastUpdatedEpochMs] ?: 0L,
            isCompleted = p[Keys.isCompleted] ?: false,
            currentStep = OnboardingStep.fromId(p[Keys.currentStep] ?: OnboardingStep.Gender.id),
            genderState = genderState,
            countryState = CountryFormState(selectedCountry = country),
            bodyMeasurementState = body,
            topMeasurementState = top,
            bottomMeasurementState = bottom,
            colourState = ColourFormState(
                colourPreference = ColourPreference.entries.firstOrNull { it.id == p[Keys.colourPreference].orEmpty() },
            ),
            addingWardrobeState = AddingWardrobeFormState(uploadedCount = p[Keys.uploadedCount] ?: 0),
        )
    }

    private object Keys {
        val schemaVersion = intPreferencesKey("schema_version")
        val lastUpdatedEpochMs = longPreferencesKey("last_updated_epoch_ms")
        val isCompleted = booleanPreferencesKey("is_completed")
        val currentStep = intPreferencesKey("current_step")
        val name = stringPreferencesKey("name")
        val dobRaw = stringPreferencesKey("dob_raw")
        val email = stringPreferencesKey("email")
        val gender = stringPreferencesKey("gender")
        val countryId = stringPreferencesKey("country_id")
        val countryLabel = stringPreferencesKey("country_label")
        val heightRaw = stringPreferencesKey("height_raw")
        val heightUnit = stringPreferencesKey("height_unit")
        val weightRaw = stringPreferencesKey("weight_raw")
        val weightUnit = stringPreferencesKey("weight_unit")
        val measurementMethod = stringPreferencesKey("measurement_method")
        val shoulderWidthRaw = stringPreferencesKey("shoulder_width_raw")
        val shoulderWidthUnit = stringPreferencesKey("shoulder_width_unit")
        val bicepRaw = stringPreferencesKey("bicep_raw")
        val bicepUnit = stringPreferencesKey("bicep_unit")
        val sleevesRaw = stringPreferencesKey("sleeves_raw")
        val sleevesUnit = stringPreferencesKey("sleeves_unit")
        val chestRaw = stringPreferencesKey("chest_raw")
        val chestUnit = stringPreferencesKey("chest_unit")
        val neckRaw = stringPreferencesKey("neck_raw")
        val neckUnit = stringPreferencesKey("neck_unit")
        val waistRaw = stringPreferencesKey("waist_raw")
        val waistUnit = stringPreferencesKey("waist_unit")
        val hipRaw = stringPreferencesKey("hip_raw")
        val hipUnit = stringPreferencesKey("hip_unit")
        val inseamRaw = stringPreferencesKey("inseam_raw")
        val inseamUnit = stringPreferencesKey("inseam_unit")
        val thighRaw = stringPreferencesKey("thigh_raw")
        val thighUnit = stringPreferencesKey("thigh_unit")
        val ankleRaw = stringPreferencesKey("ankle_raw")
        val ankleUnit = stringPreferencesKey("ankle_unit")
        val colourPreference = stringPreferencesKey("colour_preference")
        val uploadedCount = intPreferencesKey("uploaded_count")
    }
}
