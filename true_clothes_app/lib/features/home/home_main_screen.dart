import 'dart:math';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/widget_previews.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../core/responsive.dart';
import '../../fit/my_body_measurements.dart';
import '../../main_nav_shell.dart';
import '../../outfit/outfit.dart';
import '../../theme/app_theme.dart';
import '../../theme/widget_preview_theme.dart';
import '../../theme/app_colors.dart';
import '../../theme/app_fonts.dart';
import '../../widgets/outfit_composition_card_placeholder.dart';
import 'home_outfit_models.dart';
import 'outfit_detail_screen.dart';

/// Deterministic shuffle for the day: same user + calendar day → same order until
/// midnight (then [OutfitSuggestionCoordinator] may reorder).
int _outfitListShuffleSeed(String userId, DateTime date) {
  return Object.hash(userId, date.year, date.month, date.day);
}

void _outfitHomeDebugLog(String message) {
  if (kDebugMode) {
    debugPrint('[OutfitHome] $message');
  }
}

/// The scrollable content of the Home tab — no [Scaffold], so it can live
/// inside [MainNavShell]'s [IndexedStack] without nesting Scaffolds.
///
/// Port of Kotlin `HomeMainScreen.kt` + `design/screen/home/main/design.md`.
class HomeMainContent extends StatefulWidget {
  const HomeMainContent({super.key});

  @override
  HomeMainContentState createState() => HomeMainContentState();
}

class HomeMainContentState extends State<HomeMainContent> {
  static const _tabTitles = ['Outfit', 'Favourite', 'Closet'];

  /// Pool size before dedupe + shuffle (see [OutfitSuggestionCoordinator]).
  static const _homeOutfitPoolTopN = 24;

  int _tabIndex = 0;

  List<OutfitDetailPayload> _outfitPayloads = const [];
  bool _outfitFromEngine = false;
  bool _outfitLoaded = false;

  final PageController _outfitPageController = PageController();

  static final _suggestionCoordinator = OutfitSuggestionCoordinator(
    source: const BruteForceOutfitCandidateSource(topN: _homeOutfitPoolTopN),
    presentation: const ShuffledPresentation(),
    dedupeBatch: true,
  );

  @override
  void initState() {
    super.initState();
    _loadRankedOutfit();
  }

  @override
  void dispose() {
    _outfitPageController.dispose();
    super.dispose();
  }

  /// Reload ranked outfit from local store (e.g. when user returns to Home tab).
  Future<void> refreshOutfit() => _loadRankedOutfit();

