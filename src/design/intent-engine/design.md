# Intent Engine — Design Spec

How the chat AI translates natural language into engine parameters.

---

## Architecture

```
User message                        Engine
─────────────────────────────────────────────────────
"I want to look effortless          IntentContext
 but good today, and it has       ┌─────────────────┐
 to make me look tall"            │ styles: [minimalist]
        │                         │ mood: [clean]
        ▼                         │ colorScheme: monochrome
   ┌──────────┐                   │ bodyGoal: elongation
   │  Chat AI  │ ──── parse ───▶  │ proportionRule:
   │  (LLM)    │                  │   rule_of_thirds
   └──────────┘                   │ occasion: daily
                                  │ formalityRange:
                                  │   [1.5, 3.0]
                                  └────────┬────────┘
                                           │
                                    resolveIntent()
                                           │
                                           ▼
                                  ResolvedIntent
                                  ┌─────────────────┐
                                  │ formulas:        │
                                  │   [monochrome,   │
                                  │    tonal_gradient,│
                                  │    rule_of_thirds]│
                                  │                  │
                                  │ weights:         │
                                  │   proportion: 0.20│
                                  │   color: 0.30    │
                                  │   (others scaled)│
                                  │                  │
                                  │ styleOverrides:  │
                                  │   [minimalist]   │
                                  └────────┬────────┘
                                           │
                                    applyIntent()
                                           │
                                           ▼
                                  EngineContext
                                  (with overrides merged)
                                           │
                                    generateOutfits()
                                           │
                                           ▼
                                  ScoredOutfit[]
```

---

## Intent Parsing — What the LLM Outputs

The chat AI's job is classification, not generation. It maps natural language
to a fixed vocabulary of `IntentContext` fields. The LLM prompt should include
the type definition and examples.

### Parsing Examples

| User says | IntentContext |
|---|---|
| "I want to look effortless but good today, make me look tall" | `{ styles: ['minimalist'], mood: ['clean'], colorScheme: 'monochrome', bodyGoal: 'elongation', proportionRule: 'rule_of_thirds', occasion: 'daily' }` |
| "cozy date night, nothing too fancy" | `{ mood: ['romantic'], occasion: 'date_night', formalityRange: [2.5, 3.5], requireOuterwear: false }` |
| "I have a job interview tomorrow" | `{ occasion: 'business', formalityRange: [3.5, 4.5], colorScheme: 'neutral_accent', maxColors: 3 }` |
| "just throw something on for the weekend" | `{ occasion: 'weekend', mood: ['playful'], formalityRange: [1.0, 2.5] }` |
| "all black everything" | `{ colorScheme: 'monochrome', maxColors: 1, styles: ['minimalist'] }` |
| "something layered, it's cold" | `{ requireOuterwear: true, seasonOverride: 'winter' }` |
| "I want to look broader on top" | `{ bodyGoal: 'broaden_shoulders', proportionRule: 'oversized_top' }` |

---

## How Each Field Maps to Engine Behavior

### styles → EngineContext.styleProfile.selectedStyles

Temporarily replaces the user's saved style preferences. The engine's
`computeUserAttributes()` recalculates the attribute vector from these styles,
and `classifyTier()` uses them for tier 1 classification.

**Important**: This is an override, not an addition. If the user's profile has
`[oldmoney, minimalist]` and the intent sets `[streetwear]`, the engine runs
as if the user only selected streetwear. The baseline profile is not mutated.

### mood → styleCoherence scoring

The mood values feed into the attribute similarity formula (§4.4 of fit-engine.md).
Mood has the highest weight (0.25) in similarity scoring. Setting mood to `[clean]`
will strongly prefer items whose style tags map to clean-mood attributes.

### colorScheme → formula preferences

| ColorScheme | Preferred formulas | Effect |
|---|---|---|
| `monochrome` | monochrome | All items same color family |
| `tonal` | tonal_gradient | Same hue, light → dark |
| `analogous` | tonal_gradient, monochrome | Adjacent hues |
| `complementary` | contrast_pairing, neutral_pop | Opposite hues |
| `neutral_accent` | neutral_pop, one_two_three | 80% neutral + 1 pop |

Also boosts `weights.color` to 0.30 for monochrome/tonal (from default 0.25).

### bodyGoal → formulas + weight boosts

