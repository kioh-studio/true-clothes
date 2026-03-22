Bundled fonts (optional)
------------------------
The Android project under c:\projects\app only had res/font/poppins.xml; the .ttf files were not in the repo.

This Flutter app uses the google_fonts package so Poppins and Playfair Display load at runtime (cached on device). INTERNET permission is enabled in AndroidManifest.xml for the first fetch.

To use offline bundled fonts instead:
1. Download from https://fonts.google.com — Poppins (Light, Regular, Medium, SemiBold) and Playfair Display (Bold, Medium).
2. Place .ttf files in this folder.
3. Add a "fonts:" section to pubspec.yaml (see Flutter docs).
4. Replace GoogleFonts.* calls in lib/theme/app_fonts.dart with TextStyle(fontFamily: 'Poppins', ...).
