import 'package:flutter/material.dart';

import '../core/responsive.dart';

/// Circular back button — white circle with a chevron-left icon.
/// Component spec: `design/component/back-button/design.md`.
class TrueBackButton extends StatelessWidget {
  const TrueBackButton({
    super.key,
    required this.onTap,
    this.diameterDp = 40,
    this.fill = const Color(0xFFFFFFFF),
    this.iconColor = Colors.black,
    this.icon = Icons.chevron_left,
    this.semanticLabel = 'Back',
  });

  final VoidCallback onTap;
  final double diameterDp;
  final Color fill;
  final Color iconColor;
  final IconData icon;
  final String semanticLabel;

  @override
  Widget build(BuildContext context) {
    final d = scaleDp(context, diameterDp);
    return Semantics(
      button: true,
      label: semanticLabel,
      child: GestureDetector(
        onTap: onTap,
        child: Container(
          width: d,
          height: d,
          decoration: BoxDecoration(color: fill, shape: BoxShape.circle),
          child: Icon(
            icon,
            color: iconColor,
            size: scaleDp(context, diameterDp * 0.6),
          ),
        ),
      ),
    );
  }
}
