# image-gen-ab

A/B Gemini image models for MIEN. Prices: `docs/image-gen-model-survey-2026-10.md`. Key: `GOOGLE_API_KEY` (env, `supabase/.env` or `.env`).

    node scripts/image-gen-ab/run.mjs --job extraction --models gemini-3-pro-image,gemini-3.1-flash-image --inputs assets/items --out scripts/image-gen-ab/out/run1 --limit 3

- extraction: every image in `--inputs`; prompt = `buildIsolationPrompt` (detect step skipped, item label from filename, magenta bg).
- tryon: pairs `<n>.person.jpg` + `<n>.garment.png`; prompt condensed from `tryon-generate` `buildGenPrompt`.
- `--limit` default 3; >10 inputs needs `--yes`. Stops on first 402/429.
- dE76 / bbox fill need `pngjs` + `jpeg-js` (present transitively); otherwise `-`. Not CIEDE2000, no validator, no chroma-key step.
- Cost is the flat per-image price per call (assumes 1K), not usage tokens.
