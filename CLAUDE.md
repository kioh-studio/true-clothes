# MIEN — CLAUDE.md

## App Concept

**MIEN** is a personal fashion recommendation app. It collects the user's body measurements, style preferences, and color palette, then uses their existing wardrobe to suggest outfits they can actually wear today — filtered by weather, mood, and occasion.

The core loop:
1. User inputs measurements, style, and color preferences during onboarding.
2. User builds a wardrobe by adding clothing items.
3. App generates outfit suggestions from the wardrobe, tuned to weather, the user's style profile, and what fits their body.
4. User browses suggestions in a TikTok-style vertical scroll feed, saves favorites, and can tweak style/color on the fly.

---

## Design Philosophy

**Luxury minimalism.** The visual language draws from high-end fashion brands (Celine, The Row, Bottega Veneta):

- **Typography**: Large, thin-weight serif or sans-serif headlines. Generous white space. Text does the heavy lifting — no clutter.
- **Color**: Near-monochrome base (off-white, warm black, stone). Accent colors come from the user's selected palette.
- **Spacing**: Breathe. Oversized padding, never crowded.
- **Motion**: Slow, intentional transitions. No bouncy or playful animations.
- **Icons**: Hairline strokes, simple geometry. No filled/solid icons.
- **No gradients, no shadows** unless extremely subtle (elevation only where structurally necessary).
- **Image-first**: Clothing and outfit photos are full-bleed, unframed.

---

## Platform & Tech Stack

| Layer | Choice |
|---|---|
| Platform | iOS + Android (React Native) |
| Language | TypeScript |
| UI | React Native + custom design system |
| Navigation | React Navigation (stack + bottom tabs) |
| State management | Zustand or Redux Toolkit |
| Local persistence | MMKV (fast key-value) + SQLite via `expo-sqlite` |
| Backend | Supabase (auth, database, storage, edge functions) |
| AI (future) | Pose estimation for auto body measurement; outfit generation |
| Location | `expo-location` |
| Image handling | `expo-image-picker` + Supabase Storage |

---

## App Structure

```
true-clothes/
├── app/                          # Expo Router or React Navigation root
│   ├── (onboarding)/             # First-run screens (stack)
│   │   ├── welcome.tsx
│   │   ├── auth.tsx
│   │   ├── personal-info.tsx
│   │   ├── location.tsx
│   │   ├── measurements.tsx
│   │   ├── style-quiz.tsx
│   │   ├── color-palette.tsx
│   │   └── wardrobe-intro.tsx
│   ├── (tabs)/                   # Main app (bottom tab navigator)
│   │   ├── index.tsx             # Home — outfit feed
│   │   ├── menu.tsx              # Options menu
│   │   └── profile.tsx           # User profile
│   └── outfit/
│       └── [id].tsx              # Outfit detail (modal or stack)
├── src/
│   ├── components/               # Shared Compose components
│   │   ├── ui/                   # Primitives: Button, Text, Card, etc.
│   │   └── outfit/               # OutfitCard, ClothingItemRow, etc.
│   ├── design/                   # Design tokens
│   │   ├── tokens.ts             # Colors, typography, spacing
│   │   └── **/design.md          # Per-feature visual specs
│   ├── features/
│   │   ├── feed/
│   │   ├── outfit/
│   │   ├── wardrobe/
│   │   └── profile/
│   ├── stores/                   # Zustand stores
│   ├── services/                 # Supabase client, weather API, etc.
│   └── types/                    # Shared TypeScript types/interfaces
├── plan.md                       # Non-UI logic decisions and changelog
└── CLAUDE.md                     # This file
```

---

## Screen Map

### Onboarding Flow (first-run, gated)

Sequential screens, persisted progress, resumable:

1. **Welcome** — full-bleed editorial image, brand name, minimal CTA
2. **Auth** — phone number (primary) + optional email; OTP verification
3. **Personal Info** — age, gender
4. **Location** — GPS auto-detect (`expo-location`) shows city/country; user confirms or overrides
5. **Measurements** — height + weight (required); chest, waist, hip (optional); future: AI pose capture
6. **Style Quiz** — tile-based style selector; selecting a style reveals related sub-styles (progressive disclosure); multi-select allowed
7. **Color Palette** — swipe/tap to pick dominant tones (neutrals, earth, pastels, bold, monochrome, etc.)
8. **Wardrobe Intro** — prompt to add first clothing item or skip to home