| BodyGoal | Why it works | Formulas | Weight change |
|---|---|---|---|
| `elongation` | Monochrome creates unbroken vertical line. Rule of thirds (short top + long bottom) creates the illusion of longer legs. | monochrome, tonal_gradient, rule_of_thirds | proportion → 0.20, color → 0.30 |
| `broaden_shoulders` | Structured/oversized tops with contrasting bottoms draw the eye to the upper body. | contrast_pairing, one_two_three | proportion → 0.20 |
| `define_waist` | High contrast between top and bottom + fitted proportions at the waist. Rule of thirds with a tucked top. | rule_of_thirds, contrast_pairing | proportion → 0.20 |
| `balanced` | No special treatment. | (none) | (no change) |

### proportionRule → formula preferences + weight boost

| Rule | Preferred formula | Description |
|---|---|---|
| `rule_of_thirds` | rule_of_thirds | 1/3 top + 2/3 bottom (or inverse) |
| `balanced` | (none) | Even visual weight distribution |
| `oversized_top` | contrast_pairing | Volume on top, slim bottom |
| `oversized_bottom` | contrast_pairing | Slim top, volume on bottom |

Always boosts `weights.proportion` to at least 0.15.

### occasion → formalityRange + formula hints

| Occasion | Formality range | Formula hints |
|---|---|---|
| `daily` | 1.5 – 3.0 | (none) |
| `date_night` | 2.5 – 4.0 | tonal_gradient, neutral_pop |
| `business` | 3.5 – 5.0 | one_two_three, tonal_gradient |
| `weekend` | 1.0 – 2.5 | (none) |
| `event` | 3.5 – 5.0 | neutral_pop, one_two_three, contrast_pairing |
| `travel` | 1.5 – 3.0 | layering_stack, texture_stack |

Occasion provides a default `formalityRange` only if the intent doesn't
explicitly set one. Explicit range always wins.

### formalityRange → hard constraint in ranker

Used by `passesHardConstraints()` to reject outfits where the average item
formality falls outside the range. This is NOT yet implemented in the ranker —
needs to be added when the intent system is wired up.

### seasonOverride → season scoring

Overrides the default season detection. When set, `scoreSeasonMatch()` should
penalize items that don't match this season instead of comparing items to each
other.

### maxColors → hard constraint

Overrides the default 4-color limit in `passesHardConstraints()`. When set to
1–2, produces very controlled palettes (monochrome, dichromatic).

### weightOverrides → direct scoring weight control

Escape hatch for the LLM when standard mappings don't capture the intent.
Applied last, after all other adjustments. The resolver normalizes the final
weights to sum to 0.95 (with 0.05 reserved for future anchor clarity scorer).

---

## What's Not Implemented Yet

| Feature | Location | What's needed |
|---|---|---|
| Formality range as hard constraint | `outfitRanker.ts:passesHardConstraints()` | Add avg formality check against `ctx.intent?.formalityRange` |
| Season override in scorer | `seasonMatch.ts` | Accept optional season param, score against it instead of pairwise |
| Max colors override | `outfitRanker.ts:passesHardConstraints()` | Use `ctx.intent?.maxColors` instead of hardcoded 4 |
| Require outerwear/accessory | `outfitCompositor.ts` | Filter candidates missing required slots |
| Chat AI prompt template | (new file) | System prompt that instructs the LLM to output IntentContext JSON |
| Chat UI | `app/chat.tsx` | Text input → LLM call → IntentContext → engine → results |

---

## Integration Flow (When Building the Chat Feature)

```typescript
// 1. User types a message
const userMessage = "I want to look effortless but good today, make me look tall";

// 2. LLM parses it into IntentContext (via API call)
const intent: IntentContext = await parseIntent(userMessage);
// → { styles: ['minimalist'], mood: ['clean'], colorScheme: 'monochrome',
//    bodyGoal: 'elongation', proportionRule: 'rule_of_thirds' }

// 3. Build EngineContext with intent attached
const ctx: EngineContext = {
  bodyMeasurements: store.bodyMeasurements,
  styleProfile: store.styleProfile,
  colorPreferences: store.colorPreferences,
  intent,  // ← this is new
};

// 4. Generate outfits — intent is resolved internally
const outfits = generateOutfits(wardrobe, ctx, userId);
// → outfits are filtered/ranked for elongation + monochrome + minimalist
```

The existing feed UI (`useFitFeed`) works unchanged — it just receives
intent-filtered `ScoredOutfit[]` instead of baseline ones.
