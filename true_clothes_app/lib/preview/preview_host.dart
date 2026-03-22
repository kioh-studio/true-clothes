import 'package:flutter/material.dart';

import '../theme/app_colors.dart';

/// Wraps a preview with optional fixed logical size (Compose @PreviewScreenSizes style).
class PreviewHost extends StatelessWidget {
  const PreviewHost({
    super.key,
    required this.title,
    required this.child,
    this.width,
    this.height,
  });

  final String title;
  final Widget child;
  final double? width;
  final double? height;

  static const double referenceWidth = 402;
  static const double referenceHeight = 874;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.mainBackground,
      appBar: AppBar(
        title: Text(title),
        backgroundColor: AppColors.mainBackground,
        foregroundColor: Theme.of(context).colorScheme.onSurface,
        elevation: 0,
      ),
      body: Center(
        child: width != null && height != null
            ? SizedBox(
                width: width,
                height: height,
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(12),
                  child: Material(
                    color: AppColors.mainBackground,
                    child: child,
                  ),
                ),
              )
            : child,
      ),
    );
  }
}
