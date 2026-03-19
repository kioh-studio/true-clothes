package com.brian_bui.true_clothes.onboarding.data.local

import android.content.ContentValues
import android.database.Cursor
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
import com.brian_bui.true_clothes.onboarding.domain.OnboardingRepository
import com.brian_bui.true_clothes.onboarding.domain.OnboardingSnapshot
import com.brian_bui.true_clothes.onboarding.domain.OnboardingStep
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow

class SQLiteOnboardingRepository(
    private val dbHelper: OnboardingSQLiteHelper,
) : OnboardingRepository {
    override val snapshotFlow: Flow<OnboardingSnapshot> = flow {
        emit(load())
    }

    override suspend fun load(): OnboardingSnapshot {
        val db = dbHelper.readableDatabase
        val profile = db.query(
            "onboarding_profile",
            null,
            "id = 1",
            null,
            null,
            null,
            null,
        ).use { c -> c.toProfileEntity() }

        val measurements = db.query(
            "private_measurements",
            null,
            "id = 1",
            null,
            null,
            null,
            null,
        ).use { c -> c.toMeasurementsEntity() }

        return mapToSnapshot(profile, measurements)
    }

    override suspend fun savePartial(snapshot: OnboardingSnapshot) {
        val profile = snapshot.toProfileEntity()
        val measurements = snapshot.toMeasurementsEntity()
        val db = dbHelper.writableDatabase
        db.insertWithOnConflict(
            "onboarding_profile",
            null,
            profile.toValues(),
            android.database.sqlite.SQLiteDatabase.CONFLICT_REPLACE,
        )
        db.insertWithOnConflict(
            "private_measurements",
            null,
            measurements.toValues(),
            android.database.sqlite.SQLiteDatabase.CONFLICT_REPLACE,
        )
    }

    override suspend fun setCompleted(completed: Boolean) {
        val existing = load().toProfileEntity()
        val db = dbHelper.writableDatabase
        db.insertWithOnConflict(
            "onboarding_profile",
            null,
            existing.copy(
                onboardingCompleted = completed,
                onboardingCompletedAt = if (completed) System.currentTimeMillis() else null,
                onboardingStep = if (completed) OnboardingStep.Completed.id else existing.onboardingStep,
                updatedAt = System.currentTimeMillis(),
            ).toValues(),
            android.database.sqlite.SQLiteDatabase.CONFLICT_REPLACE,
        )
    }

    override suspend fun clear() {
        val db = dbHelper.writableDatabase
        db.delete("onboarding_profile", null, null)
        db.delete("private_measurements", null, null)
    }
}

private fun Cursor.toProfileEntity(): OnboardingProfileEntity? {
    if (!moveToFirst()) return null
    return OnboardingProfileEntity(
        id = getInt(getColumnIndexOrThrow("id")),
        fullName = getString(getColumnIndexOrThrow("full_name")),
        dateOfBirth = getString(getColumnIndexOrThrow("date_of_birth")),
        email = getString(getColumnIndexOrThrow("email")),
        gender = getString(getColumnIndexOrThrow("gender")),
        countryCode = getString(getColumnIndexOrThrow("country_code")),
        countryLabel = getString(getColumnIndexOrThrow("country_label")),
        colourPreference = getString(getColumnIndexOrThrow("colour_preference")),
        uploadedCount = getInt(getColumnIndexOrThrow("uploaded_count")),
        onboardingStep = getInt(getColumnIndexOrThrow("onboarding_step")),
        onboardingCompleted = getInt(getColumnIndexOrThrow("onboarding_completed")) == 1,
        onboardingCompletedAt = if (isNull(getColumnIndexOrThrow("onboarding_completed_at"))) null else getLong(getColumnIndexOrThrow("onboarding_completed_at")),
        schemaVersion = getInt(getColumnIndexOrThrow("schema_version")),
        updatedAt = getLong(getColumnIndexOrThrow("updated_at")),
        createdAt = getLong(getColumnIndexOrThrow("created_at")),
    )
}

