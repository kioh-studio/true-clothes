# MIEN Outfit Engine — V1 Implementation Plan

**Version:** 2.0 (thay thế plan trước) · **Trạng thái:** Chốt để implement

**Nguyên tắc bất biến:**
- Rule-based thuần code, KHÔNG AI trong engine. Deterministic: cùng input + seed → cùng output.
- Engine là interpreter — toàn bộ "gu thẩm mỹ" nằm trong data (style configs, lookup tables, formula specs). Thêm style/formula/occasion = thêm file, không sửa core.
- Build theo schema đầy đủ, chạy ở mức data tối thiểu. Module thiếu data tự dormant, bật lại không sửa pipeline.

---

## 1. Định vị & kỳ vọng chất lượng (chốt trước khi code)

**Engine v1 là "máy tránh sai", không phải "máy tạo đẹp".**

| Cam kết v1 | KHÔNG cam kết v1 |
|---|---|
| Đúng bảng màu style, hài hòa màu | Silhouette chính xác trên cơ thể |
| Color placement hợp body shape | Fit đúng ý từng món |
| Formality nhất quán (trừ high-low có chủ đích) | Micro-harmony giữa items cụ thể |
| Đúng cấu trúc slot, đúng occasion | "Đẹp ngoái nhìn" / phá rule có gu |
| Đúng 1 điểm nhấn (hero piece) | Trend awareness |
| Outfit theo formula có tên + giải thích được | |
| Không trùng lặp trong session | |

- Accuracy kỳ vọng: "user thấy hợp lý" ~50–55%. Trần nâng bằng DATA (fit tap, measurements — v2), không bằng thêm rule.
- Messaging sản phẩm: "không bao giờ mặc sai nữa" + "học cách phối qua từng gợi ý" (explainability). KHÔNG hứa "AI stylist ra outfit đẹp".
- Chất lượng cảm nhận phụ thuộc tủ đồ user nhiều hơn engine — chấp nhận.

---

## 2. Contract đầu vào

### 2.1. Item (tối thiểu tuyệt đối — không bắt enrich)

```json
{
  "image": "url",
  "name": "text — CHỈ hiển thị + search, không extract",
  "subcategory": "user pick lúc add, picker 2 cấp (category → subcategory)"
}
```

- Subcategory là field cấu trúc duy nhất và BẮT BUỘC (polo, tee, sơ mi, chino, jogger, blazer, đầm A-line...). Không có nó engine không xếp slot được — đây là lần duy nhất engine được phép chặn.
- Ingest tự derive: `colors` (k-means), `pattern` (solid/stripe/unknown).
- T8 gán defaults: `fit, formality, fabric_prior, structure, visual_weight_base`.

### 2.2. User & Context

```
user:    {body_shape, gender, style_prefs?, personal_color?, banned_items?, banned_colors?}
context: {occasion? (default: weekend_casual), weather?}
session: {session_id, generated_fingerprints, dismissed_items, dismissed_styles}
```

---

## 3. Hierarchy 4 tầng (thứ tự override)

```
Tầng 0  PHYSICAL       wearability — DORMANT v1 (đồ trong tủ mặc nhiên mặc được)
Tầng 1  USER OVERRIDE  banned items/colors, budget — THẮNG style
Tầng 2  STYLE CONFIG   dominant rules thẩm mỹ
Tầng 3  CONTEXT        occasion/weather — filter trong khuôn khổ style
```

Precedence trong composition: **silhouette constraint > formula strategy > formula bonus scoring**.
Ngoại lệ có kiểm soát duy nhất: formula `high_low_mix` override đúng 1 test (formality_coherence) bằng bản riêng của nó; không formula nào override silhouette test.

---

## 4. Data Model

### 4.1. `items`

```sql
CREATE TABLE items (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL,
  name          text NOT NULL,
  image_url     text NOT NULL,
  category      text NOT NULL,     -- slot: top|bottom|one_piece|outer|shoes|accessory
  subcategory   text NOT NULL,
  colors        jsonb,             -- [{hex, name, ratio}] từ k-means
  pattern       text,              -- solid|stripe|unknown
  -- Dormant (nullable, v2):
  fit           text, fit_source text, measurements jsonb, composition text,
  created_at    timestamptz DEFAULT now()
);
```

### 4.2. `style_configs` (JSONB + promoted columns)