### Main App (post-onboarding)

#### Bottom Navigation — circular pill/dot menu, 3 items, hairline icons:

| Tab | Icon | Screen |
|---|---|---|
| Home | thin play/feed icon | Outfit Feed |
| Menu | thin grid/list icon | Options Menu |
| Profile | thin person silhouette | User Profile |

---

#### Home — Outfit Feed

- Vertical full-screen `FlatList` pager, one outfit per page (TikTok pattern)
- Each card: full-bleed outfit photo, minimal overlay at bottom (style tag, temperature, occasion)
- Tap outfit → navigate to Outfit Detail
- Long-press or swipe right → save to favorites
- Filter bar (slide in from top or persistent pill): Style / Color / Occasion / Weather
- Feed logic: ranked by match score against user's measurement, style profile, color palette, and current weather

#### Outfit Detail

- Full-bleed hero image of the outfit
- Breakdown: each clothing item shown as a card row (photo + name + category)
- "Wearing this" CTA — mark outfit as worn today (logs history)
- Save / unsave toggle
- "Style it differently" — swap one item and regenerate

#### Options Menu (tab)

Full-screen list, large typography, minimal:

- Your Wardrobe
- Build an Outfit
- Saved Outfits
- Style Preferences
- Color Palette
- Size & Measurements
- (future) Shop recommendations

#### Your Wardrobe

- Grid of clothing items (2-col)
- Add item: photo upload + category + color tags + size
- Filter by category (top, bottom, footwear, outerwear, accessories)

#### Build an Outfit

- Manual outfit builder: pick items from wardrobe category by category
- AI suggests compatible combinations as user picks

#### User Profile

- Display name, avatar, location
- Stats: items in wardrobe, outfits saved, outfits worn
- Edit preferences link
- Sign out

---

## Domain Models (key types)

```ts
UserProfile {
  id, displayName, age, gender, location: { city, country, coords }
}

BodyMeasurements {          // treated as private/sensitive
  userId, heightCm, weightKg, chestCm?, waistCm?, hipCm?
}

StyleProfile {
  userId, selectedStyles: StyleTag[], dominantColors: ColorTone[]
}

ClothingItem {
  id, userId, photoUrl, category, colors: ColorTone[], sizeLabel, brand?, notes?
}

Outfit {
  id, userId, items: ClothingItem[], tags: StyleTag[], occasionTag?, savedAt?
}

OutfitSuggestion {
  outfitId, matchScore, weatherContext, generatedAt
}
```

---

## Feature Flags & MVP Scope

| Feature | MVP | Future |
|---|---|---|
| Onboarding flow | Next | — |
| Outfit feed (mock data) | Next | — |
| Wardrobe CRUD | Next | — |
| Weather-based filtering | Next | real weather API |
| Supabase auth + backend | Next | — |
| AI outfit generation | — | v2 |
| AI pose measurement | — | v2 |
| Social / sharing | — | v3 |

---

## Documentation Policy

- UI/visual/interaction requirement changes → document in `src/design/**/design.md`
- Non-UI logic (data, backend, domain, validation) changes → document in `plan.md`
- Update documentation in the same session as the code change

---

## Conventions

- Features are self-contained under `src/features/` with their own components, hooks, and types
- Screens are thin — all logic lives in hooks or stores, never inline in JSX
- No business logic in components
- Supabase access only through service abstractions — never call the client directly from screens
- Measurements stored in metric (cm, kg); display conversion is a UI concern
- Color tones stored as named enum/string values, not hex — hex is a display/token concern
- TypeScript strict mode — no `any`

<!-- SPECKIT START -->
For additional context about technologies to be used, project structure,
shell commands, and other important information, read the current plan
at specs/007-extract-by-item/plan.md

The previous feature plan is at specs/006-ai-item-extraction/plan.md
The baseline plan (phases 1–7, complete) is at specs/001-app-baseline/plan.md
<!-- SPECKIT END -->
