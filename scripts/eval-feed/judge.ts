// Blind A/B judge for two eval-feed snapshots (see run.ts).
// Renders each feed as a plain numbered list (items + colors + formula only —
// NO scores, NO engine identity) so a judge (human or LLM) can't be biased by
// knowing which snapshot came from which engine version.
//
// Usage:
//   deno run --allow-read --allow-net --allow-env scripts/eval-feed/judge.ts A.json B.json [--out prompt.txt]
//
// With GOOGLE_API_KEY set: runs 3 trials against Gemini (JUDGE_MODEL, default
// gemini-2.5-flash — override via GEMINI_FLASH_MODEL; retires 2026-10-16,
// priced upgrade path in generate-item-image/index.ts's VISION_MODEL comment),
// alternating which side is labeled "Feed X" vs "Feed Y" (A→X/B→Y, then
// flipped, then A→X again) to cancel out any positional bias, and prints a
// per-trial verdict + majority.
//
// Without GOOGLE_API_KEY: writes the full blind prompt (trial 1 framing) to
// --out (or stdout) so a human or a separate LLM session can judge manually.
// --allow-read is needed to read the two snapshot files (and --allow-write
// only if --out is used to write the prompt to a file) in addition to the
// --allow-net/--allow-env named in the spec CLI.

interface SnapshotItem {
  slot: string;
  name: string;
  type: string;
  color: string;
  material?: string | null;
  fit?: string | null;
  pattern?: string | null;
}

interface SnapshotOutfit {
  rank: number;
  formula: string;
  tier: number;
  totalScore: number;
  items: SnapshotItem[];
}

interface Snapshot {
  engineDir: string;
  generatedFor: string;
  outfits: SnapshotOutfit[];
}

// ─── CLI args ──────────────────────────────────────────────────────────────

function parseArgs(argv: string[]): { positional: string[]; flags: Record<string, string> } {
  const positional: string[] = [];
  const flags: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith('--')) {
      flags[arg.slice(2)] = argv[i + 1] ?? '';
      i++;
    } else {
      positional.push(arg);
    }
  }
  return { positional, flags };
}

const { positional, flags } = parseArgs(Deno.args);
const [pathA, pathB] = positional;

if (!pathA || !pathB) {
  console.error('Usage: deno run --allow-read --allow-net --allow-env judge.ts <A.json> <B.json> [--out <path>]');
  Deno.exit(1);
}

const snapA: Snapshot = JSON.parse(await Deno.readTextFile(pathA));
const snapB: Snapshot = JSON.parse(await Deno.readTextFile(pathB));

// ─── Blind rendering — items/colors/formula only, no scores/engine identity ─

function renderFeed(snapshot: Snapshot, label: string): string {
  const lines = snapshot.outfits.map((o, idx) => {
    const itemDesc = o.items
      .map(i => `${i.name} (${i.color}${i.material ? `, ${i.material}` : ''})`)
      .join(', ');
    return `${idx + 1}. [${o.formula}] ${itemDesc}`;
  });
  return `Feed ${label}:\n${lines.join('\n')}`;
}

function buildPrompt(feedXText: string, feedYText: string): string {
  return `You are a professional fashion stylist judging two AI-generated outfit feeds built from the SAME fixed wardrobe and the SAME user profile (smart-casual / minimalist style, neutral color preferences). Each feed lists its outfits as numbered [formula] item lists.

Judge which feed a professional stylist would prefer to show this user, based on:
1. Intentionality — outfits look deliberately composed, not randomly thrown together.
2. Color harmony — colors within each outfit work well together.
3. Variety — outfits are meaningfully distinct; avoid rewarding a feed that pads itself with near-duplicate outfits repeating the same core pieces.
4. Overall taste — would a stylist actually put this outfit on a client.

${feedXText}

${feedYText}

Pick an overall winner between Feed X and Feed Y (or "tie" if genuinely indistinguishable), score each feed 1-10, and explain your reasoning briefly.`;
}

// ─── Trial plan: alternate labeling to cancel positional bias ──────────────
// Trial 1: A→X, B→Y | Trial 2: A→Y, B→X (flipped) | Trial 3: A→X, B→Y

const TRIALS: Array<{ xSource: 'A' | 'B'; ySource: 'A' | 'B' }> = [
  { xSource: 'A', ySource: 'B' },
  { xSource: 'B', ySource: 'A' },
  { xSource: 'A', ySource: 'B' },
];

function snapshotFor(source: 'A' | 'B'): Snapshot {
  return source === 'A' ? snapA : snapB;
}

