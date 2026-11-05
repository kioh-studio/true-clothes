# Instruction — Wear log, Wishlist, Weather phase 1, Quota clarity (2026-11-05)

Approved by anh Khôi 2026-11-05 (backlog AK). Executor: Sonnet. Do the 4 parts IN ORDER;
after each part run `npx tsc --noEmit` and `npx jest` and fix what you broke before moving on.

## Global rules
- Supabase project is PAUSED: write migration FILES only, do NOT apply/push/deploy anything.
- Do NOT commit. Do NOT touch the engine's ranking/scoring code.
- All new UI strings in BOTH `src/i18n/locales` vi + en. Follow `src/design/tokens.ts` and the
  luxury-minimal rules in CLAUDE.md (hairline, no shadows/gradients).
- Every new table: RLS on, policies `TO authenticated`, `auth.uid() = user_id`.
- Use the existing local-date helper pattern (`localDateKey`, NOT `toISOString()` — UTC+7 bug).
- One small test per non-trivial pure function (aggregation, parsing, mapping). No new frameworks.
- Follow repo CLAUDE.md conventions: screens thin (logic in hooks/stores), Supabase only via
  `src/services/*`, no `any`. Document in the same session: UI changes → the relevant
  `src/design/**/design.md`; data/logic changes → a dated entry at the top of `plan.md`.
- If something needs a design decision not covered here: STOP that part, note it, continue with
  the next part, and report it at the end.

## Part 1 — Wear log (per item)

Problem: `outfit_interactions` is `unique(user_id, outfit_id, type)` so re-wearing an outfit
overwrites the old row; wears are per outfit, never per item. Keep the existing `'worn'`
interaction exactly as is (the taste engine reads it) — add a parallel per-item log.

Migration `supabase/migrations/20261105000001_wear_events.sql`:
```sql
create table public.wear_events (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  item_id    uuid not null references public.clothing_items(id) on delete cascade,
  worn_on    date not null,          -- client local date
  outfit_id  text,                   -- null = logged as a single item
  created_at timestamptz not null default now(),
  unique (user_id, item_id, worn_on)
);
create index wear_events_user_item_idx on public.wear_events (user_id, item_id, worn_on desc);
-- RLS: select / insert / delete own (no update needed).
```

`src/services/wearService.ts`:
- `logWear(itemIds: string[], outfitId?: string, date = localDateKey())` — upsert with
  `ignoreDuplicates: true` on `(user_id,item_id,worn_on)`.
- `unlogWear(itemIds: string[], date = localDateKey())` — delete those rows for that date.
- `fetchWearStats(): Promise<Record<itemId, { count: number; lastWornOn: string }>>` — select
  `item_id, worn_on`, aggregate in a PURE exported function `aggregateWear(rows)` (+ test).
- Only pass real wardrobe UUIDs (filter with a uuid regex); demo/static outfit items are skipped.

Wiring:
- `appStore.toggleWorn` / `markWorn`: after the existing logic, resolve the outfit's owned
  item ids (find how the outfit → items mapping works in the store/feed) and call
  `logWear` / `unlogWear`. Fire-and-forget like the existing writes (same in-flight counter).
- Keep `wearStats` in appStore (not persisted); load once after login / wardrobe load.
- `app/item/[id].tsx`: add a quiet "Mặc hôm nay" / "Worn today" toggle for that single item.
  Show "Đã mặc N lần · lần cuối {date}" when count > 0.

## Part 2 — Wishlist (verdict items under consideration)

Migration `supabase/migrations/20261105000002_wishlist_items.sql`:
```sql
create table public.wishlist_items (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  metadata    jsonb not null,               -- GarmentMetadata of the scanned item
  photo_path  text,                         -- wardrobe-photos bucket: {user_id}/wishlist/{id}.png
  price       numeric(12,2) check (price is null or price >= 0),
  source_url  text,
  verdict     jsonb,                        -- last Verdict
  verdict_at  timestamptz,
  wardrobe_fp text,                         -- wardrobe fingerprint at verdict time
  status      text not null default 'considering'
              check (status in ('considering','bought','skipped')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
-- RLS select/insert/update/delete own; index (user_id, status, created_at desc).
```
Storage: reuse bucket `wardrobe-photos` (policy already keys on first folder = auth.uid()).

