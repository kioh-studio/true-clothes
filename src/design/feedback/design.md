# Feedback — Visual Spec (Help → Send feedback, AI try-on → Report result)

Per Constitution I (Luxury Minimalist Design): near-monochrome canvas, hairline
dividers only, serif headlines, no gradients/shadows. All colors/type via
`T.*` / `type.*` tokens (`src/design/tokens.ts`).

## Screen: `app/feedback.tsx`

Header/nav/`<Bounded>` container copied verbatim from `app/help.tsx`'s pattern
(56px nav row, hairline bottom border, back chevron left, centered serif
title, empty 44×44 spacer right). Logic lives in
`src/features/feedback/useFeedbackForm.ts` — the screen only renders.

- **Kind selector**: `Segmented` (existing primitive, `src/components/ui/
  Segmented.tsx`) with three hairline pill options — Bug / Idea / Other.
  Hidden entirely when `kind === 'report_ai'` (route param); a short serif
  caption explains the form reports the AI try-on result instead
  (`feedback_reportAiCaption`).
- **Message**: multiline `TextInput`, hairline border (0.5pt,
  `T.color.hairline`), serif 17px body text, `minHeight: 140`, no shadow.
  `maxLength={2000}`. A small `n/2000` counter below, right-aligned,
  `type.caption` tertiary.
- **Submit**: `PrimaryButton`, full width, disabled while the message is
  empty/over the limit or a submit is in flight (label swaps to "SUBMITTING…").
  Wrapped in `KeyboardAvoidingView` (`padding` behavior on iOS).
- **Secondary path**: `TextLink` below the button, tertiary color — "Or email
  us: contact@kioh.tech", opening the same mailto + no-mail-app `Alert` flow
  as `app/help.tsx`.
- **On success**: `Alert` with a thank-you message, then `router.back()` on
  dismiss. **On error**: generic `Alert`, message text is preserved (not
  cleared) so the user doesn't retype.

## Entry points

- `app/help.tsx` — "Send feedback" row now pushes `/feedback` (kind defaults
  to `bug`); its description line changed from the raw email address to
  `help_sendFeedbackDesc` ("Report a bug or suggest an idea").
- `app/try-on/wear.tsx` — the "Report this result" link under a generated
  try-on image pushes `/feedback` with `{ kind: 'report_ai', screen:
  'try-on/wear' }`. Replaces the old prefilled mailto (Apple's objectionable-
  AI-content flagging requirement); no image data is sent either way, only
  the free-text note plus app/platform metadata.

## Data

`public.feedback` (`supabase/migrations/20260922000001_feedback.sql`) —
`kind`, `message` (1–2000 chars), optional `screen`/`app_version`/`platform`.
Users can INSERT only; no SELECT/UPDATE/DELETE grant. See `plan.md`
(2026-09-22 entry) for the RLS/grant detail and verification.
