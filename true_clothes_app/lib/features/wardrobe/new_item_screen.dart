import 'package:flutter/material.dart';
import 'package:flutter/widget_previews.dart';

import '../../core/responsive.dart';
import '../../theme/app_colors.dart';
import '../../theme/app_fonts.dart';
import '../../theme/app_theme.dart';
import '../../theme/widget_preview_theme.dart';
import '../../widgets/true_back_button.dart';
import 'add_item_models.dart';
import 'complete_item_screen.dart';

/// Step 1 of the "Add Item" flow — capture photo, name, type, description.
/// Design spec: `design/screen/add-item/design.md` → step_1_layout.
class NewItemScreen extends StatefulWidget {
  const NewItemScreen({super.key, this.onBack});

  final VoidCallback? onBack;

  @override
  State<NewItemScreen> createState() => _NewItemScreenState();
}

class _NewItemScreenState extends State<NewItemScreen> {
  final _data = NewItemData();
  final _nameController = TextEditingController();
  final _descController = TextEditingController();
  final _nameFocusNode = FocusNode();
  final _descFocusNode = FocusNode();

  bool _nameError = false;

  @override
  void dispose() {
    _nameController.dispose();
    _descController.dispose();
    _nameFocusNode.dispose();
    _descFocusNode.dispose();
    super.dispose();
  }

  bool get _canProceed => _nameController.text.trim().isNotEmpty;

  void _handleNext() {
    if (!_canProceed) {
      setState(() => _nameError = true);
      _nameFocusNode.requestFocus();
      return;
    }

    _data.name = _nameController.text.trim();
    _data.description = _descController.text.trim();

    Navigator.of(context).push<void>(
      MaterialPageRoute<void>(
        builder: (ctx) => CompleteItemScreen(
          data: _data,
          onComplete: () {
            Navigator.of(ctx).popUntil((route) => route.isFirst);
          },
        ),
      ),
    );
  }

  void _handleBack() {
    if (widget.onBack != null) {
      widget.onBack!();
    } else {
      Navigator.of(context).maybePop();
    }
  }

  void _handleImageTap() {
    // Future: open camera/gallery picker
  }

