# True Clothes — App Overview

> **What:** A wardrobe-and-outfit management app that helps users combine clothing items they already own into outfits, using body measurements, garment fit, colour profile, and style preferences to suggest and rank outfits.
>
> **Port of:** Kotlin/Android app at `c:\projects\app`. This Flutter version targets cross-platform.
>
> **Near-term goal:** Outfit suggestions from the user's existing closet.
> **Long-term goal:** Suggest purchases matching the user's size, measurements, colour palette, and aesthetic.

---

## Tech Stack

| Layer | Detail |
|---|---|
| Framework | Flutter, SDK `^3.11.3` |
| State management | None (plain `StatefulWidget` + `setState`). No Bloc/Riverpod/Provider. |
| Persistence | `shared_preferences` (onboarding completion flag only) |
| Navigation | `Navigator.push` for full-screen routes; `IndexedStack` for tabs |
| Typography | `google_fonts` — **Poppins** (body) + **Playfair Display** (headings). TTFs also bundled under `fonts/` but not declared in `pubspec.yaml` `flutter:` section. |
| Responsiveness | Width-based scaling from reference width **402**. See `lib/core/responsive.dart` (`scaleDp`, `scaleSp`, `layoutScaleOf`). Spec: `design/responsive-ui.md`. |
| Assets | `assets/` registered in `pubspec.yaml` (currently empty directory) |
| Dependencies | `cupertino_icons`, `google_fonts`, `intl`, `geolocator`, `geocoding`, `url_launcher`, `shared_preferences` |
| Backend | **None yet** — all data is demo/in-memory |

---

## Project Structure

```
lib/
├── main.dart                  # Entry point → TrueClothesApp → AppShell
├── app_shell.dart             # Root: onboarding flow vs MainNavShell
├── main_nav_shell.dart        # Post-onboarding: 3-tab IndexedStack + floating nav
├── core/
│   └── responsive.dart        # scaleDp(), scaleSp(), kReferenceDesignWidth=402
├── theme/
│   ├── app_theme.dart         # buildAppTheme() → MaterialApp.theme
│   ├── app_colors.dart        # AppColors: mainBackground, homeGradient*, homeLogotype
│   ├── app_fonts.dart         # AppFonts: poppins(), playfairDisplay() wrappers
│   └── widget_preview_theme.dart
├── widgets/                   # Shared reusable widgets (prefixed true_*)
│   ├── true_modal.dart
│   ├── true_item_slider.dart
│   ├── true_dropdown.dart
│   ├── true_tab_bar.dart
│   ├── true_search_bar.dart
│   ├── true_back_button.dart
│   ├── true_progress_bar.dart
│   ├── onboarding_nav_bar.dart
│   └── outfit_composition_card_placeholder.dart
├── features/
│   ├── onboarding/            # 7-step onboarding (gender→country→body→top→bottom→colour→wardrobe)
│   │   ├── gender_onboarding_screen.dart + gender_form.dart
│   │   ├── country_onboarding_screen.dart + country_form.dart
│   │   ├── body_measurement_onboarding_screen.dart + body_measurement_form.dart
│   │   ├── top_body_measurement_onboarding_screen.dart + top_measurement_form.dart
│   │   ├── bottom_body_measurement_onboarding_screen.dart + bottom_measurement_form.dart
│   │   ├── colour_onboarding_screen.dart + colour_form.dart
│   │   ├── adding_wardrobe_onboarding_screen.dart + adding_wardrobe_form.dart
│   │   ├── onboarding_units.dart
│   │   ├── onboarding_measurement_widgets.dart
│   │   └── onboarding_placeholder_screen.dart
│   ├── home/                  # Tab 0 — Home
│   │   ├── home_main_screen.dart       # HomeMainContent: tabs Outfit/Favourite/Closet
│   │   ├── home_outfit_models.dart     # OutfitDetailPayload + demo data factory
│   │   ├── outfit_detail_screen.dart   # Full-screen outfit detail (Navigator.push)
│   │   └── item_detail_screen.dart     # Full-screen item detail (Navigator.push)
│   ├── wardrobe/              # Tab 1 — Wardrobe
│   │   ├── wardrobe_menu_screen.dart   # WardrobeMenuContent: hub → My Wardrobe / Build Outfit
│   │   ├── my_wardrobe_screen.dart     # Closet/Collections/ByTags tabs, FAB → add item
│   │   ├── collections_tab_view.dart   # Collections grid view
│   │   ├── collection_demo_data.dart   # Demo collection entries
│   │   ├── wardrobe_demo_data.dart     # Demo wardrobe items
│   │   ├── new_item_screen.dart        # Add item step 1 (Navigator.push)
│   │   ├── complete_item_screen.dart   # Add item step 2 (Navigator.push)
│   │   └── add_item_models.dart        # Form models for add-item flow
│   └── profile/               # Tab 2 — Profile
│       └── user_profile_screen.dart    # Placeholder: "Settings & profile coming soon."
├── preview/                   # Dev-only in-app preview gallery
│   ├── preview_main.dart      # Alternate entry: flutter run -t lib/preview/preview_main.dart
│   ├── preview_host.dart
│   ├── preview_gallery.dart
│   └── preview_pages.dart
```

---

## App Architecture & Navigation Flow

