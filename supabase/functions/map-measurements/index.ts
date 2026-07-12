// Edge Function: map-measurements  (feature 009-measurement-mapping)
// POST /functions/v1/map-measurements
// Auth: Bearer token (Supabase JWT). Requires GOOGLE_API_KEY secret.
//
// Input:  { raw_text: string, garment_type: string }
// Output: { mapped, unmapped, multiple_sizes, detected_size }
//
// Pipeline:
//   1. Derive measure group from garment_type (top/bottom/shoe/other).
//   2. Single Gemini gemini-2.5-flash text call with the structured system prompt.
//   3. Server-side sanitisation: clamp, range-drop, coerce types.
//   Returns the clean result as JSON 200.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  measureGroupForType, relevantKeys, buildSystemPrompt, sanitizeMapResult,
} from './prompt.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const TEXT_MODEL = 'gemini-2.5-flash';

// ─── Gemini helpers ───────────────────────────────────────────────────────────

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const TRANSIENT = new Set([429, 500, 502, 503, 504]);
// AbortController timeout (pattern + value mirror evaluate-item/note.ts's
// generateFitNote — same shape of call: one short text-only Gemini request).
// Without it, a hung Gemini call burns the whole edge-function wall-clock.
const TEXT_TIMEOUT_MS = 8000;

interface GeminiTextResponse {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
}

/**
 * Single Gemini text call with TRANSIENT retry loop (mirrors generate-item-image).
 * temperature 0.1 for deterministic mapping; responseModalities TEXT only.
 */
async function geminiMapText(
  apiKey: string,
  systemPrompt: string,
  userText: string,
): Promise<string> {
  const body = JSON.stringify({
    system_instruction: { parts: [{ text: systemPrompt }] },
    contents: [{ parts: [{ text: userText }] }],
    generationConfig: { responseModalities: ['TEXT'], temperature: 0.1 },
  });

  let lastErr = 'Gemini text call failed';
  for (let attempt = 0; attempt < 3; attempt++) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), TEXT_TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(`${GEMINI_BASE}/${TEXT_MODEL}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-goog-api-key': apiKey },
        signal: ctrl.signal,
        body,
      });
    } catch (e) {
      lastErr = `Gemini network: ${(e as Error).message}`;
      await sleep(600 * (attempt + 1));
      continue;
    } finally {
      clearTimeout(t);
    }
    if (res.ok) {
      const data: GeminiTextResponse = await res.json();
      return data.candidates?.[0]?.content?.parts?.find((p) => p.text)?.text ?? '';
    }
    lastErr = `Gemini ${res.status}: ${(await res.text()).slice(0, 300)}`;
    if (!TRANSIENT.has(res.status)) break; // 4xx (bad key, etc.) → don't retry
    await sleep(700 * (attempt + 1));
  }
  throw new Error(lastErr);
}

// ─── Handler ──────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return jsonResponse({ ok: true }, 200);

  try {
    // ── Auth ──────────────────────────────────────────────────────────────────
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return jsonResponse({ error: 'Missing authorization header' }, 401);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return jsonResponse({ error: 'Unauthorized' }, 401);

    // ── Rate limit ────────────────────────────────────────────────────────────
    {
      const { data: ok, error: rlErr } = await supabase.rpc('consume_rate_limit', {
        p_bucket: 'map_measurements',
        p_max: 30,
        p_window_secs: 60,
      });
      if (rlErr) {
        console.warn('[map-measurements] rate limit RPC error (fail open):', rlErr.message);
      } else if (ok === false) {
        return jsonResponse({ error: 'rate_limited' }, 429);
      }
    }

    // ── API key ───────────────────────────────────────────────────────────────
    const apiKey = Deno.env.get('GOOGLE_API_KEY');
    if (!apiKey) return jsonResponse({ error: 'GOOGLE_API_KEY not configured' }, 503);

    // ── Parse + validate input ────────────────────────────────────────────────
    const body = await req.json();
    const { raw_text, garment_type } = body as { raw_text?: unknown; garment_type?: unknown };

    if (!raw_text || typeof raw_text !== 'string' || !raw_text.trim()) {
      return jsonResponse({ error: 'raw_text must be a non-empty string' }, 400);
    }

    // Cap input to prevent token abuse.
    const cappedText = raw_text.slice(0, 4000);
    const typeStr = typeof garment_type === 'string' ? garment_type : '';

    // ── Derive group + keys ───────────────────────────────────────────────────
    const group = measureGroupForType(typeStr);
    const keys = relevantKeys(group);

    // Accessories carry no body measurements — return empty result immediately.
    if (keys.length === 0) {
      return jsonResponse(
        { mapped: {}, unmapped: [], multiple_sizes: false, detected_size: null },
        200,
      );
    }

    // ── Gemini call ───────────────────────────────────────────────────────────
    const systemPrompt = buildSystemPrompt(group, keys);
    let rawOutput: string;
    try {
      rawOutput = await geminiMapText(apiKey, systemPrompt, cappedText);
    } catch (e) {
      const detail = (e as Error).message;
      console.error('[map-measurements] Gemini error:', detail);
      return jsonResponse({ error: 'Measurement mapping service error', detail }, 502);
    }

    // ── Sanitise + return ─────────────────────────────────────────────────────
    const result = sanitizeMapResult(rawOutput, keys);
    return jsonResponse(result, 200);
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error('[map-measurements] Error:', detail);
    return jsonResponse({ error: 'Internal server error', detail }, 500);
  }
});

function jsonResponse(data: unknown, status: number): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
