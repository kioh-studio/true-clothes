import 'package:flutter/material.dart';
import 'package:flutter/widget_previews.dart';

import '../core/responsive.dart';
import '../theme/widget_preview_theme.dart';

/// Port of Kotlin `TrueProgressBar.kt` / `true-clothes-docs/design/component/progress-bar/design.yml`.
class TrueProgressBar extends StatelessWidget {
  const TrueProgressBar({
    super.key,
    required this.totalPoints,
    this.activeIndices = const [],
  });

  final int totalPoints;
  final List<int> activeIndices;

  @override
  Widget build(BuildContext context) {
    if (totalPoints <= 0) return const SizedBox.shrink();

    final pointSize = scaleDp(context, 14);
    final lineWidth = scaleDp(context, 2);
    final strokeWidth = scaleDp(context, 1);

    return SizedBox(
      height: pointSize,
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          for (int index = 0; index < totalPoints; index++) ...[
            CustomPaint(
              size: Size(pointSize, pointSize),
              painter: _DotPainter(
                filled: activeIndices.contains(index),
                strokeWidth: strokeWidth,
              ),
            ),
            if (index < totalPoints - 1)
              Expanded(
                child: CustomPaint(
                  size: Size(double.infinity, pointSize),
                  painter: _LinePainter(
                    strokeWidth: lineWidth,
                    centerY: pointSize / 2,
                  ),
                ),
              ),
          ],
        ],
      ),
    );
  }
}

class _DotPainter extends CustomPainter {
  _DotPainter({required this.filled, required this.strokeWidth});

  final bool filled;
  final double strokeWidth;

  @override
  void paint(Canvas canvas, Size size) {
    final c = Offset(size.width / 2, size.height / 2);
    final r = size.width / 2;
    if (filled) {
      canvas.drawCircle(c, r, Paint()..color = Colors.black);
    } else {
      canvas.drawCircle(
        c,
        r,
        Paint()
          ..color = Colors.black
          ..style = PaintingStyle.stroke
          ..strokeWidth = strokeWidth,
      );
    }
  }

  @override
  bool shouldRepaint(covariant _DotPainter oldDelegate) =>
      oldDelegate.filled != filled || oldDelegate.strokeWidth != strokeWidth;
}

class _LinePainter extends CustomPainter {
  _LinePainter({required this.strokeWidth, required this.centerY});

  final double strokeWidth;
  final double centerY;

  @override
  void paint(Canvas canvas, Size size) {
    final y = centerY.clamp(0.0, size.height);
    canvas.drawLine(
      Offset(0, y),
      Offset(size.width, y),
      Paint()
        ..color = Colors.black
        ..strokeWidth = strokeWidth,
    );
  }

  @override
  bool shouldRepaint(covariant _LinePainter oldDelegate) =>
      oldDelegate.strokeWidth != strokeWidth || oldDelegate.centerY != centerY;
}

// -----------------------------------------------------------------------------
// Previews — Kotlin `TrueProgressBar.kt` multiple `@Preview` functions.
// -----------------------------------------------------------------------------

class TrueProgressBarPreviewGallery extends StatelessWidget {
  const TrueProgressBarPreviewGallery({super.key});

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          _row(context, 'Empty (totalPoints: 0)', () {
            return const TrueProgressBar(totalPoints: 0, activeIndices: []);
          }),
          _row(context, 'Five points, none active', () {
            return const TrueProgressBar(
              totalPoints: 5,
              activeIndices: [],
            );
          }),
          _row(context, 'First active', () {
            return const TrueProgressBar(
              totalPoints: 5,
              activeIndices: [0],
            );
          }),
          _row(context, 'First three active', () {
            return const TrueProgressBar(
              totalPoints: 5,
              activeIndices: [0, 1, 2],
            );
          }),
        ],
      ),
    );
  }

  Widget _row(
    BuildContext context,
    String label,
    Widget Function() bar,
  ) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 32),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: Theme.of(context).textTheme.titleSmall,
          ),
          const SizedBox(height: 8),
          SizedBox(height: 48, child: bar()),
        ],
      ),
    );
  }
}

@Preview(
  name: 'Progress — first dot',
  group: 'Components',
  size: Size(320, 64),
  theme: trueClothesPreviewTheme,
)
Widget trueProgressBarPreviewFirst() {
  return const SizedBox(
    height: 48,
    child: TrueProgressBar(
      totalPoints: 5,
      activeIndices: [0],
    ),
  );
}

@Preview(
  name: 'Progress — three active',
  group: 'Components',
  size: Size(320, 64),
  theme: trueClothesPreviewTheme,
)
Widget trueProgressBarPreviewThree() {
  return const SizedBox(
    height: 48,
    child: TrueProgressBar(
      totalPoints: 5,
      activeIndices: [0, 1, 2],
    ),
  );
}

@Preview(
  name: 'Progress bar — all variants',
  group: 'Components',
  size: Size(360, 420),
  theme: trueClothesPreviewTheme,
)
Widget trueProgressBarPreviewGalleryWidgetPreview() {
  return const TrueProgressBarPreviewGallery();
}