  @override
  Widget build(BuildContext context) {
    final padH = scaleDp(context, 30);

    return Scaffold(
      backgroundColor: AppColors.mainBackground,
      body: SafeArea(
        child: SingleChildScrollView(
          padding: EdgeInsets.only(bottom: scaleDp(context, 20)),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _Header(onBack: _handleBack),
              SizedBox(height: scaleDp(context, 24)),
              _ImageCapture(onTap: _handleImageTap, imagePath: _data.imagePath),
              SizedBox(height: scaleDp(context, 32)),
              Padding(
                padding: EdgeInsets.symmetric(horizontal: padH),
                child: _buildNameField(context),
              ),
              SizedBox(height: scaleDp(context, 20)),
              Padding(
                padding: EdgeInsets.symmetric(horizontal: padH),
                child: _buildTypeDropdown(context),
              ),
              SizedBox(height: scaleDp(context, 20)),
              Padding(
                padding: EdgeInsets.symmetric(horizontal: padH),
                child: _buildDescriptionField(context),
              ),
              SizedBox(height: scaleDp(context, 160)),
              _NextButton(onTap: _handleNext),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildNameField(BuildContext context) {
    return _FormField(
      label: 'Name',
      required: true,
      child: _ThinBorderInput(
        controller: _nameController,
        focusNode: _nameFocusNode,
        hasError: _nameError,
        onChanged: (v) {
          if (_nameError && v.trim().isNotEmpty) {
            setState(() => _nameError = false);
          }
        },
        textInputAction: TextInputAction.next,
        onSubmitted: (_) => _descFocusNode.requestFocus(),
      ),
    );
  }

  Widget _buildTypeDropdown(BuildContext context) {
    return _FormField(
      label: 'Type',
      required: true,
      child: _TypeDropdown(
        value: _data.type,
        onChanged: (t) => setState(() => _data.type = t),
      ),
    );
  }

  Widget _buildDescriptionField(BuildContext context) {
    return _FormField(
      label: 'Description',
      required: false,
      child: _ThinBorderInput(
        controller: _descController,
        focusNode: _descFocusNode,
        textInputAction: TextInputAction.done,
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Header: back button + centred title
// ---------------------------------------------------------------------------

class _Header extends StatelessWidget {
  const _Header({required this.onBack});
  final VoidCallback onBack;

  @override
  Widget build(BuildContext context) {
    final padH = scaleDp(context, 20);
    return Padding(
      padding: EdgeInsets.only(left: padH, right: padH, top: scaleDp(context, 16)),
      child: SizedBox(
        height: scaleDp(context, 40),
        child: Stack(
          alignment: Alignment.center,
          children: [
            Align(
              alignment: Alignment.centerLeft,
              child: TrueBackButton(onTap: onBack),
            ),
            Text(
              'New item',
              style: AppFonts.poppins(
                context,
                fontSize: scaleSp(context, 22),
                fontWeight: FontWeight.bold,
                color: Colors.black,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Image capture area
// ---------------------------------------------------------------------------

class _ImageCapture extends StatelessWidget {
  const _ImageCapture({required this.onTap, this.imagePath});
  final VoidCallback onTap;
  final String? imagePath;

  @override
  Widget build(BuildContext context) {
    final w = scaleDp(context, 250);
    final h = scaleDp(context, 250);
    return Center(
      child: Semantics(
        button: true,
        label: 'Take item photo',
        child: GestureDetector(
          onTap: onTap,
          child: Container(
            width: w,
            height: h,
            decoration: BoxDecoration(
              color: const Color(0xFFD9D9D9),
              borderRadius: BorderRadius.circular(scaleDp(context, 8)),
            ),
            child: Icon(
              Icons.camera_alt_outlined,
              size: scaleDp(context, 48),
              color: Colors.black.withValues(alpha: 0.5),
            ),
          ),
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Form field wrapper with label + optional required asterisk
// ---------------------------------------------------------------------------

class _FormField extends StatelessWidget {
  const _FormField({required this.label, required this.required, required this.child});
  final String label;
  final bool required;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        RichText(
          text: TextSpan(
            text: label,
            style: AppFonts.poppins(
              context,
              fontSize: scaleSp(context, 14),
              fontWeight: FontWeight.w600,
              color: Colors.black,
            ),
            children: required
                ? [
                    TextSpan(
                      text: '*',
                      style: AppFonts.poppins(
                        context,
                        fontSize: scaleSp(context, 14),
                        fontWeight: FontWeight.w600,
                        color: const Color(0xFFF81010),
                      ),
                    ),
                  ]
                : null,
          ),
        ),
        SizedBox(height: scaleDp(context, 8)),
        child,
      ],
    );
  }
}

// ---------------------------------------------------------------------------
// Thin-bordered text input (matches SVG: stroke-width 0.5, black)
// ---------------------------------------------------------------------------

class _ThinBorderInput extends StatelessWidget {
  const _ThinBorderInput({
    required this.controller,
    this.focusNode,
    this.hasError = false,
    this.onChanged,
    this.textInputAction,
    this.onSubmitted,
  });

  final TextEditingController controller;
  final FocusNode? focusNode;
  final bool hasError;
  final ValueChanged<String>? onChanged;
  final TextInputAction? textInputAction;
  final ValueChanged<String>? onSubmitted;

  @override
  Widget build(BuildContext context) {
    final h = scaleDp(context, 39.5);
    final borderColor = hasError ? const Color(0xFFF81010) : Colors.black;

    return SizedBox(
      height: h,
      child: TextField(
        controller: controller,
        focusNode: focusNode,
        onChanged: onChanged,
        textInputAction: textInputAction,
        onSubmitted: onSubmitted,
        style: AppFonts.poppins(
          context,
          fontSize: scaleSp(context, 13),
          color: Colors.black,
        ),
        decoration: InputDecoration(
          filled: false,
          contentPadding: EdgeInsets.symmetric(
            horizontal: scaleDp(context, 12),
            vertical: scaleDp(context, 8),
          ),
          border: OutlineInputBorder(
            borderRadius: BorderRadius.zero,
            borderSide: BorderSide(color: borderColor, width: 0.5),
          ),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.zero,
            borderSide: BorderSide(color: borderColor, width: 0.5),
          ),
          focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.zero,
            borderSide: BorderSide(color: borderColor, width: 1),
          ),
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Type dropdown (thin border, matching design)
// ---------------------------------------------------------------------------

class _TypeDropdown extends StatelessWidget {
  const _TypeDropdown({required this.value, required this.onChanged});
  final ItemType value;
  final ValueChanged<ItemType> onChanged;

  @override
  Widget build(BuildContext context) {
    final h = scaleDp(context, 39.5);

    return Container(
      height: h,
      decoration: BoxDecoration(
        border: Border.all(color: Colors.black, width: 0.5),
      ),
      padding: EdgeInsets.symmetric(horizontal: scaleDp(context, 12)),
      child: DropdownButtonHideUnderline(
        child: DropdownButton<ItemType>(
          value: value,
          isExpanded: true,
          icon: Icon(
            Icons.arrow_drop_down,
            color: const Color(0xFF1D1B20),
            size: scaleDp(context, 20),
          ),
          style: AppFonts.poppins(
            context,
            fontSize: scaleSp(context, 13),
            color: Colors.black,
          ),
          items: ItemType.values.map((t) {
            return DropdownMenuItem(value: t, child: Text(t.label));
          }).toList(),
          onChanged: (t) {
            if (t != null) onChanged(t);
          },
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Next button — bottom-right floating
// ---------------------------------------------------------------------------

class _NextButton extends StatelessWidget {
  const _NextButton({required this.onTap});
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Align(
      alignment: Alignment.centerRight,
      child: Padding(
        padding: EdgeInsets.only(right: scaleDp(context, 20)),
        child: Semantics(
          button: true,
          label: 'Next, go to complete item',
          child: GestureDetector(
            onTap: onTap,
            child: Container(
              width: scaleDp(context, 60),
              height: scaleDp(context, 60),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(scaleDp(context, 15)),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.1),
                    blurRadius: 8,
                    offset: const Offset(0, 2),
                  ),
                ],
              ),
              child: Icon(
                Icons.arrow_forward,
                color: Colors.black,
                size: scaleDp(context, 28),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Preview wrappers
// ---------------------------------------------------------------------------

class NewItemScreenPreview extends StatelessWidget {
  const NewItemScreenPreview({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      theme: buildAppTheme(),
      home: const NewItemScreen(),
    );
  }
}

@Preview(
  name: 'New Item (step 1)',
  group: 'Add Item',
  size: Size(402, 874),
  theme: trueClothesPreviewTheme,
)
Widget newItemWidgetPreview() {
  return const NewItemScreenPreview();
}