```sql
CREATE TABLE style_configs (
  style_id   text PRIMARY KEY,
  version    int NOT NULL DEFAULT 1,
  extends    text REFERENCES style_configs(style_id),
  genders    text[] NOT NULL,      -- promoted để query
  formality  text[] NOT NULL,      -- promoted, match occasion
  is_active  boolean DEFAULT true,
  config     jsonb NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

Quy tắc: JSON Schema validation khi ghi (pg_jsonschema) · resolve `extends` ở app layer (deep-merge, cache theo style_id+version, guard circular) · outfit record lưu `style_id + version` lúc gen.

### 4.3. Style config schema — phần ACTIVE v1

```json
{
  "style_id": "old_money_men",
  "extends": "old_money_base",
  "applicable_genders": ["male"],

  "colors": {
    "palette": ["navy","cream","camel","olive","brown","charcoal"],
    "banned": ["neon","hot_pink"],
    "harmony_rules": ["tonal","max_3_colors_per_outfit"],
    "patterns": {"allowed": ["solid","subtle_stripe"], "banned": ["big_logo","graphic","camo"]}
  },

  "banned_items": {"categories": ["jogger","cargo_pants","graphic_tee"]},

  "outfit_structure": {
    "required_slots": ["top","bottom","shoes"],
    "optional_slots": ["outer","belt","watch"],
    "slot_rules": {"shoes": {"types": ["loafer","derby","minimal_sneaker_leather"]}},
    "layering": {"max_layers": 3}
  },

  "formulas": {
    "weights": {"tonal": 0.35, "sandwich": 0.25, "third_piece": 0.25, "matching_leathers": 0.15},
    "banned": ["high_low_mix"]
  },

  "silhouettes": {
    "separates": {"volume_pairs_allowed": [["regular","fitted"],["fitted","fitted"],["regular","regular"]]}
  },

  "formality_range": ["smart_casual","business_casual"]
}
```

Dormant trong schema (khai báo sẵn, v1 không đọc): `fit_bias, length_coverage, garment_details, fabrics chi tiết, silhouette targets tinh, tuck_rules, waist_definition`.

Formula không nhắc trong weights → default weight 0.05 (không phải 0).

### 4.4. `occasions` (bảng riêng — match qua giao formality)

```yaml
wedding_guest:  {formality: [semi_formal, formal],
                 hard_rules: {banned_colors: [white, cream], banned_attributes: [athletic]},
                 slot_overrides: {shoes: {banned: [sneaker, sandal]}}}
office_vn:      {formality: [business_casual, smart_casual],
                 hard_rules: {coverage: {crop_top: false, shorts: false}}}
date_night:     {formality: [smart_casual, semi_formal],
                 soft_boost: {colors: [dark_tones]}, formula_multiplier: {one_statement: 1.3}}
weekend_casual: {formality: [casual, smart_casual]}   # default
```

`compatible_styles = styles WHERE formality_range ∩ occasion.formality ≠ ∅`

### 4.5. Lookup tables

| Bảng | Nội dung | v1 |
|---|---|---|
| T2 | SILHOUETTE_VOLUME_RULES — silhouette → allowed fit pairs | ✅ bản thô |
| T4b | BODY_SHAPE_RULES — color placement + fit prefer/avoid thô | ✅ ACTIVE |
| T6 | FEASIBILITY — (body_shape, silhouette) → weight cho cold-start | ✅ ACTIVE |
| T7 | OCCASIONS (4.4) | ✅ ACTIVE |
| **T8** | **SUBCATEGORY_DEFAULTS — xương sống v1** | ✅ ACTIVE |
| **T10** | **FORMULA_REGISTRY — specs YAML (mục 5)** | ✅ ACTIVE |
| T3/T4/T5 | ease, body adjustment cm, fabric prior | 💤 DORMANT |

**T8 (~30-40 subcategory, nam trước):**

```yaml
polo:   {fit: regular, formality: 2.5, fabric: cotton_pique, structure: mid, visual_weight_base: low}
tee:    {fit: regular, formality: 1.5, fabric: cotton_jersey, structure: low, visual_weight_base: low}
hoodie: {fit: relaxed, formality: 1.0, fabric: fleece, structure: mid, visual_weight_base: low}
blazer: {fit: regular, formality: 4.0, fabric: wool_blend, structure: high, visual_weight_base: mid}
chino:  {fit: regular, formality: 2.5, fabric: cotton_twill, structure: mid, visual_weight_base: low}
jogger: {fit: relaxed, formality: 1.0, fabric: fleece, structure: low, visual_weight_base: low}
```

**T4b:**

```yaml
# Nam
v_shape:   {color_placement: any, bottom_prefer: [fitted, regular]}
square:    {color_placement: light_top_dark_bottom}
triangle:  {color_placement: light_top_dark_bottom, bottom_avoid: [oversized]}
oval:      {color_placement: monochrome_or_dark_top}
rectangle: {color_placement: monochrome_column}
# Nữ
pear:      {color_placement: light_top_dark_bottom}
apple:     {silhouette_avoid: [sheath]}
hourglass: {waist_emphasis: true}
petite:    {avoid: oversized_both_slots}
```

---

## 5. Formula System (T10)

### 5.1. Kiến trúc: từ vựng constraint + executor chung + formula-as-data

Mọi formula = cùng lifecycle: **chọn ANCHOR → fill slots theo RÀNG BUỘC QUAN HỆ → check ĐIỀU KIỆN toàn outfit**. Không viết code riêng từng formula — viết bộ evaluator nhỏ dùng chung, formula là YAML.

```typescript
type ItemConstraint =
  | { type: "color_relation"; relation: "same_color"|"same_family"|"different_family"|"neutral"; ref: SlotRef }
  | { type: "formality_offset"; ref: SlotRef; min: number; max: number }
  | { type: "max_visual_weight"; value: number }
  | { type: "structure_hint"; value: "light_layer" };

