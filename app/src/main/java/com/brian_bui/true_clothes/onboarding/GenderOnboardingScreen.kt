package com.brian_bui.true_clothes.onboarding

import android.app.DatePickerDialog
import java.util.Calendar
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import com.brian_bui.true_clothes.shared.components.ModalActionMode
import com.brian_bui.true_clothes.shared.components.TrueModal
import com.brian_bui.true_clothes.shared.components.TrueProgressBar
import com.brian_bui.true_clothes.shared.theme.LocalResponsiveScale
import com.brian_bui.true_clothes.shared.theme.PoppinsFontFamily
import com.brian_bui.true_clothes.shared.theme.TrueclothesTheme

// design.md: fields.name max_length 100, fields.dob format DD-MM-YYYY, fields.email required false + email_format, fields.gender options man/woman/other
private const val NAME_MAX_LENGTH = 100
private val DOB_PATTERN = Regex("^(\\d{2})[-/]?(\\d{2})[-/]?(\\d{4})$")
private val EMAIL_PATTERN = Regex("^[\\w.-]+@[\\w.-]+\\.\\w{2,}$")

/**
 * Form state for onboarding.gender (design.md SCREEN_SPEC).
 * Layout order: name, dob, email, gender.
 */
data class GenderFormState(
    val name: String = "",
    val dobRaw: String = "", // DD-MM-YYYY as raw text for now
    val email: String = "",
    val gender: GenderOption? = null,
)

data class GenderFieldErrors(
    val name: String? = null,
    val dob: String? = null,
    val email: String? = null,
    val gender: String? = null,
) {
    fun firstError(): String? = name ?: dob ?: email ?: gender
    fun hasError(): Boolean = firstError() != null
}

/** design.md: gender options id/label — man, woman, other ("Others"). */
enum class GenderOption(val id: String, val label: String) {
    Man("man", "Man"),
    Woman("woman", "Woman"),
    Other("other", "Others"),
}

/**
 * Validates [GenderFormState] per design.md (required fields, format, max_length, email_format).
 * Returns an error message if invalid, or null if valid. Host should show [TrueModal] on error.
 */
fun validateGenderForm(state: GenderFormState): String? {
    return validateGenderFormFields(state).firstError()
}

fun validateGenderFormFields(state: GenderFormState): GenderFieldErrors {
    val nameError = when {
        state.name.isBlank() -> "Please enter your name."
        state.name.length > NAME_MAX_LENGTH -> "Name must be at most $NAME_MAX_LENGTH characters."
        else -> null
    }

    val dobTrimmed = state.dobRaw.replace(" ", "")
    val dobError = when {
        state.dobRaw.isBlank() -> "Please enter your date of birth."
        !DOB_PATTERN.matches(dobTrimmed) -> "Please enter date of birth in DD-MM-YYYY format."
        else -> null
    }

    val emailError = when {
        state.email.isNotBlank() && !EMAIL_PATTERN.matches(state.email) -> "Please enter a valid email address."
        else -> null
    }

    val genderError = if (state.gender == null) "Please select your gender." else null

    return GenderFieldErrors(
        name = nameError,
        dob = dobError,
        email = emailError,
        gender = genderError,
    )
}

private data class DobDate(
    val day: Int,
    val month: Int,
    val year: Int,
)

private fun parseDob(value: String): DobDate? {
    val match = DOB_PATTERN.matchEntire(value.replace(" ", "")) ?: return null
    val day = match.groupValues[1].toIntOrNull() ?: return null
    val month = match.groupValues[2].toIntOrNull() ?: return null
    val year = match.groupValues[3].toIntOrNull() ?: return null
    if (day !in 1..31 || month !in 1..12 || year <= 1900) return null
    return DobDate(day = day, month = month, year = year)
}

private fun formatDob(day: Int, month: Int, year: Int): String {
    val dayPart = day.toString().padStart(2, '0')
    val monthPart = (month + 1).toString().padStart(2, '0')
    return "$dayPart-$monthPart-$year"
}

