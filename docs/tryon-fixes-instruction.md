# Try-on fixes — verify pass, 2-pass face detect, telemetry, disclosure copy

Date: 2026-08-06. Approved by anh Khôi (backlog.md §K "Try-on riêng").
Executor: Sonnet 5. Scope: `supabase/functions/tryon-generate/index.ts`,
`src/features/try-on/**` (faceDetect.ts, faceComposite.ts, useWearOnYou.ts),
`src/services/tryOnWearService.ts`, `app/try-on/wear.tsx`, i18n en/vi.
Do NOT touch `generate-outfits/**` or `evaluate-item/**` (other agents own them),
do NOT edit `backlog.md`/`plan.md`, do NOT deploy, do NOT commit.

## Fix 1 — post-generate quality verify pass (server)

Today a 200-with-an-image is accepted unconditionally (`tryon-generate/index.ts:252`)
— bad anatomy / wrong garment still bills $0.13 and reaches the screen.

Do, in `tryon-generate/index.ts` after a successful generation:
1. Call Gemini with the GENERATED image + the garment descriptor list, using the
   same fetch pattern as `tryon-validate/index.ts` (temperature 0,
   `thinkingBudget: 0`, ~10s timeout). Model: read `TRYON_VERIFY_MODEL` env,
   default `gemini-2.5-flash`. Strict JSON schema response:
   `{ person_ok: boolean, garments_ok: boolean, anatomy_ok: boolean }` —
   person_ok = exactly one person, face visible; garments_ok = the listed
   garments appear on the person; anatomy_ok = no extra/deformed limbs or hands.
2. **Fail-open**: if the verify call itself errors/times out, treat as pass —
   never block a paid generation on the checker.
3. If any flag is false: refund the consumed credit (reuse the existing refund
   helper used on generation failure at :396-405) and include
   `quality_warning: true` in the success response. Still return the image —
   the user decides.
4. Client: `tryOnWearService` passes `quality_warning` through; `useWearOnYou`
   exposes it; `wear.tsx` renders a small muted caption when set —
   en: `This one came out imperfect — the credit was returned. Try again free.`
   vi: `Ảnh này chưa chuẩn — đã hoàn credit. Thử lại không mất lượt.`
   (i18n keys, both locales.)

## Fix 2 — 2-pass face detect for full-length photos (on-device)

BlazeFace short-range detects at 128×128; in a full-length shot the face is
~8-10px after letterboxing — marginal. This undermines the composite on BOTH the
source photo and the generated image.

Do, in `src/features/try-on/faceDetect.ts`:
1. After the full-image pass, if no detection OR the detected inter-eye distance
   is below a threshold (~4% of the source image's larger dimension — define a
   named constant, comment it CALIBRATION-PENDING), run a second pass on a crop:
   upper ~40% of the image height, full width (faces live there in full-length
   shots), via the same manipulateAsync path.
2. Map the crop-space detection back into full-image normalised coords (pure
   math — factor it into an exported helper).
3. Prefer a confident second-pass hit over a weak first-pass one; keep returning
   null when both miss (the composite already falls back gracefully).
4. Jest tests for the coord-mapping helper (pure) + the pass-selection logic
   (mock detections). No device dependency in tests.

## Fix 3 — composite outcome surfaced (kill the silent no-op)

Composite success/failure is currently `__DEV__` console only
(`useWearOnYou.ts:152-154`) — nobody can tell whether the feature works.

Do:
1. `useWearOnYou` exposes `faceApplied: boolean | null` (null = not attempted,
   true = composited, false = attempted-and-fell-back) alongside the result.
2. `wear.tsx`: when `faceApplied === false`, render a one-line muted caption —
   en: `Showing the AI-rendered face — your angle didn't match this time.`
   vi: `Đang dùng gương mặt AI dựng — góc chụp lần này chưa khớp.`
   When true, render nothing (success is invisible).
3. Persist a tiny local counter for debugging: MMKV/AsyncStorage key with
   `{attempts, applied, fallbacks}` incremented in the hook (follow whichever
   lightweight persistence pattern the feature already uses; if none fits, a
   module in `src/features/try-on/` using the app's storage util). No server
   calls, no new DB tables.

## Fix 4 — privacy disclosure copy

`en.json:1032` says "Your photo is never stored on our servers" — true for
storage, silent about the photo transiting Google Gemini twice.

Do: amend the photo-note copy (both locales), e.g.
en: `Your photo is processed by Google AI to create the image, and is never
stored — not by us, not by them.`
vi: `Ảnh của bạn được Google AI xử lý để tạo hình, và không được lưu lại ở đâu —
cả phía MIEN lẫn phía họ.`
Keep the luxury-minimal voice; adjust the "~10 seconds" latency claim in the
same block to `under a minute` / `chưa đến một phút` (the real budget is far
above 10s).

## Verification

- `npx tsc --noEmit` green; `npx jest src/features/try-on` (and any new test
  files) green.
- Deno-check `tryon-generate/index.ts` if the repo has a deno check task.
- Report per-fix summary + test tails + anything deferred. Note explicitly that
  device smoke-test of the composite remains pending (existing backlog item).
