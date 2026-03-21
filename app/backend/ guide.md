# Overview

True Clothes helps users build better outfits from their own wardrobe, then guides them with fit/style-aware recommendations.

The app flow implemented so far is:
- Onboarding (gender, country, body measurements, colour preference, adding wardrobe placeholder)
- Home screen (Outfit/Favourite/Closet tabs)
- Outfit detail screen (item cards, metadata text, tags, and action links like "Go to closet" / "Go to shop")

This guide describes the product purpose, current basic features, and what backend capabilities are needed to reach the goal.

# Product Purpose

Primary goal:
- Generate practical outfit recommendations based on the user's real closet, body profile, and style preferences.

Secondary goals:
- Explain why each item is suggested (style/aesthetic/material/context tags).
- Help users act on missing items (closet vs shop pathways).
- Keep UX fast: onboarding -> recommendations -> details -> action.

# Basic Features (Current App)

- **Onboarding profile capture**
  - Gender, country, height/weight + optional top/bottom measurements
  - Colour preference and wardrobe intake placeholder
- **Home feed**
  - Outfit suggestions visualized as composed item cards
  - Tab structure for Outfit, Favourite, Closet
- **Outfit detail**
  - Outfit title + tags section
  - Item rows with image container + rich item metadata
  - Action link per item ("Go to closet" / "Go to shop")
- **Design consistency**
  - Shared design tokens (default background and font families)
  - Responsive scaling patterns used across screens

# What Backend Must Provide (MVP)

- **Authentication + user profile**
  - User identity
  - Persist onboarding answers and profile updates
- **Closet inventory**
  - CRUD for closet items (name, category, size/form, color, material, image, ownership state)
  - Item image storage and URL delivery
- **Outfit recommendations**
  - Endpoint to fetch suggested outfits for a user
  - Include ranked outfit list + item composition data
- **Outfit detail payload**
  - Outfit title
  - Tags (aesthetic/weather/occasion/style/manual/system)
  - Per-item metadata (name, color, form, aesthetic, material)
  - Per-item action type (closet/shop/none) and destination payload
- **Favourite/Closet tabs support**
  - Favorite toggle and list retrieval
  - Closet-built outfit list retrieval

# Suggested Core API Shape (MVP)

- `GET /me/profile`
- `PUT /me/profile`
- `GET /me/closet-items`
- `POST /me/closet-items`
- `PATCH /me/closet-items/{id}`
- `DELETE /me/closet-items/{id}`
- `GET /me/outfits?tab=outfit|favourite|closet`
- `GET /me/outfits/{id}`
- `POST /me/outfits/{id}/favourite`
- `DELETE /me/outfits/{id}/favourite`

# Data Needed to Reach the Goal

- **Profile data**
  - Body and preference fields from onboarding
- **Item-level closet data**
  - Category/type, fit/form, color, material, season/context tags
- **Recommendation metadata**
  - Reason/tags for explainability
  - Confidence/priority for ranking
- **Actionability data**
  - Availability state: already owned / suggested to buy
  - Shop reference when action is "Go to shop"

# Non-Functional Requirements

- **Performance**
  - Home and outfit detail responses should feel instant (<300ms backend target for cached paths)
- **Scalability**
  - Recommendation reads should be cache-friendly
- **Reliability**
  - Graceful fallback payloads when recommendation service is unavailable
- **Privacy**
  - Treat body measurements and profile data as sensitive user data

# Immediate Next Backend Priorities

1. Profile + closet item persistence with image support.
2. Outfit list/detail endpoints with tags and item metadata matching current UI.
3. Favourite flow APIs.
4. Recommendation generation pipeline (first rule-based, then model-assisted).

# API Scope (Requested)

This section is the concrete API scope to support current product goals and onboarding/home flows.

## A) User Body Profile (Onboarding Step 3)

Required:
- Upload user body profile.
- View user body profile.

Suggested endpoints:
- `PUT /me/body-profile`
- `GET /me/body-profile`

Body profile fields (example):
- `height.value`, `height.unit` (`cm`/`in`)
- `weight.value`, `weight.unit` (`kg`/`lb`)
- top measurements (optional): shoulder, bicep, sleeves, chest, neck
- bottom measurements (optional): waist, hip, inseam, thigh, ankle
- `measurement_method` (`manual` / `ai_guess` placeholder)

## B) User Profile (Onboarding Step 1 + Step 2, Profile Menu)

Required:
- Update name/gender/DOB/location.
- View user profile.

Suggested endpoints:
- `PUT /me/profile`
- `GET /me/profile`

Profile fields:
- `name`
- `gender`
- `dob`
- `location` (country/city/region)

## C) Closet Management

Required:
1. Add closet item (POST)
2. Update closet item (PUT/PATCH)
3. List all closet items
4. Get closet item detail

Suggested endpoints:
- `POST /me/closet-items`
- `PUT /me/closet-items/{itemId}`
- `PATCH /me/closet-items/{itemId}`
- `GET /me/closet-items`
- `GET /me/closet-items/{itemId}`

Important domain rules:
- Item type controls required measurements:
  - Top (inwear/outwear): shoulder/sleeves/chest/etc.
  - Bottom: waist/hip/leg/inseam/etc.
- Item image upload is required when creating an item.
- Measurements must support flexible units (`cm`/`in`, etc).

Closet item core fields:
- `id`, `name`, `type` (`top_inwear`, `top_outwear`, `bottom`, `bag`, `shoes`, `accessory`)
- `fit_type` (`regular`, `wide`, `oversize`, `slim`, ...)
- `measurements` (unit-aware value map)
- `color`, `material`, `style_tags`
- `image_url` (required)
- `is_active`

## D) Outfit Suggestion and Outfit Operations

