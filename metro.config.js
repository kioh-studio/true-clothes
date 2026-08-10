// Metro config for MIEN.
// Extends Expo's default config; adds `tflite` to asset extensions
// so react-native-fast-tflite models bundled via require() are included.

const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Include .tflite model files as static assets (react-native-fast-tflite).
// Without this, Metro silently skips the file and __loadTensorflowModel fails.
config.resolver.assetExts.push('tflite');

// Keep Metro out of native build output.
//
// Gradle constantly creates and deletes directories under `android/build/` — including
// inside node_modules (e.g. react-native-safe-area-context/android/build/intermediates/
// consumer_proguard_dir/). Metro's file watcher crawls those, and if Gradle removes a
// directory between the crawl and the watch() call, Metro dies outright with
// `ENOENT: no such file or directory, watch ...` and takes the dev server with it.
// That happens whenever a Gradle build runs while `expo start` is up.
//
// Nothing under these paths is ever imported by the app, so excluding them costs nothing
// and also speeds up the initial crawl. Both separators are matched for Windows.
config.resolver.blockList = [
  ...(Array.isArray(config.resolver.blockList)
    ? config.resolver.blockList
    : config.resolver.blockList
      ? [config.resolver.blockList]
      : []),
  // The optional segment matches the Gradle module dir, so this covers android/build,
  // android/app/build and node_modules/<pkg>/android/build alike.
  /[/\\]android[/\\](?:[^/\\]+[/\\])?build[/\\].*/,
  /[/\\]android[/\\](?:[^/\\]+[/\\])?\.cxx[/\\].*/,
  /[/\\]ios[/\\]build[/\\].*/,
  /[/\\]ios[/\\]Pods[/\\].*/,
];

module.exports = config;
