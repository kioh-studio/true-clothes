package com.brian_bui.true_clothes.onboarding

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.size
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.Alignment
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.clickable
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import com.brian_bui.true_clothes.shared.theme.TrueclothesTheme
import com.brian_bui.true_clothes.shared.components.ModalActionMode
import com.brian_bui.true_clothes.shared.components.TrueModal
import com.brian_bui.true_clothes.shared.components.TrueProgressBar
import com.brian_bui.true_clothes.shared.theme.LocalResponsiveScale
import com.brian_bui.true_clothes.shared.theme.PoppinsFontFamily

enum class BottomMeasurement(val key: String, val label: String) {
    Waist("waist", "Waist"),
    Hip("hip", "Hip"),
    Inseam("inseam", "Inseam"),
    Thigh("thigh", "Thigh"),
    Ankle("ankle", "Ankle"),
}

data class BottomMeasurementFormState(
    val waistRaw: String = "",
    val waistUnit: HeightUnit = HeightUnit.Cm,
    val hipRaw: String = "",
    val hipUnit: HeightUnit = HeightUnit.Cm,
    val inseamRaw: String = "",
    val inseamUnit: HeightUnit = HeightUnit.Cm,
    val thighRaw: String = "",
    val thighUnit: HeightUnit = HeightUnit.Cm,
    val ankleRaw: String = "",
    val ankleUnit: HeightUnit = HeightUnit.Cm,
)

private fun validateOptionalNonNegative(raw: String): String? {
    val trimmed = raw.trim()
    if (trimmed.isEmpty()) return null
    val v = trimmed.toFloatOrNull() ?: return "Please enter a valid number."
    if (v < 0f) return "Value must be >= 0."
    return null
}

private fun validateBottomMeasurementForm(state: BottomMeasurementFormState): String? {
    return validateOptionalNonNegative(state.waistRaw)
        ?: validateOptionalNonNegative(state.hipRaw)
        ?: validateOptionalNonNegative(state.inseamRaw)
        ?: validateOptionalNonNegative(state.thighRaw)
        ?: validateOptionalNonNegative(state.ankleRaw)
}

private data class BottomMeasurementFieldErrors(
    val waist: String? = null,
    val hip: String? = null,
    val inseam: String? = null,
    val thigh: String? = null,
    val ankle: String? = null,
) {
    fun hasError(): Boolean = waist != null || hip != null || inseam != null || thigh != null || ankle != null
}

private fun validateBottomMeasurementFields(state: BottomMeasurementFormState): BottomMeasurementFieldErrors {
    return BottomMeasurementFieldErrors(
        waist = validateOptionalNonNegative(state.waistRaw),
        hip = validateOptionalNonNegative(state.hipRaw),
        inseam = validateOptionalNonNegative(state.inseamRaw),
        thigh = validateOptionalNonNegative(state.thighRaw),
        ankle = validateOptionalNonNegative(state.ankleRaw),
    )
}

