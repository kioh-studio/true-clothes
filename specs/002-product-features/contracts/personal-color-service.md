# Contract: Personal Color Service

**File**: `src/services/personalColorService.ts`

## Functions

### `savePersonalColor(userId, result): Promise<void>`

Writes season + undertone + personal palette to `public.profiles`.

**Input**:
```typescript
interface PersonalColorResult {
  season: 'spring' | 'summer' | 'autumn' | 'winter'
  undertone: 'warm' | 'cool' | 'neutral'
  personalPalette: string[]   // 8–12 named color strings from colorSeasonData
}
```

**Output**: void — throws `PersonalColorSaveError` on DB failure.

**DB writes**:
- `profiles.color_season = result.season`
- `profiles.skin_undertone = result.undertone`
- `profiles.personal_palette = result.personalPalette`

---

### `getPersonalColor(userId): Promise<PersonalColorResult | null>`

Reads current season/undertone/palette from `profiles`. Returns null if unset.

---

## Scoring Logic (pure, in `src/features/personal-color/colorSeasonData.ts`)

```typescript
function scoreAnswers(answers: QuizAnswer[]): PersonalColorResult

interface QuizAnswer {
  questionId: number   // 1–5
  optionIndex: number  // 0-based
}
```

Scoring matrix is a static lookup table. No API calls. No side effects.
Runs entirely client-side.
