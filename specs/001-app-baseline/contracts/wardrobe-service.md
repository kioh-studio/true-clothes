# Contract: wardrobeService

**File**: `src/services/wardrobeService.ts`
**Date**: 2026-06-06

This service is the sole point of contact between the app and the Supabase
`clothing_items` table and `wardrobe-photos` storage bucket.

Screens and stores MUST NOT import `supabase` directly. All wardrobe persistence
goes through this service.

---

## Interface

```typescript
// src/services/wardrobeService.ts

export interface AddItemInput {
  localPhotoUri: string | null   // file:// URI from expo-image-picker, or null
  category: ClothingItem['category']
  colors: string[]               // named colour strings (e.g. "Navy", "Cream")
  sizeLabel?: string
  brand?: string
  notes?: string
}

export interface UpdateItemInput {
  colors?: string[]
  sizeLabel?: string
  brand?: string
  notes?: string
}

/**
 * Fetch all clothing items for the authenticated user.
 * Returns items ordered by created_at DESC.
 * Throws if not authenticated.
 */
export async function fetchMyItems(): Promise<ClothingItem[]>

/**
 * Add a new clothing item.
 * 1. Uploads photo to Supabase Storage (if localPhotoUri provided).
 * 2. Inserts row to clothing_items.
 * 3. Returns the created ClothingItem with remote ID and photo_url.
 *
 * Throws on Storage upload failure (does not insert row).
 * Throws on DB insert failure (attempts Storage cleanup).
 */
export async function addItem(input: AddItemInput): Promise<ClothingItem>

/**
 * Update metadata for an existing item.
 * Does NOT update the photo.
 * Throws if item not found or not owned by current user.
 */
export async function updateItem(
  id: string,
  patch: UpdateItemInput
): Promise<ClothingItem>

/**
 * Delete a clothing item.
 * 1. Deletes the row from clothing_items.
 * 2. Deletes the photo from Supabase Storage (best-effort; logs on failure).
 * Throws if item not found or not owned by current user.
 */
export async function deleteItem(id: string): Promise<void>

/**
 * Migrate locally-persisted items (from AsyncStorage pre-sync era) to Supabase.
 * Called once on first boot after the wardrobe sync update.
 * Processes items sequentially to avoid Storage rate limits.
 *
 * @param localItems  Items read from legacy AsyncStorage state
 * @param onProgress  Called after each item is migrated: (done, total) => void
 * @returns           Array of successfully migrated ClothingItems
 */
export async function migrateLocalItems(
  localItems: LegacyLocalItem[],
  onProgress?: (done: number, total: number) => void
): Promise<ClothingItem[]>
```

---

## Behaviour Contracts

### `fetchMyItems()`

- MUST return an empty array (not throw) if the user has no items.
- MUST throw `AuthError` if user is not authenticated.
- MUST map all snake_case DB columns to camelCase domain fields.
- MUST return `photoUrl` as a signed URL with 1-hour expiry, not a raw path.

### `addItem(input)`

- MUST upload photo before inserting DB row.
- MUST NOT insert DB row if photo upload fails.
- MUST attempt Storage cleanup if DB insert fails after a successful upload.
- MUST return the complete `ClothingItem` including the assigned `id` and `photoUrl`.
- `colors` values MUST be named strings. Service MUST NOT accept or store hex values.

### `updateItem(id, patch)`

- MUST verify `user_id = auth.uid()` before updating (enforced by RLS, but verify
  that the error surfaces correctly as a typed service error).
- MUST return the updated `ClothingItem`.

### `deleteItem(id)`

- MUST delete the DB row first.
- MUST attempt Storage deletion after DB delete succeeds.
- Storage deletion failure MUST be logged but MUST NOT cause the function to throw
  (the DB row is already gone; orphaned Storage objects are acceptable in MVP).

### `migrateLocalItems(localItems, onProgress)`

- MUST call `onProgress` after each item, regardless of success or failure for that item.
- MUST continue processing remaining items even if one item fails.
- MUST return only successfully migrated items.
- MUST be idempotent: if called twice with the same local items, duplicate DB rows
  MUST NOT be created. (Use a migration flag in AsyncStorage to prevent double-calls.)

---

## Error Types

```typescript
// Errors thrown by wardrobeService — callers (stores) catch and handle

export class WardrobeStorageError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message)
    this.name = 'WardrobeStorageError'
  }
}

export class WardrobeDbError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message)
    this.name = 'WardrobeDbError'
  }
}
```

Stores catch these errors and surface them as user-facing toast messages.
Screens never catch service errors directly.

---

## Storage Path Convention

```
wardrobe-photos/
└── {userId}/
    └── {itemId}.jpg
```

- `userId`: `auth.uid()` at time of upload.
- `itemId`: UUID returned by DB insert (generated server-side by `gen_random_uuid()`).
  Photo is uploaded with a temporary name first, then renamed — or the itemId is
  pre-generated client-side using `crypto.randomUUID()` and used for both upload and insert.

**Recommended approach**: Pre-generate `itemId = crypto.randomUUID()` client-side.
Upload photo to `{userId}/{itemId}.jpg`. Insert row with that `id`. This avoids
a two-step rename.
