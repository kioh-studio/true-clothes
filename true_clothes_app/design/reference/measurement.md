# Measurement Reference

This document defines **every measurement** True Clothes collects, split into two
categories:

| Category | When collected | Purpose |
|---|---|---|
| **Body measurements** | During onboarding or in profile settings — measured once, updated occasionally. | Used to compare against garment dimensions for fit recommendations. |
| **Garment (clothes) measurements** | When adding a new item to the wardrobe (step 2: "Complete item"). | Stored per item so the system can calculate how the garment fits the user. |

All values are stored in **centimetres (CM)** internally. The UI lets the user
enter in CM or IN and converts at save time.

---

## 1. Body Measurements

Taken from the **user's body** (not clothing). Collected during onboarding and
editable in the profile. Keep the tape measure level and parallel to the floor
for all circumference measurements.

### 1.1 Upper body

| Key | Label | How to measure |
|---|---|---|
| `body_bust` | Chest / Bust | Measure around the fullest part of the bust/chest, under the armpits, and across shoulder blades, ensuring the tape is parallel to the ground. |
| `body_waist` | Natural Waist | Measure around the narrowest part of the torso, usually just above the belly button. |
| `body_shoulder_width` | Shoulder width | Measure from one shoulder point to the other across the top of the back. |
| `body_sleeve_length` | Sleeve length | Measure from the shoulder socket, along the outer arm (slightly bent) to the wrist. |
| `body_upper_body_length` | Back waist length | Measure from the prominent bone at the base of the neck down to the natural waistline. |
| `body_upper_arm` | Upper arm | Measure around the widest section of the upper arm. |
| `body_neck` | Neck | Around the base of the neck, just above the collar bone. |

### 1.2 Lower body

| Key | Label | How to measure |
|---|---|---|
| `body_waist` | Waist | _(same as 1.1 — shared key)_ |
| `body_hip` | Hip | Around the fullest part of the hips, about 18–23 cm (7–9 in) below the waistline. |
| `body_inseam` | Inseam | From the crotch down the inner leg to the ankle bone. |
| `body_thigh` | Thigh | Around the fullest part of the thigh, just below the crotch. |
| `body_rise` | Rise (crotch depth) | Sitting on a flat surface: from the waist to the seat. |

### 1.3 Feet

| Key | Label | How to measure |
|---|---|---|
| `body_foot_length` | Foot length | Heel to longest toe, standing on paper. |
| `body_foot_width` | Foot width | Widest part of the foot, standing on paper. |

### 1.4 General

| Key | Label | How to measure |
|---|---|---|
| `body_height` | Height | Standing straight, head to floor. |
| `body_weight` | Weight (kg) | _(optional, not a measurement per se)_ |

---

## 2. Garment Measurements (per clothes type)

Taken from the **physical clothing item** laid flat. Recorded when the user adds
an item to their wardrobe. Each type has its own set because garments are
measured differently.

### 2.1 Top item

Items worn on the upper body: T-shirts, shirts, polos, tank tops, blouses.

| Key | Label | How to measure |
|---|---|---|
| `chest` | Chest / Bust (pit-to-pit) | Across the chest from armpit seam to armpit seam × 2. |
| `waist_top` | Waist | Across the garment at the natural waist level × 2, laid flat. |
| `shoulder_width` | Shoulder width | Seam to seam across the top of the shoulders, laid flat. |
| `sleeves` | Sleeve length | From the shoulder seam to the cuff. |
| `body_length` | Body length (back waist length) | From the highest point of the shoulder (next to collar) to the bottom hem. |
| `upper_arm` | Upper arm | Around the widest part of the sleeve at the upper arm. |

### 2.2 Bottom item — Pants / Trousers

Trousers, jeans, shorts, joggers.

| Key | Label | How to measure |
|---|---|---|
| `waist` | Waist | Across the top of the waistband × 2, laid flat. |
| `hip` | Hip | Across the widest point below the waist × 2, laid flat. |
| `inseam` | Inseam | From the crotch seam to the bottom hem, along the inner leg. |
| `thigh` | Thigh | Across the thigh at the crotch seam × 2, laid flat. |
| `rise` | Rise (front) | From the top of the waistband to the crotch seam. |

### 2.3 Bottom item — Skirts

Skirts, skorts.

| Key | Label | How to measure |
|---|---|---|
| `waist` | Waist | Across the top of the waistband × 2, laid flat. |
| `hip` | Hip | Across the widest point below the waist × 2, laid flat. |
| `skirt_length` | Skirt length | From the top of the waistband to the bottom hem. |

### 2.4 Outerwear

Jackets, coats, blazers, hoodies, cardigans.

| Key | Label | How to measure |
|---|---|---|
| `chest` | Chest (pit-to-pit) | Across the chest from armpit seam to armpit seam × 2. |
| `waist_outer` | Waist | Across the garment at the natural waist level × 2, laid flat. |
| `shoulder_width` | Shoulder width | Seam to seam across the top of the shoulders, laid flat. |
| `sleeves` | Sleeve length | From the shoulder seam to the cuff. |
| `body_length` | Body length | From the highest point of the shoulder to the bottom hem. |
| `upper_arm` | Upper arm | Around the widest part of the sleeve at the upper arm. |

### 2.5 Shoes

Sneakers, boots, sandals, formal shoes.

| Key | Label | How to measure |
|---|---|---|
| `shoe_size` | Size | Manufacturer size — user selects a sizing system (EU / US / UK) and enters the number. |
| `shoe_width` | Width | Widest point of the outsole in cm. Or use width letter (N / M / W / XW). |

