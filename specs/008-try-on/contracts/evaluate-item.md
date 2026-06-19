# Contract: `evaluate-item` Edge Function (NEW)

Deterministic server-side Verdict scoring for one prospective item. Deno runtime. Auth: same Supabase JWT pattern as `generate-outfits` (user resolved from the token; profile read server-side).

## Endpoint
`POST /functions/v1/evaluate-item`

## Request body (snake_case, edge-internal)
```jsonc
{
  "item": {
    "type": "SHIRT",                 // controlled type (UPPERCASE)
    "color": "Olive",                // controlled color name
    "material": "Cotton" ,           // controlled or null
    "fit": "regular",                // controlled or null
    "pattern": "solid",              // controlled or null
    "warmth_season": "all_season",   // controlled or null
    "measurements": { "m_chest": 54, "m_body_length": 70 } // cm, partial; may be {}
  }
  // user profile is loaded server-side from the JWT (body_measurements,
  // style_profiles.selected_styles, profiles.color_season/personal_palette).
  // Optionally accept a `locale` for explanation language ("vi" | "en").
}
```

## Response body
```jsonc
{
  "overall_score": 78,              // 0–100, or null if no criteria evaluable
  "recommendation": "worth_it",      // "great" | "worth_it" | "maybe" | "skip"
  "criteria": [
    { "key": "color",       "available": true,  "score": 88, "weight": 0.20, "explanation": "Olive sits inside your earth-tone palette." },
    { "key": "style",       "available": true,  "score": 72, "weight": 0.20, "explanation": "Reads quiet-luxury; aligns with Old Money." },
    { "key": "fit",         "available": true,  "score": 80, "weight": 0.25, "explanation": "Regular fit matches your preferred fit." },
    { "key": "measurement", "available": false, "score": null, "weight": 0.25, "explanation": "Add your chest/shoulder measurements to score this." },
    { "key": "fabric",      "available": true,  "score": 70, "weight": 0.10, "explanation": "Cotton is all-season and style-appropriate." }
  ]
}
```

## Rules
- All five `criteria` keys are ALWAYS present and in this order.
- `available:false` ⇒ `score:null`; excluded from `overall_score`; its weight is dropped and the remaining weights renormalized.
- A criterion is unavailable when its item attribute is missing (FR-009b) OR the required user-profile data is missing (FR-009a).
- `overall_score` weights Fit + Measurement above Color/Style/Fabric (FR-007). Default weights: fit 0.25, measurement 0.25, color 0.20, style 0.20, fabric 0.10 (tunable).
- `recommendation` bands (default, tunable): ≥85 great, 70–84 worth_it, 50–69 maybe, <50 skip.
- Scoring MUST import the shared item-level scoring module under `generate-outfits/engine/` (no duplicated math — Constitution V).
- Deterministic: same inputs → same output. No LLM. Target < 3s warm.

## Errors
- 400 invalid/empty `item`.
- 401 missing/invalid auth.
- 500 unexpected — client shows recoverable retry (FR-017); no state is persisted.

## Client mapping (`src/services/tryOnService.ts`)
Maps snake_case response → domain `Verdict` (camelCase: `overallScore`, `recommendation`, `criteria[].available/score/explanation`). Invoked from a `tryOnStore` action, never from a screen (Constitution III).
