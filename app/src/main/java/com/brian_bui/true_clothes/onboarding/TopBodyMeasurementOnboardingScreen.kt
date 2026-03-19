package com.brian_bui.true_clothes.onboarding

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import com.brian_bui.true_clothes.shared.components.ModalActionMode
import com.brian_bui.true_clothes.shared.components.TrueModal
import com.brian_bui.true_clothes.shared.components.TrueProgressBar
import com.brian_bui.true_clothes.shared.theme.LocalResponsiveScale
import com.brian_bui.true_clothes.shared.theme.PoppinsFontFamily
import com.brian_bui.true_clothes.shared.theme.TrueclothesTheme

enum class TopMeasurement(val key: String, val label: String) {
    ShoulderWidth("shoulder_width", "Shoulder width"),
    Bicep("bicep", "Bicep"),
    Sleeves("sleeves", "Sleeves"),
    Chest("chest", "Chest"),
    Neck("neck", "Neck"),
}

data class TopMeasurementFormState(
    val shoulderWidthRaw: String = "",
    val shoulderWidthUnit: HeightUnit = HeightUnit.Cm,
    val bicepRaw: String = "",
    val bicepUnit: HeightUnit = HeightUnit.Cm,
    val sleevesRaw: String = "",
    val sleevesUnit: HeightUnit = HeightUnit.Cm,
    val chestRaw: String = "",
    val chestUnit: HeightUnit = HeightUnit.Cm,
    val neckRaw: String = "",
    val neckUnit: HeightUnit = HeightUnit.Cm,
)

private fun validateOptionalNonNegative(raw: String): String? {
    val trimmed = raw.trim()
    if (trimmed.isEmpty()) return null
    val v = trimmed.toFloatOrNull() ?: return "Please enter a valid number."
    if (v < 0f) return "Value must be >= 0."
    return null
}

private fun validateTopMeasurementForm(state: TopMeasurementFormState): String? {
    return validateOptionalNonNegative(state.shoulderWidthRaw)
        ?: validateOptionalNonNegative(state.bicepRaw)
        ?: validateOptionalNonNegative(state.sleevesRaw)
        ?: validateOptionalNonNegative(state.chestRaw)
        ?: validateOptionalNonNegative(state.neckRaw)
}

private data class TopMeasurementFieldErrors(
    val shoulderWidth: String? = null,
    val bicep: String? = null,
    val sleeves: String? = null,
    val chest: String? = null,
    val neck: String? = null,
) {
    fun hasError(): Boolean = shoulderWidth != null || bicep != null || sleeves != null || chest != null || neck != null
}

private fun validateTopMeasurementFields(state: TopMeasurementFormState): TopMeasurementFieldErrors {
    return TopMeasurementFieldErrors(
        shoulderWidth = validateOptionalNonNegative(state.shoulderWidthRaw),
        bicep = validateOptionalNonNegative(state.bicepRaw),
        sleeves = validateOptionalNonNegative(state.sleevesRaw),
        chest = validateOptionalNonNegative(state.chestRaw),
        neck = validateOptionalNonNegative(state.neckRaw),
    )
}

