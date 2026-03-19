package com.brian_bui.true_clothes.shared.components

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.brian_bui.true_clothes.shared.theme.LocalResponsiveScale
import com.brian_bui.true_clothes.shared.theme.MainBackground
import com.brian_bui.true_clothes.shared.theme.TrueclothesTheme

/**
 * Modal action configuration, aligned with COMPONENT_SPEC in app/design/component/modal/design.md.
 */
enum class ModalActionMode {
    CloseOnly,
    OkCancel,
}

/**
 * Reusable modal component that matches the modal design spec.
 *
 * Placement, backdrop, and animation are intentionally left to the caller:
 * - This composable renders a centered card with optional scrim by default.
 * - Callers can wrap it or adjust [alignment] / [useScrim] to change behavior.
 */
@Composable
fun TrueModal(
    visible: Boolean,
    title: String,
    message: String,
    mode: ModalActionMode,
    onDismiss: () -> Unit,
    onOk: (() -> Unit)? = null,
    modifier: Modifier = Modifier,
    extraContent: (@Composable () -> Unit)? = null,
    alignment: Alignment = Alignment.Center,
    useScrim: Boolean = true,
    cornerRadius: Dp = 10.dp,
) {
    if (!visible) return

    val scale = LocalResponsiveScale.current
    val containerPadding = scale.scaleDp(20f)
    val titleSize = scale.scaleSp(15f)
    val messageSize = scale.scaleSp(13f)
    val iconTouchPadding = scale.scaleDp(4f)
    val messageTop = scale.scaleDp(20f)
    val messageBottom = scale.scaleDp(30f)
    val buttonTop = scale.scaleDp(12f)
    val contentStartPadding = scale.scaleDp(20f)
    val contentEndPadding = scale.scaleDp(20f)
    val titleTopPadding = scale.scaleDp(20f)
    val resolvedCornerRadius = scale.scaleDp(cornerRadius.value)
    val borderWidth = scale.scaleDp(1f)

    Box(
        modifier = Modifier
            .fillMaxSize()
            .then(
                if (useScrim) {
                    Modifier.background(Color.Black.copy(alpha = 0.32f))
                } else {
                    Modifier
                }
            ),
        contentAlignment = alignment,
    ) {
        Surface(
            shape = RoundedCornerShape(resolvedCornerRadius),
            color = MainBackground,
            shadowElevation = 0.dp,
            border = androidx.compose.foundation.BorderStroke(borderWidth, Color.Black),
            modifier = modifier
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(
                        start = contentStartPadding,
                        end = contentEndPadding,
                        top = titleTopPadding,
                        bottom = containerPadding,
                    ),
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween,
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Text(
                        text = title,
                        // Maps to: Poppins, 15px, SemiBold in the design spec.
                        style = MaterialTheme.typography.titleMedium.copy(
                            fontSize = titleSize,
                            fontWeight = FontWeight.SemiBold,
                        ),
                        modifier = Modifier.weight(1f),
                    )

                    Text(
                        text = "✕",
                        // Simple text-based close icon matching the X in the design.
                        style = MaterialTheme.typography.bodyMedium,
                        modifier = Modifier
                            .clickable { onDismiss() }
                            .padding(iconTouchPadding),
                    )
                }

                if (message.isNotBlank()) {
                    Text(
                        text = message,
                        // Maps to: Poppins, 13px, Light in the design spec.
                        style = MaterialTheme.typography.bodyMedium.copy(
                            fontSize = messageSize,
                            fontWeight = FontWeight.Light,
                        ),
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(top = messageTop, bottom = messageBottom),
                    )
                }

                if (extraContent != null) {
                    extraContent()
                }

                if (mode == ModalActionMode.OkCancel) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(top = buttonTop),
                        horizontalArrangement = Arrangement.End,
                    ) {
                        // Cancel button shares the same handler as the close icon: onDismiss.
                        Button(onClick = onDismiss) {
                            Text("Cancel")
                        }

                        Spacer(modifier = Modifier.width(scale.scaleDp(8f)))

                        Button(
                            onClick = { onOk?.invoke() },
                            enabled = onOk != null,
                        ) {
                            Text("OK")
                        }
                    }
                }
            }
        }
    }
}

@Preview(showBackground = true)
@Composable
private fun TrueModalPreviewCloseOnly() {
    TrueclothesTheme {
        TrueModal(
            visible = true,
            title = "Info",
            message = "This is a sample informational message.",
            mode = ModalActionMode.CloseOnly,
            onDismiss = {},
        )
    }
}

@Preview(showBackground = true)
@Composable
private fun TrueModalPreviewOkCancel() {
    TrueclothesTheme {
        TrueModal(
            visible = true,
            title = "Delete item?",
            message = "Are you sure you want to delete this item?",
            mode = ModalActionMode.OkCancel,
            onDismiss = {},
            onOk = {},
        )
    }
}

