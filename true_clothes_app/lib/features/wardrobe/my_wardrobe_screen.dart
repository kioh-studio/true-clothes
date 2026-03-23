import 'package:flutter/material.dart';
import 'package:flutter/widget_previews.dart';

import '../../core/responsive.dart';
import '../../theme/app_colors.dart';
import '../../theme/app_fonts.dart';
import '../../theme/app_theme.dart';
import '../../theme/widget_preview_theme.dart';
import '../../widgets/true_back_button.dart';
import '../../widgets/true_dropdown.dart';
import '../../widgets/true_item_slider.dart';
import '../../widgets/true_search_bar.dart';
import '../../widgets/true_tab_bar.dart';
import '../home/item_detail_screen.dart';
import 'collections_tab_view.dart';
import 'new_item_screen.dart';
import 'wardrobe_demo_data.dart';

/// My Wardrobe — browsable list of all wardrobe items by category.
/// Implements `design/screen/my-wardrobe/design.md`.
///
/// Pushed via [Navigator.push] from [WardrobeMenuContent]; has its own
/// [Scaffold] because it is not part of the [MainNavShell] IndexedStack.
class MyWardrobeScreen extends StatefulWidget {
  const MyWardrobeScreen({super.key, this.onBack, this.initialTabIndex = 0});

  final VoidCallback? onBack;
  final int initialTabIndex;

  @override
  State<MyWardrobeScreen> createState() => _MyWardrobeScreenState();
}

class _MyWardrobeScreenState extends State<MyWardrobeScreen> {
  static const _tabLabels = ['Closet', 'Collections', 'By tags'];
  static const _categories = [
    'Top',
    'Bottom',
    'Outerwear',
    'Shoes',
    'Accessory',
    'Bag',
  ];

  late int _tabIndex = widget.initialTabIndex;
  String _selectedCategory = _categories.first;
  String _searchQuery = '';
  final _searchController = TextEditingController();
  final _searchFocusNode = FocusNode();

  List<WardrobeItem> get _filteredItems {
    final items = demoWardrobeItems[_selectedCategory] ?? [];
    if (_searchQuery.isEmpty) return items;
    final query = _searchQuery.toLowerCase();
    return items.where((i) => i.name.toLowerCase().contains(query)).toList();
  }

  @override
  void dispose() {
    _searchController.dispose();
    _searchFocusNode.dispose();
    super.dispose();
  }

  void _handleBack() {
    if (widget.onBack != null) {
      widget.onBack!();
    } else {
      Navigator.of(context).maybePop();
    }
  }

  Widget _buildTabContent(BuildContext context, List<WardrobeItem> items) {
    switch (_tabIndex) {
      case 0:
        return TrueItemSlider(
          itemCount: items.length,
          itemBuilder: (context, index, isPrimary) {
            final item = items[index];
            return Semantics(
              button: true,
              label: '${item.name}, open details',
              child: GestureDetector(
                onTap: () => _openItemDetail(item),
                child: _ItemCardImage(item: item),
              ),
            );
          },
        );
      case 1:
        return CollectionsTabView(searchQuery: _searchQuery);
      default:
        return _PlaceholderTab(label: _tabLabels[_tabIndex]);
    }
  }