/**
 * Gender onboarding screen (design.md: onboarding.gender).
 * Layout: header "Tell us about you" (Poppins medium 20px), vertical form order [name, dob, email, gender],
 * footer progress_bar (global stepper), navigation back/next disabled on this step.
 */
@Composable
fun GenderOnboardingScreen(
    state: GenderFormState,
    onStateChange: (GenderFormState) -> Unit,
    onNext: () -> Unit = {},
    modifier: Modifier = Modifier,
    validationError: String? = null,
    onValidationErrorDismiss: () -> Unit = {},
) {
    var hasTriedSubmit by remember { mutableStateOf(false) }
    val context = LocalContext.current
    val scale = LocalResponsiveScale.current
    val fieldErrors = validateGenderFormFields(state)
    // Sizes from gender.svg, scaled for current screen (design ref 402dp width).
    val paddingHorizontal = scale.scaleDp(33.5f)
    val paddingVertical = scale.scaleDp(50.5f)
    val fieldHeight = scale.scaleDp(50f)
    val spacingSection = scale.scaleDp(70f)
    val spacingAfterEmail = scale.scaleDp(78f)
    val spacingGenderRows = scale.scaleDp(32f)
    val spacingBeforeProgress = scale.scaleDp(78f)
    val radioCircleSize = scale.scaleDp(16f)
    val radioLabelGap = scale.scaleDp(8f)
    val titleFontSize = scale.scaleSp(20f)

    if (validationError != null) {
        Dialog(
            onDismissRequest = onValidationErrorDismiss,
            properties = DialogProperties(
                usePlatformDefaultWidth = false,
                dismissOnBackPress = true,
                dismissOnClickOutside = true,
            ),
        ) {
            Box(Modifier.fillMaxSize()) {
                TrueModal(
                    visible = true,
                    title = "Error",
                    message = validationError,
                    mode = ModalActionMode.CloseOnly,
                    onDismiss = onValidationErrorDismiss,
                )
            }
        }
    }

    Column(
        modifier = modifier
            .fillMaxSize()
            .fillMaxWidth(),
    ) {
        // Scrollable form content so it never overlaps the fixed progress bar
        Column(
            modifier = Modifier
                .weight(1f)
                .fillMaxWidth()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = paddingHorizontal, vertical = paddingVertical)
                .padding(bottom = spacingBeforeProgress),
        ) {
            // design.md layout.header: title "Tell us about you", font Poppins medium 20px
            Text(
                text = "Tell us about you",
                style = MaterialTheme.typography.titleLarge.copy(
                    fontFamily = PoppinsFontFamily,
                    fontSize = titleFontSize,
                    fontWeight = FontWeight.Medium,
                ),
            )

            Spacer(modifier = Modifier.size(spacingSection))

            // design.md fields: name, label "Name", max_length 100
            OutlinedTextField(
                value = state.name,
                onValueChange = { onStateChange(state.copy(name = it.take(NAME_MAX_LENGTH))) },
                label = { Text("Name") },
                modifier = Modifier
                    .fillMaxWidth()
                    .heightIn(min = fieldHeight),
                singleLine = true,
                isError = hasTriedSubmit && fieldErrors.name != null,
                supportingText = {
                    if (hasTriedSubmit && fieldErrors.name != null) {
                        Text(fieldErrors.name)
                    }
                },
            )

            Spacer(modifier = Modifier.size(spacingSection))

            // design.md fields: dob, label "Date of birth", format DD-MM-YYYY, required
            val parsedDob = parseDob(state.dobRaw)
            val initialYear = parsedDob?.year ?: Calendar.getInstance().get(Calendar.YEAR)
            val initialMonth = (parsedDob?.month?.minus(1)) ?: Calendar.getInstance().get(Calendar.MONTH)
            val initialDay = parsedDob?.day ?: Calendar.getInstance().get(Calendar.DAY_OF_MONTH)
            val openDobPicker = {
                val picker = DatePickerDialog(
                    context,
                    { _, year, month, dayOfMonth ->
                        onStateChange(state.copy(dobRaw = formatDob(dayOfMonth, month, year)))
                    },
                    initialYear,
                    initialMonth,
                    initialDay,
                )
                picker.datePicker.maxDate = System.currentTimeMillis()
                picker.show()
            }

            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .heightIn(min = fieldHeight),
            ) {
                OutlinedTextField(
                    value = state.dobRaw,
                    onValueChange = {},
                    label = { Text("Date of birth (DD-MM-YYYY)") },
                    modifier = Modifier
                        .fillMaxWidth()
                        .heightIn(min = fieldHeight),
                    singleLine = true,
                    readOnly = true,
                    isError = hasTriedSubmit && fieldErrors.dob != null,
                    supportingText = {
                        if (hasTriedSubmit && fieldErrors.dob != null) {
                            Text(fieldErrors.dob)
                        }
                    },
                )

                Box(
                    modifier = Modifier
                        .matchParentSize()
                        .clickable(
                            interactionSource = remember { MutableInteractionSource() },
                            indication = null,
                            onClick = openDobPicker,
                        ),
                )
            }

            Spacer(modifier = Modifier.size(spacingSection))

            // design.md fields: email, label "Email", required false, email_format
            OutlinedTextField(
                value = state.email,
                onValueChange = { onStateChange(state.copy(email = it)) },
                label = { Text("Email") },
                placeholder = { Text("Optional") },
                modifier = Modifier
                    .fillMaxWidth()
                    .heightIn(min = fieldHeight),
                singleLine = true,
                keyboardOptions = KeyboardOptions(
                    keyboardType = KeyboardType.Email,
                ),
                isError = hasTriedSubmit && fieldErrors.email != null,
                supportingText = {
                    if (hasTriedSubmit && fieldErrors.email != null) {
                        Text(fieldErrors.email)
                    }
                },
            )

            Spacer(modifier = Modifier.size(spacingAfterEmail))

            // design.md fields: gender, label "Gender", enum_single, options man / Woman / Others
            Column(verticalArrangement = Arrangement.spacedBy(spacingGenderRows)) {
                Text(
                    text = "Gender",
                    style = MaterialTheme.typography.bodyMedium.copy(
                        fontFamily = PoppinsFontFamily,
                        fontWeight = FontWeight.SemiBold,
                    ),
                )

                GenderOption.values().forEach { option ->
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier.fillMaxWidth(),
                    ) {
                        RadioButton(
                            selected = state.gender == option,
                            onClick = { onStateChange(state.copy(gender = option)) },
                            modifier = Modifier.size(radioCircleSize),
                        )
                        Spacer(modifier = Modifier.size(radioLabelGap))
                        Text(text = option.label)
                    }
                }
                if (hasTriedSubmit && fieldErrors.gender != null) {
                    Text(
                        text = fieldErrors.gender,
                        color = MaterialTheme.colorScheme.error,
                        style = MaterialTheme.typography.bodySmall,
                    )
                }
            }
        }

        // Fixed footer: Back (disabled on first step), progress bar, Next
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = paddingHorizontal, vertical = paddingVertical),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween,
        ) {
            TextButton(onClick = {}) {
                Text("Back", color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.38f))
            }
            TrueProgressBar(
                totalPoints = 5,
                activeIndices = listOf(0),
                modifier = Modifier.weight(1f).padding(horizontal = scale.scaleDp(8f)),
            )
            TextButton(onClick = {
                hasTriedSubmit = true
                if (!fieldErrors.hasError()) onNext()
            }) {
                Text("Next")
            }
        }
    }
}

@Preview(showBackground = true)
@Composable
private fun GenderOnboardingScreenPreview() {
    TrueclothesTheme {
        var state by remember { mutableStateOf(GenderFormState()) }
        GenderOnboardingScreen(
            state = state,
            onStateChange = { state = it },
        )
    }
}

