# Contract: `collectionsService` — `src/services/collectionsService.ts`

**Branch**: `001-app-baseline` | **Date**: 2026-06-07

This service is the **sole point of contact** with `public.collections` and
`public.collection_items` in Supabase. Screens and stores MUST NOT import the
Supabase client directly for collection operations.

---

## Exported Functions

### `fetchMyCollections(): Promise<Collection[] | null>`

Fetches all collections for the authenticated user, including their item IDs.

- Returns `null` when the user is not authenticated (caller keeps local/demo fallback).
- Returns `[]` when authenticated with no collections.
- Throws `CollectionsDbError` on query failure.
- Results ordered by `created_at DESC` (most-recently-created first).

**Query**: `SELECT id, name, description, created_at, collection_items(item_id) FROM collections WHERE user_id = auth.uid()`

---

### `createCollection(name: string, description: string): Promise<Collection | null>`

Inserts a new collection for the authenticated user.

- Returns the created `Collection` on success.
- Returns `null` when not authenticated (caller may create a local-only collection).
- Throws `CollectionsDbError` on insert failure.

---

### `updateCollection(id: string, patch: { name?: string; description?: string }): Promise<void>`

Updates name and/or description on an existing collection.

- No-op when not authenticated.
- No-op when `patch` is empty (no DB round-trip).
- Throws `CollectionsDbError` on update failure.
- No ownership check beyond RLS (Supabase RLS enforces `user_id = auth.uid()`).

---

### `deleteCollection(id: string): Promise<void>`

Deletes a collection. `collection_items` rows cascade-delete automatically.

- No-op when not authenticated.
- Throws `CollectionsDbError` on delete failure.

---

### `addItemToCollection(collectionId: string, itemId: string): Promise<void>`

Adds a wardrobe item to a collection (idempotent — duplicate inserts are ignored
via `ON CONFLICT DO NOTHING` on the composite PK).

- No-op when not authenticated.
- `itemId` MUST be a Supabase UUID from `clothing_items.id`.
  Static demo item IDs (e.g. `'i_tee_white'`) are NOT valid here — they do not
  exist in `clothing_items` and will fail the FK constraint.
- Throws `CollectionsDbError` on insert failure.

---

### `removeItemFromCollection(collectionId: string, itemId: string): Promise<void>`

Removes a wardrobe item from a collection.

- No-op when not authenticated.
- No error if the membership row does not exist (idempotent delete).
- Throws `CollectionsDbError` on delete failure.

---

### `createdLabel(iso: string): string`

Pure helper. Converts an ISO timestamp to the display label used by the UI
(e.g. `"CREATED MAY 2026"`). Exported so `appStore.ts` can generate the same
label format when creating a local-only collection fallback.

---

## Error Type

```typescript
class CollectionsDbError extends Error {
  name: 'CollectionsDbError'
  cause?: unknown   // Raw Supabase error or other thrown value
}
```

---

## Constraints

- `itemId` passed to `addItemToCollection` MUST be a Supabase UUID (not a static demo ID).
- `collectionId` must belong to the authenticated user — enforced by Supabase RLS,
  not by the service layer.
- `collectionsService` never imports from `appStore` or any screen.

---

## camelCase ↔ snake_case Mapping

| DB column | TypeScript field |
|-----------|-----------------|
| `collection_items.item_id` | `Collection.itemIds[]` |
| `collections.created_at` | `Collection.createdDate` (via `createdLabel()`) |
| `collections.name` | `Collection.name` |
| `collections.description` | `Collection.description` |

All snake_case DB shapes stay internal to `collectionsService.ts`.
