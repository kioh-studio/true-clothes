import 'package:flutter/material.dart';

import '../core/responsive.dart';
import '../theme/app_fonts.dart';

/// Horizontal carousel with primary/secondary card sizing.
///
/// The active card displays at [primaryHeightDp]; non-active cards shrink to
/// [secondaryHeightDp]. Heights interpolate continuously during drag.
/// Component spec: `design/component/item-slider/design.md`.
class TrueItemSlider extends StatefulWidget {
  const TrueItemSlider({
    super.key,
    required this.itemCount,
    required this.itemBuilder,
    this.cardWidthDp = 260,
    this.primaryHeightDp = 488,
    this.secondaryHeightDp = 408,
    this.gapDp = 24,
    this.padLeftDp = 20,
    this.padBottomDp = 89,
    this.cardColor = const Color(0xFFDCDCDC),
    this.emptyText = 'No items yet \u2014 tap + to add your first piece.',
  });

  final int itemCount;

  /// Builder for card content; receives the index and whether it is primary.
  final Widget Function(BuildContext context, int index, bool isPrimary)
      itemBuilder;

  final double cardWidthDp;
  final double primaryHeightDp;
  final double secondaryHeightDp;
  final double gapDp;
  final double padLeftDp;
  final double padBottomDp;
  final Color cardColor;
  final String emptyText;

  @override
  State<TrueItemSlider> createState() => _TrueItemSliderState();
}

class _TrueItemSliderState extends State<TrueItemSlider> {
  late final ScrollController _controller;
  double _scrollOffset = 0;

  @override
  void initState() {
    super.initState();
    _controller = ScrollController();
    _controller.addListener(() {
      setState(() => _scrollOffset = _controller.offset);
    });
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  double _stride(BuildContext context) =>
      scaleDp(context, widget.cardWidthDp) + scaleDp(context, widget.gapDp);

  double _cardHeight(BuildContext context, int index) {
    final primaryH = scaleDp(context, widget.primaryHeightDp);
    final secondaryH = scaleDp(context, widget.secondaryHeightDp);
    final stride = _stride(context);
    final activePos = stride > 0 ? _scrollOffset / stride : 0.0;
    final distance = (index - activePos).abs().clamp(0.0, 1.0);
    return primaryH + (secondaryH - primaryH) * distance;
  }

  void _snapToNearest() {
    if (!_controller.hasClients) return;
    final stride = _stride(context);
    if (stride <= 0) return;
    final target = (_controller.offset / stride)
        .round()
        .clamp(0, (widget.itemCount - 1).clamp(0, widget.itemCount));
    _controller.animateTo(
      target * stride,
      duration: const Duration(milliseconds: 300),
      curve: Curves.easeOut,
    );
  }

  @override
  Widget build(BuildContext context) {
    if (widget.itemCount == 0) {
      return Center(
        child: Text(
          widget.emptyText,
          style: AppFonts.poppins(
            context,
            fontSize: scaleSp(context, 14),
            fontWeight: FontWeight.w400,
            color: Colors.black.withValues(alpha: 0.45),
          ),
          textAlign: TextAlign.center,
        ),
      );
    }

    final cardW = scaleDp(context, widget.cardWidthDp);
    final primaryH = scaleDp(context, widget.primaryHeightDp);
    final gap = scaleDp(context, widget.gapDp);
    final padLeft = scaleDp(context, widget.padLeftDp);
    final padBottom = scaleDp(context, widget.padBottomDp);

    final stride = _stride(context);
    final activePos = stride > 0 ? _scrollOffset / stride : 0.0;

    return Padding(
      padding: EdgeInsets.only(bottom: padBottom),
      child: SizedBox(
        height: primaryH,
        child: NotificationListener<ScrollEndNotification>(
          onNotification: (_) {
            _snapToNearest();
            return true;
          },
          child: ListView.builder(
            controller: _controller,
            scrollDirection: Axis.horizontal,
            padding: EdgeInsets.only(left: padLeft),
            physics: const BouncingScrollPhysics(),
            itemCount: widget.itemCount,
            itemBuilder: (context, index) {
              final h = _cardHeight(context, index);
              final isPrimary =
                  (index - activePos).abs() < 0.5;
              return Padding(
                padding: EdgeInsets.only(right: gap),
                child: Align(
                  alignment: Alignment.center,
                  child: AnimatedContainer(
                    duration: const Duration(milliseconds: 200),
                    curve: Curves.easeOut,
                    width: cardW,
                    height: h,
                    color: widget.cardColor,
                    child: widget.itemBuilder(context, index, isPrimary),
                  ),
                ),
              );
            },
          ),
        ),
      ),
    );
  }
}
