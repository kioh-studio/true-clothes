// collectionsService — sole point of contact with the collections and
// collection_items tables. Screens and stores MUST NOT import `sb` directly.
//
// Collections group WARDROBE ITEMS (many-to-many). Persisted server-side; an item
// may belong to multiple collections.

import { sb } from './supabase';
import { Collection } from '../data';

// ─── Error type ──────────────────────────────────────────────────────────────

export class CollectionsDbError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'CollectionsDbError';
  }
}

// ─── Internal DB row types ───────────────────────────────────────────────────

interface CollectionRow {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  collection_items: { item_id: string }[] | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

// Matches the "CREATED MON YEAR" label style used by the demo collections.
export function createdLabel(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return 'CREATED';
  return `CREATED ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

function rowToCollection(row: CollectionRow): Collection {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? '',
    createdDate: createdLabel(row.created_at),
    itemIds: (row.collection_items ?? []).map(ci => ci.item_id),
  };
}

async function currentUserId(): Promise<string | null> {
  const { data: { user } } = await sb.auth.getUser();
  return user?.id ?? null;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Fetch all collections for the authenticated user, with their item IDs.
 * Returns null if not authenticated (so callers can keep a local/demo fallback);
 * returns [] when authenticated with no collections.
 */
export async function fetchMyCollections(): Promise<Collection[] | null> {
  const userId = await currentUserId();
  if (!userId) return null;

  const { data, error } = await sb
    .from('collections')
    .select('id, name, description, created_at, collection_items(item_id)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw new CollectionsDbError('Failed to fetch collections', error);
  return (data as CollectionRow[] | null ?? []).map(rowToCollection);
}

/**
 * Create a new collection. Returns the created Collection, or null if not
 * authenticated (caller may create a local-only collection in that case).
 */
export async function createCollection(name: string, description: string): Promise<Collection | null> {
  const userId = await currentUserId();
  if (!userId) return null;

  const { data, error } = await sb
    .from('collections')
    .insert({ user_id: userId, name, description })
    .select('id, name, description, created_at, collection_items(item_id)')
    .single();

  if (error) throw new CollectionsDbError('Failed to create collection', error);
  return rowToCollection(data as CollectionRow);
}

/** Update a collection's title and/or description. No-op if not authenticated. */
export async function updateCollection(
  id: string,
  patch: { name?: string; description?: string },
): Promise<void> {
  const userId = await currentUserId();
  if (!userId) return;

  const dbPatch: Record<string, unknown> = {};
  if (patch.name !== undefined)        dbPatch.name = patch.name;
  if (patch.description !== undefined) dbPatch.description = patch.description;
  if (Object.keys(dbPatch).length === 0) return;

  const { error } = await sb.from('collections').update(dbPatch).eq('id', id);
  if (error) throw new CollectionsDbError('Failed to update collection', error);
}

/** Delete a collection (its membership rows cascade away). No-op if not authenticated. */
export async function deleteCollection(id: string): Promise<void> {
  const userId = await currentUserId();
  if (!userId) return;

  const { error } = await sb.from('collections').delete().eq('id', id);
  if (error) throw new CollectionsDbError('Failed to delete collection', error);
}

/** Add a wardrobe item to a collection. Idempotent (PK prevents duplicates). */
export async function addItemToCollection(collectionId: string, itemId: string): Promise<void> {
  const userId = await currentUserId();
  if (!userId) return;

  const { error } = await sb
    .from('collection_items')
    .upsert({ collection_id: collectionId, item_id: itemId }, { onConflict: 'collection_id,item_id' });
  if (error) throw new CollectionsDbError('Failed to add item to collection', error);
}

/** Remove a wardrobe item from a collection. */
export async function removeItemFromCollection(collectionId: string, itemId: string): Promise<void> {
  const userId = await currentUserId();
  if (!userId) return;

  const { error } = await sb
    .from('collection_items')
    .delete()
    .eq('collection_id', collectionId)
    .eq('item_id', itemId);
  if (error) throw new CollectionsDbError('Failed to remove item from collection', error);
}