Required:
1. Suggested outfits list (time/weather/style/body-fit aware)
2. Outfit detail (item IDs + tags + outfit name)
3. Mark favourite
4. List favourites
5. Closet-only outfit list

Suggested endpoints:
- `GET /me/outfits/suggested`
- `GET /me/outfits/{outfitId}`
- `POST /me/outfits/{outfitId}/favourite`
- `DELETE /me/outfits/{outfitId}/favourite`
- `GET /me/outfits/favourites`
- `GET /me/outfits/closet`

Suggestion logic inputs:
- Current time bucket (`morning` / `afternoon` / `night`)
- Weather bucket (`hot` / `normal` / `cold`) from temperature
- User favourite styles/aesthetics
- Body-profile vs item-measurement fit compatibility
- Optional color harmony (favourite color + skin color)

Critical output requirements:
- Return enough item IDs to render outfit detail screen directly.
- Include `outfit_name` (user-defined or system-generated).
- Include `tags` (style, weather, occasion, etc).
- Include `main_item_id` or `item_role` to distinguish silhouette-defining main piece.
- Mark whether outfit is complete (`is_complete = true`) meaning no additional required items.

Ranking policy (MVP):
- Prioritize outfits that match user preferred styles first.
- Show other styles only when preferred-style options are insufficient.

## E) Style

Required:
1. Add user favourite styles
2. Suggest styles for user based on previous choices

Suggested endpoints:
- `PUT /me/preferences/styles`
- `GET /me/preferences/styles`
- `GET /me/styles/suggested`

## F) Color

Required:
1. Add user favourite color
2. Add user skin color

Suggested endpoints:
- `PUT /me/preferences/colors`
- `GET /me/preferences/colors`

Expected fields:
- `favorite_colors: []`
- `skin_tone` or `skin_color`

## Shared Contract Rules

- All measurement fields must carry explicit unit metadata.
- Conversion and storage should be normalized server-side (recommended: canonical metric storage).
- Outfit generation should support these item categories:
  - Top (inwear, outwear), bottom, bag, shoes/sneaker, accessories.
- A "complete outfit" must include all required pieces so user can wear it as-is.
- APIs should return enough metadata for explainability (why suggested) and UI tags.

## Entities (RDS)

Recommended primary storage: PostgreSQL (Amazon RDS) as source of truth.

### 1) users
- `id` (uuid, pk)
- `email`, `name`, `gender`, `dob`
- `country`, `city`, `timezone`
- `created_at`, `updated_at`

### 2) user_body_profile
- `user_id` (pk, fk -> users.id)
- `height_value`, `height_unit` (`cm`/`in`)
- `weight_value`, `weight_unit` (`kg`/`lb`)
- `measurement_method` (`manual`/`ai_guess`)
- `created_at`, `updated_at`

### 3) user_body_measurements
- `id` (uuid, pk)
- `user_id` (fk -> users.id)
- `measurement_key` (e.g. `shoulder`, `sleeves`, `waist`, `inseam`)
- `body_region` (`top`/`bottom`)
- `value`, `unit`
- `created_at`, `updated_at`

### 4) user_style_preferences
- `id` (uuid, pk)
- `user_id` (fk -> users.id)
- `style_key` (e.g. `minimalism`, `classic`, `smart_casual`)
- `source` (`user`/`system`)
- `weight` (numeric score)
- `created_at`, `updated_at`

### 5) user_color_preferences
- `id` (uuid, pk)
- `user_id` (fk -> users.id)
- `color_hex`
- `is_favorite` (bool)
- `created_at`, `updated_at`

### 6) user_skin_profile
- `user_id` (pk, fk -> users.id)
- `skin_tone` / `skin_color_hex`
- `meta` (jsonb, optional)
- `created_at`, `updated_at`

### 7) closet_items
- `id` (uuid, pk)
- `user_id` (fk -> users.id)
- `name`
- `category` (`top_inwear`, `top_outwear`, `bottom`, `bag`, `shoes`, `accessory`)
- `fit_type` (`regular`, `wide`, `oversize`, `slim`, ...)
- `color_hex`
- `material_text`
- `image_url` (required)
- `status` (`active`, `archived`)
- `created_at`, `updated_at`

### 8) closet_item_measurements
- `id` (uuid, pk)
- `closet_item_id` (fk -> closet_items.id)
- `measurement_key` (type-dependent: top vs bottom requirements)
- `value`, `unit`
- `created_at`, `updated_at`

### 9) outfits
- `id` (uuid, pk)
- `user_id` (fk -> users.id)
- `name` (system-generated or user-defined)
- `generated_by` (`system`/`user`)
- `context_time_bucket` (`morning`, `afternoon`, `night`)
- `context_weather_bucket` (`hot`, `normal`, `cold`)
- `is_complete` (bool)
- `score` (ranking score)
- `created_at`, `updated_at`

### 10) outfit_items
- `id` (uuid, pk)
- `outfit_id` (fk -> outfits.id)
- `closet_item_id` (fk -> closet_items.id, nullable when shop item)
- `source_type` (`closet`/`shop`)
- `item_role` (`main`/`support`)  # main item for silhouette
- `sort_order`
- `action_type` (`go_to_closet`, `go_to_shop`, `none`)
- `shop_ref` (nullable)
- `created_at`, `updated_at`

### 11) outfit_tags
- `id` (uuid, pk)
- `outfit_id` (fk -> outfits.id)
- `tag_text` (e.g. `minimalism`, `sunny day`, `classic`)
- `tag_type` (`style`, `weather`, `occasion`, `system`, `user`)
- `created_at`, `updated_at`

### 12) favorite_outfits
- `user_id` (fk -> users.id)
- `outfit_id` (fk -> outfits.id)
- `created_at`
- composite pk: (`user_id`, `outfit_id`)

