# Quickstart: On-Device "Extract by Item" — Validation Guide

End-to-end checks. **Requires a custom dev client (EAS Build) on a hardware device** — ML Kit / Vision do NOT run on the iOS simulator, and Expo Go cannot load the native module.

## Prerequisites

1. Build & install the dev client: `eas build --profile development` (iOS hardware device + Android device). Config plugin for `expo-item-extract` registered in `app.json`/`app.config`.
2. Camera/photo-library permissions granted (already configured by the wizard).
3. Test photos: (a) one garment on a plain wall/surface (flat-lay or hung), (b) a solid-colour item, (c) a garment with visible brand text, (d) a garment on a busy/non-plain background.

## Scenario 1 — Add one item, free & offline (P1)

1. **Enable airplane mode.** Wardrobe → Add → choose **"Extract by item"** (badge: On-device · Free) → pick photo (a).
2. **Expect**: processing on-device, then one Review entry with the garment **cut out on a transparent background**.
3. Confirm → saved. In Supabase later (when online): `select source, color, type, graphics from clothing_items order by added_at desc limit 1;` → `source='item'`.
4. **Expect**: no AI credit consumed (`select * from usage_credits ...` unchanged); worked fully offline.

✅ Pass: FR-001/003/004/005/013, SC-004.

## Scenario 2 — Colour & type pre-fill (P2)

1. Extract photo (b) (solid colour). **Expect**: `color` pre-filled to the nearest controlled colour (with swatch); `pattern` = solid.
2. **Expect**: `type` pre-filled when the on-device label maps confidently; otherwise the type field is **blank** for the user (not a wild guess).
3. Edit `type`/`color` in the card — pickers offer only controlled values.

✅ Pass: FR-006/007/008/011/014, SC-001/003.

## Scenario 3 — Logo capture (P3)

1. Extract photo (c) (visible brand text) → confirm-save.
2. `select graphics from clothing_items where graphics is not null order by added_at desc limit 1;` → `{present:true, text:"…"}`.
3. Generate outfit suggestions → unaffected by the logo data.

✅ Pass: FR-009.

## Scenario 4 — Busy background / graceful degradation

1. Extract photo (d) (non-plain background). **Expect**: a best-effort cut-out OR the original photo shown (with a hint), the entry still editable/saveable — no crash, no hard failure.
2. (Optional) On an iOS <17 device, confirm the keying/original fallback path still yields a usable entry.

✅ Pass: FR-015, Edge Cases.

## Scenario 5 — Transparent output composites cleanly

1. After saving an item via this method, view it in the wardrobe grid, item detail, and an outfit collage.
2. **Expect**: the transparent cut-out composites cleanly (no white box) on the cards/collage.

✅ Pass: FR-003 (transparent), SC-006.

## Scenario 6 — One item per photo

1. Extract a photo containing two items via "Extract by item". **Expect**: exactly one entry (dominant item); a hint suggests using "Extract by AI" for full outfits.

✅ Pass: Edge Cases.

## Regression

- "Extract by AI" method unchanged (006 still works; credit-gated).
- Manual add still works; demo account renders unchanged.

## References

- Interfaces: [contracts/extract-by-item.md](contracts/extract-by-item.md)
- Mapping: [data-model.md](data-model.md) · Decisions: [research.md](research.md)
- Shared wizard/save: `specs/006-ai-item-extraction/`