type OutfitCondition =
  | { type: "color_count"; max: number }
  | { type: "color_ratio"; ratios: number[]; tolerance: number }   // area ước từ category
  | { type: "slot_present"; slot: Slot }
  | { type: "single_outlier"; dimension: "formality"; minDelta: number };

interface FormulaSpec {
  id: string;
  requires: DataField[];          // thiếu → formula tự dormant
  structure?: {required_slots: Slot[]};
  fill: FillStep[];               // rỗng = fill tự do theo base_score
  conditions: OutfitCondition[];
  synergy?: BodyShape[];          // nhân hệ số khi trùng body shape
  overrides_test?: TestId;        // chỉ high_low_mix dùng
}
```

### 5.2. Formula specs v1 (7-8 formula active với data colors + category + formality)

```yaml
monochrome:
  requires: [colors]
  fill:
    - {slot: top, pick: anchor, by: base_score}
    - {slot: bottom, pick: constrained, constraints: [{type: color_relation, relation: same_family, ref: anchor}]}
    - {slot: shoes,  pick: constrained, constraints: [{type: color_relation, relation: same_family, ref: anchor}]}
  synergy: [rectangle, oval, petite]

tonal:            # họ monochrome, nới relation sang shades cùng tông
  requires: [colors]
  fill: (như monochrome, relation: same_family với tolerance rộng hơn)

sandwich:
  requires: [colors]
  fill:
    - {slot: shoes,  pick: anchor, by: base_score}
    - {slot: top,    pick: constrained, constraints: [{type: color_relation, relation: same_family, ref: anchor}]}
    - {slot: bottom, pick: constrained, constraints: [{type: color_relation, relation: different_family, ref: anchor}]}
  conditions: [{type: color_count, max: 3}]

rule_60_30_10:
  requires: [colors]
  fill: []
  conditions: [{type: color_ratio, ratios: [0.6, 0.3, 0.1], tolerance: 0.15}]

neutral_plus_accent:
  requires: [colors]
  fill: []
  conditions: [{type: color_count, max: 3}]   # + điều kiện: đúng 1 màu non-neutral

third_piece:
  requires: [category]
  structure: {required_slots: [outer]}
  fill:
    - {slot: outer, pick: constrained, constraints: [{type: structure_hint, value: light_layer}]}

matching_leathers:
  requires: [colors, category]
  fill:
    - {slot: shoes, pick: anchor, by: base_score}
    - {slot: belt,  pick: constrained, constraints: [{type: color_relation, relation: same_color, ref: anchor}]}

high_low_mix:
  requires: [formality]
  conditions: [{type: single_outlier, dimension: formality, minDelta: 2}]
  overrides_test: formality_coherence

one_statement:    # = hero piece, tồn tại như formula để label/bonus
  requires: [colors]
  conditions: []  # enforce bởi hero rule trong combinator
```

**KHÔNG vào T10:** rule_of_thirds, french_tuck (thuộc tầng silhouette — tuck_rules/transition, dormant v1) · texture_mixing, print_mixing tinh (requires composition/pattern detect tốt — dormant).

### 5.3. Executor (viết 1 lần)

```
compose(spec, pool, ctx) → Outfit | null
  - check spec.requires vs data có → thiếu = dormant, trả null
  - chạy fill steps: anchor → constrained picks (filter pool qua CONSTRAINT_EVALUATORS)
  - pickDeterministic(candidates, ctx.seed)   ← seeded, giữ determinism
  - fill slot còn lại theo base_score
  - check conditions qua CONDITION_EVALUATORS → pass mới trả outfit
  - fill fail bất kỳ bước nào → null, combinator resample formula khác (max N lần, không retry vô hạn)