`src/services/wishlistService.ts`: list / add / updateVerdict / setStatus / remove (remove
also deletes the storage object). `wardrobeFingerprint(items)` = PURE function:
`${count}:${max(updatedAt|createdAt)}` (+ test). Inspect `WardrobeItem` for the real field names.

Free tier: unlimited (no AI cost to save).

Flows:
- Try-on `ResultScreen`: secondary action "Lưu để cân nhắc" → `tryOnStore.saveToWishlist()`:
  upload `scannedItem.localImageUri`, insert row with metadata + current verdict + fingerprint.
  Must NOT delete the temp file before upload finishes. Disable after saved.
- New screen `app/wishlist.tsx` (entry: a row in the Profile tab menu, near Saved/History):
  grid of `considering` items + score. Footer line: "Đã không mua: {sum price of skipped}"
  (hide when 0 / no prices).
- Opening an item: if `wardrobeFingerprint(current) !== row.wardrobe_fp` → re-run
  `evaluateItem` with `skip_note: true`, save new verdict/fingerprint, show
  "{old} → {new}" delta. Otherwise show stored verdict, no network call.
- Edge fn `evaluate-item`: accept optional `body.skip_note === true` → skip the Gemini note
  (fit_note null). Backward compatible. (Deploy later — project paused.)
- Item actions: "Đã mua" → add to wardrobe reusing tryOnStore's ScannedItem→AddItemInput mapping
  (extract it into a shared pure function if needed; photo: download signed URL to a temp
  file and feed the normal add path), then delete the wishlist row. "Bỏ qua" → status
  `skipped`. "Xoá" → remove. Optional price input on the item.

## Part 3 — Weather phase 1 (no engine change)

Problem: band comes from `current_weather` at the moment the app opens (24°C at 7am, 34°C at noon).

- `fetchCurrentWeather`: add `&daily=apparent_temperature_max,apparent_temperature_min,precipitation_probability_max&timezone=auto&forecast_days=1`.
- `WeatherContext` gains OPTIONAL `feelsLikeMaxC`, `feelsLikeMinC`, `precipProbMax`
  (optional so persisted old contexts still type-check / load).
- `temperatureBand` = `getTemperatureBand(feelsLikeMaxC ?? temperature)`.
  Add `// ponytail: uses today's daytime max; evening users get today's band, add hourly if needed`.
- Extract a PURE `parseOpenMeteo(json)` and test it with a fixture (with and without `daily`).
- Home (`app/(tabs)/index.tsx`, next to the existing °C label): show "Cảm giác {max}°" when
  feels-like differs from current by ≥2°, and "Mưa {p}%" when `precipProbMax >= 50`.

## Part 4 — Quota clarity (Acloset lesson: never hold the closet hostage)

- Verify there is NO cap on number of wardrobe items / wishlist items anywhere (grep). Report.
- Add `CreditQuotaNote` (creditType `ai_extraction`) to the try-on `ScanScreen`, same pattern as
  `UploadStep.tsx`.
- Onboarding `wardrobe-intro`: one quiet line — VI: "Tủ đồ, wishlist, ghi mặc: miễn phí không
  giới hạn. Quét bằng AI: {n} lượt/tháng miễn phí." n from FREE_LIMITS.ai_extraction (export it;
  don't hardcode). EN equivalent.
- Do NOT change `app/paywall.tsx` (its no-numbers rule in `src/design/paywall/design.md` stays).

## Report back
Files changed per part, test counts before/after, anything stopped on, and the list of
migrations + edge fn that need applying/deploying once Supabase is restored.
