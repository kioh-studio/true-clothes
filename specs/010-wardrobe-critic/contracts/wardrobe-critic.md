# Contract — Edge Function `wardrobe-critic`

**Endpoint**: `POST /functions/v1/wardrobe-critic`
**Auth**: Bearer Supabase JWT (verify_jwt ON — user-facing)
**Rate limit**: `consume_rate_limit(p_bucket 'wardrobe_critic', p_max 10, p_window_secs 3600)` → 429 `{ error: 'rate_limited' }` khi hết; RPC lỗi thì fail-open.

## Request body (all optional)

```jsonc
{
  "locale": "vi",              // 'vi' | 'en' — chỉ ảnh hưởng field nào không? notes trả CẢ HAI locale, field này reserve cho tương lai
  "candidate_item": {           // OPTIONAL (Try-On bridge extension): chấm unlock-count cho MỘT món cụ thể
    "type": "SHIRT", "color": "White", "material": "Cotton", "fit": "regular"
  }
}
```

- Body rỗng ⇒ phân tích gap chuẩn.
- `candidate_item` hợp lệ ⇒ response thêm `candidate: { unlockCount, matchedArchetypeId | null }`, phần còn lại giữ nguyên.

## Response 200

```jsonc
{
  "mode": "gaps",                    // 'gaps' | 'starter' | 'complete'
  "generated_at": "2026-07-03T09:00:00Z",
  "baseline_qualified": 18,
  "recommendations": [               // ≤ 3, unlockCount desc, chỉ mode='gaps'
    {
      "archetype_id": "white_shirt",
      "label": { "en": "A crisp white shirt", "vi": "Một sơ mi trắng đứng dáng" },
      "unlock_count": 12,
      "note": { "en": "...", "vi": "..." },
      "sample_outfits": [["<itemId>", "<itemId>"], ...]   // ids THẬT của các món sẽ phối cùng (không chứa id giả định)
    }
  ],
  "starter_checklist": [             // chỉ mode='starter'
    { "archetype_id": "white_tee", "label": { "en": "...", "vi": "..." }, "owned": true }
  ],
  "redundancy": {                    // nullable
    "type_name": "TEE", "color_family": "whites", "count": 9,
    "note": { "en": "...", "vi": "..." }
  },
  "candidate": null                  // hoặc { "unlock_count": 7, "matched_archetype_id": "white_shirt" }
}
```

## Errors

| Status | Body | Khi nào |
|---|---|---|
| 401 | `{ error: 'Unauthorized' }` | thiếu/sai JWT |
| 429 | `{ error: 'rate_limited' }` | quá 10 lần/giờ |
| 200 với `mode:'starter'` | — | tủ trống/thưa KHÔNG phải lỗi (client dẫn UX riêng) |
| 500 | `{ error: 'Internal server error' }` | lỗi không lường |

## Invariants (test được)

1. Mọi `unlock_count` ≥ 3 (threshold) khi mode='gaps'.
2. Không recommendation nào có archetype `ownedMatch` khớp một item đang có trong tủ.
3. Mọi recommendation có archetype `styleAffinity` giao với selectedStyles của user (nếu user có chọn style).
4. `sample_outfits` chỉ chứa ids có thật trong tủ user.
5. Response không bao giờ chứa id item giả định (`hypo_*`).
6. Cùng tủ đồ + cùng ngày ⇒ cùng report (deterministic — seed theo userId+date như feed).
