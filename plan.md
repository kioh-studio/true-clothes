# Onboarding Logic Plan

## Documentation Policy
- UI/visual/interaction requirement changes must be recorded in the relevant `app/design/**/design.md` file(s).
- Non-UI logic changes must be recorded in this `plan.md`, including:
  - data storage and persistence behavior
  - backend/business logic behavior and flow changes
  - domain/model/repository contract changes
  - validation logic rules that affect application behavior
- Update documentation in the same working session as the implementation change.

## Plan
- Implement onboarding as required first-run flow with persisted progress and completion gating.
- Keep the existing Compose UI screens and move flow logic to a centralized ViewModel.
- Persist onboarding state locally on mobile (current phase), with a clear boundary for future backend sync.
- Separate shareable profile data from private body-measurement data in the domain model for future sync policy.

## Decisions
- Storage (current): local mobile persistence only.
- Persistence mechanism in current implementation: SQLite (`SQLiteOpenHelper`) repository abstraction.
- Future migration direction: dynamic sync policy for non-sensitive fields, keep private measurement fields restricted.
- Scope: MVP completion flow only (no real wardrobe upload pipeline, no AI measurement estimation).

## Progress
- Added onboarding domain contract (`OnboardingRepository`) and aggregate state model (`OnboardingSnapshot`, `OnboardingStep`, privacy metadata).
- Added local persistence data source and repository implementation for onboarding snapshots.
- Added onboarding presentation layer with centralized validation and `OnboardingViewModel`.
- Refactored app flow entry to use ViewModel state, resume step, and gate app entry by completion flag.
- Enabled final onboarding step to complete flow (`AddingWardrobe` next action now callable).
- Added required dependencies for lifecycle ViewModel and DataStore in Gradle catalogs/build file.
- Switched persistence to SQLite entities + helper + repository to align with mobile SQLite decision.

## Changelog
### 2026-03-19
- Created onboarding domain models and repository interface:
  - `app/src/main/java/com/brian_bui/true_clothes/onboarding/domain/OnboardingModels.kt`
  - `app/src/main/java/com/brian_bui/true_clothes/onboarding/domain/OnboardingRepository.kt`
- Implemented local persistence layer:
  - `app/src/main/java/com/brian_bui/true_clothes/onboarding/data/OnboardingLocalDataSource.kt`
  - `app/src/main/java/com/brian_bui/true_clothes/onboarding/data/DataStoreOnboardingRepository.kt`
- Added presentation logic for validation and flow orchestration:
  - `app/src/main/java/com/brian_bui/true_clothes/onboarding/presentation/OnboardingValidation.kt`
  - `app/src/main/java/com/brian_bui/true_clothes/onboarding/presentation/OnboardingViewModel.kt`
- Rewired app onboarding entry/gating:
  - `app/src/main/java/com/brian_bui/true_clothes/MainActivity.kt`
- Updated onboarding last-step action behavior:
  - `app/src/main/java/com/brian_bui/true_clothes/onboarding/AddingWardrobeOnboardingScreen.kt`
- Added dependencies:
  - `gradle/libs.versions.toml`
  - `app/build.gradle.kts`
- Implemented SQLite entity/storage layer and wired ViewModel repository:
  - `app/src/main/java/com/brian_bui/true_clothes/onboarding/data/local/OnboardingProfileEntity.kt`
  - `app/src/main/java/com/brian_bui/true_clothes/onboarding/data/local/PrivateMeasurementsEntity.kt`
  - `app/src/main/java/com/brian_bui/true_clothes/onboarding/data/local/OnboardingSQLiteHelper.kt`
  - `app/src/main/java/com/brian_bui/true_clothes/onboarding/data/local/RoomOnboardingRepository.kt` (contains `SQLiteOnboardingRepository`)
  - `app/src/main/java/com/brian_bui/true_clothes/onboarding/presentation/OnboardingViewModel.kt`
- Implemented real location detection on country onboarding:
  - Added runtime location permissions in `app/src/main/AndroidManifest.xml`
  - Added permission request flow, device location lookup, reverse geocoding, and country auto-selection in `app/src/main/java/com/brian_bui/true_clothes/onboarding/CountryOnboardingScreen.kt`
- Switched country detection to Fused Location Provider API:
  - Added Play Services location dependency in `gradle/libs.versions.toml` and `app/build.gradle.kts`
  - Replaced `LocationManager` usage with `FusedLocationProviderClient` (`lastLocation` + `getCurrentLocation`) in `app/src/main/java/com/brian_bui/true_clothes/onboarding/CountryOnboardingScreen.kt`
- Updated country auto-detection display/value mapping:
  - Keep persisted selection as country option for flow validation/state.
  - When location permission is granted and geocoder resolves address, show country input text as `city, country`.
  - Clear detected location display when user manually chooses a country from the list.

## Next
- Optionally switch persistence to SQLite/Room if you want strict SQLite alignment now.
- Add instrumentation/unit tests for:
  - resume from persisted step
  - validation on each step
  - completion gating on relaunch
