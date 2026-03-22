import 'package:flutter/material.dart';

import '../core/responsive.dart';
import '../theme/app_fonts.dart';

/// Close-only info dialog matching Kotlin `TrueModal` + `ModalActionMode.CloseOnly`.
Future<void> showTrueInfoModal(
  BuildContext context, {
  String title = 'Info',
  required String message,
}) {
  return showDialog<void>(
    context: context,
    barrierDismissible: true,
    builder: (ctx) {
      final pad = scaleDp(ctx, 24);
      return Dialog(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 360),
          child: Padding(
            padding: EdgeInsets.all(pad),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(
                  title,
                  style: AppFonts.poppins(
                    ctx,
                    fontSize: scaleSp(ctx, 18),
                    fontWeight: FontWeight.w600,
                  ),
                ),
                SizedBox(height: scaleDp(ctx, 12)),
                Text(
                  message,
                  style: AppFonts.poppins(ctx, fontSize: scaleSp(ctx, 14)),
                ),
                SizedBox(height: scaleDp(ctx, 20)),
                Align(
                  alignment: Alignment.centerRight,
                  child: TextButton(
                    onPressed: () => Navigator.of(ctx).pop(),
                    child: Text(
                      'Close',
                      style: AppFonts.poppins(
                        ctx,
                        fontSize: scaleSp(ctx, 14),
                        color: Theme.of(ctx).colorScheme.primary,
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      );
    },
  );
}
