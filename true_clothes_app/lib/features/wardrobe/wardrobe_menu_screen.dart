import 'package:flutter/material.dart';
import 'package:flutter/widget_previews.dart';

import '../../core/responsive.dart';
import '../../main_nav_shell.dart';
import '../../theme/app_colors.dart';
import '../../theme/app_fonts.dart';
import '../../theme/app_theme.dart';
import '../../theme/widget_preview_theme.dart';
import 'my_wardrobe_screen.dart';

/// Wardrobe menu — central hub for closet and outfit management.
/// Implements `true_clothes_app/design/screen/build-wardrobe/design.md`.
///
/// Lives inside [MainNavShell]'s [IndexedStack]; no nested Scaffold.
class WardrobeMenuContent extends StatelessWidget {
  const WardrobeMenuContent({super.key});

  @override
  Widget build(BuildContext context) {
    final hPad = scaleDp(context, 22);

    return ColoredBox(
      color: AppColors.mainBackground,
      child: SafeArea(
        bottom: false,
        child: SingleChildScrollView(
          padding: EdgeInsets.only(
            left: hPad,
            right: hPad,
            top: scaleDp(context, 75),
            bottom: scaleDp(context, 100),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // ── Section 1: Closet ──────────────────────────────────────
              _SectionHeader(title: 'Closet'),
              _OptionRow(
                icon: Icons.shelves,
                label: 'My wardrobe',
                semanticsHint: 'Open wardrobe',
                onTap: () {
                  Navigator.of(context).push<void>(
                    MaterialPageRoute<void>(
                      builder: (_) => const MyWardrobeScreen(),
                    ),
                  );
                },
              ),

              SizedBox(height: scaleDp(context, 34)),

              // ── Section 2: Outfit ──────────────────────────────────────
              _SectionHeader(title: 'Outfit'),
              _OptionRow(
                icon: Icons.checkroom,
                label: 'Build your outfit',
                semanticsHint: 'Open outfit builder',
                onTap: () {},
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Section header — title + underline
// ---------------------------------------------------------------------------

class _SectionHeader extends StatelessWidget {
  const _SectionHeader({required this.title});

  final String title;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(bottom: scaleDp(context, 22)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Semantics(
            header: true,
            child: Text(
              title,
              style: AppFonts.poppins(
                context,
                fontSize: scaleSp(context, 24),
                fontWeight: FontWeight.w700,
                color: Colors.black,
              ),
            ),
          ),
          SizedBox(height: scaleDp(context, 10)),
          Container(
            width: scaleDp(context, 100),
            height: scaleDp(context, 1),
            color: Colors.black,
          ),
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Option row — icon + label, tappable
// ---------------------------------------------------------------------------

class _OptionRow extends StatelessWidget {
  const _OptionRow({
    required this.icon,
    required this.label,
    required this.semanticsHint,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final String semanticsHint;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final iconSize = scaleDp(context, 23);

    return Semantics(
      button: true,
      label: '$label, $semanticsHint',
      child: InkWell(
        onTap: onTap,
        child: ConstrainedBox(
          constraints: BoxConstraints(minHeight: scaleDp(context, 48)),
          child: Row(
            children: [
              Icon(icon, size: iconSize, color: Colors.black),
              SizedBox(width: scaleDp(context, 10)),
              Expanded(
                child: Text(
                  label,
                  style: AppFonts.poppins(
                    context,
                    fontSize: scaleSp(context, 14),
                    fontWeight: FontWeight.w400,
                    color: Colors.black,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Widget Previewer
// ---------------------------------------------------------------------------

class WardrobeMenuScreenPreview extends StatelessWidget {
  const WardrobeMenuScreenPreview({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      theme: buildAppTheme(),
      home: const MainNavShell(initialIndex: 1),
    );
  }
}

@Preview(
  name: 'Wardrobe menu',
  group: 'Home',
  size: Size(402, 874),
  theme: trueClothesPreviewTheme,
)
Widget wardrobeMenuWidgetPreview() {
  return const WardrobeMenuScreenPreview();
}
