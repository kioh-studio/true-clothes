import 'package:flutter/material.dart';

import '../core/responsive.dart';
import '../theme/app_fonts.dart';

/// Underlined search input with trailing magnifying glass icon.
/// Component spec: `design/component/search-bar/design.md`.
class TrueSearchBar extends StatelessWidget {
  const TrueSearchBar({
    super.key,
    required this.controller,
    required this.focusNode,
    required this.onChanged,
    this.hintText = 'Search anything...',
    this.widthDp = 170,
    this.alignment = Alignment.centerRight,
  });

  final TextEditingController controller;
  final FocusNode focusNode;
  final ValueChanged<String> onChanged;
  final String hintText;
  final double widthDp;
  final Alignment alignment;

  @override
  Widget build(BuildContext context) {
    return Align(
      alignment: alignment,
      child: SizedBox(
        width: scaleDp(context, widthDp),
        child: Semantics(
          label: hintText,
          textField: true,
          child: TextField(
            controller: controller,
            focusNode: focusNode,
            onChanged: onChanged,
            style: AppFonts.poppins(
              context,
              fontSize: scaleSp(context, 14),
              fontWeight: FontWeight.w400,
              color: Colors.black,
            ),
            decoration: InputDecoration(
              hintText: hintText,
              hintStyle: AppFonts.poppins(
                context,
                fontSize: scaleSp(context, 14),
                fontWeight: FontWeight.w400,
                color: Colors.black.withValues(alpha: 0.5),
              ),
              isDense: true,
              contentPadding: EdgeInsets.only(bottom: scaleDp(context, 8)),
              border: UnderlineInputBorder(
                borderSide: BorderSide(
                  color: Colors.black.withValues(alpha: 0.6),
                  width: scaleDp(context, 1),
                ),
              ),
              enabledBorder: UnderlineInputBorder(
                borderSide: BorderSide(
                  color: Colors.black.withValues(alpha: 0.6),
                  width: scaleDp(context, 1),
                ),
              ),
              focusedBorder: UnderlineInputBorder(
                borderSide: BorderSide(
                  color: Colors.black.withValues(alpha: 0.8),
                  width: scaleDp(context, 1.5),
                ),
              ),
              suffixIcon: Icon(
                Icons.search,
                color: const Color(0xFF1E1E1E),
                size: scaleDp(context, 20),
              ),
              suffixIconConstraints: BoxConstraints(
                maxHeight: scaleDp(context, 24),
                maxWidth: scaleDp(context, 24),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
