// Metro config for MIEN.
// Extends Expo's default config; adds `tflite` to asset extensions
// so react-native-fast-tflite models bundled via require() are included.

const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Include .tflite model files as static assets (react-native-fast-tflite).
// Without this, Metro silently skips the file and __loadTensorflowModel fails.
config.resolver.assetExts.push('tflite');

module.exports = config;
