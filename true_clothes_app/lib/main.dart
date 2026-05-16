// True Clothes — Flutter port of `c:\projects\app` (Kotlin).
// Design reference: `true-clothes-docs/design/` (sibling repo).
//
// Android Studio: File → Open → select this `true_clothes_app` folder.
// Run `flutter pub get` once, then Run ▶ with a device or emulator.
//
// UI previews:
//   • Official @Preview (Flutter Widget Previewer / Chrome): flutter widget-preview start
//   • In-app gallery: flutter run -t lib/preview/preview_main.dart

import 'package:flutter/material.dart';

import 'app_shell.dart';
import 'outfit/style/bundled_style_configs.dart';
import 'outfit/style/style_registry.dart';
import 'theme/app_theme.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  StyleRegistry.instance.registerAll(kBundledStyleConfigs);
  runApp(const TrueClothesApp());
}

class TrueClothesApp extends StatelessWidget {
  const TrueClothesApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'True Clothes',
      debugShowCheckedModeBanner: false,
      theme: buildAppTheme(),
      home: const AppShell(),
    );
  }
}