private fun Cursor.toMeasurementsEntity(): PrivateMeasurementsEntity? {
    if (!moveToFirst()) return null
    return PrivateMeasurementsEntity(
        id = getInt(getColumnIndexOrThrow("id")),
        heightValue = getString(getColumnIndexOrThrow("height_value")),
        heightUnit = getString(getColumnIndexOrThrow("height_unit")),
        weightValue = getString(getColumnIndexOrThrow("weight_value")),
        weightUnit = getString(getColumnIndexOrThrow("weight_unit")),
        measurementMethod = getString(getColumnIndexOrThrow("measurement_method")),
        shoulderWidthValue = getString(getColumnIndexOrThrow("shoulder_width_value")),
        shoulderWidthUnit = getString(getColumnIndexOrThrow("shoulder_width_unit")),
        bicepValue = getString(getColumnIndexOrThrow("bicep_value")),
        bicepUnit = getString(getColumnIndexOrThrow("bicep_unit")),
        sleevesValue = getString(getColumnIndexOrThrow("sleeves_value")),
        sleevesUnit = getString(getColumnIndexOrThrow("sleeves_unit")),
        chestValue = getString(getColumnIndexOrThrow("chest_value")),
        chestUnit = getString(getColumnIndexOrThrow("chest_unit")),
        neckValue = getString(getColumnIndexOrThrow("neck_value")),
        neckUnit = getString(getColumnIndexOrThrow("neck_unit")),
        waistValue = getString(getColumnIndexOrThrow("waist_value")),
        waistUnit = getString(getColumnIndexOrThrow("waist_unit")),
        hipValue = getString(getColumnIndexOrThrow("hip_value")),
        hipUnit = getString(getColumnIndexOrThrow("hip_unit")),
        inseamValue = getString(getColumnIndexOrThrow("inseam_value")),
        inseamUnit = getString(getColumnIndexOrThrow("inseam_unit")),
        thighValue = getString(getColumnIndexOrThrow("thigh_value")),
        thighUnit = getString(getColumnIndexOrThrow("thigh_unit")),
        ankleValue = getString(getColumnIndexOrThrow("ankle_value")),
        ankleUnit = getString(getColumnIndexOrThrow("ankle_unit")),
        updatedAt = getLong(getColumnIndexOrThrow("updated_at")),
    )
}

private fun mapToSnapshot(
    profile: OnboardingProfileEntity?,
    measurements: PrivateMeasurementsEntity?,
): OnboardingSnapshot {
    val p = profile ?: OnboardingProfileEntity()
    val m = measurements ?: PrivateMeasurementsEntity()
    return OnboardingSnapshot(
        schemaVersion = p.schemaVersion,
        lastUpdatedEpochMs = p.updatedAt,
        isCompleted = p.onboardingCompleted,
        currentStep = OnboardingStep.fromId(p.onboardingStep),
        genderState = GenderFormState(
            name = p.fullName,
            dobRaw = p.dateOfBirth,
            email = p.email.orEmpty(),
            gender = GenderOption.entries.firstOrNull { it.id == p.gender },
        ),
        countryState = CountryFormState(
            selectedCountry = if (p.countryCode.isBlank()) {
                null
            } else {
                CountryOption(id = p.countryCode, label = p.countryLabel.ifBlank { p.countryCode })
            },
        ),
        bodyMeasurementState = BodyMeasurementFormState(
            heightRaw = m.heightValue,
            heightUnit = HeightUnit.entries.firstOrNull { it.id == m.heightUnit } ?: HeightUnit.Cm,
            weightRaw = m.weightValue,
            weightUnit = WeightUnit.entries.firstOrNull { it.id == m.weightUnit } ?: WeightUnit.Kg,
            measurementMethod = MeasurementMethod.entries.firstOrNull { it.id == m.measurementMethod },
        ),
        topMeasurementState = TopMeasurementFormState(
            shoulderWidthRaw = m.shoulderWidthValue,
            shoulderWidthUnit = HeightUnit.entries.firstOrNull { it.id == m.shoulderWidthUnit } ?: HeightUnit.Cm,
            bicepRaw = m.bicepValue,
            bicepUnit = HeightUnit.entries.firstOrNull { it.id == m.bicepUnit } ?: HeightUnit.Cm,
            sleevesRaw = m.sleevesValue,
            sleevesUnit = HeightUnit.entries.firstOrNull { it.id == m.sleevesUnit } ?: HeightUnit.Cm,
            chestRaw = m.chestValue,
            chestUnit = HeightUnit.entries.firstOrNull { it.id == m.chestUnit } ?: HeightUnit.Cm,
            neckRaw = m.neckValue,
            neckUnit = HeightUnit.entries.firstOrNull { it.id == m.neckUnit } ?: HeightUnit.Cm,
        ),
        bottomMeasurementState = BottomMeasurementFormState(
            waistRaw = m.waistValue,
            waistUnit = HeightUnit.entries.firstOrNull { it.id == m.waistUnit } ?: HeightUnit.Cm,
            hipRaw = m.hipValue,
            hipUnit = HeightUnit.entries.firstOrNull { it.id == m.hipUnit } ?: HeightUnit.Cm,
            inseamRaw = m.inseamValue,
            inseamUnit = HeightUnit.entries.firstOrNull { it.id == m.inseamUnit } ?: HeightUnit.Cm,
            thighRaw = m.thighValue,
            thighUnit = HeightUnit.entries.firstOrNull { it.id == m.thighUnit } ?: HeightUnit.Cm,
            ankleRaw = m.ankleValue,
            ankleUnit = HeightUnit.entries.firstOrNull { it.id == m.ankleUnit } ?: HeightUnit.Cm,
        ),
        colourState = ColourFormState(
            colourPreference = ColourPreference.entries.firstOrNull { it.id == p.colourPreference },
        ),
        addingWardrobeState = AddingWardrobeFormState(uploadedCount = p.uploadedCount),
    )
}

