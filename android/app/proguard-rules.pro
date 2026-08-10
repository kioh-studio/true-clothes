# ProGuard / R8 rules for MIEN release builds.
#
# Enabled via android.enableMinifyInReleaseBuilds=true (see android/gradle.properties).
# Appended to the default proguard-android.txt plus the consumer rules that libraries
# ship inside their own AARs.
#
# Already covered by consumer rules — do NOT duplicate here:
#   - react-native        (ReactAndroid/build.gradle.kts:504 -> consumerProguardFiles)
#   - expo-modules-core   (android/build.gradle:80 -> keeps Record, Module, ExpoView,
#                          Enumerable, @DoNotStrip — i.e. all the reflection-driven parts
#                          of the Expo module system)
#   - react-native-svg    (android/build.gradle:111)
#
# The rules below cover the libraries that ship NO consumer rules of their own.

# --- Stack traces -----------------------------------------------------------------
# Without these, every release crash report is an unreadable pile of a/b/c frames.
-keepattributes SourceFile,LineNumberTable,Signature,Exceptions,InnerClasses,*Annotation*
-renamesourcefileattribute SourceFile

# --- JNI --------------------------------------------------------------------------
# Any class holding a native method must keep both its own name and the method names,
# because the C++ side resolves them by string. Covers react-native-fast-tflite,
# Hermes and the RN JNI layer. Dropping this produces UnsatisfiedLinkError at runtime,
# which does not show up until the feature is actually opened.
-keepclasseswithmembernames,includedescriptorclasses class * {
    native <methods>;
}

# --- react-native-fast-tflite (no consumer rules) ---------------------------------
# Used by the on-device pose / segmentation pipeline. TfliteModule is reached from the
# RN package list and its members from JNI.
-keep class com.tflite.** { *; }

# --- RevenueCat (no consumer rules on the RN wrapper) -----------------------------
# Paywall + entitlement models are deserialized from the RevenueCat backend by field
# name, so obfuscating them silently breaks purchase restore rather than crashing.
-keep class com.revenuecat.purchases.** { *; }
-keepclassmembers class com.revenuecat.purchases.** { *; }

# --- TurboModules / new architecture ----------------------------------------------
-keep class com.facebook.react.turbomodule.** { *; }
-keep class com.facebook.jni.** { *; }

# --- ML Kit barcode: deliberately excluded ----------------------------------------
# app/build.gradle drops com.google.mlkit:barcode-scanning, but expo-camera's compiled
# BarcodeAnalyzer / MLKitBarCodeScanner still reference those classes, so R8 aborts with
# "Missing classes detected" unless told the dangling references are intentional.
# Safe because every call site is gated behind CameraUtils.isMLKitBarcodeScannerAvailable(),
# which probes with Class.forName and returns false when the class is absent.
-dontwarn com.google.mlkit.vision.barcode.**

# --- Kotlin -----------------------------------------------------------------------
# Coroutines' internal service loader and the debug probes are resolved reflectively.
-keepclassmembers class kotlinx.coroutines.** { volatile <fields>; }
-dontwarn kotlinx.coroutines.**
-dontwarn org.jetbrains.annotations.**

# --- OkHttp / Okio (pulled in by RN networking and the Supabase client) ------------
-dontwarn okhttp3.**
-dontwarn okio.**
-dontwarn javax.annotation.**
