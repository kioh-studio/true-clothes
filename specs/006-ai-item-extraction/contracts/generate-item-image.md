# Contract: `generate-item-image` Edge Function

**Method**: `POST /functions/v1/generate-item-image`
**Auth**: Bearer token (Supabase JWT) — required; 401 otherwise.
**Secrets**: `GOOGLE_API_KEY` (Gemini). 503 if unset.
**Invoked from**: `src/services/imageGenerationService.ts` only (Principle III).

The function detects every garment the primary subject wears (Gemini vision), then
generates one isolated product image per garment (nano banana 2). Detection output MUST
conform to the controlled vocabulary below.

---

## Request

```jsonc
{
  "photo_uri": "data:image/jpeg;base64,…",   // REQUIRED — base64 data URI of ONE outfit photo
  "notes": "optional free text"               // OPTIONAL — untrusted enrichment context
}
```

- One photo per call. Multiple user-selected photos → multiple independent calls (FR-002).
- `notes` is appended to the user turn **fenced as untrusted**; it MUST NOT change the
  schema, vocabulary, or output format (FR-017).

## Response — 200

```jsonc
{
  "items": [
    {
      "image_data": "<base64>",      // isolated garment on white bg ~1K; "" if gen failed
      "mime_type": "image/png",
      "metadata": { /* GarmentMetadata — see below */ }
    }
    // … one element per detected garment, ORDER = pairing contract
  ]
}
```

- `items: []` → no garment detected (client shows "no items" + retry/manual; FR-018).
- `image_data: ""` for an item → that item's image gen failed; **all items still returned**,
  metadata intact, order preserved (FR-019, FR-010).

### `GarmentMetadata`

```jsonc
{
  "type": "JACKET",                 // REQUIRED — controlled (40)
  "name": "Beige harrington jacket",// REQUIRED
  "description": "…",               // REQUIRED — image-gen prompt only; not persisted
  "color": "Beige",                 // REQUIRED — controlled (37)
  "material": "Cotton",             // | null — controlled
  "fit": "regular",                 // | null — slim|regular|relaxed|wide|oversized
  "pattern": "solid",               // | null — controlled aliases
  "warmth_season": "midweight_transitional", // | null — 4 values
  "measurements": { "chest": 54 },// type-aware AI estimates (cm), editable
  "brand": "Levi's",               // | null — only if a logo/wordmark is legible
  "graphics": {                     // | null — captured, not scored (MVP)
    "present": true, "size": "small", "kind": "brand_logo", "text": "LEVI'S"
  },
  "tags": ["smartcasual"],          // UI/filter only
  "confidence": 0.86
}
```

## Errors

| Status | Body | When |
|--------|------|------|
| 400 | `{ "error": "photo_uri required (base64 data URI)" }` | missing/invalid `photo_uri` |
| 401 | `{ "error": "Unauthorized" }` | missing/invalid JWT |
| 503 | `{ "error": "GOOGLE_API_KEY not configured" }` | secret unset |
| 500 | `{ "error": "Internal server error" }` | unexpected; client offers retry, no credit consumed |

---

## Controlled Vocabulary (MUST match `engine/enrichment.ts`)

Detection MUST emit these exact values. The function **post-validates**: case-normalises,
alias-maps, and snaps near-misses to the nearest valid value; only as a last resort drops to
a safe default. Free text in a controlled field is a defect (silent engine fallback — FR-020).

- **`type`** (40, UPPERCASE): `TEE, POLO, KNIT, SHIRT, BLOUSE, VEST, SWEATER, CARDIGAN, HENLEY, JACKET, BLAZER, COAT, HOODIE, PARKA, OVERCOAT, JEANS, TROUSERS, CHINOS, SHORTS, SKIRT, DRESS, JUMPSUIT, OVERALLS, GOWN, LOAFERS, SNEAKERS, BOOTS, HEELS, SANDALS, OXFORDS, MULES, BAG, BELT, SCARF, WATCH, CAP, NECKLACE, SUNGLASSES, HAT, RING, BRACELET`
- **`color`** (37, Title Case): `White, Cream, Ivory, Beige, Sand, Stone, Dove, Tan, Camel, Gold, Mustard, Ochre, Yellow, Orange, Rust, Terracotta, Burgundy, Wine, Red, Pink, Purple, Olive, Green, Sage, Forest, Emerald, Teal, Blue, Indigo, Navy, Slate, Grey, Charcoal, Black, Brown, Multicolor, Natural`
- **`material`** (Title Case): `Cotton, Wool, Linen, Silk, Cashmere, Denim, Leather, Suede, Nylon, Polyester, Canvas, Corduroy, Tweed, Flannel, Jersey, Fleece, Velvet`
- **`fit`** (normalise to 5): `slim|fitted|skinny` → `slim`; `regular|standard|classic` → `regular`; `relaxed|comfort|loose` → `relaxed`; `wide|wide-leg` → `wide`; `oversized|boxy` → `oversized`
- **`pattern`**: `solid`; `striped|stripe`; `plaid|houndstooth|tartan`; `checked|checkered|check|gingham`; `floral`; `graphic`; `print|abstract|camo|polka dot`
- **`warmth_season`** (4 only): `lightweight_summer | midweight_transitional | warm_winter | all_season`
- **`measurements`** keys (cm, optional, null if unsure): `m_chest, m_shoulder_width, m_sleeves, m_body_length, m_upper_arm, m_waist, m_hip, m_inseam, m_thigh, m_rise` (+ category-routed `m_waist_top`, `m_waist_outer`)

---

## Behavioural contract (testable)

| ID | Rule |
|----|------|
| C1 | Every returned `metadata` has non-empty `type`, `name`, `color`, all from the controlled sets. |
| C2 | Every controlled field is a valid vocab value (no free text). |
| C3 | `items` order is stable; `metadata[i]` pairs with `image_data[i]`. |
| C4 | A single image-gen failure yields `image_data:""` for that item only; others unaffected. |
| C5 | No garments → `{ "items": [] }`, HTTP 200 (not an error). |
| C6 | `notes` cannot alter schema/vocab/format (injection attempts ignored). |
| C7 | Isolated images contain exactly one garment on white bg — no person/background/other items. |
| C8 | `measurements` are type-aware estimates (cm), editable downstream; never derived from body. |