### 2.6 Accessory

Belts, hats, scarves, gloves, ties, jewellery.

| Key | Label | How to measure |
|---|---|---|
| `length` | Length | Total length of the item (e.g. belt end-to-end, scarf length). |
| `width` | Width | Width of the item (e.g. belt width, tie blade width). |

### 2.7 Bag

Backpacks, totes, crossbody, clutches.

| Key | Label | How to measure |
|---|---|---|
| `bag_height` | Height | From base to top edge of the bag body (excluding handles). |
| `bag_width` | Width | Across the widest point of the bag body. |
| `bag_depth` | Depth | Front to back of the bag body. |

---

## 3. Body ↔ Garment Comparison Logic (future)

The system uses body and garment measurements together to evaluate fit:

| Body measurement | Compared with (garment) | Fit insight |
|---|---|---|
| `body_bust` | Top/Outerwear `chest` | Chest/bust room — snug, standard, roomy. |
| `body_shoulder_width` | Top/Outerwear `shoulder_width` | Shoulder fit — too narrow, fitted, relaxed, oversized. |
| `body_waist` | Top `waist_top` / Bottom `waist` / Outerwear `waist_outer` | Waist fit. |
| `body_hip` | Bottom `hip` | Hip room. |
| `body_upper_arm` | Top/Outerwear `upper_arm` | Sleeve tightness around upper arm. |
| `body_sleeve_length` | Top/Outerwear `sleeves` | Sleeve length fit — too short, correct, long. |
| `body_upper_body_length` | Top/Outerwear `body_length` | Garment length — cropped, regular, longline, oversized. |
| `body_inseam` | Bottom `inseam` | Trouser length — ankle, full length, cropped. |
| `body_thigh` | Bottom `thigh` | Thigh room — slim, standard, relaxed. |
| `body_foot_length` | Shoes `shoe_size` | Shoe size accuracy. |

The **ease** (garment dimension minus body dimension) determines the fit
category. Thresholds, pairing, and aggregation are defined in
[`docs/fit-ease-thresholds.md`](../../docs/fit-ease-thresholds.md); the Dart
implementation lives under `lib/fit/`.

---

## 4. Measurement Tools

Users should be guided to use the right tools for accurate measurements.

| Tool | Description | Used for |
|---|---|---|
| **Flexible tape measure** | A soft, 150 cm (60 in) tape measure. The primary tool for all body and garment measurements. | All circumference and length measurements. |
| **Measuring gauge / seam gauge** | A small ruler with a sliding marker, typically 15 cm (6 in). | Sleeve length and other short precise measurements. |
| **Ruler / straightedge** | A rigid ruler (30 cm or longer). | Flat-laid garment widths and lengths where a straight reference is helpful. |
| **Flat surface** | A table or floor where the garment can be laid flat without wrinkles. | All garment measurements — never measure garments while hanging or worn. |

**Tips to show in the app's help dialogs:**
- Keep the tape snug but not tight — you should be able to slide a finger underneath.
- For body measurements, wear thin clothing or measure over undergarments only.
- For garment measurements, lay the item flat on a hard surface, smoothed out with no wrinkles.
- Measure twice, enter once.

---

## 5. Implementation Notes

- **Storage**: All measurements are stored in CM with 1-decimal precision. UI
  converts IN → CM on save (`cm = in × 2.54`).
- **Source of measurement data**: In production, measurements may also come from
  brand size charts or user-scanned product pages. For MVP, user manually
  enters values.
- **Which fields to show**: The "Complete item" screen (step 2) shows
  `measurementsForType(itemType)` from `add_item_models.dart`. The mapping
  must stay in sync with the tables above.
- **Skirts vs. Pants**: Both are "Bottom item" in the `ItemType` enum. The UI
  should detect or let the user specify sub-type (pants vs. skirt) to show
  the correct measurement set (Section 2.2 vs. 2.3).
- **Onboarding body measurements**: Collected across
  `body_measurement_onboarding_screen.dart`,
  `top_body_measurement_onboarding_screen.dart`, and
  `bottom_body_measurement_onboarding_screen.dart`. Ensure their field keys
  match Section 1 above.
- **Validation**: Measurement values must be positive numbers. Reasonable ranges
  should be enforced (e.g. shoulder width 20–80 cm, waist 40–200 cm) to
  catch typos.
- **"×2" convention**: Many garment measurements are taken on a **flat-laid**
  item (half width). The raw number is the **half** width; the system doubles
  it internally for body comparison. The UI labels and help text should
  clarify this to the user ("Measure across the front, we'll double it").

---

## 6. Changelog

| Date | Author | Change |
|---|---|---|
| 2026-03-23 | AI assistant | Initial version — body + garment measurement definitions for all item types. |
| 2026-03-23 | AI assistant | Added neckline depth, shoulder slope, armhole depth, sleeve circumference to body. Added skirt sub-type. Added measurement tools section. Updated sleeve length to use center-back method. |
| 2026-03-23 | AI assistant | Simplified to essential fit measurements only. Tops/Outerwear: 6 fields (chest, waist, shoulder width, sleeve length, body length, upper arm). Pants: 5 fields. Skirts: 3 fields. Shoes: 2 fields. Bags: 3 fields (removed strap drop). Removed neckline depth, armhole depth, shoulder slope, sleeve circumference, hem, across back, knee, leg opening, outseam, insole length from garment measurements. Simplified body measurements to match. |
