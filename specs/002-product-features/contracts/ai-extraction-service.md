# Contract: AI Extraction Service

**File**: `src/services/aiExtractionService.ts`
**Edge Function**: `supabase/functions/extract-garments/index.ts`

## Client-Side Service

### `extractGarments(localPhotoUri, notes?: string): Promise<ExtractionResult>`

1. Checks `usageCreditService.checkCredit('worn_outfit_scan')` — throws `InsufficientCreditsError` if over limit.
2. Uploads photo to `wardrobe-photos/{userId}/raw/{uploadId}.jpg`.
3. Invokes `extract-garments` Edge Function with `{ uploadPath, notes }`.
4. On success → calls `usageCreditService.incrementCredit('worn_outfit_scan')`.
5. On failure → does NOT increment credit.
6. Returns `ExtractionResult`.

```typescript
interface ExtractionResult {
  uploadId: string
  items: ExtractedItem[]
  confidence: 'high' | 'low'   // 'low' triggers manual-fix prompt
}

interface ExtractedItem {
  name: string | null
  category: WardrobeItem['category']
  primaryColor: string
  additionalColors: string[]
  material: string | null
  brand: string | null
  notes: string | null
}
```

### `retryExtraction(uploadId): Promise<ExtractionResult>`

Re-runs extraction on the same uploaded photo. Does NOT consume an additional credit
(one free retry per photo, Q27). Tracked via `uploadId` in a session map.

### `confirmExtraction(uploadId, confirmedItems): Promise<WardrobeItem[]>`

1. For each confirmed item: run on-device background removal, upload PNG to
   `wardrobe-photos/{userId}/{itemId}.jpg`, insert `clothing_items` row.
2. After all items confirmed and saved → delete raw photo from Storage.
3. Returns array of saved `WardrobeItem`.

---

## Edge Function: `extract-garments`

**Runtime**: Deno (Supabase Edge)

**Request body**:
```json
{
  "uploadPath": "userId/raw/uploadId.jpg",
  "notes": "optional user context"
}
```

**Response**:
```json
{
  "items": [ { "name", "category", "primaryColor", "additionalColors", "material", "brand" } ],
  "confidence": "high" | "low"
}
```

**Claude call**: `claude-haiku-4-5` with vision. Prompt instructs Claude to:
- Identify each distinct clothing item in the photo.
- For each: name, category (must be one of the valid enum values), primary color
  (from the app's named color list), additional colors, material, brand.
- Return valid JSON only — no prose.
- User notes (if provided) are appended as fenced user context.

**Error handling**: 401 (no auth), 402 (credit check via DB), 500 (Claude API failure).
On 500 → client shows error, does NOT consume credit.