@Composable
fun BottomBodyMeasurementOnboardingScreen(
    state: BottomMeasurementFormState,
    onStateChange: (BottomMeasurementFormState) -> Unit,
    onBack: () -> Unit,
    onNext: () -> Unit,
    modifier: Modifier = Modifier,
) {
    var hasTriedSubmit by remember { mutableStateOf(false) }
    val fieldErrors = validateBottomMeasurementFields(state)
    val scale = LocalResponsiveScale.current
    val paddingH = scale.scaleDp(33.5f)
    val paddingV = scale.scaleDp(33.5f)
    val fieldHeight = scale.scaleDp(50f)
    val spacingBeforeProgress = scale.scaleDp(78f)
    val titleFontSize = scale.scaleSp(20f)
    val subtitleFontSize = scale.scaleSp(14f)
    val sectionSpacing = scale.scaleDp(80f)
    val headerToFirstRowSpacing = sectionSpacing + scale.scaleDp(30f)
    val helpSize = scale.scaleDp(28f)
    val unitBoxWidth = scale.scaleDp(88f)
    val unitBoxHeight = scale.scaleDp(44f)

    var modalMessage by remember { mutableStateOf<String?>(null) }
    if (modalMessage != null) {
        Dialog(
            onDismissRequest = { modalMessage = null },
            properties = DialogProperties(
                usePlatformDefaultWidth = false,
                dismissOnBackPress = true,
                dismissOnClickOutside = true,
            ),
        ) {
            Box(Modifier.fillMaxSize()) {
                TrueModal(
                    visible = true,
                    title = "Info",
                    message = modalMessage ?: "",
                    mode = ModalActionMode.CloseOnly,
                    onDismiss = { modalMessage = null },
                )
            }
        }
    }

    Column(modifier = modifier.fillMaxSize().fillMaxWidth()) {
        Column(
            modifier = Modifier
                .weight(1f)
                .fillMaxWidth()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = paddingH, vertical = paddingV)
                .padding(bottom = spacingBeforeProgress),
        ) {
            Text(
                text = "Better understand your body",
                style = MaterialTheme.typography.titleLarge.copy(
                    fontFamily = PoppinsFontFamily,
                    fontSize = titleFontSize,
                    fontWeight = androidx.compose.ui.text.font.FontWeight.Medium,
                ),
            )

            Spacer(modifier = Modifier.size(scale.scaleDp(18f)))
            Text(
                text = "Under your bottom can guide you to choose best pants and shoes, which building your main silhouette",
                style = MaterialTheme.typography.bodyMedium.copy(
                    fontFamily = PoppinsFontFamily,
                    fontSize = subtitleFontSize,
                    fontWeight = androidx.compose.ui.text.font.FontWeight.Normal,
                    color = Color(0xFF6B6B6B),
                ),
            )

            Spacer(modifier = Modifier.size(headerToFirstRowSpacing))

            MeasurementRow(
                label = BottomMeasurement.Waist.label,
                valueRaw = state.waistRaw,
                unit = state.waistUnit,
                onValueRawChange = { onStateChange(state.copy(waistRaw = it)) },
                onUnitChange = { onStateChange(state.copy(waistUnit = it)) },
                onHelp = { modalMessage = "Enter your waist in CM or IN." },
                helpSize = helpSize,
                unitBoxWidth = unitBoxWidth,
                unitBoxHeight = unitBoxHeight,
                fieldHeight = fieldHeight,
                errorMessage = if (hasTriedSubmit) fieldErrors.waist else null,
            )

            Spacer(modifier = Modifier.size(sectionSpacing))
            MeasurementRow(
                label = BottomMeasurement.Hip.label,
                valueRaw = state.hipRaw,
                unit = state.hipUnit,
                onValueRawChange = { onStateChange(state.copy(hipRaw = it)) },
                onUnitChange = { onStateChange(state.copy(hipUnit = it)) },
                onHelp = { modalMessage = "Enter your hip in CM or IN." },
                helpSize = helpSize,
                unitBoxWidth = unitBoxWidth,
                unitBoxHeight = unitBoxHeight,
                fieldHeight = fieldHeight,
                errorMessage = if (hasTriedSubmit) fieldErrors.hip else null,
            )

            Spacer(modifier = Modifier.size(sectionSpacing))
            MeasurementRow(
                label = BottomMeasurement.Inseam.label,
                valueRaw = state.inseamRaw,
                unit = state.inseamUnit,
                onValueRawChange = { onStateChange(state.copy(inseamRaw = it)) },
                onUnitChange = { onStateChange(state.copy(inseamUnit = it)) },
                onHelp = { modalMessage = "Enter your inseam in CM or IN." },
                helpSize = helpSize,
                unitBoxWidth = unitBoxWidth,
                unitBoxHeight = unitBoxHeight,
                fieldHeight = fieldHeight,
                errorMessage = if (hasTriedSubmit) fieldErrors.inseam else null,
            )

            Spacer(modifier = Modifier.size(sectionSpacing))
            MeasurementRow(
                label = BottomMeasurement.Thigh.label,
                valueRaw = state.thighRaw,
                unit = state.thighUnit,
                onValueRawChange = { onStateChange(state.copy(thighRaw = it)) },
                onUnitChange = { onStateChange(state.copy(thighUnit = it)) },
                onHelp = { modalMessage = "Enter your thigh in CM or IN." },
                helpSize = helpSize,
                unitBoxWidth = unitBoxWidth,
                unitBoxHeight = unitBoxHeight,
                fieldHeight = fieldHeight,
                errorMessage = if (hasTriedSubmit) fieldErrors.thigh else null,
            )

            Spacer(modifier = Modifier.size(sectionSpacing))
            MeasurementRow(
                label = BottomMeasurement.Ankle.label,
                valueRaw = state.ankleRaw,
                unit = state.ankleUnit,
                onValueRawChange = { onStateChange(state.copy(ankleRaw = it)) },
                onUnitChange = { onStateChange(state.copy(ankleUnit = it)) },
                onHelp = { modalMessage = "Enter your ankle in CM or IN." },
                helpSize = helpSize,
                unitBoxWidth = unitBoxWidth,
                unitBoxHeight = unitBoxHeight,
                fieldHeight = fieldHeight,
                errorMessage = if (hasTriedSubmit) fieldErrors.ankle else null,
            )
        }

        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = paddingH, vertical = paddingV),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween,
        ) {
            TextButton(onClick = onBack) { Text("Back") }
            TrueProgressBar(
                totalPoints = 5,
                activeIndices = listOf(2),
                modifier = Modifier.weight(1f).padding(horizontal = scale.scaleDp(8f)),
            )
            TextButton(
                onClick = {
                    hasTriedSubmit = true
                    if (fieldErrors.hasError()) return@TextButton
                    val err = validateBottomMeasurementForm(state)
                    if (err != null) modalMessage = err else onNext()
                },
                enabled = true,
            ) { Text("Next") }
        }
    }
}

@Preview(showBackground = true)
@Composable
private fun PreviewBottomBodyMeasurementOnboardingScreen() {
    TrueclothesTheme {
        BottomBodyMeasurementOnboardingScreen(
            state = BottomMeasurementFormState(),
            onStateChange = {},
            onBack = {},
            onNext = {},
        )
    }
}