matches(spec, outfit) → bool   ← dùng cho formula_bonus + explainability label
```

Registry chấp nhận lẫn declarative spec (YAML) và custom class implement `{compose, matches}` — escape hatch cho formula vượt từ vựng (v2).

### 5.4. Effective weight

```
effective_weight(formula) = style.formulas.weights[id]  (default 0.05 nếu không khai)
                          × body_synergy_multiplier      (từ spec.synergy vs user.body_shape)
                          × occasion.formula_multiplier  (optional)
banned trong style → 0
```

---

## 6. Engine Pipeline (runtime)

```
BƯỚC 1 — STYLE RESOLUTION
  có style_prefs → dùng (filter gender + formality ∩ occasion)
  cold-start → sample 2-3 styles theo T6 feasibility weight,
               RÀNG BUỘC ≥1 style echo body_shape; gắn style_id để học preference

BƯỚC 2 — SILHOUETTE RESOLUTION (tầng HÌNH KHỐI)
  v1: volume_pairs_allowed từ style config (fit = T8 defaults, bản thô)
  dormant: ease targets từ measurements

BƯỚC 3 — CANDIDATE POOL per slot (đi chợ theo tiêu chuẩn)
  Hard filter: subcategory ∉ banned(user ∪ style ∪ occasion),
               colors ∉ banned, volume pair thô
  Base score:  0.50×color_palette_match + 0.30×style_tag(T8) + 0.20×pattern_match
               (pattern unknown → 0.5 neutral, KHÔNG pass banned check)
  → top-K per slot (K=8-10)
  ── chưa có outfit, chỉ có nguyên liệu hợp lệ về silhouette + style ──

BƯỚC 4 — FORMULA-DRIVEN COMPOSITION (tầng TRÌNH BÀY — nấu theo công thức)
  per outfit:
    a. sample formula theo effective_weight (seeded)
    b. executor.compose(spec, pool, ctx)
       — formula tạo QUAN HỆ giữa items (thứ không filter độc lập nào làm được)
       — mọi pick nằm TRONG pool → silhouette constraint tự động được tôn trọng
    c. hero piece: đúng 1 item visual_weight cao, slot khác áp max_visual_weight

BƯỚC 5 — VERIFY
  ✅ color harmony (≤3 màu, harmony_rules)
  ✅ color placement vs body shape (T4b) — vi phạm trừ điểm
  ✅ formality coherence (max−min ≤ 1.5) — trừ khi formula overrides_test
  ✅ hero uniqueness — ≥2 statement → loại
  ✅ formula conditions (matches)
  ⚠️ pattern rules (chỉ khi pattern ≠ unknown)
  ⚠️ volume pair thô — chặn cặp vô lý hiển nhiên
  💤 transition, taper, texture, silhouette thật → skip
  Nguyên tắc: skip = unknown ≠ pass
  outfit_confidence = min(item.confidence) × verify_coverage
  final_rank = (base_score + formula_bonus 0.1) × (0.7 + 0.3×confidence)
  → mọi outfit v1: silhouette_verified = false

BƯỚC 6 — DEDUP & OUTPUT
  fingerprint hash(sorted item_ids) + Jaccard > 0.6 = near-dup → loại
  filter dismissed_items/styles trong session
  → ≥10 outfits, mỗi cái 1 formula (đa dạng có cấu trúc)
  cold-start: NHÓM theo style, không trộn
  mỗi outfit kèm label giải thích: "Công thức Sandwich — áo và giày cùng tông kem"