```
main.dart
  └── TrueClothesApp (MaterialApp, theme: buildAppTheme())
        └── AppShell (StatefulWidget)
              ├── [onboarding incomplete] → Linear flow via _Flow enum:
              │     gender → country → body → (topBody) → (bottomBody) → colour → wardrobe → home
              │     State held in AppShell via setState. Persists completion to SharedPreferences.
              │
              └── [onboarding complete] → MainNavShell
                    ├── IndexedStack[0]: HomeMainContent
                    │     └── Navigator.push → OutfitDetailScreen / ItemDetailScreen
                    ├── IndexedStack[1]: WardrobeMenuContent
                    │     └── Navigator.push → MyWardrobeScreen
                    │           └── Navigator.push → NewItemScreen → CompleteItemScreen
                    │           └── Navigator.push → ItemDetailScreen
                    ├── IndexedStack[2]: UserProfileContent (placeholder)
                    └── Floating circular nav bar (Home / Wardrobe / Profile)
                          Bottom-aligned circles, diameter: active=70dp, inactive=45dp
```

---

## Feature Status

| Feature | Status | Key files |
|---|---|---|
| **Onboarding** | **Done** — full 7-step flow, persisted via SharedPreferences | `app_shell.dart`, `features/onboarding/*` |
| **Home — Outfit tab** | **Done** — demo outfit cards, opens OutfitDetailScreen | `home_main_screen.dart`, `outfit_detail_screen.dart` |
| **Home — Favourite tab** | **Stub** — placeholder content | `home_main_screen.dart` |
| **Home — Closet tab** | **Stub** — placeholder content | `home_main_screen.dart` |
| **Wardrobe menu** | **Done** — hub with "My wardrobe" and "Build your outfit" | `wardrobe_menu_screen.dart` |
| **My Wardrobe** | **Done** — Closet/Collections/ByTags tabs, search, category dropdown, FAB | `my_wardrobe_screen.dart`, `collections_tab_view.dart` |
| **Add Item flow** | **Done** — two-step: new item → complete item | `new_item_screen.dart`, `complete_item_screen.dart` |
| **Item Detail** | **Done** — from wardrobe items with detail info | `item_detail_screen.dart` |
| **Build Outfit** | **Stub** — onTap is empty `() {}` | `wardrobe_menu_screen.dart` |
| **Profile / Settings** | **Stub** — "coming soon" placeholder | `user_profile_screen.dart` |
| **Style suggestions** | **Spec only** — logic doc exists, no implementation | `docs/suggest-style-logic.md` |
| **Backend / sync** | **Not started** — all data is demo/in-memory | — |

---

## Design Specs

All design docs live under `design/`. Each has a `design.md` and usually SVG/PNG mockups.

### Screens (`design/screen/`)
| Path | Covers |
|---|---|
| `onboarding/design.md` | Master onboarding spec |
| `onboarding/gender/` | Gender selection screen |
| `onboarding/country/` | Country/location screen |
| `onboarding/body-measurement/` | Core body measurements |
| `onboarding/top/` | Top body detail measurements |
| `onboarding/bottom/` | Bottom body detail measurements |
| `onboarding/colour/` | Colour profile screen |
| `onboarding/adding-wardrobe/` | "Adding wardrobe" transition screen |
| `home/main/` | Main home shell + floating nav |
| `home/outfit/` | Outfit presentation in home |
| `home/item/` | Item presentation in home |
| `build-wardrobe/` | Wardrobe hub / build flow |
| `my-wardrobe/` | Closet UI |
| `collection/` | Collections UI |
| `add-item/` + `add-item/additional/` | Two-step add item flow |

### Components (`design/component/`)
| Path | Widget |
|---|---|
| `back-button/` | `true_back_button.dart` |
| `dropdown/` | `true_dropdown.dart` |
| `item-slider/` | `true_item_slider.dart` |
| `modal/` | `true_modal.dart` |
| `search-bar/` | `true_search_bar.dart` |
| `tab-bar/` | `true_tab_bar.dart` |

### Reference docs
| Path | Content |
|---|---|
| `design/responsive-ui.md` | dp/sp/px mapping, reference width 402, scaling rules |
| `design/reference/measurement.md` | Body/garment measurement reference |
| `docs/suggest-style-logic.md` | Style catalog, cold-start, hybrid recommendation logic (on-device, preference-driven, no age/gender bias) |

---

## Key Conventions

- **Responsive scaling:** All layout values from design specs go through `scaleDp(context, dp)` and `scaleSp(context, sp)`. Never hard-code pixel values.
- **No nested Scaffolds:** Tab content widgets (`HomeMainContent`, `WardrobeMenuContent`, `UserProfileContent`) are plain widgets inside `MainNavShell`'s single `Scaffold`.
- **Bottom padding:** Content pages add ~100dp bottom padding to clear the floating nav circles.
- **Gradient background:** Shared via `buildPageBackground()` in `main_nav_shell.dart` (3-stop gradient: `#4D5051` @ 35% → `#DCDCDC`).
- **Page titles:** Use `pageTitleStyle()` from `main_nav_shell.dart` — Playfair Display, bold, 28sp, logotype color.
- **Form state pattern:** Onboarding forms use immutable `*FormState` classes, lifted to `AppShell` via callbacks.
- **Widget previews:** Screens use `@Preview` annotation for Flutter Widget Previewer. Alt entry: `flutter run -t lib/preview/preview_main.dart`.
- **Git:** Repo root is `C:/projects/true-clothes`. App code is in `true_clothes_app/` subdirectory.

---

## What's Not Built Yet

1. **Build Outfit feature** — entry point exists but not wired
2. **Profile / Settings screens** — placeholder only
3. **Backend / data layer** — no API, no database, no sync
4. **Style recommendation engine** — spec exists (`docs/suggest-style-logic.md`), no code
5. **Home Favourite and Closet tabs** — stubs
6. **User authentication** — not started
7. **Image handling** — no camera/gallery integration for wardrobe items
