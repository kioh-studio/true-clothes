import 'package:flutter/material.dart';

import '../../core/responsive.dart';
import '../../theme/app_fonts.dart';
import '../home/item_detail_screen.dart';
import 'collection_demo_data.dart';
import 'wardrobe_demo_data.dart';

/// Vertically scrollable list of collection cards.
///
/// Implements `design/screen/collection/design.md`.
/// Each card shows the collection title and a 2×2 preview grid of item
/// thumbnails with an optional dashed "add item" slot.
class CollectionsTabView extends StatelessWidget {
  const CollectionsTabView({
    super.key,
    this.searchQuery = '',
  });

  final String searchQuery;

  @override
  Widget build(BuildContext context) {
    final collections = _filteredCollections();

    if (collections.isEmpty) {
      return Center(
        child: Text(
          'No collections yet',
          style: AppFonts.poppins(
            context,
            fontSize: scaleSp(context, 14),
            fontWeight: FontWeight.w400,
            color: Colors.black.withValues(alpha: 0.45),
          ),
        ),
      );
    }

    final padH = scaleDp(context, 20);
    final spacing = scaleDp(context, 60);
    final padTop = scaleDp(context, 16);
    final padBottom = scaleDp(context, 100);

    return ListView.separated(
      padding: EdgeInsets.only(
        left: padH,
        right: padH,
        top: padTop,
        bottom: padBottom,
      ),
      itemCount: collections.length,
      separatorBuilder: (_, idx) => SizedBox(height: spacing, key: ValueKey('sep-$idx')),
      itemBuilder: (context, index) {
        return _CollectionCard(collection: collections[index]);
      },
    );
  }

  List<ItemCollection> _filteredCollections() {
    if (searchQuery.isEmpty) return demoCollections;
    final query = searchQuery.toLowerCase();
    return demoCollections
        .where((c) => c.name.toLowerCase().contains(query))
        .toList();
  }
}

// ---------------------------------------------------------------------------
// Collection card — title + 2×2 item grid
// ---------------------------------------------------------------------------

class _CollectionCard extends StatelessWidget {
  const _CollectionCard({required this.collection});

  final ItemCollection collection;

  static const int _maxSlots = 4;

  @override
  Widget build(BuildContext context) {
    final cardW = scaleDp(context, 350);
    final cardH = scaleDp(context, 373);
    final innerPadH = scaleDp(context, 20);
    final titlePadTop = scaleDp(context, 14);
    final gridPadTop = scaleDp(context, 46);
    final thumbSize = scaleDp(context, 140);
    final gap = scaleDp(context, 30);

    final items = collection.items;
    final showAddSlot = items.length < _maxSlots;
    final visibleItems = items.length > _maxSlots
        ? items.sublist(0, _maxSlots)
        : items;

    return Container(
      width: cardW,
      height: cardH,
      color: Colors.white,
      child: Stack(
        children: [
          // Title
          Positioned(
            left: innerPadH,
            top: titlePadTop,
            right: innerPadH,
            child: Semantics(
              header: true,
              child: Text(
                collection.name,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: AppFonts.playfairDisplay(
                  context,
                  fontSize: scaleSp(context, 18),
                  fontWeight: FontWeight.bold,
                  color: Colors.black,
                ),
              ),
            ),
          ),

          // 2×2 grid
          Positioned(
            left: innerPadH,
            top: gridPadTop,
            right: innerPadH,
            child: Wrap(
              spacing: gap,
              runSpacing: gap,
              children: [
                for (final item in visibleItems)
                  _ItemThumbnail(
                    size: thumbSize,
                    item: item,
                    onTap: () => _openItemDetail(context, item),
                  ),
                if (showAddSlot)
                  _AddItemSlot(
                    size: thumbSize,
                    collectionName: collection.name,
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  void _openItemDetail(BuildContext context, WardrobeItem item) {
    final info = item.detailInfo;
    if (info == null) return;
    Navigator.of(context).push<void>(
      MaterialPageRoute<void>(
        builder: (ctx) => ItemDetailScreen(
          item: info,
          onBack: () => Navigator.of(ctx).pop(),
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Item thumbnail — loads from asset, network, or shows placeholder
// ---------------------------------------------------------------------------

class _ItemThumbnail extends StatelessWidget {
  const _ItemThumbnail({
    required this.size,
    required this.item,
    required this.onTap,
  });

  final double size;
  final WardrobeItem item;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: '${item.name}, open details',
      child: GestureDetector(
        onTap: onTap,
        child: Container(
          width: size,
          height: size,
          color: const Color(0xFFD9D9D9),
          child: _buildImage(context),
        ),
      ),
    );
  }

  Widget _buildImage(BuildContext context) {
    final url = item.imageUrl;
    if (url == null || url.isEmpty) {
      return _placeholder(context);
    }

    if (item.isAssetImage) {
      return Image.asset(
        url,
        fit: BoxFit.cover,
        width: size,
        height: size,
        errorBuilder: (_, e, st) => _placeholder(context),
      );
    }

    return Image.network(
      url,
      fit: BoxFit.cover,
      width: size,
      height: size,
      loadingBuilder: (_, child, progress) {
        if (progress == null) return child;
        return _placeholder(context);
      },
      errorBuilder: (_, e, st) => _placeholder(context),
    );
  }

  Widget _placeholder(BuildContext context) {
    return Center(
      child: Icon(
        Icons.checkroom,
        size: scaleDp(context, 28),
        color: Colors.black.withValues(alpha: 0.15),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Dashed "add item" slot
// ---------------------------------------------------------------------------

class _AddItemSlot extends StatelessWidget {
  const _AddItemSlot({
    required this.size,
    required this.collectionName,
  });

  final double size;
  final String collectionName;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: 'Add item to $collectionName',
      child: GestureDetector(
        onTap: () {
          // Future: open item picker to assign to this collection.
        },
        child: CustomPaint(
          painter: _DashedBorderPainter(
            color: Colors.black,
            strokeWidth: scaleDp(context, 1),
            dashLength: scaleDp(context, 2),
            gapLength: scaleDp(context, 2),
          ),
          child: SizedBox(
            width: size,
            height: size,
            child: Center(
              child: Icon(
                Icons.add,
                size: scaleDp(context, 40),
                color: const Color(0xFF1E1E1E),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Dashed border painter
// ---------------------------------------------------------------------------

class _DashedBorderPainter extends CustomPainter {
  _DashedBorderPainter({
    required this.color,
    required this.strokeWidth,
    required this.dashLength,
    required this.gapLength,
  });

  final Color color;
  final double strokeWidth;
  final double dashLength;
  final double gapLength;

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = color
      ..strokeWidth = strokeWidth
      ..style = PaintingStyle.stroke;

    final path = Path()..addRect(Offset.zero & size);
    final totalDash = dashLength + gapLength;

    for (final metric in path.computeMetrics()) {
      double distance = 0;
      while (distance < metric.length) {
        final end = (distance + dashLength).clamp(0.0, metric.length);
        final extracted = metric.extractPath(distance, end);
        canvas.drawPath(extracted, paint);
        distance += totalDash;
      }
    }
  }

  @override
  bool shouldRepaint(_DashedBorderPainter oldDelegate) =>
      color != oldDelegate.color ||
      strokeWidth != oldDelegate.strokeWidth ||
      dashLength != oldDelegate.dashLength ||
      gapLength != oldDelegate.gapLength;
}
