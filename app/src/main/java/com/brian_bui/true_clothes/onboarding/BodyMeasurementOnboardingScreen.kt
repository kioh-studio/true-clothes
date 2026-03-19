package com.brian_bui.true_clothes.onboarding

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
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
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.text.font.FontWeight
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

enum class HeightUnit(val id: String, val label: String) { Cm("cm", "CM"), In("in", "IN") }
enum class WeightUnit(val id: String, val label: String) { Kg("kg", "KG"), Lb("lb", "LB") }
enum class MeasurementMethod(val id: String) { Manual("manual"), AiGuess("ai_guess") }

data class BodyMeasurementFormState(
    val heightRaw: String = "",
    val heightUnit: HeightUnit = HeightUnit.Cm,
    val weightRaw: String = "",
    val weightUnit: WeightUnit = WeightUnit.Kg,
    val measurementMethod: MeasurementMethod? = null,
)

data class BodyMeasurementFieldErrors(
    val height: String? = null,
    val weight: String? = null,
) {
    fun firstError(): String? = height ?: weight
    fun hasError(): Boolean = firstError() != null
}

fun validateBodyMeasurementForm(state: BodyMeasurementFormState): String? {
    return validateBodyMeasurementFormFields(state).firstError()
}

fun validateBodyMeasurementFormFields(state: BodyMeasurementFormState): BodyMeasurementFieldErrors {
    val height = state.heightRaw.trim().toFloatOrNull()
    val heightError = if (height == null || height <= 0f) "Please enter a valid height." else null
    val weight = state.weightRaw.trim().toFloatOrNull()
    val weightError = if (weight == null || weight <= 0f) "Please enter a valid weight." else null
    return BodyMeasurementFieldErrors(height = heightError, weight = weightError)
}

