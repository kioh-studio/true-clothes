import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../core/responsive.dart';
import '../../theme/app_fonts.dart';
import 'onboarding_units.dart';

const Color kOnboardingSubtitleGrey = Color(0xFF6B6B6B);
const Color kUnitPickerFill = Color(0xFFFFFAE0);
const Color kGreyChoiceSelected = Color(0xFFBDBDBD);
const Color kGreyChoiceUnselected = Color(0xFFD9D9D9);
const Color kRequiredStarRed = Color(0xFFF81010);

String sanitizeDecimal(String raw, {int maxLen = 6}) {
  final buf = StringBuffer();
  var dot = false;
  for (final c in raw.runes) {
    final ch = String.fromCharCode(c);
    if (ch == '.') {
      if (dot) continue;
      dot = true;
      buf.write(ch);
    } else if (ch.codeUnitAt(0) >= 0x30 && ch.codeUnitAt(0) <= 0x39) {
      buf.write(ch);
    }
    if (buf.length >= maxLen) break;
  }
  return buf.toString();
}

class FieldLabelWithStar extends StatelessWidget {
  const FieldLabelWithStar({
    super.key,
    required this.label,
    required this.fontSize,
  });

  final String label;
  final double fontSize;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Text(
          label,
          style: AppFonts.poppins(
            context,
            fontSize: fontSize,
            fontWeight: FontWeight.w600,
          ),
        ),
        Text(
          '*',
          style: AppFonts.poppins(
            context,
            fontSize: fontSize,
            fontWeight: FontWeight.w600,
            color: kRequiredStarRed,
          ),
        ),
      ],
    );
  }
}

class HelpQuestionIcon extends StatelessWidget {
  const HelpQuestionIcon({super.key, required this.size, required this.onTap});