// ─── No-key path: emit the blind prompt for manual/LLM judging ────────────

const apiKey = Deno.env.get('GOOGLE_API_KEY');

if (!apiKey) {
  const trial = TRIALS[0];
  const feedXText = renderFeed(snapshotFor(trial.xSource), 'X');
  const feedYText = renderFeed(snapshotFor(trial.ySource), 'Y');
  const prompt = buildPrompt(feedXText, feedYText);

  const header =
    `# Blind A/B judging prompt (GOOGLE_API_KEY not set — no automated call made)\n` +
    `# Feed X = snapshot "${pathA}" (label only; do not reveal to judge)\n` +
    `# Feed Y = snapshot "${pathB}" (label only; do not reveal to judge)\n` +
    `# Paste the prompt below into a human reviewer or a separate LLM session to judge blind.\n\n`;

  const output = header + prompt;

  if (flags.out) {
    await Deno.writeTextFile(flags.out, output);
    console.log(`GOOGLE_API_KEY not set — no automated judging performed.`);
    console.log(`Wrote the blind judging prompt to ${flags.out} for manual/LLM review.`);
  } else {
    console.log(`GOOGLE_API_KEY not set — no automated judging performed. Blind prompt below:\n`);
    console.log(output);
  }
  Deno.exit(0);
}

// ─── Gemini-backed path ─────────────────────────────────────────────────────

// This is a Deno script (see Deno.args/Deno.env/Deno.exit above, and the
// `deno run` usage line at the top of this file) — using Deno.env.get here,
// not process.env, to match the rest of the file.
const JUDGE_MODEL = Deno.env.get('GEMINI_FLASH_MODEL') || 'gemini-2.5-flash';

interface GeminiVerdict {
  winner: 'X' | 'Y' | 'tie';
  reasoning: string;
  xScore: number;
  yScore: number;
}

async function callGemini(prompt: string): Promise<GeminiVerdict> {
  const resp = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${JUDGE_MODEL}:generateContent`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-goog-api-key': apiKey!,
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: 'OBJECT',
            properties: {
              winner: { type: 'STRING', enum: ['X', 'Y', 'tie'] },
              reasoning: { type: 'STRING' },
              xScore: { type: 'NUMBER' },
              yScore: { type: 'NUMBER' },
            },
            required: ['winner', 'reasoning', 'xScore', 'yScore'],
          },
          temperature: 0.3,
          thinkingConfig: { thinkingBudget: 0 },
        },
      }),
    },
  );

  if (!resp.ok) {
    throw new Error(`Gemini API error ${resp.status}: ${await resp.text()}`);
  }

  const data = await resp.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error(`Gemini response missing text: ${JSON.stringify(data)}`);
  return JSON.parse(text) as GeminiVerdict;
}

const results: Array<{ trial: number; winnerSource: 'A' | 'B' | 'tie'; verdict: GeminiVerdict }> = [];

for (let t = 0; t < TRIALS.length; t++) {
  const trial = TRIALS[t];
  const feedXText = renderFeed(snapshotFor(trial.xSource), 'X');
  const feedYText = renderFeed(snapshotFor(trial.ySource), 'Y');
  const prompt = buildPrompt(feedXText, feedYText);

  const verdict = await callGemini(prompt);
  const winnerSource: 'A' | 'B' | 'tie' =
    verdict.winner === 'tie' ? 'tie' : verdict.winner === 'X' ? trial.xSource : trial.ySource;

  results.push({ trial: t + 1, winnerSource, verdict });

  console.log(`\n── Trial ${t + 1} (X=${trial.xSource}, Y=${trial.ySource}) ──`);
  console.log(`Winner: Feed ${verdict.winner} → source ${winnerSource}`);
  console.log(`Scores: X=${verdict.xScore}  Y=${verdict.yScore}`);
  console.log(`Reasoning: ${verdict.reasoning}`);
}

const counts = { A: 0, B: 0, tie: 0 };
for (const r of results) counts[r.winnerSource]++;

let majority: string;
if (counts.A > counts.B && counts.A > counts.tie) majority = `A (${pathA})`;
else if (counts.B > counts.A && counts.B > counts.tie) majority = `B (${pathB})`;
else majority = 'no clear majority / tie';

console.log(`\n── Majority (of 3 trials) ──`);
console.log(`A wins: ${counts.A}, B wins: ${counts.B}, ties: ${counts.tie}`);
console.log(`Majority verdict: ${majority}`);
