import 'package:flutter/material.dart';

import '../theme/app_theme.dart';
import 'preview_host.dart';
import 'preview_pages.dart';

/// Catalog of UI previews (Kotlin `@Preview` / `@PreviewScreenSizes` equivalent).
class PreviewGalleryApp extends StatelessWidget {
  const PreviewGalleryApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'True Clothes — UI Previews',
      debugShowCheckedModeBanner: false,
      theme: buildAppTheme(),
      home: const _PreviewGalleryHome(),
    );
  }
}

class _PreviewEntry {
  const _PreviewEntry({
    required this.id,
    required this.name,
    required this.builder,
    this.useReferenceFrame = false,
  });

  final String id;
  final String name;
  final WidgetBuilder builder;
  final bool useReferenceFrame;
}

class _PreviewGalleryHome extends StatelessWidget {
  const _PreviewGalleryHome();

  static final List<_PreviewEntry> _entries = [
    _PreviewEntry(
      id: 'app',
      name: 'TrueclothesApp (full shell)',
      builder: previewTrueclothesApp,
    ),
    _PreviewEntry(
      id: 'gender',
      name: 'GenderOnboardingScreen',
      builder: previewGenderOnboarding,
      useReferenceFrame: true,
    ),
    _PreviewEntry(
      id: 'country',
      name: 'CountryOnboardingScreen',
      builder: previewCountryOnboarding,
      useReferenceFrame: true,
    ),
    _PreviewEntry(
      id: 'body',
      name: 'BodyMeasurementOnboardingScreen',
      builder: previewBodyMeasurementOnboarding,
      useReferenceFrame: true,
    ),
    _PreviewEntry(
      id: 'top',
      name: 'TopBodyMeasurementOnboardingScreen',
      builder: previewTopBodyMeasurementOnboarding,
      useReferenceFrame: true,
    ),
    _PreviewEntry(
      id: 'bottom',
      name: 'BottomBodyMeasurementOnboardingScreen',
      builder: previewBottomBodyMeasurementOnboarding,
      useReferenceFrame: true,
    ),
    _PreviewEntry(
      id: 'colour',
      name: 'ColourOnboardingScreen',
      builder: previewColourOnboarding,
      useReferenceFrame: true,
    ),
    _PreviewEntry(
      id: 'wardrobe',
      name: 'AddingWardrobeOnboardingScreen',
      builder: previewAddingWardrobeOnboarding,
      useReferenceFrame: true,
    ),
    _PreviewEntry(
      id: 'home',
      name: 'HomeMainScreen',
      builder: previewHomeMain,
    ),
    _PreviewEntry(
      id: 'progress',
      name: 'TrueProgressBar (gallery)',
      builder: previewTrueProgressBarGallery,
    ),
    _PreviewEntry(
      id: 'modal',
      name: 'TrueModal (stub)',
      builder: previewTrueModalSamples,
    ),
    _PreviewEntry(
      id: 'outfit',
      name: 'OutfitDetailScreen',
      builder: previewOutfitDetail,
      useReferenceFrame: true,
    ),
    _PreviewEntry(
      id: 'item',
      name: 'ItemDetailScreen',
      builder: previewItemDetail,
      useReferenceFrame: true,
    ),
    _PreviewEntry(
      id: 'my_wardrobe',
      name: 'MyWardrobeScreen',
      builder: previewMyWardrobe,
      useReferenceFrame: true,
    ),
    _PreviewEntry(
      id: 'collections',
      name: 'Collections (tab)',
      builder: previewCollections,
      useReferenceFrame: true,
    ),
    _PreviewEntry(
      id: 'new_item',
      name: 'NewItemScreen (step 1)',
      builder: previewNewItem,
      useReferenceFrame: true,
    ),
    _PreviewEntry(
      id: 'complete_item',
      name: 'CompleteItemScreen (step 2)',
      builder: previewCompleteItem,
      useReferenceFrame: true,
    ),
    _PreviewEntry(
      id: 'wardrobe_menu',
      name: 'WardrobeMenuScreen',
      builder: previewWardrobeMenu,
      useReferenceFrame: true,
    ),
    _PreviewEntry(
      id: 'user_profile',
      name: 'UserProfileScreen',
      builder: previewUserProfile,
      useReferenceFrame: true,
    ),
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text('UI Previews'),
            Text(
              'Kotlin @Preview equivalent',
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: Theme.of(context).colorScheme.onSurfaceVariant,
                  ),
            ),
          ],
        ),
      ),
      body: ListView.builder(
        itemCount: _entries.length,
        itemBuilder: (context, i) {
          final e = _entries[i];
          return Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (i > 0) const Divider(height: 1),
              ListTile(
                title: Text(e.name),
                subtitle: Text(e.id),
                trailing: e.useReferenceFrame
                    ? const Chip(
                        label: Text('402×874'),
                        visualDensity: VisualDensity.compact,
                      )
                    : null,
                onTap: () {
                  Navigator.of(context).push(
                    MaterialPageRoute<void>(
                      builder: (context) => PreviewHost(
                        title: e.name,
                        width: e.useReferenceFrame
                            ? PreviewHost.referenceWidth
                            : null,
                        height: e.useReferenceFrame
                            ? PreviewHost.referenceHeight
                            : null,
                        child: e.builder(context),
                      ),
                    ),
                  );
                },
              ),
            ],
          );
        },
      ),
    );
  }
}