@Composable
fun BodyMeasurementOnboardingScreen(
    state: BodyMeasurementFormState,
    onStateChange: (BodyMeasurementFormState) -> Unit,
    onBack: () -> Unit,
    onNext: () -> Unit,
    onTopBody: () -> Unit,
    onBottomBody: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val scale = LocalResponsiveScale.current
    val paddingH = scale.scaleDp(33.5f)
    val paddingV = scale.scaleDp(33.5f)
    val fieldHeight = scale.scaleDp(35f)
    val titleFontSize = scale.scaleSp(20f)
    val subtitleFontSize = scale.scaleSp(14f)
    val labelFontSize = scale.scaleSp(18f)
    val labelGap = scale.scaleDp(10f)
    val unitBoxWidth = scale.scaleDp(88f)
    val unitBoxHeight = scale.scaleDp(44f)
    val helpSize = scale.scaleDp(28f)
    val spacingBeforeProgress = scale.scaleDp(78f)

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

    var hasTriedSubmit by remember { mutableStateOf(false) }
    val fieldErrors = validateBodyMeasurementFormFields(state)

    Column(
        modifier = modifier
            .fillMaxSize()
            .fillMaxWidth(),
    ) {
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
                    fontWeight = FontWeight.Medium,
                ),
            )
            Spacer(modifier = Modifier.size(scale.scaleDp(18f)))
            Text(
                text = "Before joining the fashion world, you\nbetter know about your body...",
                style = MaterialTheme.typography.bodyMedium.copy(
                    fontFamily = PoppinsFontFamily,
                    fontSize = subtitleFontSize,
                    fontWeight = FontWeight.Normal,
                    color = Color(0xFF6B6B6B),
                ),
            )

            Spacer(modifier = Modifier.size(scale.scaleDp(44f)))

            FieldLabel(
                label = "Height",
                modifier = Modifier.fillMaxWidth(),
                fontSize = labelFontSize,
            )
            Spacer(modifier = Modifier.size(labelGap))
            UnitInputRow(
                value = state.heightRaw,
                onValueChange = { onStateChange(state.copy(heightRaw = it)) },
                unitLabel = state.heightUnit.label,
                onUnitSelected = { onStateChange(state.copy(heightUnit = it)) },
                units = HeightUnit.values().toList(),
                helpSize = helpSize,
                unitBoxWidth = unitBoxWidth,
                unitBoxHeight = unitBoxHeight,
                fieldHeight = fieldHeight,
                onHelp = { modalMessage = "Enter your height. Choose CM or IN from the dropdown." },
                errorMessage = if (hasTriedSubmit) fieldErrors.height else null,
            )

            Spacer(modifier = Modifier.size(scale.scaleDp(26f)))

            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(scale.scaleDp(12f)),
            ) {
                WeightIcon(modifier = Modifier.size(scale.scaleDp(28f)))
                FieldLabel(
                    label = "Weight",
                    modifier = Modifier.weight(1f),
                    fontSize = labelFontSize,
                )
            }
            Spacer(modifier = Modifier.size(labelGap))
            UnitInputRow(
                value = state.weightRaw,
                onValueChange = { onStateChange(state.copy(weightRaw = it)) },
                unitLabel = state.weightUnit.label,
                onUnitSelected = { onStateChange(state.copy(weightUnit = it)) },
                units = WeightUnit.values().toList(),
                helpSize = helpSize,
                unitBoxWidth = unitBoxWidth,
                unitBoxHeight = unitBoxHeight,
                fieldHeight = fieldHeight,
                onHelp = { modalMessage = "Enter your weight. Choose KG or LB from the dropdown." },
                errorMessage = if (hasTriedSubmit) fieldErrors.weight else null,
            )

            Spacer(modifier = Modifier.size(scale.scaleDp(40f)))

            Text(
                text = "Determine your body measurement",
                style = MaterialTheme.typography.titleMedium.copy(
                    fontFamily = PoppinsFontFamily,
                    fontWeight = FontWeight.SemiBold,
                ),
            )

            Spacer(modifier = Modifier.size(scale.scaleDp(18f)))

            val separatorWidth = scale.scaleDp(2f)
            val separatorHeight = scale.scaleDp(170f)

            Column(modifier = Modifier.fillMaxWidth()) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(scale.scaleDp(14f)),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Column(
                        modifier = Modifier.weight(1f),
                        verticalArrangement = Arrangement.spacedBy(scale.scaleDp(18f)),
                    ) {
                        GreyChoiceButton(
                            text = "Top body",
                            selected = state.measurementMethod == MeasurementMethod.Manual,
                            onClick = {
                                onStateChange(state.copy(measurementMethod = MeasurementMethod.Manual))
                                onTopBody()
                            },
                        )
                        GreyChoiceButton(
                            text = "Bottom body",
                            selected = state.measurementMethod == MeasurementMethod.Manual,
                            onClick = {
                                onStateChange(state.copy(measurementMethod = MeasurementMethod.Manual))
                                onBottomBody()
                            },
                        )
                        Text(
                            text = "Manual input your\nbody measurement",
                            style = MaterialTheme.typography.bodyMedium.copy(
                                fontFamily = PoppinsFontFamily,
                            ),
                        )
                    }

                    Box(
                        modifier = Modifier
                            .width(separatorWidth)
                            .height(separatorHeight)
                            .background(Color.Black.copy(alpha = 0.6f)),
                    )

                    Column(
                        modifier = Modifier.weight(1f),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.spacedBy(scale.scaleDp(14f)),
                    ) {
                        CameraTile(
                            size = scale.scaleDp(104f),
                            onClick = {
                                // Placeholder only for now (design.md important note).
                                onStateChange(state.copy(measurementMethod = MeasurementMethod.AiGuess))
                                modalMessage = "AI guess is coming soon."
                            },
                        )
                        Text(
                            text = "Let our AI guess\nyour\nmeasurement",
                            style = MaterialTheme.typography.bodyMedium.copy(
                                fontFamily = PoppinsFontFamily,
                            ),
                        )
                    }
                }

                Spacer(modifier = Modifier.size(scale.scaleDp(12f)))

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Spacer(modifier = Modifier.weight(1f))
                    Box(
                        modifier = Modifier.width(scale.scaleDp(44f)),
                        contentAlignment = Alignment.Center,
                    ) {
                        Text(
                            text = "OR",
                            style = MaterialTheme.typography.bodyMedium.copy(
                                fontFamily = PoppinsFontFamily,
                                fontWeight = FontWeight.Medium,
                            ),
                        )
                    }
                    Spacer(modifier = Modifier.weight(1f))
                }
            }
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
                    if (!fieldErrors.hasError()) onNext()
                },
                enabled = true,
            ) { Text("Next") }
        }
    }
}

