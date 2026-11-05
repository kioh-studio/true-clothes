// wearService — per-item wear log (table wear_events). Parallel to the
// per-outfit 'worn' interaction; never replaces it.

import { sb } from './supabase';
import { localDateKey } from '../utils/localDateKey';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface WearStat { count: number; lastWornOn: string }
export type WearStats = Record<string, WearStat>;

/** Keep only real wardrobe UUIDs (demo/static ids are skipped). */
export function realItemIds(ids: string[]): string[] {
  return [...new Set(ids.filter(id => UUID_RE.test(id)))];
}

/** Outfit ids are pipe-joined slot item ids, optionally prefixed `gen_`. */
export function itemIdsFromOutfitId(outfitId: string): string[] {
  return realItemIds(outfitId.replace(/^gen_/, '').split('|'));
}

/** Pure: rows → per-item { count, lastWornOn }. */
export function aggregateWear(rows: { item_id: string; worn_on: string }[]): WearStats {
  const out: WearStats = {};
  for (const r of rows) {
    const cur = out[r.item_id];
    if (!cur) out[r.item_id] = { count: 1, lastWornOn: r.worn_on };
    else {
      cur.count += 1;
      if (r.worn_on > cur.lastWornOn) cur.lastWornOn = r.worn_on;
    }
  }
  return out;
}

export async function logWear(
  itemIds: string[], outfitId?: string, date: string = localDateKey(),
): Promise<void> {
  const ids = realItemIds(itemIds);
  if (ids.length === 0) return;
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return;
  const { error } = await sb.from('wear_events').upsert(
    ids.map(item_id => ({ user_id: user.id, item_id, worn_on: date, outfit_id: outfitId ?? null })),
    { onConflict: 'user_id,item_id,worn_on', ignoreDuplicates: true },
  );
  if (error) console.warn('[wear] log failed:', error.message);
}

export async function unlogWear(itemIds: string[], date: string = localDateKey()): Promise<void> {
  const ids = realItemIds(itemIds);
  if (ids.length === 0) return;
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return;
  const { error } = await sb.from('wear_events')
    .delete().eq('user_id', user.id).eq('worn_on', date).in('item_id', ids);
  if (error) console.warn('[wear] unlog failed:', error.message);
}

export async function fetchWearStats(): Promise<WearStats> {
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return {};
  const { data, error } = await sb.from('wear_events')
    .select('item_id, worn_on').eq('user_id', user.id);
  if (error) {
    console.warn('[wear] fetch failed:', error.message);
    return {};
  }
  return aggregateWear((data ?? []) as { item_id: string; worn_on: string }[]);
}
