/// Kotlin `AddingWardrobeOnboardingScreen.kt` (upload count placeholder).
class AddingWardrobeFormState {
  const AddingWardrobeFormState({this.uploadedCount = 0});

  final int uploadedCount;

  AddingWardrobeFormState copyWith({int? uploadedCount}) {
    return AddingWardrobeFormState(
      uploadedCount: uploadedCount ?? this.uploadedCount,
    );
  }
}