@Composable
private fun FieldLabel(
    label: String,
    modifier: Modifier,
    fontSize: androidx.compose.ui.unit.TextUnit,
) {
    Row(
        modifier = modifier,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            text = label,
            style = MaterialTheme.typography.bodyLarge.copy(
                fontFamily = PoppinsFontFamily,
                fontWeight = FontWeight.SemiBold,
                fontSize = fontSize,
            ),
        )
        Text(
            text = "*",
            style = MaterialTheme.typography.bodyLarge.copy(
                fontFamily = PoppinsFontFamily,
                fontWeight = FontWeight.SemiBold,
                fontSize = fontSize,
                color = Color(0xFFF81010),
            ),
        )
    }
}

@Composable
private fun <T> UnitInputRow(
    value: String,
    onValueChange: (String) -> Unit,
    unitLabel: String,
    onUnitSelected: (T) -> Unit,
    units: List<T>,
    helpSize: androidx.compose.ui.unit.Dp,
    unitBoxWidth: androidx.compose.ui.unit.Dp,
    unitBoxHeight: androidx.compose.ui.unit.Dp,
    fieldHeight: androidx.compose.ui.unit.Dp,
    onHelp: () -> Unit,
    errorMessage: String?,
) where T : Enum<T> {
    val scale = LocalResponsiveScale.current
    var expanded by remember { mutableStateOf(false) }

    Column(modifier = Modifier.fillMaxWidth()) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(scale.scaleDp(14f)),
        ) {
            OutlinedTextField(
                value = value,
                onValueChange = { raw ->
                    onValueChange(raw.filter { it.isDigit() || it == '.' }.take(6))
                },
                modifier = Modifier
                    .weight(1f)
                    .heightIn(min = fieldHeight),
                singleLine = true,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                placeholder = { Text("our...secret..........") },
                isError = errorMessage != null,
                supportingText = {
                    if (errorMessage != null) Text(errorMessage)
                },
            )

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
                            .padding(horizontal = scale.scaleDp(12f)),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween,
                    ) {
                        Text(
                            text = unitLabel,
                            style = MaterialTheme.typography.bodyMedium.copy(
                                fontFamily = PoppinsFontFamily,
                                fontWeight = FontWeight.SemiBold,
                            ),
                        )
                        Text(text = "▾")
                    }
                }

                DropdownMenu(
                    expanded = expanded,
                    onDismissRequest = { expanded = false },
                ) {
                    units.forEach { unit ->
                        DropdownMenuItem(
                            text = { Text(unit.name.uppercase()) },
                            onClick = {
                                onUnitSelected(unit)
                                expanded = false
                            },
                        )
                    }
                }
            }

            HelpIcon(
                size = helpSize,
                onClick = onHelp,
            )
        }
    }
}

@Composable
private fun HelpIcon(
    size: androidx.compose.ui.unit.Dp,
    onClick: () -> Unit,
) {
    val scale = LocalResponsiveScale.current
    Box(
        modifier = Modifier
            .size(size)
            .clickable { onClick() },
        contentAlignment = Alignment.Center,
    ) {
        Canvas(modifier = Modifier.fillMaxSize()) {
            val stroke = Stroke(width = scale.scaleDp(2f).toPx())
            drawCircle(color = Color.Black, style = stroke)
        }
        Text(
            text = "?",
            style = MaterialTheme.typography.bodyMedium.copy(
                fontFamily = PoppinsFontFamily,
                fontWeight = FontWeight.SemiBold,
            ),
        )
    }
}

