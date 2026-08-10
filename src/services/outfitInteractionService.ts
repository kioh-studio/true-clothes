import { sb } from './supabase';
import { OutfitInteraction } from '../types/outfit';

export class OutfitInteractionError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'OutfitInteractionError';
  }
}

async function upsertInteraction(outfitId: string, type: string, extra: Record<string, unknown> = {}) {
  const { data: { user } } = await sb.auth.getUser();
  if (!user) throw new OutfitInteractionError('Not authenticated');

  const { error } = await sb.from('outfit_interactions').upsert(
    { user_id: user.id, outfit_id: outfitId, type, ...extra },
    { onConflict: 'user_id,outfit_id,type' },
  );
  if (error) throw new OutfitInteractionError(`Failed to upsert ${type}`, error);
}

async function deleteInteraction(outfitId: string, type: string) {
  const { data: { user } } = await sb.auth.getUser();
  if (!user) throw new OutfitInteractionError('Not authenticated');

  const { error } = await sb.from('outfit_interactions')
    .delete()
    .match({ user_id: user.id, outfit_id: outfitId, type });
  if (error) throw new OutfitInteractionError(`Failed to delete ${type}`, error);
}

export async function saveOutfit(outfitId: string, outfitData?: Record<string, unknown>) {
  await upsertInteraction(outfitId, 'saved', outfitData ? { outfit_data: outfitData } : {});
}

export async function unsaveOutfit(outfitId: string) {
  await deleteInteraction(outfitId, 'saved');
}

export async function markWorn(outfitId: string, outfitData?: Record<string, unknown>) {
  await upsertInteraction(outfitId, 'worn', {
    worn_at: new Date().toISOString(),
    ...(outfitData ? { outfit_data: outfitData } : {}),
  });
}

export async function unmarkWorn(outfitId: string) {
  await deleteInteraction(outfitId, 'worn');
}

export async function scheduleOutfit(outfitId: string, dateKey: string, outfitData?: Record<string, unknown>) {
  await upsertInteraction(outfitId, 'scheduled', {
    scheduled_for: dateKey,
    ...(outfitData ? { outfit_data: outfitData } : {}),
  });
}

export async function unscheduleOutfit(outfitId: string) {
  await deleteInteraction(outfitId, 'scheduled');
}

// Behavior-event logging (Q18): one impression row per outfit the feed ever
// showed, tagged with curated/formula so save-rates can be compared between
// LLM-curated and rule-only batches. Fire-and-forget; first impression wins.
export interface ImpressionEntry {
  outfitId: string;
  curated: boolean;
  formula?: string;
  position: number;
}

export async function logImpressions(entries: ImpressionEntry[]): Promise<void> {
  if (entries.length === 0) return;
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return;

  const rows = entries.map(e => ({
    user_id: user.id,
    outfit_id: e.outfitId,
    type: 'impression',
    outfit_data: { curated: e.curated, formula: e.formula ?? null, position: e.position },
  }));

  const { error } = await sb.from('outfit_interactions').upsert(rows, {
    onConflict: 'user_id,outfit_id,type',
    ignoreDuplicates: true,
  });
  if (error) console.warn('[outfitInteractions] impression log failed:', error.message);
}

// Feed-signals (2026-08-07): two lightweight behaviour events consumed by the
// server taste vector (engine/taste.ts) — `viewed` (tap into outfit detail
// from the feed, weak positive) and `dismissed` (swipe-left on a feed card,
// explicit negative). Same outfit_data shape as impressions {formula,
// position, curated} so the server-side slot-key parsing is identical.
// Fire-and-forget, same as logImpressions: unique-conflict on a repeat
// view/dismiss of the same outfit is expected (not an error), so we
// `ignoreDuplicates` rather than surface it, and swallow any other failure —
// losing one behaviour-event row must never break navigation/the gesture.
export interface FeedSignalEntry {
  outfitId: string;
  curated: boolean;
  formula?: string;
  position: number;
}

export async function logViewed(entry: FeedSignalEntry): Promise<void> {
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return;

  const { error } = await sb.from('outfit_interactions').upsert(
    {
      user_id: user.id,
      outfit_id: entry.outfitId,
      type: 'viewed',
      outfit_data: { curated: entry.curated, formula: entry.formula ?? null, position: entry.position },
    },
    { onConflict: 'user_id,outfit_id,type', ignoreDuplicates: true },
  );
  if (error) console.warn('[outfitInteractions] viewed log failed:', error.message);
}

export async function logDismissed(entry: FeedSignalEntry): Promise<void> {
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return;

  const { error } = await sb.from('outfit_interactions').upsert(
    {
      user_id: user.id,
      outfit_id: entry.outfitId,
      type: 'dismissed',
      outfit_data: { curated: entry.curated, formula: entry.formula ?? null, position: entry.position },
    },
    { onConflict: 'user_id,outfit_id,type', ignoreDuplicates: true },
  );
  if (error) console.warn('[outfitInteractions] dismissed log failed:', error.message);
}

export async function fetchInteractions(): Promise<OutfitInteraction[]> {
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return [];

  const { data, error } = await sb
    .from('outfit_interactions')
    .select('*')
    .eq('user_id', user.id);

  if (error) throw new OutfitInteractionError('Failed to fetch interactions', error);
  return (data ?? []).map((r: Record<string, unknown>): OutfitInteraction => ({
    id:            r.id as string,
    userId:        r.user_id as string,
    outfitId:      r.outfit_id as string,
    type:          r.type as OutfitInteraction['type'],
    outfitData:    (r.outfit_data as Record<string, unknown> | null) ?? null,
    wornAt:        (r.worn_at as string | null) ?? null,
    scheduledDate: (r.scheduled_for as string | null) ?? null,
    createdAt:     r.created_at as string,
    updatedAt:     r.created_at as string,
  }));
}

export async function fetchWornCooldownIds(): Promise<string[]> {
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return [];

  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await sb
    .from('outfit_interactions')
    .select('outfit_id')
    .eq('user_id', user.id)
    .eq('type', 'worn')
    .gte('worn_at', cutoff);

  if (error) return [];
  return (data ?? []).map((r: { outfit_id: string }) => r.outfit_id);
}
