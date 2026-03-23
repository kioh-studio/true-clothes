import 'package:flutter/material.dart';

import '../core/responsive.dart';
import '../theme/app_fonts.dart';

/// Horizontal text tab bar with a short coloured indicator under the active tab.
/// Component spec: `design/component/tab-bar/design.md`.
class TrueTabBar extends StatelessWidget {
  const TrueTabBar({
    super.key,
    required this.labels,
    required this.selectedIndex,
    required this.onSelected,
    this.activeFontWeight = FontWeight.bold,
    this.inactiveFontWeight = FontWeight.w400,
    this.fontSizeSp = 18,
    this.activeColor = Colors.black,
    this.inactiveOpacity = 0.4,
    this.indicatorColor = const Color(0xFFFFB432),
    this.indicatorThicknessDp = 3,
    this.indicatorWidthDp = 30,
    this.tabSpacingDp = 28,
  });

  final List<String> labels;
  final int selectedIndex;
  final ValueChanged<int> onSelected;
  final FontWeight activeFontWeight;
  final FontWeight inactiveFontWeight;
  final double fontSizeSp;
  final Color activeColor;
  final double inactiveOpacity;
  final Color indicatorColor;
  final double indicatorThicknessDp;
  final double indicatorWidthDp;
  final double tabSpacingDp;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: List.generate(labels.length, (i) {
        final active = selectedIndex == i;
        return Padding(
          padding: EdgeInsets.only(
            right: i < labels.length - 1 ? scaleDp(context, tabSpacingDp) : 0,
          ),
          child: Semantics(
            button: true,
            selected: active,
            label: '${labels[i]} tab${active ? ', selected' : ''}',
            child: InkWell(
              onTap: () => onSelected(i),
              child: Padding(
                padding: EdgeInsets.symmetric(vertical: scaleDp(context, 8)),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      labels[i],
                      style: AppFonts.playfairDisplay(
                        context,
                        fontSize: scaleSp(context, fontSizeSp),
                        fontWeight: active ? activeFontWeight : inactiveFontWeight,
                        color: active
                            ? activeColor
                            : activeColor.withValues(alpha: inactiveOpacity),
                      ),
                    ),
                    if (active) ...[
                      SizedBox(height: scaleDp(context, 4)),
                      Container(
                        height: scaleDp(context, indicatorThicknessDp),
                        width: scaleDp(context, indicatorWidthDp),
                        decoration: BoxDecoration(
                          color: indicatorColor,
                          borderRadius: BorderRadius.circular(
                            scaleDp(context, indicatorThicknessDp / 2),
                          ),
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ),
          ),
        );
      }),
    );
  }
}