  final double size;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final stroke = scaleDp(context, 2);
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        customBorder: const CircleBorder(),
        child: SizedBox(
          width: size,
          height: size,
          child: CustomPaint(
            painter: _CircleStrokePainter(strokeWidth: stroke),
            child: Center(
              child: Text(
                '?',
                style: AppFonts.poppins(
                  context,
                  fontSize: scaleSp(context, 14),
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _CircleStrokePainter extends CustomPainter {
  _CircleStrokePainter({required this.strokeWidth});

  final double strokeWidth;

  @override
  void paint(Canvas canvas, Size size) {
    final c = Offset(size.width / 2, size.height / 2);
    final r = size.shortestSide / 2 - strokeWidth / 2;
    canvas.drawCircle(
      c,
      r,
      Paint()
        ..color = Colors.black
        ..style = PaintingStyle.stroke
        ..strokeWidth = strokeWidth,
    );
  }

  @override
  bool shouldRepaint(covariant _CircleStrokePainter oldDelegate) =>
      oldDelegate.strokeWidth != strokeWidth;
}

class HeightUnitPicker extends StatelessWidget {
  const HeightUnitPicker({
    super.key,
    required this.unit,
    required this.onChanged,
    required this.width,
    required this.height,
  });

  final HeightUnit unit;
  final ValueChanged<HeightUnit> onChanged;
  final double width;
  final double height;

  @override
  Widget build(BuildContext context) {
    return _EnumUnitPicker<HeightUnit>(
      value: unit,
      values: HeightUnit.values,
      label: (u) => u.label,
      onChanged: onChanged,
      width: width,
      height: height,
    );
  }
}

class WeightUnitPicker extends StatelessWidget {
  const WeightUnitPicker({
    super.key,
    required this.unit,
    required this.onChanged,
    required this.width,
    required this.height,
  });

  final WeightUnit unit;
  final ValueChanged<WeightUnit> onChanged;
  final double width;
  final double height;

  @override
  Widget build(BuildContext context) {
    return _EnumUnitPicker<WeightUnit>(
      value: unit,
      values: WeightUnit.values,
      label: (u) => u.label,
      onChanged: onChanged,
      width: width,
      height: height,
    );
  }
}

class _EnumUnitPicker<T> extends StatelessWidget {
  const _EnumUnitPicker({
    required this.value,
    required this.values,
    required this.label,
    required this.onChanged,
    required this.width,
    required this.height,
  });

  final T value;
  final List<T> values;
  final String Function(T) label;
  final ValueChanged<T> onChanged;
  final double width;
  final double height;

  @override
  Widget build(BuildContext context) {
    final padH = scaleDp(context, 12);
    return PopupMenuButton<T>(
      initialValue: value,
      onSelected: onChanged,
      itemBuilder: (ctx) => values
          .map(
            (u) => PopupMenuItem(
              value: u,
              child: Text(label(u)),
            ),
          )
          .toList(),
      child: Container(
        width: width,
        height: height,
        decoration: BoxDecoration(
          color: kUnitPickerFill,
          border: Border.all(color: Colors.black),
        ),
        padding: EdgeInsets.symmetric(horizontal: padH),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              label(value),
              style: AppFonts.poppins(
                context,
                fontSize: scaleSp(context, 14),
                fontWeight: FontWeight.w600,
              ),
            ),
            const Text('▾'),
          ],
        ),
      ),
    );
  }
}

class GreyChoiceButton extends StatelessWidget {
  const GreyChoiceButton({
    super.key,
    required this.text,
    required this.selected,
    required this.onTap,
  });

  final String text;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final h = scaleDp(context, 43);
    final bg = selected ? kGreyChoiceSelected : kGreyChoiceUnselected;
    return Material(
      color: bg,
      child: InkWell(
        onTap: onTap,
        child: SizedBox(
          width: double.infinity,
          height: h,
          child: Center(
            child: Text(
              text,
              style: AppFonts.poppins(
                context,
                fontSize: scaleSp(context, 14),
                fontWeight: FontWeight.w500,
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class CameraUploadTile extends StatelessWidget {
  const CameraUploadTile({super.key, required this.size, required this.onTap});

  final double size;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final iconSize = scaleDp(context, 44);
    return Material(
      color: kGreyChoiceUnselected,
      child: InkWell(
        onTap: onTap,
        child: SizedBox(
          width: size,
          height: size,
          child: Center(
            child: Icon(Icons.photo_camera_outlined, size: iconSize),
          ),
        ),
      ),
    );
  }
}

class MeasurementLeftGlyph extends StatelessWidget {
  const MeasurementLeftGlyph({super.key, required this.size});

  final double size;

  @override
  Widget build(BuildContext context) {
    final sw = scaleDp(context, 2);
    return CustomPaint(
      size: Size(size, size),
      painter: _RulerGlyphPainter(strokeWidth: sw),
    );
  }
}

class _RulerGlyphPainter extends CustomPainter {
  _RulerGlyphPainter({required this.strokeWidth});

  final double strokeWidth;

  @override
  void paint(Canvas canvas, Size size) {
    final w = size.width;
    final h = size.height;
    final r = RRect.fromRectAndRadius(
      Rect.fromLTWH(w * 0.18, h * 0.2, w * 0.64, h * 0.7),
      Radius.circular(w * 0.12),
    );
    canvas.drawRRect(
      r,
      Paint()
        ..color = Colors.black
        ..style = PaintingStyle.stroke
        ..strokeWidth = strokeWidth,
    );
    canvas.drawLine(
      Offset(w * 0.22, h * 0.52),
      Offset(w * 0.78, h * 0.28),
      Paint()
        ..color = Colors.black
        ..strokeWidth = strokeWidth,
    );
  }

  @override
  bool shouldRepaint(covariant _RulerGlyphPainter oldDelegate) =>
      oldDelegate.strokeWidth != strokeWidth;
}

class TopBottomMeasurementRow extends StatefulWidget {
  const TopBottomMeasurementRow({
    super.key,
    required this.label,
    required this.valueRaw,
    required this.unit,
    required this.onValueChange,
    required this.onUnitChange,
    required this.onHelp,
    required this.fieldHeight,
    required this.unitBoxWidth,
    required this.unitBoxHeight,
    required this.helpSize,
    this.errorText,
  });

  final String label;
  final String valueRaw;
  final HeightUnit unit;
  final ValueChanged<String> onValueChange;
  final ValueChanged<HeightUnit> onUnitChange;
  final VoidCallback onHelp;
  final double fieldHeight;
  final double unitBoxWidth;
  final double unitBoxHeight;
  final double helpSize;
  final String? errorText;

  @override
  State<TopBottomMeasurementRow> createState() =>
      _TopBottomMeasurementRowState();
}

class _TopBottomMeasurementRowState extends State<TopBottomMeasurementRow> {
  late final TextEditingController _controller;

  @override
  void initState() {
    super.initState();
    _controller = TextEditingController(text: widget.valueRaw);
  }

  @override
  void didUpdateWidget(covariant TopBottomMeasurementRow oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.valueRaw != oldWidget.valueRaw) {
      _controller.value = TextEditingValue(
        text: widget.valueRaw,
        selection: TextSelection.collapsed(offset: widget.valueRaw.length),
      );
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final gap = scaleDp(context, 10);
    final labelSize = scaleSp(context, 18);
    final rowGap = scaleDp(context, 14);
    final glyph = scaleDp(context, 32);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            MeasurementLeftGlyph(size: glyph),
            SizedBox(width: scaleDp(context, 12)),
            Expanded(
              child: Text(
                widget.label,
                style: AppFonts.poppins(
                  context,
                  fontSize: labelSize,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
          ],
        ),
        SizedBox(height: gap),
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: SizedBox(
                height: widget.fieldHeight,
                child: TextField(
                  controller: _controller,
                  keyboardType: const TextInputType.numberWithOptions(
                    decimal: true,
                  ),
                  inputFormatters: [
                    FilteringTextInputFormatter.allow(RegExp(r'[0-9.]')),
                    LengthLimitingTextInputFormatter(6),
                  ],
                  onChanged: (s) =>
                      widget.onValueChange(sanitizeDecimal(s)),
                  style: AppFonts.poppins(
                    context,
                    fontSize: scaleSp(context, 16),
                  ),
                  decoration: InputDecoration(
                    hintText: 'our...secret..........',
                    errorText: widget.errorText,
                  ),
                ),
              ),
            ),
            SizedBox(width: rowGap),
            HeightUnitPicker(
              unit: widget.unit,
              onChanged: widget.onUnitChange,
              width: widget.unitBoxWidth,
              height: widget.unitBoxHeight,
            ),
            SizedBox(width: rowGap),
            HelpQuestionIcon(size: widget.helpSize, onTap: widget.onHelp),
          ],
        ),
      ],
    );
  }
}
