import 'dart:math' as math;

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';

import '../features/home/home_outfit_models.dart';
import 'composition_layout.dart';

/// Dynamic outfit composition card — adapts layout to the number of present
/// items. Anchor item is always the largest; secondary items scale based on
/// count. See `design/screen/home/main/design.md`.
class OutfitCompositionCardPlaceholder extends StatelessWidget {
  const OutfitCompositionCardPlaceholder({
    super.key,
    required this.sources,
  });

  final OutfitCompositionSources sources;

  @override
  Widget build(BuildContext context) {
    final mainImages = sources.mainImages;
    final accentImages = sources.accentImages;
    if (mainImages.isEmpty && accentImages.isEmpty) {
      return const SizedBox.shrink();
    }

    final layout = buildCompositionSlots(
      mainCount: mainImages.length,
      accentCount: accentImages.length,
    );

    return LayoutBuilder(
      builder: (context, constraints) {
        final scaleX = constraints.maxWidth / canvasW;
        final maxH = constraints.hasBoundedHeight
            ? constraints.maxHeight
            : double.infinity;
        final scaleY = maxH.isFinite ? maxH / canvasH : double.infinity;
        final scale = math.min(scaleX, scaleY);

        double s(double px) => px * scale;

        return SizedBox(
          width: s(canvasW),
          height: s(canvasH),
          child: Stack(
            clipBehavior: Clip.none,
            children: [
              // Main items (anchor + secondaries) — dynamically scaled
              for (int i = 0; i < layout.mainSlots.length && i < mainImages.length; i++)
                _Slot(
                  imagePath: mainImages[i],
                  left: s(layout.mainSlots[i].x),
                  top: s(layout.mainSlots[i].y),
                  width: s(layout.mainSlots[i].w),
                  height: s(layout.mainSlots[i].h),
                ),
              // Accent items (shoes, bag, etc.) — fixed small size
              for (int i = 0; i < layout.accentSlots.length && i < accentImages.length; i++)
                _Slot(
                  imagePath: accentImages[i],
                  left: s(layout.accentSlots[i].x),
                  top: s(layout.accentSlots[i].y),
                  width: s(layout.accentSlots[i].w),
                  height: s(layout.accentSlots[i].h),
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
        color: Colors.transparent,
        child: imagePath != null && imagePath!.isNotEmpty
            ? Image.asset(
                imagePath!,
                fit: BoxFit.contain,
                width: width,
                height: height,
                errorBuilder: (context, error, stackTrace) {
                  if (kDebugMode) {
                    debugPrint(
                      '[OutfitImage] asset load failed: $imagePath — $error',
                    );
                  }
                  return const Center(
                    child: Icon(Icons.broken_image_outlined, color: Colors.white54),
                  );
                },
              )
            : const Center(
                child: Icon(Icons.hide_image_outlined, color: Colors.white38),
              ),
      ),
    );
  }
}
