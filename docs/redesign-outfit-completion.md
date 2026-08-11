# Redesign: what an outfit is

**Status:** design, awaiting approval. Nothing here is implemented.
**Date:** 2026-08-12
**Supersedes (in intent):** the `slots.top === slots.bottom` one-piece convention documented at `generation.ts:622-629` ("Q29").

---

## 1. The problem

`OutfitSlots` is a fixed set of named roles, each holding exactly one item:

```ts
{ top: string; bottom: string; shoes: string; outwear?: string; accessory?: string; mid?: string }
```

A one-piece has no home of its own, so it squats in `top` **and** `bottom`. That is not a description of a dress — it is a way of stopping anything else from being placed. Three consequences, all verified against the current code:

**(a) Real outfits are inexpressible.** A dress worn over trousers cannot be represented, because the dress has taken the `bottom` slot. The same shape blocks a tee under a pinafore, and an abaya over an existing top-and-bottom pair. Most pointedly for this app's market, it blocks **áo dài** — a tunic worn over trousers is the national dress of the country MIEN is built for, and the data model cannot hold it.

**(b) Two different questions share one answer.** Eight call sites resolve garments with `find(i => i.category === 'bottom' || i.category === 'onepiece')` — three in `silhouette.ts`, four in `scoring.ts`, one in `generation.ts`. They conflate *what is visible on a region* (which drives silhouette and colour) with *what touches the body there* (which drives fit and measurement). For every outfit that exists today those are the same garment, so the conflation is invisible. Add trousers under a dress and it is wrong in both directions at once: silhouette should read the dress, fit should measure the trousers.

**(c) A live bug already follows from it.** `index.ts:689`:

```js
o.weatherBand = weatherBandOf(its, o.slots.outwear !== undefined || o.slots.mid !== undefined);
```

Warmth is decided by **whether a slot is occupied**, not by what occupies it. The `canLayer` path puts an open shirt into `outwear`, so a linen shirt worn open makes an outfit read as layered and warm, and lands it in a colder temperature band than it belongs in. The slot is named "outerwear", so anything sitting in it is treated as outerwear.

## 2. What the research says

Four parallel investigations (2026-08-12; findings summarised, sources in the session transcript):

- **Cultural dress:** ten distinct real-world structures need a garment that spans torso and legs, layered over or under independent single-region garments — áo dài, áo dài cách tân, kimono + nagajuban + haori, hanbok, salwar/kurta, abaya/jilbab, dress-over-trousers (Ganni FW25, Simone Rocha SS26), pinafore-over-shirt, slip-dress-over-tee. Two traditions also carry components that belong to no region at all: the dupatta and the hijab.
- **Industry taxonomies:** no widely-used system models body coverage. Google Product Taxonomy, GS1 GPC, Schema.org extensions and every large retailer use flat merchandising categories, one label per SKU, with one-pieces siloed away from top/bottom semantics. The only fielded systems with an explicit layer axis are a cloth-physics collision order (CLO3D) and a military cold-weather procurement spec (ECWCS, seven numbered levels). Fashion never formalised it.
- **Compatibility research:** layering is removed at data-curation time. MCN keeps "only the first item" when a category repeats; NGNN filters outfits so "the categories of items in it are not overlapped"; Vasileva et al. concede they never learned an embedding for comparing two tops because no training outfit contained two. No paper models a dress as filling two slots. Layering appears as a first-class annotation only in a virtual try-on dataset, not in any recommendation dataset.
- **Professional styling:** the domain's own vocabulary is role-based — anchor piece, focal point, third piece, one-statement-piece — and does **not** speak in regions and depths. It also names the exact gap: the vocabulary names the garment, never the function the garment is currently performing. A shirt worn open changes role and the language just re-describes the outfit.

The apparent conflict between the last two and the first resolves cleanly once you separate the questions. *What is an outfit made of* is a representation question, and it needs regions and depth. *Why is an outfit good* is an evaluation question, and it should keep the stylist vocabulary the engine already implements (`statementStrength`, anchor clarity, `formalityRange`, the `rule_of_thirds` formula). This redesign changes the first and leaves the second alone.

## 3. The model

**An outfit is an ordered stack of garments per body region, plus components worn or carried outside any region.**