private fun OnboardingSnapshot.toProfileEntity(): OnboardingProfileEntity = OnboardingProfileEntity(
    id = 1,
    fullName = genderState.name,
    dateOfBirth = genderState.dobRaw,
    email = genderState.email.ifBlank { null },
    gender = genderState.gender?.id.orEmpty(),
    countryCode = countryState.selectedCountry?.id.orEmpty(),
    countryLabel = countryState.selectedCountry?.label.orEmpty(),
    colourPreference = colourState.colourPreference?.id,
    uploadedCount = addingWardrobeState.uploadedCount,
    onboardingStep = currentStep.id,
    onboardingCompleted = isCompleted,
    onboardingCompletedAt = if (isCompleted) System.currentTimeMillis() else null,
    schemaVersion = schemaVersion,
    updatedAt = System.currentTimeMillis(),
)

private fun OnboardingSnapshot.toMeasurementsEntity(): PrivateMeasurementsEntity = PrivateMeasurementsEntity(
    id = 1,
    heightValue = bodyMeasurementState.heightRaw,
    heightUnit = bodyMeasurementState.heightUnit.id,
    weightValue = bodyMeasurementState.weightRaw,
    weightUnit = bodyMeasurementState.weightUnit.id,
    measurementMethod = bodyMeasurementState.measurementMethod?.id,
    shoulderWidthValue = topMeasurementState.shoulderWidthRaw,
    shoulderWidthUnit = topMeasurementState.shoulderWidthUnit.id,
    bicepValue = topMeasurementState.bicepRaw,
    bicepUnit = topMeasurementState.bicepUnit.id,
    sleevesValue = topMeasurementState.sleevesRaw,
    sleevesUnit = topMeasurementState.sleevesUnit.id,
    chestValue = topMeasurementState.chestRaw,
    chestUnit = topMeasurementState.chestUnit.id,
    neckValue = topMeasurementState.neckRaw,
    neckUnit = topMeasurementState.neckUnit.id,
    waistValue = bottomMeasurementState.waistRaw,
    waistUnit = bottomMeasurementState.waistUnit.id,
    hipValue = bottomMeasurementState.hipRaw,
    hipUnit = bottomMeasurementState.hipUnit.id,
    inseamValue = bottomMeasurementState.inseamRaw,
    inseamUnit = bottomMeasurementState.inseamUnit.id,
    thighValue = bottomMeasurementState.thighRaw,
    thighUnit = bottomMeasurementState.thighUnit.id,
    ankleValue = bottomMeasurementState.ankleRaw,
    ankleUnit = bottomMeasurementState.ankleUnit.id,
)

private fun OnboardingProfileEntity.toValues(): ContentValues = ContentValues().apply {
    put("id", id)
    put("full_name", fullName)
    put("date_of_birth", dateOfBirth)
    put("email", email)
    put("gender", gender)
    put("country_code", countryCode)
    put("country_label", countryLabel)
    put("colour_preference", colourPreference)
    put("uploaded_count", uploadedCount)
    put("onboarding_step", onboardingStep)
    put("onboarding_completed", if (onboardingCompleted) 1 else 0)
    put("onboarding_completed_at", onboardingCompletedAt)
    put("schema_version", schemaVersion)
    put("updated_at", updatedAt)
    put("created_at", createdAt)
}

private fun PrivateMeasurementsEntity.toValues(): ContentValues = ContentValues().apply {
    put("id", id)
    put("height_value", heightValue)
    put("height_unit", heightUnit)
    put("weight_value", weightValue)
    put("weight_unit", weightUnit)
    put("measurement_method", measurementMethod)
    put("shoulder_width_value", shoulderWidthValue)
    put("shoulder_width_unit", shoulderWidthUnit)
    put("bicep_value", bicepValue)
    put("bicep_unit", bicepUnit)
    put("sleeves_value", sleevesValue)
    put("sleeves_unit", sleevesUnit)
    put("chest_value", chestValue)
    put("chest_unit", chestUnit)
    put("neck_value", neckValue)
    put("neck_unit", neckUnit)
    put("waist_value", waistValue)
    put("waist_unit", waistUnit)
    put("hip_value", hipValue)
    put("hip_unit", hipUnit)
    put("inseam_value", inseamValue)
    put("inseam_unit", inseamUnit)
    put("thigh_value", thighValue)
    put("thigh_unit", thighUnit)
    put("ankle_value", ankleValue)
    put("ankle_unit", ankleUnit)
    put("updated_at", updatedAt)
}
