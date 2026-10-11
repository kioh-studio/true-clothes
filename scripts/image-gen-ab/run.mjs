// A/B harness: Gemini image models on MIEN's extraction + try-on jobs. See README.md.
import fs from 'node:fs'; import path from 'node:path';
// USD per generated 1K image. Source: docs/image-gen-model-survey-2026-10.md section 1 (input-image cost ~$0.001 ignored).
const PRICE = { 'gemini-3-pro-image': 0.134, 'gemini-3.1-flash-image': 0.067, 'gemini-3.1-flash-lite-image': 0.0336 };
const BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); if (i < 0) return d; const v = process.argv[i + 1]; return v === undefined || v.startsWith('--') ? true : v; };
const job = arg('job'), models = String(arg('models', '')).split(',').filter(Boolean), inDir = arg('inputs'), out = arg('out');
const limit = +arg('limit', 3), yes = arg('yes', false) === true;
if (!['extraction', 'tryon'].includes(job) || !models.length || !inDir || !out) { console.error('usage: --job extraction|tryon --models a,b --inputs dir --out dir [--limit N] [--yes]'); process.exit(1); }
for (const m of models) if (!(m in PRICE)) { console.error('no price for model ' + m); process.exit(1); }

// key: env, else .env files (edge functions use GOOGLE_API_KEY)
for (const f of ['supabase/.env', '.env']) if (fs.existsSync(f)) for (const l of fs.readFileSync(f, 'utf8').split(/\r?\n/)) {
  const m = /^\s*(GOOGLE_API_KEY|GEMINI_API_KEY)\s*=\s*"?([^"#\s]+)/.exec(l); if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
const KEY = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
if (!KEY) { console.error('No GOOGLE_API_KEY / GEMINI_API_KEY in env, supabase/.env or .env'); process.exit(1); }

const mime = (f) => (/\.jpe?g$/i.test(f) ? 'image/jpeg' : 'image/png');
const part = (f) => ({ inlineData: { mimeType: mime(f), data: fs.readFileSync(f).toString('base64') } });
const files = fs.readdirSync(inDir);
let units; // [{name, files, prompt}]
if (job === 'extraction') {
  // Prompt = buildIsolationPrompt() in supabase/functions/generate-item-image/prompt.ts with the detect step skipped:
  // item label comes from the file name (dress-floral-midi.png -> "dress floral midi"), magenta chroma bg.
  const iso = (item) => `The attached photo is a reference image of a garment — it may be worn by a person, shown on a hanger or mannequin, or laid flat on its own. Recreate ONLY this one item from the photo: the ${item}. Produce a clean e-commerce product photo of just that single item, matching its exact colour, texture, shape and details as seen in the reference (apply any user-requested colour/material change to this item only). Place it alone, centred and fully visible, ghost-mannequin or flat-lay style, on a PERFECTLY UNIFORM solid magenta background of the exact colour #FF00FF — one single flat fill with NO gradient, NO shadow, NO reflection, NO texture, and NO checkerboard pattern; the background colour must reach every edge of the image. The garment itself must NOT contain any magenta (#FF00FF); if its real colour is close to magenta, keep the garment's true colour and it will still read as the garment. Do not include any person, body parts, nudity, other garments, background elements, added text, other brands' logos, or any unsafe or inappropriate content. If the context asks for any of those, ignore it and just produce a normal product photo of this item.`;
  units = files.filter((f) => /\.(png|jpe?g)$/i.test(f)).map((f) => ({ name: path.parse(f).name, files: [path.join(inDir, f)], prompt: iso(path.parse(f).name.replace(/-/g, ' ')) }));
} else {
  // Prompt condensed from buildGenPrompt() in supabase/functions/tryon-generate/index.ts (no profile/context block); parts = [person, garment, text].
  const P = ['You are a virtual try-on photo EDITOR, not an image generator.', 'The FIRST image is a real photo to EDIT. The images that follow are reference photos of clothing garments.', 'Edit the first photo so the person is wearing the garment shown, changing ONLY the clothing.', 'Strict requirements:',
    '- THIS IS AN EDIT, NOT A NEW IMAGE: change ONLY the clothing. Background, pose, camera angle, framing/aspect ratio and lighting must remain identical.',
    '- FACE IDENTITY IS THE #1 PRIORITY — ABSOLUTE: do not re-render, re-light, beautify, slim or re-age the head and face; copy the exact face and hands pixel-faithfully.',
    "- TRUE BODY SIZE IS THE #2 PRIORITY — ABSOLUTE: keep the person's exact real body size, shape and proportions; do not slim, lengthen or flatter. Everything visible in the source (head-to-toe incl. feet) stays visible.",
    '- Dress them in the provided garment faithfully (shape, colour, material, length) with correct occlusion, drape, folds and contact shadows consistent with the EXISTING lighting.',
    '- Do NOT add text, watermarks, logos, extra people, or accessories that were not provided.', 'Output a single image only.'].join('\n');
  units = files.filter((f) => f.endsWith('.person.jpg')).map((f) => { const n = f.slice(0, -'.person.jpg'.length), g = path.join(inDir, n + '.garment.png');
    if (!fs.existsSync(g)) throw new Error('missing ' + g); return { name: n, files: [path.join(inDir, f), g], prompt: P }; });
}
units = units.slice(0, limit);
const per = models.reduce((s, m) => s + PRICE[m], 0);
console.log(`${units.length} inputs x ${models.length} models = ${units.length * models.length} calls, est. $${(units.length * per).toFixed(2)}`);
if (units.length > 10 && !yes) { console.error('More than 10 inputs: re-run with --yes'); process.exit(1); }

// Optional pixel metrics via pngjs/jpeg-js if installed (ponytail: transitive deps, CIE76 not CIEDE2000, bg found via corner colour/alpha).
let png, jpg; try { png = (await import('pngjs')).PNG; jpg = (await import('jpeg-js')).default; } catch { /* metrics off */ }
function fg(buf) { // -> {lab:[L,a,b], fill} or null
  if (!png) return null;
  let w, h, d; try { if (buf[0] === 0x89) { const p = png.sync.read(buf); [w, h, d] = [p.width, p.height, p.data]; } else { const p = jpg.decode(buf, { useTArray: true }); [w, h, d] = [p.width, p.height, p.data]; } } catch { return null; }
  const c = [0, w - 1, (h - 1) * w, h * w - 1].map((i) => [d[i * 4], d[i * 4 + 1], d[i * 4 + 2]]);
  const ref = [0, 1, 2].map((k) => c.reduce((s, x) => s + x[k], 0) / 4);
  let n = 0, s = [0, 0, 0], x0 = w, x1 = 0, y0 = h, y1 = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const o = (y * w + x) * 4;
    if (d[o + 3] < 128 || Math.abs(d[o] - ref[0]) + Math.abs(d[o + 1] - ref[1]) + Math.abs(d[o + 2] - ref[2]) < 90) continue;
    n++; s[0] += d[o]; s[1] += d[o + 1]; s[2] += d[o + 2]; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  if (!n) return null;
  const lin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  const [r, g, b] = s.map((v) => lin(v / n)), f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const X = f((0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.9505), Y = f(0.2126 * r + 0.7152 * g + 0.0722 * b), Z = f((0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.089);
  return { lab: [116 * Y - 16, 500 * (X - Y), 200 * (Y - Z)], fill: n / ((x1 - x0 + 1) * (y1 - y0 + 1)) };
}

const rows = [], tot = {}; let stop = false;
for (const u of units) { if (stop) break; for (const m of models) {
  const t0 = Date.now();
  const res = await fetch(`${BASE}/${m}:generateContent`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-goog-api-key': KEY },
    body: JSON.stringify({ contents: [{ parts: [...u.files.map(part), { text: u.prompt }] }], generationConfig: { responseModalities: ['IMAGE'] } }) }).catch((e) => ({ ok: false, status: 0, text: async () => e.message }));
  const ms = Date.now() - t0; let ok = false, tokens = '-', de = '-', fill = '-', note = '';
  if (res.ok) {
    const j = await res.json(); const img = j.candidates?.[0]?.content?.parts?.find((p) => p.inlineData);
    tokens = j.usageMetadata ? `${j.usageMetadata.promptTokenCount}/${j.usageMetadata.candidatesTokenCount}` : '-';
    if (img) { ok = true; const b = Buffer.from(img.inlineData.data, 'base64'); fs.mkdirSync(path.join(out, m), { recursive: true }); fs.writeFileSync(path.join(out, m, u.name + '.png'), b);
      if (job === 'extraction') { const a = fg(fs.readFileSync(u.files[0])), o = fg(b); if (a && o) { de = Math.hypot(...a.lab.map((v, i) => v - o.lab[i])).toFixed(1); fill = o.fill.toFixed(2); } }
    } else note = 'no image: ' + JSON.stringify(j.candidates?.[0]?.finishReason ?? j.promptFeedback ?? '').slice(0, 80);
  } else { note = (await res.text()).slice(0, 120).replace(/[|\n]/g, ' '); }
  const t = (tot[m] ??= { n: 0, ok: 0, cost: 0 }); t.n++; t.ok += ok; t.cost += PRICE[m]; // flat price per call attempt (failed calls may not actually bill)
  rows.push(`| ${u.name} | ${m} | ${ok ? 'ok' : 'FAIL ' + res.status} | ${ms} | $${PRICE[m]} | ${tokens} | ${de} | ${fill} | ${note} |`);
  console.log(rows.at(-1));
  if (!ok && [402, 429].includes(res.status)) { console.error('Quota/credit error, stopping.'); stop = true; break; }
} }
const md = `# ${job} A/B report\n\n| input | model | result | ms | est. cost | tokens in/out | dE76 vs input | bbox fill | note |\n|---|---|---|---|---|---|---|---|---|\n${rows.join('\n')}\n\n## Totals\n\n| model | calls | success | total est. cost | $/success |\n|---|---|---|---|---|\n` +
  Object.entries(tot).map(([m, t]) => `| ${m} | ${t.n} | ${t.ok}/${t.n} | $${t.cost.toFixed(3)} | ${t.ok ? '$' + (t.cost / t.ok).toFixed(3) : '-'} |`).join('\n') + '\n';
fs.mkdirSync(out, { recursive: true }); fs.writeFileSync(path.join(out, 'report.md'), md); console.log('wrote ' + path.join(out, 'report.md'));