```

---

## 7. Module Structure

```
engine/
├── config/
│   ├── styles/*.yaml
│   ├── occasions.yaml
│   ├── formulas/specs/*.yaml          # T10
│   ├── tables/{subcategory_defaults, body_shape_rules, volume_rules, feasibility}.yaml
│   ├── tables/dormant/
│   └── schemas/                        # JSON Schema cho mọi config
├── ingest/
│   ├── color_extractor                 # k-means, crop center-weighted trước khi cluster
│   ├── pattern_detector                # solid/stripe/unknown — không đoán thêm
│   └── item_resolver                   # chuẩn hóa mọi item về 1 shape thống nhất
├── core/
│   ├── style_resolver
│   ├── context_resolver
│   ├── candidate_query
│   ├── formulas/
│   │   ├── executor.ts                 # compose() + matches()
│   │   ├── constraints/*.ts            # mỗi evaluator 1 file
│   │   └── registry.ts                 # YAML specs + custom classes
│   ├── combinator                      # sample formula + hero piece
│   ├── verifier/*.ts                   # mỗi test 1 module, bật/tắt theo requires
│   └── deduper
└── api/generate_outfits(user, context, session) → [Outfit]
```

Nguyên tắc code: pipeline KHÔNG phân nhánh theo data level · mọi chỗ đọc fit/measurement/composition qua optional · weights/thresholds trong config · seeded random mọi nơi.

---

## 8. Phases

### Phase 1 — Foundation (tuần 1–2)
- [ ] DB: items, style_configs, occasions, outfits (lưu style_id+version, formula_id)
- [ ] Config loader: JSON Schema validation + extends resolver + cache
- [ ] T8 (~30-40 subcategory nam) + T4b + T2 thô + T6 + T7
- [ ] 2 style configs: **old_money_men + streetwear_men** (đối lập mọi field = cặp test)
- [ ] Ingest: k-means color + pattern detect + item_resolver

### Phase 2 — Formula system + core (tuần 3–4)
- [ ] Constraint/condition evaluators (~6-8 cái)
- [ ] Formula executor + registry + 5 specs đầu: monochrome, sandwich, third_piece, matching_leathers, rule_60_30_10
- [ ] Style resolver + cold-start sampling · candidate query + base scoring
- [ ] Combinator: formula sampling + hero piece + resample-on-fail

### Phase 3 — Verify + hoàn thiện (tuần 5–6)
- [ ] Verifier: harmony, placement, formality (+ high_low override), hero, formula conditions, pattern, volume thô
- [ ] Thêm specs: tonal, neutral_plus_accent, high_low_mix, one_statement
- [ ] Deduper + session store + dismissed filter
- [ ] Occasion matching · output grouping + explainability labels
- [ ] **Test trên tủ đồ thật của mình** (V-shape — test case cho T4b)

### Sau v1 (không làm bây giờ)
- Style configs nữ + one-piece taxonomy · fit 1-tap → volume pair thật · measurements → silhouette engine đầy đủ · vision model ở tầng ingest (con đường lên "có gu") · preference learning từ hành vi

---

## 9. Testing

```
1. Unit: mỗi evaluator + verifier độc lập, fixture rõ pass/fail
2. Config: mọi YAML qua schema, không circular extends
3. Golden: tủ đồ mẫu ~30 items →
   - old_money không bao giờ chứa jogger/graphic_tee
   - mọi outfit ≤3 màu, đúng 1 hero, đủ required_slots
   - outfit gen theo sandwich phải matches(sandwich) = true
   - cùng seed → cùng output
4. Property: tủ đồ random → không crash, không thiếu slot, không trùng fingerprint,
   formula compose fail → resample không loop vô hạn
5. Manual: tủ đồ thật, 3 câu hỏi stylist (một shape rõ? điểm nhấn đúng chỗ? 
   có chỗ nào tường thuật khuyết điểm?)
```

---

## 10. Risks

| Risk | Mitigation |
|---|---|
| Pattern detect sai → graphic tee lọt old_money | unknown = neutral không pass banned; user sửa pattern 1 tap khi thấy |
| K-means dính màu nền | crop center-weighted / bg removal đơn giản trước cluster |
| T8 defaults lệch local brands | T8 là data file, tune không cần deploy |
| Formula compose fail nhiều (tủ nhỏ, ít màu) | resample max N lần → fallback fill tự do theo base_score, vẫn trả kết quả |
| Tủ đồ toàn item na ná → dedup chặn hết | nới Jaccard threshold động khi pool nhỏ |
| User kỳ vọng silhouette advice | messaging: "phối màu & style theo dáng", không hứa fit |
| Style config typo (JSONB) | JSON Schema bắt buộc khi ghi |

---

## 11. Success Criteria v1

- Gen ≥10 outfit hợp lệ từ tủ ≥15 items trong <2s
- 0 vi phạm hard rules (banned, thiếu slot, >1 hero, >3 màu, formality vỡ ngoài high-low)
- 0 duplicate/near-dup trong session · deterministic cùng seed
- Mỗi outfit có formula label giải thích được
- Manual review tủ thật: ≥50% outfit "mặc được ra đường"
- Thêm 1 style HOẶC 1 formula mới hoàn toàn bằng YAML, không sửa code