@Composable
private fun GreyChoiceButton(
    text: String,
    selected: Boolean,
    onClick: () -> Unit,
) {
    val scale = LocalResponsiveScale.current
    val bg = if (selected) Color(0xFFBDBDBD) else Color(0xFFD9D9D9)
    Surface(
        color = bg,
        modifier = Modifier
            .fillMaxWidth()
            .height(scale.scaleDp(43f))
            .clickable { onClick() },
        shadowElevation = 0.dp,
    ) {
        Box(contentAlignment = Alignment.Center) {
            Text(
                text = text,
                style = MaterialTheme.typography.bodyMedium.copy(
                    fontFamily = PoppinsFontFamily,
                    fontWeight = FontWeight.Medium,
                ),
            )
        }
    }
}

@Composable
private fun CameraTile(
    size: androidx.compose.ui.unit.Dp,
    onClick: () -> Unit,
) {
    val scale = LocalResponsiveScale.current
    Surface(
        color = Color(0xFFD9D9D9),
        modifier = Modifier
            .size(size)
            .clickable { onClick() },
        shadowElevation = 0.dp,
    ) {
        Box(contentAlignment = Alignment.Center) {
            CameraIcon(modifier = Modifier.size(scale.scaleDp(44f)))
        }
    }
}

@Composable
private fun WeightIcon(modifier: Modifier = Modifier) {
    Canvas(modifier = modifier) {
        val stroke = Stroke(width = size.minDimension * 0.08f)
        val corner = CornerRadius(size.minDimension * 0.18f, size.minDimension * 0.18f)
        val padding = size.minDimension * 0.12f
        drawRoundRect(
            color = Color.Black,
            topLeft = Offset(padding, padding),
            size = Size(size.width - padding * 2, size.height - padding * 2),
            cornerRadius = corner,
            style = stroke,
        )
        // simple gauge arc + dot
        drawArc(
            color = Color.Black,
            startAngle = 200f,
            sweepAngle = 140f,
            useCenter = false,
            topLeft = Offset(size.width * 0.28f, size.height * 0.22f),
            size = Size(size.width * 0.44f, size.height * 0.44f),
            style = stroke,
        )
        drawCircle(
            color = Color.Black,
            radius = size.minDimension * 0.06f,
            center = Offset(size.width * 0.5f, size.height * 0.46f),
        )
    }
}

@Composable
private fun CameraIcon(modifier: Modifier = Modifier) {
    Canvas(modifier = modifier) {
        val stroke = Stroke(width = size.minDimension * 0.08f)
        val w = size.width
        val h = size.height
        val body = Path().apply {
            moveTo(w * 0.18f, h * 0.34f)
            lineTo(w * 0.32f, h * 0.34f)
            lineTo(w * 0.36f, h * 0.26f)
            lineTo(w * 0.64f, h * 0.26f)
            lineTo(w * 0.68f, h * 0.34f)
            lineTo(w * 0.82f, h * 0.34f)
            lineTo(w * 0.82f, h * 0.74f)
            lineTo(w * 0.18f, h * 0.74f)
            close()
        }
        drawPath(body, color = Color.Black, style = stroke)
        drawCircle(
            color = Color.Black,
            radius = size.minDimension * 0.14f,
            center = Offset(w * 0.5f, h * 0.54f),
            style = stroke,
        )
    }
}

@Preview(showBackground = true)
@Composable
private fun BodyMeasurementOnboardingScreenPreview() {
    TrueclothesTheme {
        var state by remember { mutableStateOf(BodyMeasurementFormState()) }
        BodyMeasurementOnboardingScreen(
            state = state,
            onStateChange = { state = it },
            onBack = {},
            onNext = {},
            onTopBody = {},
            onBottomBody = {},
        )
    }
}

