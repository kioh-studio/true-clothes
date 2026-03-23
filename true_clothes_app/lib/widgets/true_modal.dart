import 'package:flutter/material.dart';

import '../core/responsive.dart';
import '../theme/app_fonts.dart';

/// Reusable modal matching `design/component/modal/design.md`.
///
/// Background #F5F5F5, 1px black border, 10px corner radius.
/// Title: Poppins SemiBold 15px. Body: Poppins Light 13px.
/// Close via the X icon in the top-right corner.
Future<void> showTrueInfoModal(
  BuildContext context, {
  String title = 'Info',
  required String message,
}) {
  return showDialog<void>(
    context: context,
    barrierDismissible: true,
    barrierColor: Colors.black.withValues(alpha: 0.3),
    builder: (ctx) => _TrueModalDialog(title: title, message: message),
  );
}

class _TrueModalDialog extends StatelessWidget {
  const _TrueModalDialog({required this.title, required this.message});

  final String title;
  final String message;

  @override
  Widget build(BuildContext context) {
    final cornerRadius = scaleDp(context, 10);
    final padLeft = scaleDp(context, 20);
    final padTop = scaleDp(context, 20);
    final padBottom = scaleDp(context, 30);
    final padRight = scaleDp(context, 20);
    final titleToBody = scaleDp(context, 20);
    final iconSize = scaleDp(context, 24);

    return Center(
      child: Material(
        color: Colors.transparent,
        child: ConstrainedBox(
          constraints: BoxConstraints(
            maxWidth: scaleDp(context, 312),
          ),
          child: Container(
            decoration: BoxDecoration(
              color: const Color(0xFFF5F5F5),
              borderRadius: BorderRadius.circular(cornerRadius),
              border: Border.all(color: Colors.black, width: 1),
            ),
            child: Padding(
              padding: EdgeInsets.only(
                left: padLeft,
                top: padTop,
                right: padRight,
                bottom: padBottom,
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Expanded(
                        child: Text(
                          title,
                          style: AppFonts.poppins(
                            context,
                            fontSize: scaleSp(context, 15),
                            fontWeight: FontWeight.w600,
                            color: Colors.black,
                          ),
                        ),
                      ),
                      GestureDetector(
                        onTap: () => Navigator.of(context).pop(),
                        child: Icon(
                          Icons.close,
                          size: iconSize,
                          color: const Color(0xFF1D1B20),
                        ),
                      ),
                    ],
                  ),
                  SizedBox(height: titleToBody),
                  Text(
                    message,
                    style: AppFonts.poppins(
                      context,
                      fontSize: scaleSp(context, 13),
                      fontWeight: FontWeight.w300,
                      color: Colors.black,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