  Future<void> _loadRankedOutfit() async {
    _outfitHomeDebugLog('Home load: start');
    final prefs = await SharedPreferences.getInstance();
    await ensureDefaultCatalogWardrobe(prefs);
    final repo = LocalWardrobeRepository(prefs);
    final items = await repo.listWardrobeItems();
    final savedBody = await repo.loadBodyProfile();
    final body = savedBody ?? kMyBodyMeasurementsCm;
    _outfitHomeDebugLog(
      'after ensureDefaultCatalogWardrobe: ${items.length} items; '
      'body=${savedBody != null ? 'savedProfile' : 'kMyBodyMeasurementsCm'} '
      '(bust=${body.bust} shoulder=${body.shoulderWidth})',
    );
    final colour = await repo.loadColourPreference();
    final userId = await ensureLocalUserId(prefs);
    final now = DateTime.now();
    final rankingContext = OutfitRankingContext(
      seedUserId: userId,
      date: now,
      colourPreferenceId: colour?.id,
      favouriteStyleTags: const ['old money', 'quiet luxury'],
      styleConfigId: 'old-money',
    );
    final shuffle = Random(_outfitListShuffleSeed(userId, now));
    final ranked = _suggestionCoordinator.run(
      body: body,
      items: items,
      context: rankingContext,
      random: shuffle,
      debugLog: kDebugMode ? _outfitHomeDebugLog : null,
    );
    _outfitHomeDebugLog(
      'result: ${ranked.length} outfit(s) for UI (_outfitFromEngine=${ranked.isNotEmpty})',
    );
    if (kDebugMode && ranked.isNotEmpty) {
      final c = ranked.first;
      _outfitHomeDebugLog(
        'first outfit garmentColors: top=${c.top.primaryColor} '
        'bottom=${c.bottom.primaryColor} shoes=${c.shoes.primaryColor}'
        '${c.outer != null ? ' outer=${c.outer!.primaryColor}' : ''}',
      );
      _outfitHomeDebugLog(
        'first outfit imagePaths: top=${c.top.imagePath} bottom=${c.bottom.imagePath} '
        'shoes=${c.shoes.imagePath}${c.outer != null ? ' outer=${c.outer!.imagePath}' : ''}',
      );
      final firstPayload = outfitDetailPayloadFromCandidate(c, body);
      final src = firstPayload.toCompositionSources();
      _outfitHomeDebugLog(
        'composition asset keys → shirt=${src.shirt} pants=${src.pants} '
        'jacket=${src.jacket} shoes=${src.shoes} bag=${src.bag}',
      );
      _outfitHomeDebugLog(
        'item display colors: '
        '${firstPayload.items.map((e) => '${e.name}:${e.itemColor}').join('; ')}',
      );
    }
    if (!mounted) return;
    setState(() {
      if (ranked.isNotEmpty) {
        _outfitPayloads = [
          for (var i = 0; i < ranked.length; i++)
            outfitDetailPayloadFromCandidate(ranked[i], body),
        ];
        _outfitFromEngine = true;
      } else {
        _outfitPayloads = [demoOutfitDetailPayload()];
        _outfitFromEngine = false;
      }
      _outfitLoaded = true;
    });
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      if (_outfitPageController.hasClients) {
        _outfitPageController.jumpToPage(0);
      }
    });
  }

  void _openOutfitDetail(OutfitDetailPayload outfit) {
    Navigator.of(context).push<void>(
      MaterialPageRoute<void>(
        builder: (ctx) => OutfitDetailScreen(
          outfit: outfit,
          onBack: () => Navigator.of(ctx).pop(),
        ),
      ),
    );
  }

  /// Matches Kotlin `underlineWidthBeforeFinalLetter` / design tab indicator.
  double _tabUnderlineWidth(String text, TextStyle style) {
    if (text.length <= 1) return 0;
    final tp = TextPainter(
      text: TextSpan(text: text, style: style),
      textDirection: TextDirection.ltr,
      maxLines: 1,
    )..layout(minWidth: 0, maxWidth: double.infinity);
    final boxes = tp.getBoxesForSelection(
      TextSelection(baseOffset: text.length - 1, extentOffset: text.length),
    );
    if (boxes.isEmpty) return 0;
    return boxes.first.left.clamp(0.0, double.infinity);
  }

  Widget _luxuryOutfitPlaceholderRow(BuildContext context, String label) {
    final r = scaleDp(context, 12);
    return Semantics(
      label: 'Outfit preview placeholder, $label',
      child: Container(
        height: scaleDp(context, 180),
        decoration: BoxDecoration(
          color: Colors.white.withValues(alpha: 0.12),
          borderRadius: BorderRadius.circular(r),
          border: Border.all(
            color: Colors.white.withValues(alpha: 0.25),
            width: scaleDp(context, 1),
          ),
        ),
        alignment: Alignment.center,
        padding: EdgeInsets.symmetric(horizontal: scaleDp(context, 16)),
        child: Text(
          label,
          maxLines: 2,
          overflow: TextOverflow.ellipsis,
          textAlign: TextAlign.center,
          style: AppFonts.poppins(
            context,
            fontSize: scaleSp(context, 14),
            fontWeight: FontWeight.w600,
            color: Colors.white,
          ),
        ),
      ),
    );
  }

  static const _navOverlapBottomPad = 100.0;

  /// One full-viewport page per outfit (vertical snap, TikTok-style).
  Widget _buildOutfitPager(double padH) {
    final bottomPad = scaleDp(context, _navOverlapBottomPad);
    if (!_outfitLoaded) {
      return Center(
        child: Padding(
          padding: EdgeInsets.symmetric(horizontal: padH),
          child: const CircularProgressIndicator(),
        ),
      );
    }

    Widget pageFor(OutfitDetailPayload outfit, int index, int total) {
      return Padding(
        padding: EdgeInsets.fromLTRB(0, 0, 0, 0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (!_outfitFromEngine) ...[
              Text(
                'Add tops, bottoms, and shoes to your closet to get outfits built '
                'from your wardrobe.',
                textAlign: TextAlign.center,
                style: AppFonts.poppins(
                  context,
                  fontSize: scaleSp(context, 12),
                  color: Colors.white.withValues(alpha: 0.85),
                ),
              ),
              SizedBox(height: scaleDp(context, 12)),
            ],
            Expanded(
              child: Align(
                alignment: Alignment.topCenter,
                child: Padding(
                  padding: EdgeInsets.only(top: scaleDp(context, 8)),
                  child: Semantics(
                    button: true,
                    label: total > 1
                        ? 'Suggested outfit ${index + 1} of $total, open details'
                        : 'Suggested outfit, open details',
                    child: InkWell(
                      onTap: () => _openOutfitDetail(outfit),
                      child: Padding(
                        padding: EdgeInsets.symmetric(
                          horizontal: scaleDp(context, 3),
                        ),
                        child: OutfitCompositionCardPlaceholder(
                          sources: outfit.toCompositionSources(),
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
      );
    }

    if (!_outfitFromEngine) {
      return PageView(
        scrollDirection: Axis.vertical,
        controller: _outfitPageController,
        children: [pageFor(_outfitPayloads.first, 0, 1)],
      );
    }

    return PageView.builder(
      scrollDirection: Axis.vertical,
      controller: _outfitPageController,
      itemCount: _outfitPayloads.length,
      itemBuilder: (context, index) {
        return pageFor(_outfitPayloads[index], index, _outfitPayloads.length);
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final padH = scaleDp(context, 24);
    final padTop = scaleDp(context, 36);
    final titleSize = scaleSp(context, 28);
    final lineHeight = scaleSp(context, 40);
    const inactiveOpacity = 0.7;

    final tabStyle = AppFonts.poppins(
      context,
      fontSize: scaleSp(context, 14),
      fontWeight: FontWeight.normal,
      letterSpacing: 0.10 * scaleSp(context, 14),
    );

    // Full-screen gradient container — bottom: false so the floating nav circles
    // in MainNavShell can overlap the bottom area without clipping.
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
        bottom: false,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Padding(
              padding: EdgeInsets.fromLTRB(padH, padTop, padH, 0),
              child: Text(
                'TRUE CLOTHES',
                style: AppFonts.playfairDisplay(
                  context,
                  fontSize: titleSize,
                  fontWeight: FontWeight.bold,
                  color: AppColors.homeLogotype,
                  height: lineHeight / titleSize,
                  letterSpacing: 0.06 * titleSize,
                ),
              ),
            ),
            Padding(
              padding: EdgeInsets.fromLTRB(
                scaleDp(context, 40),
                scaleDp(context, 10),
                scaleDp(context, 40),
                scaleDp(context, 10),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                crossAxisAlignment: CrossAxisAlignment.center,
                children: List.generate(_tabTitles.length, (i) {
                  final active = _tabIndex == i;
                  final title = _tabTitles[i];
                  final color = Colors.white.withValues(
                    alpha: active ? 1.0 : inactiveOpacity,
                  );
                  final style = tabStyle.copyWith(color: color);
                  final uw = active ? _tabUnderlineWidth(title, style) : 0.0;

                  return Semantics(
                    selected: active,
                    button: true,
                    label: '$title tab${active ? ', selected' : ''}',
                    child: InkWell(
                      onTap: () => setState(() => _tabIndex = i),
                      child: Padding(
                        padding: EdgeInsets.symmetric(
                          horizontal: scaleDp(context, 4),
                          vertical: scaleDp(context, 8),
                        ),
                        child: ConstrainedBox(
                          constraints: BoxConstraints(
                            minHeight: scaleDp(context, 48),
                          ),
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            crossAxisAlignment: CrossAxisAlignment.start,
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Text(
                                title,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: style,
                              ),
                              if (active && uw > 0) ...[
                                SizedBox(height: scaleDp(context, 5)),
                                Container(
                                  height: scaleDp(context, 1.5),
                                  width: uw,
                                  color: Colors.white.withValues(alpha: 1.0),
                                ),
                              ],
                            ],
                          ),
                        ),
                      ),
                    ),
                  );
                }),
              ),
            ),
            Expanded(
              child: _tabIndex == 0
                  ? _buildOutfitPager(padH)
                  : ListView(
                      padding: EdgeInsets.only(
                        bottom: scaleDp(context, _navOverlapBottomPad),
                      ),
                      children: [
                        Padding(
                          padding: EdgeInsets.symmetric(horizontal: padH),
                          child: Column(
                            children: [
                              _luxuryOutfitPlaceholderRow(
                                context,
                                '${_tabIndex == 1 ? 'Favourite' : 'Closet'} outfit #1',
                              ),
                              SizedBox(height: scaleDp(context, 2)),
                              _luxuryOutfitPlaceholderRow(
                                context,
                                '${_tabIndex == 1 ? 'Favourite' : 'Closet'} outfit #2',
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
            ),
          ],
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Thin shell — used only for standalone widget preview.
// ---------------------------------------------------------------------------

/// Standalone wrapper around [HomeMainContent] with its own [Scaffold].
/// In the real app [HomeMainContent] lives inside [MainNavShell].
class HomeMainScreen extends StatelessWidget {
  const HomeMainScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.homeGradientBottom,
      body: const HomeMainContent(),
    );
  }
}

// ---------------------------------------------------------------------------
// Widget preview
// ---------------------------------------------------------------------------

@Preview(
  name: 'Home main',
  group: 'Home',
  size: Size(402, 874),
  theme: trueClothesPreviewTheme,
)
Widget homeMainWidgetPreview() {
  // Use MainNavShell so the preview includes the floating circular nav buttons.
  return MaterialApp(
    debugShowCheckedModeBanner: false,
    theme: buildAppTheme(),
    home: const MainNavShell(),
  );
}