```ts
type Region = 'torso' | 'legs' | 'feet';

interface OutfitComposition {
  /** Item ids, innermost → outermost. Array order IS the layer depth. */
  torso: string[];
  legs: string[];
  feet: string[];
  /** Worn, shapes the look, but not stacked on a region: belt, scarf, dupatta, hijab, hat. */
  attached: string[];
  /** Not worn at all: bag. */
  carried: string[];
}
```

Three decisions worth stating explicitly:

**Depth is array position, not a stored integer.** Nothing can hold an inconsistent depth number, and inserting a layer is a splice.

**A spanning garment appears in both arrays under the same id.** Áo dài is `torso: [tunic]`, `legs: [trousers, tunic]` — the tunic is present in both, and in `legs` it sits *after* the trousers, which is precisely the statement "the tunic is worn over the trousers". This generalises the existing Q29 convention rather than discarding it: today's `top === bottom` is the degenerate case where the spanning garment is the only thing on both regions. Item counting dedupes by id, exactly as `slotsToIds` does now.

**`attached` and `carried` are separated.** Today both are `accessory`, which files a handbag and a draped dupatta as the same kind of thing. One is carried and irrelevant to silhouette; the other is worn and changes the line of the outfit. The research hit this twice independently (dupatta, hijab).

### Roles become derived, not stored

```ts
const outermost = (c: OutfitComposition, r: Region) => c[r].at(-1);
const innermost = (c: OutfitComposition, r: Region) => c[r].at(0);
```

- "the top", for silhouette and colour → `outermost(c, 'torso')`
- "what must fit the legs" → `innermost(c, 'legs')`
- "does this outfit have a real outer shell" → does any torso garment have `fabric.layerRole === 'outer'` — a question about garments, not about slot occupancy

The eight conflated call sites become calls to one of these two resolvers, chosen deliberately per site. That is the whole of fix (b), and it is mechanical once the resolvers exist.

### Layering validity, stated once

For consecutive garments `a` (depth *i*) and `b` (depth *i+1*) in the same region:

