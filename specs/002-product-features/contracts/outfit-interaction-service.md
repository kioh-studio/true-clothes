# Contract: Outfit Interaction Service

**File**: `src/services/outfitInteractionService.ts`

## Functions

### `saveOutfit(outfitId, outfitData): Promise<OutfitInteraction>`
### `unsaveOutfit(outfitId): Promise<void>`
### `markWorn(outfitId, outfitData, wornAt: string): Promise<OutfitInteraction>`
### `unmarkWorn(outfitId): Promise<void>`
### `scheduleOutfit(outfitId, outfitData, scheduledFor: string): Promise<OutfitInteraction>`
### `unscheduleOutfit(outfitId): Promise<void>`

All write to `public.outfit_interactions`. Use UPSERT on `(user_id, outfit_id, type)`.

### `fetchInteractions(): Promise<OutfitInteraction[]>`

Returns all interactions for the current user. Used on hydration to rebuild
`savedSet`, `wornSet`, `scheduledSet` in appStore.

### `fetchWornCooldownIds(): Promise<string[]>`

Returns outfit IDs worn in the last 7 days. Sent as `exclude_ids` to the
`generate-outfits` Edge Function alongside already-seen IDs.

---

## Error Types

```typescript
class OutfitInteractionError extends Error {
  code: 'SAVE_FAILED' | 'DELETE_FAILED' | 'FETCH_FAILED'
}
```
