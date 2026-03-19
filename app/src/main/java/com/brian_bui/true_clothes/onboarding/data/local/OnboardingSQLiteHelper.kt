package com.brian_bui.true_clothes.onboarding.data.local

import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper

class OnboardingSQLiteHelper(context: Context) : SQLiteOpenHelper(
    context,
    DB_NAME,
    null,
    DB_VERSION,
) {
    override fun onCreate(db: SQLiteDatabase) {
        db.execSQL(
            """
            CREATE TABLE onboarding_profile (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                full_name TEXT NOT NULL,
                date_of_birth TEXT NOT NULL,
                email TEXT,
                gender TEXT NOT NULL,
                country_code TEXT NOT NULL,
                country_label TEXT NOT NULL,
                colour_preference TEXT,
                uploaded_count INTEGER NOT NULL DEFAULT 0,
                onboarding_step INTEGER NOT NULL DEFAULT 0,
                onboarding_completed INTEGER NOT NULL DEFAULT 0,
                onboarding_completed_at INTEGER,
                schema_version INTEGER NOT NULL DEFAULT 1,
                updated_at INTEGER NOT NULL,
                created_at INTEGER NOT NULL
            )
            """.trimIndent(),
        )
        db.execSQL(
            """
            CREATE TABLE private_measurements (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                height_value TEXT NOT NULL,
                height_unit TEXT NOT NULL,
                weight_value TEXT NOT NULL,
                weight_unit TEXT NOT NULL,
                measurement_method TEXT,
                shoulder_width_value TEXT NOT NULL,
                shoulder_width_unit TEXT NOT NULL,
                bicep_value TEXT NOT NULL,
                bicep_unit TEXT NOT NULL,
                sleeves_value TEXT NOT NULL,
                sleeves_unit TEXT NOT NULL,
                chest_value TEXT NOT NULL,
                chest_unit TEXT NOT NULL,
                neck_value TEXT NOT NULL,
                neck_unit TEXT NOT NULL,
                waist_value TEXT NOT NULL,
                waist_unit TEXT NOT NULL,
                hip_value TEXT NOT NULL,
                hip_unit TEXT NOT NULL,
                inseam_value TEXT NOT NULL,
                inseam_unit TEXT NOT NULL,
                thigh_value TEXT NOT NULL,
                thigh_unit TEXT NOT NULL,
                ankle_value TEXT NOT NULL,
                ankle_unit TEXT NOT NULL,
                updated_at INTEGER NOT NULL
            )
            """.trimIndent(),
        )
    }

    override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) {
        db.execSQL("DROP TABLE IF EXISTS onboarding_profile")
        db.execSQL("DROP TABLE IF EXISTS private_measurements")
        onCreate(db)
    }

    companion object {
        private const val DB_NAME = "onboarding_sqlite.db"
        // Bump schema version so existing installs trigger destructive recreation.
        private const val DB_VERSION = 2
    }
}