1. `b` must be wearable over something — `canWearOver` (today's `canLayer`, generalised past the torso).
2. `a` must be wearable under something — `canWearUnder` (new; trousers yes, a parka no).
3. Volume must not decrease outward: `volume(b) >= volume(a)`.
4. Weight must not decrease outward, with the existing carve-out that a `heavy` mid under a true outer stays banned.

This single rule subsumes `layerOptionsFor`, the mid-under-outer heavy ban, and the dual-role `canLayer` path — and it covers a case no code exists for today: **trousers worn under a dress must be slimmer than the dress**, which falls straight out of rule 3.

## 4. What changes in how an outfit is built

Today the generator fills named slots, one item each, so outfit size is decided by the number of slots:

```
Core = { top, bottom, shoe, outwear? }
→ anchor → best counterpart → best shoes → variants (+accessory, +outwear, +mid)
```

Under the new model it places garments onto regions and checks each placement against what is already there:

```
1. Base cover: either (torso garment + legs garment), or one spanning garment.
2. Outward layers: append to a region, validity-checked (rule above). ≤ 2 beyond the base.
3. Inward layers: prepend to a region — trousers under a dress, tee under a pinafore.
4. Feet: one garment.
5. attached / carried: optional, as today's accessory variant.
```

Step 3 is the new capability; everything else is the current algorithm expressed against a different container. The `≤ 2 beyond base` cap keeps the variant count in the same range as today's `variantsFor`, so candidate volume and the existing caps do not move.

**For an ordinary outfit nothing changes.** Tee + jeans + shoes produces the same items with the same scores. The model earns its cost only on outfits that are currently impossible, or currently mis-scored.

## 5. Where the data comes from

Deliberately, **stage 1 needs no new DB column.** All three new garment attributes are derivable from data already stored:

| Attribute | Source |
|---|---|
| `covers: Region[]` | table keyed by `type`, extending `CATEGORY_MAP` — `DRESS → [torso, legs]`, `TROUSERS → [legs]`, `JACKET → [torso]` |
| `canWearOver` | existing `clothing_items.can_layer`, falling back to `deriveCanLayer` |
| `canWearUnder` | derivable by type: bottoms and base-layer tops yes, `layerRole: 'outer'` no |

`covers` replaces `category` as the primitive the engine reasons with. `category` stays as the merchandising label for UI grouping and filtering — it is the right shape for that job and every taxonomy in the industry agrees.

If a later stage wants garments whose coverage does not follow from type (a cropped versus maxi coat, a tunic versus a shirt), that becomes an extraction field, following the `distressed` precedent from 2026-08-11: nullable column, fail-open enforcement, backfill afterwards.

## 6. Compatibility and migration

Two hazards, both with precedent in this repo.

**The `outfit_id` key is persisted.** 1,648 rows in `outfit_interactions` hold `top|bottom|shoes|outwear|accessory|mid`, and `taste.ts` splits on `|` and looks ids up. The key must stay parseable. The server therefore keeps emitting the legacy six-field key as the canonical outfit id, derived from the composition by the resolvers, and adds `composition` alongside it in the response. Deriving the legacy key is lossy for exotic compositions — that is acceptable, because it is exactly the subset an old client can render anyway.

**Server deploys instantly; the app ships on a build.** An installed app that does not know `composition` must keep working, so the server dual-writes legacy slots and composition until the new build has rolled out. This is how the `mid` slot was introduced on 2026-08-10 and it worked; the same discipline applies, including appending rather than reordering any key field.

## 7. Test corpus

The ten structures from the cultural research become the acceptance set. Each is expressed as a composition and must round-trip through generation, scoring and rendering:

| # | Pattern | Composition |
|---|---|---|
| 1 | Áo dài | `torso: [tunic]`, `legs: [trousers, tunic]` |
| 2 | Áo dài cách tân | `torso: [tunic]`, `legs: [skirt, tunic]` |
| 3 | Áo bà ba (control) | `torso: [shirt]`, `legs: [trousers]` |
| 4 | Salwar/kurta | `torso: [kurta]`, `legs: [churidar]`, `attached: [dupatta]` |
| 5 | Kimono + haori | `torso: [nagajuban, kimono, haori]`, `legs: [nagajuban, kimono]` |
| 6 | Hanbok | `torso: [jeogori]`, `legs: [petticoat, chima]` |
| 7 | Abaya over base | `torso: [blouse, abaya]`, `legs: [trousers, abaya]`, `attached: [hijab]` |
| 8 | Dress over trousers | `torso: [dress]`, `legs: [jeans, dress]` |
| 9 | Pinafore over shirt | `torso: [shirt, pinafore]`, `legs: [pinafore]` |
| 10 | Slip dress over tee | `torso: [tee, slip]`, `legs: [slip]` |

Row 3 is the control: it must produce byte-identical output to today.

## 8. Staging

Every stage is gated on the offline harness (`scripts/eval-feed`), which as of 2026-08-11/12 has fixtures that exercise measured fit, guessed fit, shape goals, one-pieces and layering.

| Stage | Change | Gate |
|---|---|---|
| 0 | Add `OutfitComposition` + resolvers. Derive composition from existing slots; assert round-trip. No behaviour change. | All existing fixtures byte-identical |
| 1 | Move the eight `.find` sites onto the resolvers, choosing outermost or innermost per site deliberately | Byte-identical |
| 2 | `weatherBand` reads garments, not slot occupancy | Measured; expect movement, review direction |
| 3 | Generation emits inward layers | New fixtures for patterns 1, 8, 9; count outfits that could not previously exist |
| 4 | Client threading: composition through the store, collage z-order from depth | Device review before build |
| 5 | Retire legacy slot fields once the new build has rolled out | — |

Stages 0 and 1 are pure refactors with a byte-identical gate, which is what makes the rest safe to attempt.

## 9. Out of scope, and open decisions

**Out of scope.** No move to a learned compatibility model. The research shows the field converged on unordered sets of typed items, but every implementation of that still assumes one item per category, so there is nothing to adopt — and MIEN's engine is rule-based by design. This redesign changes the container, not the paradigm.

**Open, needs a decision:**

1. **Arms as a region.** Currently folded into `torso` with sleeve length as an attribute. A sleeveless dress under a cardigan is representable either way; a formal arms region would be more correct and materially more expensive. Recommendation: leave folded, revisit if a real case demands it.
2. **Whether `attached` participates in scoring.** A dupatta changes the line of an outfit; a belt already does via `outfitWaistDefinition`. Splitting `accessory` invites the question of whether draped components should feed silhouette. Recommendation: split the field in stage 0, wire the scoring in a later, separately measured change.
3. **How far to let inward layering go.** Trousers under a dress is clearly wanted. Tights under a skirt, a tee under a shirt, thermals — each is real, each multiplies candidates. Recommendation: stage 3 ships trousers-under-spanning-garment and tee-under-spanning-garment only, and we look at the measured candidate counts before widening.
