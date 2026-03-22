// UI preview entrypoint — same idea as Jetpack Compose @Preview in Android Studio.
//
// Run from terminal:
//   flutter run -t lib/preview/preview_main.dart
//
// Android Studio: Run → Edit Configurations → add Flutter configuration →
//   Additional run args: -t lib/preview/preview_main.dart

import 'package:flutter/material.dart';

import 'preview_gallery.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const PreviewGalleryApp());
}
