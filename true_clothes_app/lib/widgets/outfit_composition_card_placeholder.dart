import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../features/home/home_outfit_models.dart';

/// Same [kPreviewImagePackage] as [pubspec.yaml] `name:` — required for Flutter Widget Previewer (web).
const String kPreviewImagePackage = 'true_clothes_app';

/// Port of Kotlin `OutfitCompositionCardPlaceholder.kt` — 500×570 reference canvas,
/// uniform scale to fit width (and height when bounded). See `design/screen/home/main/design.md`.
class OutfitCompositionCardPlaceholder extends StatelessWidget {
  const OutfitCompositionCardPlaceholder({
    super.key,
    required this.sources,
  });

  final OutfitCompositionSources sources;

  static const double _canvasW = 500;
  static const double _canvasH = 570;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final scaleX = constraints.maxWidth / _canvasW;
        final maxH = constraints.hasBoundedHeight
            ? constraints.maxHeight
            : double.infinity;
        final scaleY = maxH.isFinite ? maxH / _canvasH : double.infinity;
        final scale = math.min(scaleX, scaleY);

        double s(double px) => px * scale;
        final w = s(_canvasW);
        final h = s(_canvasH);

        return SizedBox(
          width: w,
          height: h,
          child: Stack(
            clipBehavior: Clip.none,
            children: [
              _Slot(
                imagePath: sources.pants,
                left: s(0),
                top: s(0),
                width: s(350),
                height: s(468),
              ),
              _Slot(
                imagePath: sources.jacket,
                left: s(350),
                top: s(0),
                width: s(150),
                height: s(206),
              ),
              _Slot(
                imagePath: sources.shirt,
                left: s(350),
                top: s(206),
                width: s(150),
                height: s(206),
              ),
              _Slot(
                imagePath: sources.bag,
                left: s(350),
                top: s(412),
                width: s(102),
                height: s(140),
              ),
              _Slot(
                imagePath: sources.shoes,
                left: s(0),
                top: s(468),
                width: s(102),
                height: s(102),
              ),
            ],
          ),
        );
      },
    );
  }
}

class _Slot extends StatelessWidget {
  const _Slot({
    required this.imagePath,
    required this.left,
    required this.top,
    required this.width,
    required this.height,
  });

  final String? imagePath;
  final double left;
  final double top;
  final double width;
  final double height;

  @override
  Widget build(BuildContext context) {
    return Positioned(
      left: left,
      top: top,
      width: width,
      height: height,
      child: ColoredBox(
        color: Colors.white.withValues(alpha: 0.08),
        child: imagePath != null && imagePath!.isNotEmpty
            ? Image.asset(
                imagePath!,
                package: kPreviewImagePackage,
                fit: BoxFit.contain,
                errorBuilder: (_, _, _) => const SizedBox.expand(),
              )
            : const SizedBox.expand(),
      ),
    );
  }
}
