// Edge Function: generate-item-image  (feature 006-ai-item-extraction)
// POST /functions/v1/generate-item-image
// Auth: Bearer token (Supabase JWT). Requires GOOGLE_API_KEY secret.
//
// Input:  { photo_uri: string (base64 data URI of ONE worn-outfit photo), notes?: string }
// Output: { items: ExtractedItemWithImage[] }
//   ExtractedItemWithImage = { image_data: base64|"", mime_type: string, metadata: GarmentMetadata }
//
// Pipeline (Gemini for both steps):
//   1) gemini-2.5-flash (vision → text): detect every garment the primary subject wears,
//      returning a controlled-vocabulary JSON array. Each object is validated/snapped
//      server-side (prompt.ts) so no free text in controlled fields reaches the client.
//   2) gemini-3-pro-image-preview (nano banana 2, image out): for EACH garment, send the
//      ORIGINAL photo + an isolation prompt → an isolated product image on white background.
//      All garments run in parallel; array order is the data↔image pairing contract.
//   A per-item image failure yields image_data:"" (the item is still returned).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  EXTRACTION_SYSTEM, buildUserPrompt, buildIsolationPrompt, snapGarment, GarmentMetadata,
} from './prompt.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const VISION_MODEL = 'gemini-2.5-flash';
const IMAGE_GEN_MODEL = 'gemini-3-pro-image-preview'; // nano banana 2 / Gemini 3 Pro Image

interface ExtractedItemWithImage {
  image_data: string;
  mime_type: string;
  metadata: GarmentMetadata;
}

interface GeminiPart { text?: string; inlineData?: { mimeType: string; data: string } }
interface GeminiResponse { candidates?: Array<{ content?: { parts?: GeminiPart[] } }> }

// ─── Gemini helpers ───────────────────────────────────────────────────────────

async function geminiDetect(apiKey: string, image: GeminiPart, notes?: string): Promise<string> {
  const res = await fetch(`${GEMINI_BASE}/${VISION_MODEL}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-goog-api-key': apiKey },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: EXTRACTION_SYSTEM }] },
      contents: [{ parts: [image, { text: buildUserPrompt(notes) }] }],
      generationConfig: { responseModalities: ['TEXT'], temperature: 0.2 },
    }),
  });
  if (!res.ok) throw new Error(`Gemini vision ${res.status}: ${await res.text()}`);
  const data: GeminiResponse = await res.json();
  return data.candidates?.[0]?.content?.parts?.find((p) => p.text)?.text ?? '';
}

async function geminiIsolate(
  apiKey: string, image: GeminiPart, g: GarmentMetadata, notes?: string,
): Promise<{ data: string; mimeType: string } | null> {
  try {
    const res = await fetch(`${GEMINI_BASE}/${IMAGE_GEN_MODEL}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-goog-api-key': apiKey },
      body: JSON.stringify({
        // Reference photo + per-item isolation instruction → image out. Client downscales to ~1K.
        contents: [{ parts: [image, { text: buildIsolationPrompt(g, notes) }] }],
        generationConfig: { responseModalities: ['IMAGE'] },
      }),
    });
    if (!res.ok) {
      console.warn('[generate-item-image] isolate error:', res.status, await res.text());
      return null;
    }
    const data: GeminiResponse = await res.json();
    const part = data.candidates?.[0]?.content?.parts?.find((p) => p.inlineData);
    if (!part?.inlineData) return null;
    return { data: part.inlineData.data, mimeType: part.inlineData.mimeType };
  } catch (e) {
    console.warn('[generate-item-image] isolate threw:', (e as Error).message);
    return null;
  }
}

function parseImage(photoUri: string): GeminiPart {
  if (!photoUri.startsWith('data:')) {
    throw new Error('photo_uri must be a base64 data URI (data:image/...;base64,...)');
  }
  const comma = photoUri.indexOf(',');
  const mimeType = photoUri.slice(0, comma).replace('data:', '').replace(';base64', '');
  return { inlineData: { mimeType, data: photoUri.slice(comma + 1) } };
}

function parseGarments(rawJson: string): GarmentMetadata[] {
  let parsed: unknown = [];
  try {
    const cleaned = rawJson.replace(/```(?:json)?\n?/g, '').replace(/```\n?/g, '').trim();
    parsed = JSON.parse(cleaned);
  } catch {
    console.error('[generate-item-image] garment parse failed:', rawJson.slice(0, 300));
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  return parsed.map((p) => snapGarment(p)).filter((g): g is GarmentMetadata => g !== null);
}

// ─── Handler ──────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return jsonResponse({ ok: true }, 200);

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return jsonResponse({ error: 'Missing authorization header' }, 401);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return jsonResponse({ error: 'Unauthorized' }, 401);

    const apiKey = Deno.env.get('GOOGLE_API_KEY');
    if (!apiKey) return jsonResponse({ error: 'GOOGLE_API_KEY not configured' }, 503);

    const body = await req.json();
    const { photo_uri, notes } = body as { photo_uri?: string; notes?: string };
    if (!photo_uri || typeof photo_uri !== 'string') {
      return jsonResponse({ error: 'photo_uri required (base64 data URI)' }, 400);
    }

    let image: GeminiPart;
    try { image = parseImage(photo_uri); }
    catch (e) { return jsonResponse({ error: (e as Error).message }, 400); }

    // Step 1 — detect + snap to controlled vocab
    const rawJson = await geminiDetect(apiKey, image, notes);
    const garments = parseGarments(rawJson);
    if (garments.length === 0) return jsonResponse({ items: [] }, 200);

    // Step 2 — isolate each garment in parallel; preserve order (pairing contract)
    const items: ExtractedItemWithImage[] = await Promise.all(
      garments.map(async (metadata) => {
        const img = await geminiIsolate(apiKey, image, metadata, notes);
        return {
          image_data: img?.data ?? '',
          mime_type: img?.mimeType ?? 'image/png',
          metadata,
        };
      }),
    );

    return jsonResponse({ items }, 200);
  } catch (err) {
    console.error('[generate-item-image] Error:', err);
    return jsonResponse({ error: 'Internal server error' }, 500);
  }
});

function jsonResponse(data: unknown, status: number): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