  void _openItemDetail(WardrobeItem item) {
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

  @override
  Widget build(BuildContext context) {
    final padH = scaleDp(context, 20);
    final items = _filteredItems;

    return Scaffold(
      backgroundColor: AppColors.mainBackground,
      body: SafeArea(
        child: Stack(
          children: [
            Column(
              children: [
                // ── Header ───────────────────────────────────────────────
                _Header(onBack: _handleBack),
                SizedBox(height: scaleDp(context, 24)),

                // ── Search ───────────────────────────────────────────────
                Padding(
                  padding: EdgeInsets.symmetric(horizontal: padH),
                  child: TrueSearchBar(
                    controller: _searchController,
                    focusNode: _searchFocusNode,
                    onChanged: (q) => setState(() => _searchQuery = q),
                  ),
                ),
                SizedBox(height: scaleDp(context, 20)),

                // ── Tabs ─────────────────────────────────────────────────
                Padding(
                  padding: EdgeInsets.symmetric(horizontal: padH),
                  child: TrueTabBar(
                    labels: _tabLabels,
                    selectedIndex: _tabIndex,
                    onSelected: (i) => setState(() => _tabIndex = i),
                  ),
                ),
                SizedBox(height: scaleDp(context, 16)),

                // ── Category dropdown (Closet only) ──────────────────────
                if (_tabIndex == 0) ...[
                  Padding(
                    padding: EdgeInsets.symmetric(horizontal: padH),
                    child: TrueDropdown(
                      options: _categories,
                      selected: _selectedCategory,
                      onChanged: (c) => setState(() => _selectedCategory = c),
                    ),
                  ),
                  SizedBox(height: scaleDp(context, 16)),
                ],

                // ── Content area ─────────────────────────────────────────
                Expanded(child: _buildTabContent(context, items)),
              ],
            ),
            _Fab(onTap: () {
              Navigator.of(context).push<void>(
                MaterialPageRoute<void>(
                  builder: (_) => const NewItemScreen(),
                ),
              );
            }),
          ],
        ),
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
      padding: EdgeInsets.only(
        left: padH,
        right: padH,
        top: scaleDp(context, 16),
      ),
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
              'My Wardrobe',
              style: AppFonts.playfairDisplay(
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
// Item card image — loads from local asset, network URL, or shows placeholder
// ---------------------------------------------------------------------------

class _ItemCardImage extends StatelessWidget {
  const _ItemCardImage({required this.item});

  final WardrobeItem item;

  @override
  Widget build(BuildContext context) {
    final url = item.imageUrl;
    if (url == null || url.isEmpty) {
      return Center(
        child: Icon(
          Icons.checkroom,
          size: scaleDp(context, 48),
          color: Colors.black.withValues(alpha: 0.25),
        ),
      );
    }

    final placeholder = Container(
      color: const Color(0xFFDCDCDC),
      child: Center(
        child: Icon(
          Icons.checkroom,
          size: scaleDp(context, 36),
          color: Colors.black.withValues(alpha: 0.15),
        ),
      ),
    );

    if (item.isAssetImage) {
      return Image.asset(
        url,
        fit: BoxFit.cover,
        width: double.infinity,
        height: double.infinity,
        errorBuilder: (_, e, st) => placeholder,
      );
    }

    return Image.network(
      url,
      fit: BoxFit.cover,
      width: double.infinity,
      height: double.infinity,
      loadingBuilder: (_, child, progress) {
        if (progress == null) return child;
        return placeholder;
      },
      errorBuilder: (_, e, st) => placeholder,
    );
  }
}

// ---------------------------------------------------------------------------
// Placeholder tab for Collections / By tags (future scope)
// ---------------------------------------------------------------------------

class _PlaceholderTab extends StatelessWidget {
  const _PlaceholderTab({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Text(
        '$label \u2014 coming soon',
        style: AppFonts.poppins(
          context,
          fontSize: scaleSp(context, 14),
          fontWeight: FontWeight.w400,
          color: Colors.black.withValues(alpha: 0.45),
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// FAB — floating "add item" button, bottom-right
// ---------------------------------------------------------------------------

class _Fab extends StatelessWidget {
  const _Fab({required this.onTap});

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final fabW = scaleDp(context, 73);
    final fabH = scaleDp(context, 67);

    return Positioned(
      right: scaleDp(context, 20),
      bottom: scaleDp(context, 16),
      child: Semantics(
        button: true,
        label: 'Add new item',
        child: GestureDetector(
          onTap: onTap,
          child: Container(
            width: fabW,
            height: fabH,
            decoration: BoxDecoration(
              color: const Color(0xFFFFFFFF),
              borderRadius: BorderRadius.circular(scaleDp(context, 5)),
              border: Border.all(
                color: Colors.black,
                width: scaleDp(context, 0.3),
              ),
            ),
            child: Icon(
              Icons.add,
              color: const Color(0xFF1E1E1E),
              size: scaleDp(context, 32),
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

class MyWardrobeScreenPreview extends StatelessWidget {
  const MyWardrobeScreenPreview({super.key, this.initialTabIndex = 0});

  final int initialTabIndex;

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      theme: buildAppTheme(),
      home: MyWardrobeScreen(initialTabIndex: initialTabIndex),
    );
  }
}

class CollectionsPreview extends StatelessWidget {
  const CollectionsPreview({super.key});

  @override
  Widget build(BuildContext context) {
    return const MyWardrobeScreenPreview(initialTabIndex: 1);
  }
}

@Preview(
  name: 'My Wardrobe',
  group: 'Wardrobe',
  size: Size(402, 874),
  theme: trueClothesPreviewTheme,
)
Widget myWardrobeWidgetPreview() {
  return const MyWardrobeScreenPreview();
}

@Preview(
  name: 'Collections',
  group: 'Wardrobe',
  size: Size(402, 874),
  theme: trueClothesPreviewTheme,
)
Widget collectionsWidgetPreview() {
  return const CollectionsPreview();
}
