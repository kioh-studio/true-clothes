import 'package:flutter/material.dart';

import '../core/responsive.dart';
import '../theme/app_fonts.dart';

/// Bordered dropdown selector with label and down-arrow icon.
/// Component spec: `design/component/dropdown/design.md`.
class TrueDropdown extends StatelessWidget {
  const TrueDropdown({
    super.key,
    required this.options,
    required this.selected,
    required this.onChanged,
    this.widthDp = 132,
    this.heightDp = 33,
    this.fontSizeSp = 16,
    this.alignment = Alignment.centerRight,
  });

  final List<String> options;
  final String selected;
  final ValueChanged<String> onChanged;
  final double widthDp;
  final double heightDp;
  final double fontSizeSp;
  final Alignment alignment;

  @override
  Widget build(BuildContext context) {
    final width = scaleDp(context, widthDp);
    final height = scaleDp(context, heightDp);
    final touchHeight = scaleDp(context, 48);

    return Align(
      alignment: alignment,
      child: SizedBox(
        height: touchHeight,
        child: Center(
          child: Container(
            width: width,
            height: height,
            decoration: BoxDecoration(
              color: const Color(0xFFFFFFFF),
              border: Border.all(
                color: Colors.black,
                width: scaleDp(context, 0.5),
              ),
            ),
            child: DropdownButtonHideUnderline(
              child: ButtonTheme(
                alignedDropdown: true,
                child: DropdownButton<String>(
                  value: selected,
                  isExpanded: true,
                  icon: Icon(
                    Icons.arrow_drop_down,
                    color: const Color(0xFF1D1B20),
                    size: scaleDp(context, 20),
                  ),
                  style: AppFonts.poppins(
                    context,
                    fontSize: scaleSp(context, fontSizeSp),
                    fontWeight: FontWeight.w400,
                    color: Colors.black,
                  ),
                  onChanged: (v) {
                    if (v != null) onChanged(v);
                  },
                  items: options
                      .map((o) => DropdownMenuItem(value: o, child: Text(o)))
                      .toList(),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