@Composable
private fun MeasurementRow(
    label: String,
    valueRaw: String,
    unit: HeightUnit,
    onValueRawChange: (String) -> Unit,
    onUnitChange: (HeightUnit) -> Unit,
    onHelp: () -> Unit,
    helpSize: androidx.compose.ui.unit.Dp,
    unitBoxWidth: androidx.compose.ui.unit.Dp,
    unitBoxHeight: androidx.compose.ui.unit.Dp,
    fieldHeight: androidx.compose.ui.unit.Dp,
    errorMessage: String?,
) {
    val scale = LocalResponsiveScale.current

    Column(verticalArrangement = Arrangement.spacedBy(scale.scaleDp(10f))) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            MeasurementLeftIcon()
            Spacer(modifier = Modifier.size(scale.scaleDp(12f)))
            Text(
                text = label,
                style = MaterialTheme.typography.bodyMedium.copy(
                    fontFamily = PoppinsFontFamily,
                    fontWeight = androidx.compose.ui.text.font.FontWeight.SemiBold,
                    fontSize = scale.scaleSp(18f),
                ),
            )
        }

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(scale.scaleDp(14f)),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            OutlinedTextField(
                value = valueRaw,
                onValueChange = { raw ->
                    onValueRawChange(raw.filter { it.isDigit() || it == '.' }.take(6))
                },
                modifier = Modifier.weight(1f).heightIn(min = fieldHeight),
                singleLine = true,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                placeholder = { Text("our...secret..........") },
                isError = errorMessage != null,
                supportingText = {
                    if (errorMessage != null) Text(errorMessage)
                },
            )

            UnitDropdown(
                unit = unit,
                units = listOf(HeightUnit.Cm, HeightUnit.In),
                unitBoxWidth = unitBoxWidth,
                unitBoxHeight = unitBoxHeight,
                onUnitSelected = onUnitChange,
            )

            HelpIcon(size = helpSize, onClick = onHelp)
        }
    }
}

@Composable
private fun HelpIcon(size: androidx.compose.ui.unit.Dp, onClick: () -> Unit) {
    val scale = LocalResponsiveScale.current
    Box(
        modifier = Modifier
            .size(size)
            .clickable { onClick() },
        contentAlignment = Alignment.Center,
    ) {
        Canvas(modifier = Modifier.fillMaxSize()) {
            val stroke = Stroke(width = scale.scaleDp(2f).toPx())
            drawCircle(
                color = Color.Black,
                radius = this.size.minDimension / 2f,
                style = stroke,
            )
        }
        Text(
            text = "?",
            style = MaterialTheme.typography.bodyMedium.copy(
                fontFamily = PoppinsFontFamily,
                fontWeight = androidx.compose.ui.text.font.FontWeight.SemiBold,
            ),
        )
    }
}

@Composable
private fun UnitDropdown(
    unit: HeightUnit,
    units: List<HeightUnit>,
    unitBoxWidth: androidx.compose.ui.unit.Dp,
    unitBoxHeight: androidx.compose.ui.unit.Dp,
    onUnitSelected: (HeightUnit) -> Unit,
) {
    var expanded by remember { mutableStateOf(false) }
    Box {
        Surface(
            color = Color(0xFFFFFAE0),
            contentColor = Color.Black,
            modifier = Modifier
                .size(width = unitBoxWidth, height = unitBoxHeight)
                .clickable { expanded = true },
            shadowElevation = 0.dp,
            border = androidx.compose.foundation.BorderStroke(1.dp, Color.Black),
        ) {
            Row(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(horizontal = LocalResponsiveScale.current.scaleDp(12f)),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween,
            ) {
                Text(
                    text = unit.label,
                    style = MaterialTheme.typography.bodyMedium.copy(
                        fontFamily = PoppinsFontFamily,
                        fontWeight = androidx.compose.ui.text.font.FontWeight.SemiBold,
                    ),
                )
                Text(text = "▾")
            }
        }

        DropdownMenu(
            expanded = expanded,
            onDismissRequest = { expanded = false },
        ) {
            units.forEach { u ->
                DropdownMenuItem(
                    text = { Text(u.label) },
                    onClick = {
                        onUnitSelected(u)
                        expanded = false
                    },
                )
            }
        }
    }
}

@Composable
private fun MeasurementLeftIcon() {
    val scale = LocalResponsiveScale.current
    Canvas(modifier = Modifier.size(scale.scaleDp(32f))) {
        val w = size.width
        val h = size.height
        val stroke = Stroke(width = scale.scaleDp(2f).toPx())
        drawRoundRect(
            color = Color.Black,
            topLeft = Offset(w * 0.18f, h * 0.2f),
            size = androidx.compose.ui.geometry.Size(w * 0.64f, h * 0.7f),
            cornerRadius = androidx.compose.ui.geometry.CornerRadius(w * 0.12f, w * 0.12f),
            style = stroke,
        )
        drawLine(
            color = Color.Black,
            start = Offset(w * 0.22f, h * 0.52f),
            end = Offset(w * 0.78f, h * 0.28f),
            strokeWidth = stroke.width,
        )
    }
}