@Composable
fun TopBodyMeasurementOnboardingScreen(
    state: TopMeasurementFormState,
    onStateChange: (TopMeasurementFormState) -> Unit,
    onBack: () -> Unit,
    onNext: () -> Unit,
    modifier: Modifier = Modifier,
) {
    var hasTriedSubmit by remember { mutableStateOf(false) }
    val fieldErrors = validateTopMeasurementFields(state)
    val scale = LocalResponsiveScale.current
    val paddingH = scale.scaleDp(33.5f)
    val paddingV = scale.scaleDp(33.5f)
    val fieldHeight = scale.scaleDp(50f)
    val spacingBeforeProgress = scale.scaleDp(78f)
    val titleFontSize = scale.scaleSp(20f)
    val subtitleFontSize = scale.scaleSp(14f)
    val labelFontSize = scale.scaleSp(18f)
    val helpSize = scale.scaleDp(28f)
    val unitBoxWidth = scale.scaleDp(88f)
    val unitBoxHeight = scale.scaleDp(44f)
    val sectionSpacing = scale.scaleDp(40f)
    val headerToFirstRowSpacing = sectionSpacing + scale.scaleDp(60f)

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
                text = "The measurement bring you best shirts, jackets,.. that makes people change the way they see you",
                style = MaterialTheme.typography.bodyMedium.copy(
                    fontFamily = PoppinsFontFamily,
                    fontSize = subtitleFontSize,
                    fontWeight = androidx.compose.ui.text.font.FontWeight.Normal,
                    color = Color(0xFF6B6B6B),
                ),
            )

            Spacer(modifier = Modifier.size(headerToFirstRowSpacing))

            MeasurementRow(
                label = TopMeasurement.ShoulderWidth.label,
                valueRaw = state.shoulderWidthRaw,
                unit = state.shoulderWidthUnit,
                onValueRawChange = { onStateChange(state.copy(shoulderWidthRaw = it)) },
                onUnitChange = { onStateChange(state.copy(shoulderWidthUnit = it)) },
                onHelp = { modalMessage = "Enter your shoulder width in CM or IN." },
                helpSize = helpSize,
                unitBoxWidth = unitBoxWidth,
                unitBoxHeight = unitBoxHeight,
                fieldHeight = fieldHeight,
                errorMessage = if (hasTriedSubmit) fieldErrors.shoulderWidth else null,
            )

            Spacer(modifier = Modifier.size(sectionSpacing))

            MeasurementRow(
                label = TopMeasurement.Bicep.label,
                valueRaw = state.bicepRaw,
                unit = state.bicepUnit,
                onValueRawChange = { onStateChange(state.copy(bicepRaw = it)) },
                onUnitChange = { onStateChange(state.copy(bicepUnit = it)) },
                onHelp = { modalMessage = "Enter your bicep in CM or IN." },
                helpSize = helpSize,
                unitBoxWidth = unitBoxWidth,
                unitBoxHeight = unitBoxHeight,
                fieldHeight = fieldHeight,
                errorMessage = if (hasTriedSubmit) fieldErrors.bicep else null,
            )

            Spacer(modifier = Modifier.size(sectionSpacing))

            MeasurementRow(
                label = TopMeasurement.Sleeves.label,
                valueRaw = state.sleevesRaw,
                unit = state.sleevesUnit,
                onValueRawChange = { onStateChange(state.copy(sleevesRaw = it)) },
                onUnitChange = { onStateChange(state.copy(sleevesUnit = it)) },
                onHelp = { modalMessage = "Enter your sleeves in CM or IN." },
                helpSize = helpSize,
                unitBoxWidth = unitBoxWidth,
                unitBoxHeight = unitBoxHeight,
                fieldHeight = fieldHeight,
                errorMessage = if (hasTriedSubmit) fieldErrors.sleeves else null,
            )

            Spacer(modifier = Modifier.size(sectionSpacing))

            MeasurementRow(
                label = TopMeasurement.Chest.label,
                valueRaw = state.chestRaw,
                unit = state.chestUnit,
                onValueRawChange = { onStateChange(state.copy(chestRaw = it)) },
                onUnitChange = { onStateChange(state.copy(chestUnit = it)) },
                onHelp = { modalMessage = "Enter your chest in CM or IN." },
                helpSize = helpSize,
                unitBoxWidth = unitBoxWidth,
                unitBoxHeight = unitBoxHeight,
                fieldHeight = fieldHeight,
                errorMessage = if (hasTriedSubmit) fieldErrors.chest else null,
            )

            Spacer(modifier = Modifier.size(sectionSpacing))

            MeasurementRow(
                label = TopMeasurement.Neck.label,
                valueRaw = state.neckRaw,
                unit = state.neckUnit,
                onValueRawChange = { onStateChange(state.copy(neckRaw = it)) },
                onUnitChange = { onStateChange(state.copy(neckUnit = it)) },
                onHelp = { modalMessage = "Enter your neck in CM or IN." },
                helpSize = helpSize,
                unitBoxWidth = unitBoxWidth,
                unitBoxHeight = unitBoxHeight,
                fieldHeight = fieldHeight,
                errorMessage = if (hasTriedSubmit) fieldErrors.neck else null,
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
            // Important note from design.md: keep progress on the 3rd step while inside this subflow.
            TrueProgressBar(
                totalPoints = 5,
                activeIndices = listOf(2),
                modifier = Modifier.weight(1f).padding(horizontal = scale.scaleDp(8f)),
            )
            TextButton(
                onClick = {
                    hasTriedSubmit = true
                    if (fieldErrors.hasError()) return@TextButton
                    val err = validateTopMeasurementForm(state)
                    if (err != null) modalMessage = err else onNext()
                },
                enabled = true,
            ) { Text("Next") }
        }
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
    // Simple placeholder icon; replace with exact SVG icon if needed later.
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

@Preview(showBackground = true)
@Composable
private fun PreviewTopBodyMeasurementOnboardingScreen() {
    TrueclothesTheme {
        TopBodyMeasurementOnboardingScreen(
            state = TopMeasurementFormState(),
            onStateChange = {},
            onBack = {},
            onNext = {},
        )
    }
}

