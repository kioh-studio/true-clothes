import 'package:flutter/material.dart';

import 'core/responsive.dart';
import 'features/home/home_main_screen.dart';
import 'features/profile/user_profile_screen.dart';
import 'features/wardrobe/wardrobe_menu_screen.dart';
import 'theme/app_colors.dart';
import 'theme/app_fonts.dart';

/// Root shell for the post-onboarding app.
///
/// Three floating circular nav buttons sit on the gradient background — matching
/// the `app/design/screen/home/main/main.svg` layout exactly:
///   • Left  (r=22.5dp): Home
///   • Center (r=35dp, selected state larger): Wardrobe
///   • Right  (r=22.5dp): Profile
///
/// All three circles have their **bottom edges aligned** (y=853 on the 874dp
/// reference canvas), positioned 21dp above the system bottom edge.
/// There is no opaque bar behind the circles — they float on the gradient.
class MainNavShell extends StatefulWidget {
  const MainNavShell({super.key, this.initialIndex = 0});

  final int initialIndex;

  @override
  State<MainNavShell> createState() => _MainNavShellState();
}

class _MainNavShellState extends State<MainNavShell> {
  late int _navIndex = widget.initialIndex;

  static const _pages = <Widget>[
    HomeMainContent(),
    WardrobeMenuContent(),
    UserProfileContent(),
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.homeGradientBottom,
      // No AppBar — each page handles its own top inset via SafeArea.
      body: Stack(
        children: [
          // Positioned.fill ensures IndexedStack gets tight constraints and
          // always fills the Stack — prevents loose-constraint shrink-wrapping.
          Positioned.fill(
            child: IndexedStack(
              index: _navIndex,
              sizing: StackFit.expand,
              children: _pages,
            ),
          ),

          // Floating circular navigation — overlaid on the gradient.
          // SafeArea(top:false) handles the system nav bar inset automatically;
          // the 21dp inner padding is the designed gap above the safe area edge.
          Positioned(
            left: 0,
            right: 0,
            bottom: 0,
            child: SafeArea(
              top: false,
              child: Padding(
                padding: EdgeInsets.only(bottom: scaleDp(context, 21)),
                child: _FloatingNavCircles(
                  currentIndex: _navIndex,
                  onSelected: (i) => setState(() => _navIndex = i),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Floating circular navigation
// ---------------------------------------------------------------------------

class _FloatingNavCircles extends StatelessWidget {
  const _FloatingNavCircles({
    required this.currentIndex,
    required this.onSelected,
  });

  final int currentIndex;
  final ValueChanged<int> onSelected;

  static const _destinations = [
    _NavDest(icon: Icons.home_outlined, activeIcon: Icons.home, label: 'Home'),
    _NavDest(
      icon: Icons.checkroom_outlined,
      activeIcon: Icons.checkroom,
      label: 'Wardrobe',
    ),
    _NavDest(
      icon: Icons.person_outline,
      activeIcon: Icons.person,
      label: 'Profile',
    ),
  ];

  @override
  Widget build(BuildContext context) {
    // Reference positions from main.svg (402dp canvas):
    //   Left  circle center x=54.5  → left edge = 54.5−22.5 = 32dp
    //   Center circle center x=201  → left edge = 201−35   = 166dp
    //   Right  circle center x=347.5→ left edge = 347.5−22.5= 325dp
    //
    // Gap between left-circle right edge and center left edge:
    //   166 − (32+45) = 89dp  (same gap on the other side).
    //
    // Inactive diameter = 45dp (r=22.5); Active diameter = 70dp (r=35).
    // Row uses CrossAxisAlignment.end so all bottom edges align.
    final dInactive = scaleDp(context, 45);
    final dActive = scaleDp(context, 70);
    final leftMargin = scaleDp(context, 32);
    final gap = scaleDp(context, 89);

    return Row(
      crossAxisAlignment: CrossAxisAlignment.end,
      children: [
        SizedBox(width: leftMargin),
        for (int i = 0; i < _destinations.length; i++) ...[
          if (i > 0) SizedBox(width: gap),
          _CircleNavItem(
            dest: _destinations[i],
            selected: currentIndex == i,
            diameter: currentIndex == i ? dActive : dInactive,
            onTap: () => onSelected(i),
          ),
        ],
        SizedBox(width: leftMargin),
      ],
    );
  }
}

class _NavDest {
  const _NavDest({
    required this.icon,
    required this.activeIcon,
    required this.label,
  });

  final IconData icon;
  final IconData activeIcon;
  final String label;
}

class _CircleNavItem extends StatelessWidget {
  const _CircleNavItem({
    required this.dest,
    required this.selected,
    required this.diameter,
    required this.onTap,
  });

  final _NavDest dest;
  final bool selected;
  final double diameter;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    // Icon size scales proportionally: 28dp inside active (70dp), 18dp inside inactive (45dp).
    final iconSize = selected ? scaleDp(context, 28) : scaleDp(context, 18);

    return Semantics(
      button: true,
      selected: selected,
      label: '${dest.label}${selected ? ', selected' : ''}',
      child: GestureDetector(
        onTap: onTap,
        child: Container(
          width: diameter,
          height: diameter,
          decoration: BoxDecoration(
            // Design fill: #FFFDFD — near-white circle floating on gradient.
            color: const Color(0xFFFFFDFD),
            shape: BoxShape.circle,
            // Shadow lifts the circle off the #DCDCDC gradient so it is
            // clearly visible — without it the near-white circle is invisible.
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.18),
                blurRadius: scaleDp(context, 10),
                offset: Offset(0, scaleDp(context, 3)),
              ),
            ],
          ),
          child: Icon(
            selected ? dest.activeIcon : dest.icon,
            size: iconSize,
            color: Colors.black,
          ),
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Shared gradient background helper used by content pages.
// ---------------------------------------------------------------------------

/// Wraps [child] in the same gradient background used by the home screen, with
/// top-only SafeArea so the floating nav circles can overlap at the bottom.
///
/// Content pages should add their own bottom scroll padding (~100dp) so that
/// the last list item is not obscured by the floating circles.
Widget buildPageBackground({
  required BuildContext context,
  required Widget child,
}) {
  return Container(
    decoration: BoxDecoration(
      gradient: LinearGradient(
        begin: Alignment.topCenter,
        end: Alignment.bottomCenter,
        stops: const [0, 0.24, 1],
        colors: [
          AppColors.homeGradientTop.withValues(
            alpha: AppColors.homeGradientTopAlpha,
          ),
          AppColors.homeGradientBottom,
          AppColors.homeGradientBottom,
        ],
      ),
    ),
    child: SafeArea(
      // bottom: false — the floating circles live above the system nav bar;
      // each page doesn't need to reserve extra bottom space for a nav bar widget.
      bottom: false,
      child: child,
    ),
  );
}

// ---------------------------------------------------------------------------
// Label style for the page title — shared across Wardrobe and Profile screens.
// ---------------------------------------------------------------------------
TextStyle pageTitleStyle(BuildContext context) => AppFonts.playfairDisplay(
      context,
      fontSize: scaleSp(context, 28),
      fontWeight: FontWeight.bold,
      color: AppColors.homeLogotype,
      height: scaleSp(context, 40) / scaleSp(context, 28),
      letterSpacing: 0.06 * scaleSp(context, 28),
    );
