> **Audit 2026-08-11** — rà lại toàn bộ ~122 mục `- [ ]` đang mở so với code hiện tại. Kết
> quả: 8 mục hoá ra đã implement xong từ lâu nhưng backlog quên đóng (3 trong số đó treo hơn
> một tháng) — đã xoá theo đúng quy ước dưới đây; 4 mục mô tả sai đủ để dẫn nhầm hướng người
> đọc sau (VD tưởng thiếu dependency đã cài từ tuần trước, tưởng con số cũ vẫn đúng sau khi
> đã tối ưu) — đã viết lại cho khớp thực tế; 1 cặp trùng lặp (`modest` style) — đã gộp một.
> Bài học: một việc CHƯA thật sự xong cho tới khi backlog entry của nó được đóng NGAY trong
> cùng phiên — để treo dù chỉ vài tuần là bắt người sau tốn công điều tra lại, hoặc tệ hơn là
> đi sửa một chỗ đã đúng.

## AH. Engine không có khái niệm "tổng độ ấm" của outfit (2026-08-12)

> ⚠ **ĐÃ THỬ SỬA VÀ ĐÃ REVERT trong cùng phiên 2026-08-12.** Bản sửa deploy lên
> production (fn version 64), rồi A/B với baseline mới lộ ra là nó giết nhầm một
> loạt outfit chuẩn → revert (`git checkout HEAD -- .../engine/`) + deploy lại
> (version 65). Hai mục 🔴/🟠 dưới đây vì vậy **MỞ LẠI**, KHÔNG phải đã xong.
> Chi tiết A/B + phân tích vì sao sai: `plan.md`, mục cùng tên, block ⚠ đầu mục.
> Patch còn giữ ở scratchpad phiên (`engine-layering.patch`, 451 dòng) — KHÔNG
> nằm trong repo, nếu cần làm lại thì đọc post-mortem trước khi apply.
>
> **Hai bài học bắt buộc cho lần làm lại:**
> 1. Tiêu chí đúng của Part B là **base CÓ CỔ/nẹp khuy** (POLO, sơ mi cài khuy mặc
>    trong cùng), KHÔNG phải "tay ngắn". Tay ngắn vơ nhầm cả `TEE` — mà tee dưới
>    sweater dưới jacket là stack kinh điển nhất, đúng ví dụ mà comment slot `mid`
>    trong `generation.ts` viện dẫn.
> 2. Part A không được tính lớp **outer** ngang giá lớp trong. Sweater len + coat len
>    = 3+3 = 6 > ngân sách fall 5, nhưng đó chỉ là 2 lớp và là outfit mùa thu chuẩn.
>    Nên đếm SỐ LỚP theo trần mỗi mùa, hoặc miễn/giảm giá lớp ngoài cùng.
> 3. Test unit xanh hết (319 pass) mà vẫn lọt sạch mấy regression này — vì chúng chỉ
>    assert luật mới bắn trúng đích, không assert outfit chuẩn giữ nguyên điểm. Đổi
>    RANKING thì bài test phải là **A/B sweep outfit known-good với engine trước khi
>    sửa, chạy TRƯỚC khi deploy.**

- [ ] 🔴 **`scoreSeasonMatch` tính TRUNG BÌNH theo món ⇒ mù hoàn toàn với số lớp mặc**
  (2026-08-12) — `engine/scoring.ts:1020`: `seasons.reduce((s, x) => s + SEASON_COMPAT[
  targetSeason][x], 0) / seasons.length`. Là trung bình, không phải tổng. Hệ quả: một look
  3 lớp thân trên (base + mid + outer) và một look 2 lớp cùng chất vải cho ĐIỂM SEASON Y
  HỆT NHAU. FIXED 2026-08-12 (đã chọn Option A ở trên, kết hợp thêm hard skip): thêm
  `torsoInsulation`/`LAYER_INSULATION`/`SEASON_INSULATION_BUDGET`/`scoreLayerLoad` trong
  `engine/scoring.ts` — cộng dồn insulation theo `fabricWeight` trên các lớp thân trên
  (`top`/`outwear`/`onepiece`), so với ngân sách theo `Season` (engine không có input
  Celsius, xem `plan.md` 2026-08-12). Wire multiplicative penalty trên `totalScore` trong
  `ranking.ts` (không phải một scoring dimension mới — trọng số `season` quá nhẹ để tự
  đẩy ranking) + hard skip khi lệch ngân sách ≥3. Cả hai ngưỡng đều CALIBRATION-PENDING.
  Test: `mid-layer.test.ts` (3 lớp bị loại ở mùa hè, được phép ở mùa đông;
  `scoreLayerLoad` no-op khi không có `targetSeason`).
- [ ] 🟠 **Base có cổ/nẹp khuy không được nằm dưới cả mid + outer** (2026-08-12, sửa lại
  tiêu chí sau khi bản "tay ngắn/tay dài" bị revert — xem block ⚠ đầu section) —
  `POLO: 'base'` trong `LAYER_ROLE_BY_TYPE` (`enrichment.ts:284`), chung rổ với
  TEE/SHIRT/HENLEY/BLOUSE. Grep `sleeve` toàn engine: chỉ xuất hiện như KEY ĐO
  (`sleeves` cm trong FIT_THRESHOLDS/KEY_EASE_WEIGHT của fit scoring), KHÔNG có attribute
  độ dài tay áo. FIXED 2026-08-12: KHÔNG cần cột DB/ingest mới — suy luận
  `FitItem.sleeveLength` ('short'|'long') trong `engine/enrichment.ts` bằng keyword tên
  món (ưu tiên) rồi fallback `TYPE_DEFAULT_SLEEVE` theo `typeName`, cùng lối rule-derived
  như `inferPattern`/`deriveFabricName`. Gate: base ngắn tay không được nằm dưới ĐỒNG THỜI
  cả mid và outer thật (dưới một trong hai vẫn OK) — áp cả ở nơi sinh (`generation.ts`, 2
  builder mid) lẫn choke point (`ranking.ts:310`, cùng chỗ với rule mid-nặng). Undefined
  fail-open. Test: `layering.test.ts` (name keyword thắng type default) +
  `mid-layer.test.ts` (generation + ranking choke point).
- [ ] 🟡 **Card không thể hiện thứ tự lớp mặc** (2026-08-12) — collage + meta strip bày 5
  món ngang hàng, user không biết polo mặc TRONG sweater mặc TRONG overshirt. Với outfit
  1 lớp thì không sao, nhưng từ khi slot `mid` tồn tại (2026-08-10) thì một look có thể có
  3 lớp thân trên. Collage đã biết z-order (OUTER→MID→INNER trong `collageLayout.ts`),
  chỉ là chưa nói ra thành chữ. UI work, ngoài phạm vi fix engine 2026-08-12 ở trên.

## AG. Phát hiện từ screenshot feed 2026-08-12

- [ ] 🟡 **Collage lệch trái, trống hẳn góc dưới-phải** (2026-08-12) — sau khi thu nhỏ
  scale (`COLLAGE` trong `src/components/outfit/collageLayout.ts`), bố cục đọc thành hình
  chữ L: anchor cột trái (9–39 wu) + cột phụ bên phải (~56–82 wu) + hàng phụ kiện dồn hết
  về trái vì `centerX = anchorBox.left + anchorBox.w / 2` — mọi hàng accessory căn theo
  centerline của anchor. Với anchor ở cột trái thì cả 3 tầng đều nặng bên trái, để lại một
  mảng trống lớn ở góc dưới-phải và một "rãnh" dọc ~17 wu giữa hai cột. Chưa sửa: đây là
  lựa chọn cố ý trước đó (một phụ kiện lẻ căn giữa khung đọc như bị rời khỏi anchor — xem
  comment ~dòng 268), nên đổi sang căn giữa toàn khung / căn giữa bounding-box của cả
  composition là một trade-off thẩm mỹ, phải hỏi anh Khôi trước.
- [ ] 🟢 **Header nhiệt độ hiển thị "–" trong khi card ghi "15–22°C"** (2026-08-12) —
  `app/(tabs)/index.tsx:215` fallback về `t('tabs_home_weatherLabel')` = `"–"` khi
  `weatherContext` null (weather chưa load / bị từ chối quyền vị trí), còn `outfit.weather`
  trên meta line là dải nhiệt độ tĩnh của outfit chứ không phải thời tiết thật. Hai con số
  cạnh nhau mâu thuẫn về mặt đọc. Cần quyết: ẩn hẳn cụm nhiệt độ header khi chưa có dữ
  liệu, hay retry/hiện lý do.
- [ ] 🟢 **Chấm xanh lạ giữa vùng trống cột phải** (2026-08-12) — thấy trong screenshot ở
  ~66% chiều ngang, ngay dưới polo. Không truy được nguồn trong code: card chỉ render 5
  slot collage (đúng 5 món, đều hiện) + rail action, `buildLayout` lọc `hasImage`, và
  không có element dot nào trong `app/(tabs)/`. Màu xanh cũng nằm ngoài palette
  near-monochrome. Nghi overlay hệ thống / artifact screenshot — cần chụp lại để xác nhận.

## AB. Phát hiện phiên 2026-08-10 (review toàn app + khảo sát engine)

- [ ] **Personal colour: KHÔNG có telemetry chẩn đoán nào** (2026-08-10) — `hueDeg`,
  `ITA°`, `snrOk`, `scleraCorrected`, các cờ confidence đều được tính rồi bay hơi: không
  log, không render, không lưu (verify: không một `console.log` nào trong
  `src/features/personal-color/`; các field đó không xuất hiện ở `ResultView`). Chỉ
  `season`/`palette`/`tone12` tới được Supabase. Hệ quả: KHÔNG đo được độ chính xác —
  cầm máy chụp 15 lần cũng chỉ đọc được `tone12`/`season` từ màn kết quả, không biết
  hue bao nhiêu độ hay SNR có đạt không. Chặn thẳng Tier 1 của
  `docs/personal-color-device-test-protocol.md`. Doc đã ghi rõ chỗ chèn `console.log`
  tạm trong `analyzeFace` (instrumentation vứt đi, không ship).

- [ ] **Sentry: cần DSN + cân nhắc thêm lại Gradle plugin** (2026-08-10, cập nhật 2026-08-13) —
  `EXPO_PUBLIC_SENTRY_DSN` vẫn RỖNG trong `.env`, nhưng đã bị XOÁ hẳn khỏi cả 3 profile
  `eas.json` (2026-08-13) vì EAS reject giá trị `env` rỗng chuỗi khi validate. Code guard
  (`app/_layout.tsx` — `if (dsn) {...}`) vẫn im lặng như cũ vì `undefined` cũng falsy như
  `""`. Khi anh Khôi tạo project Sentry và có DSN thật, phải THÊM LẠI key
  `EXPO_PUBLIC_SENTRY_DSN` vào cả 3 profile `eas.json` (không chỉ set giá trị — key đang
  không tồn tại). `expo install` tự thêm config plugin vào `app.json` và agent đã GỠ RA có
  chủ đích: plugin đó chain `sentry-cli` upload vào Android release bundle và FAIL nếu
  thiếu `SENTRY_AUTH_TOKEN` → sẽ làm gãy pipeline Gradle release local (dự án không dùng
  EAS build cho Android). Thêm lại khi đã có project + token, nếu muốn source map.
  Có `app/dev-sentry-test.tsx` (dev-only, đã `.easignore`) để tự bắn lỗi thử.
  Analytics (khác crash reporting) vẫn CHƯA có gì — cố ý hoãn sang sau.

## AA. Suggestion toggles — follow-ups (2026-08-10)

- [ ] **No client-visible hint when a toggle is suppressing a dimension** — unlike the
  wardrobe-affinity `style_fallback` envelope (surfaced as a quiet feed hint, see git log
  2026-08-08), turning off `suggest_by_style`/`suggest_by_personal_color`/
  `suggest_by_formula`/`suggest_by_measurements` currently has zero client-visible signal
  beyond the Settings switch itself and a server console log
  (`[generate-outfits] suggestion toggles off: …`, same in `evaluate-item`/
  `wardrobe-critic`). Not requested by the chốt design, but worth considering later: a
  small "not scoring by X today" note somewhere in the feed/verdict/critic UI, so a user
  who toggled something off months ago and forgot isn't confused by shifted suggestions.
- [ ] **`wardrobe-critic`/`evaluate-item` response schemas don't surface which toggles
  were off for that call** — `generate-outfits` doesn't either (this was intentionally
  out of scope per the chốt design — DB-only toggles, no request/response wiring). If a
  future debugging need arises (e.g. support ticket "why did my gaps report change"),
  consider echoing the four booleans back in the response for traceability.

---

# Backlog — review later

Deferred items flagged during development. Each has enough context to pick up cold.
Dọn 2026-07-03 theo yêu cầu anh Khôi: mọi mục đã implement bị XÓA (lịch sử đầy đủ nằm
trong plan.md changelog); còn lại phân nhóm theo lý do chưa làm.

---

## Z. Wardrobe photos — dangling `photo_storage='local'` refs (2026-08-08)

- [ ] **`tee-airism.png` là ảnh Harrington Jacket từ commit đầu tiên — cần ảnh tee thật**
  (2026-08-12, phát hiện khi truy vết card "2 áo khoác không có top" trên feed).
  Chuỗi nhân quả đã verify từng bước: `assets/items/tee-airism.png` byte-identical với
  `jacket-harrington.png` (31.098 bytes, sai từ commit `c41a644`) → upload cloud y nguyên
  cho CẢ 2 wardrobe (object `cf299883-…png` folder `d90a166b…` và folder `19595dec…`,
  cùng 80.205 bytes với object harrington) → backfill AI đọc ảnh jacket nên gắn
  `can_layer=true` + hex/drape/visual_interest của jacket cho "cái tee" → engine layer
  tee ngoài polo (log: "AIRism Cotton Tee (outwear)", tip "wear the tee open over the
  polo") và feed card nhìn như 2 jacket không top. Engine/collage KHÔNG có bug — outfit
  hợp lệ, chỉ ảnh sai. ĐÃ LÀM 2026-08-12: null các field suy-từ-ảnh (`can_layer`,
  `primary_hex`, `secondary_hex`, `drape`, `print_scale`, `visual_interest`,
  `distressed`) trên 2 row AIRism (`cf299883…` + `29945877…`) → TEE hết layer được theo
  rule. CŨNG ĐÃ LÀM cùng ngày (anh Khôi duyệt phương án tự tải ảnh Uniqlo): thay
  `assets/items/tee-airism.png` bằng flat shot AIRism Cotton Oversized Tee trắng thật
  (goods_00_465185, xoá logo góc, 1000×1000 PNG) và upload đè CẢ 2 object cloud.
  CÒN LẠI: (1) chạy lại backfill-item-metadata cho 2 item AIRism (cần
  `BACKFILL_ADMIN_SECRET`) để điền lại hex/drape/visual_interest từ ảnh đúng;
  (2) ảnh cũ có thể còn trong device cache (`ensureCloudCached` cache theo id) —
  cần clear app data / xoá cache trên máy test để thấy ảnh mới; (3) tiện thể: demo
  `512 Slim Taper (Charcoal)` đang trỏ ảnh bản Blue — lệch màu nhỏ, sửa nếu muốn.

- [ ] **3 demo-wardrobe items có ảnh gãy (broken image placeholder)** — phát hiện
  2026-08-08. Trong DB live (user `19595dec-bad6-48e7-a859-fbabee490b7d`), 3/35
  `clothing_items` có `photo_storage='local'` + `photo_url='wardrobe-photos/<uuid>.png'`:
  - `Navy blue crew neck t-shirt` → `eabb3870-7ffb-4d2a-9e72-c8b7eea14bab.png`
  - `Black fitness tracker` → `54731323-45ef-4e06-9895-79bbcb6a57fc.png`
  - `Small silver stud earring` → `b2d81d1a-d953-4a3b-b291-91c8c672ceb6.png`

  3 uuid này KHÔNG tồn tại ở đâu khác: không có trong bucket `wardrobe-photos`
  (32 object, tất cả đều được reference, không orphan), không có trong
  `seedLocalPhotos.dev.ts`, không có trong `assets/items/`. Tức là ảnh chỉ từng
  nằm trong app sandbox của đúng cái máy đã thêm item → cài lại app / đổi máy là
  mất vĩnh viễn. `resolveItemPhotoSource` (`src/features/wardrobe-photos/useItemPhoto.ts:46`)
  trả `status:'missing'` → UI hiện placeholder. Code đúng theo FR-009, lỗi nằm ở data.
  Cần chốt: chụp/gán lại ảnh cho 3 item, hay set `photo_url=NULL, photo_storage='none'`
  để về empty-state sạch. `/dev-seed` KHÔNG fix được (3 id này không nằm trong seed list).

  **CẬP NHẬT 2026-08-12** — 3 item gốc nói trên đã bị XOÁ hôm 2026-08-11 (có backup JSON).
  Nhưng đợt backfill hôm nay lộ ra **3 item KHÁC cùng bệnh**, thuộc wardrobe
  `a303e5b4-e0c6-4977-a8ab-bccee9546600`, tức lỗi này VẪN ĐANG TÁI DIỄN chứ không phải
  sự cố một lần:
  - `Black framed eyeglasses` (SUNGLASSES) → `2abf45dd-…jpg`
  - `Black strap watch` (WATCH) → `df3891b0-…jpg`
  - `Dark trousers` (TROUSERS) → `2ffc020a-…jpg`

  Đã verify qua `storage.objects`: **không object nào trong 3 cái này tồn tại** trong bucket
  `wardrobe-photos`, dù `photo_url` trỏ vào đó. Backfill fail đúng 3 món này với
  `unfetchable image (photo_storage=local)` — nên chúng cũng là 3/70 món duy nhất không có
  metadata đầy đủ.

  CHƯA XOÁ, chờ anh Khôi chốt. Khuyến nghị: **set `photo_url=NULL, photo_storage='none'`**
  thay vì xoá row — mắt kính/đồng hồ/quần tây là đồ thật trong tủ, xoá là mất món chứ không
  chỉ mất ảnh; engine vẫn chấm được chúng nếu có metadata (hiện chưa, vì không có ảnh để đọc).

- [ ] **Free tier: ảnh item không có bản cloud → mất khi cài lại app** — `storePhoto()`
  (`src/services/wardrobeService.ts:261`) chỉ upload cloud khi `tier==='premium'`;
  free tier dừng ở `writeDeviceCopy` → `photo_storage='local'`. Đây là nguyên nhân gốc
  của mục trên. Có `promoteToCloud()` nhưng nó cần file trên máy còn sống, nên không cứu
  được sau khi mất. Cân nhắc: cảnh báo user free rằng ảnh chỉ nằm trên máy, hoặc chạy
  promote khi user nâng cấp premium (trước khi file kịp bị reclaim).

---

## G. Responsive layout (iPad) follow-ups (2026-07-22)

- [ ] **iPad landscape orientation** — currently portrait-locked
  (`app.json` `orientation: "portrait"`); unlock + audit all screens for
  landscape/multitasking widths (deferred, out of current scope — this
  session only shipped portrait-only responsive support per plan.md
  changelog "Responsive layout — phone to iPad Pro 13\" (2026-07-22)").
- [ ] **Font-scaling caps** — no `allowFontScaling`/`maxFontSizeMultiplier`
  anywhere; tight fixed `lineHeight`s + `numberOfLines` truncation risk
  clipping text at large accessibility text sizes. Add a shared `Text`
  primitive with a cap (deferred).
- [ ] **iPad has no camera torch — personal-color wrist scan degraded**
  — `app/(onboarding)/personal-color.tsx` WristScanStep uses `facing="back"`
  + `enableTorch` dual-flash (torch on/off) to cancel ambient light for skin
  undertone detection. No iPad model has an LED camera flash/torch, so
  `enableTorch` is a no-op on iPad → the two captures are effectively
  identical and undertone results are unreliable. Detect iPad (or no-torch
  device) and either hide/skip the wrist-flash step or fall back to a
  single-shot ambient path with a warning. Discovered 2026-07-22 while
  auditing iOS feature parity after enabling `supportsTablet`. STILL NOT
  SOLVED for the wrist step — but as of Personal Colour v3 Phase A
  (2026-08-04) the wrist is now only the SECONDARY undertone site: the new
  `FaceScanStep`'s screen-flash technique (full-screen white overlay +
  `expo-brightness` pushed to max, standing in for a torch on the front
  camera) works on any device with a screen, iPad included — so the PRIMARY
  face read is unaffected by this gap. Fixing the wrist step itself is still
  open, just lower priority now that it's not the primary signal.
## A. Chờ anh Khôi duyệt — trade-off lớn (chi phí / UX / phạm vi)

- [ ] **`base.rounded` (apple) và `base.waist` (hourglass) chặn cứng nhánh "cân bằng" →
  không outfit nào khiến 2 baseline này đọc ra `rectangle`** (2026-08-11, phát hiện khi
  fix hình phạt shapeGoal ở trên — KHÔNG sửa trong task đó, cần anh Khôi duyệt trước).
  Câu hỏi thật: có nên cho bằng chứng từ OUTFIT (vd. cạp cao rõ ràng, không structured
  piece nào, không avg cao) được PHÉP lật `base.rounded`/`base.waist` để đọc ra
  `rectangle`, giống cách `outfitWaistDefinition` đã lật chúng để đọc ra `hourglass`
  (fix 2026-08-10)? Đây là câu hỏi về Ý NGHĨA của "resulting silhouette" — sửa nó đổi
  cách đọc dáng cho MỌI user apple/hourglass ở mọi tính năng dùng `resultingBodySilhouette`
  (không chỉ shapeGoal), không phải side-effect nên làm ngầm trong một patch hình phạt.
  Hiện tại: goal `rectangle` cho 2 baseline này đã được neutralise (không còn bị trừ điểm)
  qua `isShapeGoalReachable`, nhưng user vẫn KHÔNG BAO GIỜ thấy outfit của mình được gắn
  nhãn `rectangle` — chỉ là không còn bị phạt vì điều đó nữa.

- [ ] **`resultingBodySilhouette` vẫn chỉ đọc ~2.5 biến (volume top/bottom + 1 cờ nhị
  phân "có eo do outfit tạo hay không")** (2026-08-10, còn treo sau fix trên) — mô hình
  vẫn bỏ qua các đòn bẩy stylist kinh điển khác: vị trí eo cụ thể (cạp cao/thấp), đường
  vai/vai độn, độ dài áo (crop vs tunic), cổ áo (V vs thuyền), khối màu dọc/monochrome,
  mức độ "chiết eo" (nhị phân có/không, không có thang độ). Hai thứ rẻ nhất để thêm
  trước vì dữ liệu ĐÃ có: vị trí eo (formula `rule_of_thirds` đã tồn tại nhưng chưa nối
  vào shape read) và monochrome (formula đã có, cũng chưa nối). Vai/cổ cần thêm trường
  vào wardrobe item → đắt hơn, làm sau.

- [ ] **`WAIST_DEFINING_TYPES` chỉ có CORSET/BLAZER/VEST — DRESS và COAT/OVERCOAT/JACKET
  bị loại có chủ đích** (2026-08-10, CALIBRATION-PENDING) — `typeName` không phân biệt
  được kiểu dáng cắt may (wrap dress chiết eo vs shift dress thẳng thùng; trench coat có
  đai vs coat suông) vì wardrobe item chưa có trường "silhouette cut". `DRESS` bị loại
  hoàn toàn khỏi tín hiệu chiết eo dù nhiều wrap/fit-and-flare dress chiết eo rất rõ; một
  trench có đai vẫn được nhận diện NHƯNG chỉ qua tín hiệu (a) thắt lưng phụ kiện, không
  qua chính type COAT. Muốn làm đúng cần thêm trường silhouette-cut vào extract-garments
  hoặc backfill-item-metadata.

- [ ] **`shapeGoal` chưa nối vào `evaluate-item`/`wardrobe-critic`** (2026-08-10) — task
  "shape goal" chỉ định rõ phạm vi `generate-outfits`, không như phiên "4 suggestion
  toggles" (2026-08-10, mục dưới) vốn yêu cầu áp dụng cả 3 function. Cả hai function vẫn
  compile/pass bình thường (field optional, no-op khi absent), nhưng verdict của
  `evaluate-item` và report của `wardrobe-critic` hiện KHÔNG biết tới dáng đích user đã
  chọn. Cần quyết định có đáng làm không trước khi tự ý mở rộng phạm vi.

- [ ] **Engine metal wiring** (2026-08-04, deferred out of Phase C by design decision —
  plan.md Phase C entry has the rationale). Scoring gold-vs-silver accessories needs:
  (1) item-metadata metal vocabulary (`gold`/`silver` — engine PrimaryColor only has
  'metallic') + backfill of existing accessories, (2) a clean `supabase/functions` tree
  (currently carries uncommitted wardrobe-critic work; single production env — deploying
  now would ship unfinished code). Do after wardrobe-critic lands.

- [ ] **ColorChecker validation fixture** (2026-08-04, blocked on anh Khôi's purchase
  decision — Classic Mini ~$50–60). Capture the physical card through the app's own flow,
  assert recovered LAB within published bands, retiring the `CALIBRATION-PENDING` markers
  on the colour-math constants for real. Needs the physical card + a real device.

- [ ] **Wardrobe critic — chưa smoke-test trên thiết bị thật.** T032 candidate re-scoring
  (dòng unlock-count thật trên banner "Fills your gap: {label}" ở `ResultScreen.tsx`) đã
  ship 2026-08-11 (`useCandidateUnlock`, `resultScreen_fillsGapUnlocks`) nhưng cũng chỉ
  verify được `tsc --noEmit` + `jest`, chưa chạy qua máy thật lần nào — narrow scope còn
  lại xuống đúng phần chưa test: chạy qua Menu → Wardrobe Report (3 mode:
  gaps/starter/complete), free vs premium gating, end-of-feed card, Try-On bridge line, VÀ
  dòng unlock-count T032 mới (fail-soft theo thiết kế — xác nhận lỗi/chậm không chặn
  verdict, không hiện spinner) trên thiết bị/emulator thật trước khi coi là xong hẳn.
- [ ] **Gemini judge cho eval harness.** `scripts/eval-feed/judge.ts` sẵn sàng nhưng máy dev
  không có GOOGLE_API_KEY (secret chỉ nằm trên Supabase). Cần anh Khôi set key local hoặc
  đưa vào CI để có blind A/B judge thật; hiện các vòng đo đều chấm tay theo rubric.
## B. Cần thiết bị thật / dữ liệu thật (không verify được từ máy dev)

- [ ] **Collage flow layout — chưa verify trực quan trên máy thật** (2026-08-12) — layout
  collage mới (anchor to nhất bên trái / căn giữa khi không có secondary; secondaries cột
  phải top-aligned theo Y anchor; accessories hàng dưới cùng trải đều + wrap; scale-to-fit
  + căn giữa dọc; `areaAspect` đo qua onLayout) mới chỉ verify bằng 13 unit test + tsc.
  Cần mở app trên emulator/máy thật, lướt feed qua nhiều outfit (2 món, 3-4 món, nhiều
  phụ kiện, chỉ dress+giày) xem tỷ lệ/khoảng cách nhìn có đúng ý không — các hằng số
  trong `COLLAGE` (`src/components/outfit/collageLayout.ts`) là draft, có thể cần tune.
  Cùng đợt (2026-08-12, sau feedback "quần không được scale lên"): pipeline đo
  **content-bounds** on-device mới (`src/features/wardrobe-photos/contentBounds.ts` +
  `contentBoundsUri.ts`, crop sát món đồ + aspect thật cho layout) cũng CALIBRATION-PENDING:
  threshold Manhattan 60 / min-content 1% / pad 2% chưa chạy qua ảnh thật. Case cần soi kỹ
  trên máy: đồ TRẮNG trên nền trắng (nguy cơ box chỉ bắt được phần có bóng đổ → crop cụt
  món đồ; nếu gặp thì tăng threshold hoặc thêm guard), và ảnh remote retailer (manipulate
  có thể fail → fallback contain, chỉ cần xác nhận không crash).

- [ ] **Try-on face composite — `faceDetect.ts`'s `NORMALIZE_TO_UNIT` vẫn chưa calibrate
  trên thiết bị thật** (2026-08-07, đợt edit-in-place + composite diagnostics). Chưa biết
  BlazeFace short-range cần input [0,1] hay [-1,1] — diagnostics mới thêm ở
  `compositeFace()`/`faceCompositeStats.ts` (`CompositeReason` + `byReason` tally, caption
  `__DEV__` trên `wear.tsx`) sẽ giúp XÁC ĐỊNH thay vì đoán mù (nếu `no_face_source`/
  `no_face_generated` chiếm phần lớn `byReason`, gần như chắc chắn normalisation sai — lúc
  đó mới flip flag, không đoán trước).
- [ ] **Try-on face composite — hằng số `faceMaskRadii()` cần tune trên thiết bị thật**
  (2026-08-07): 0.62 (ear-span → rx), clamp 1.4x/2.6x inter-eye, fallback 1.9x, tỉ lệ
  ry/rx 1.28 — toàn bộ CALIBRATION-PENDING, chưa chạy qua ảnh thật lần nào. Cần verify mask
  rộng hơn (tới jaw/hairline/tai) có làm seam lộ rõ hơn không, và ear-span guard (reject nếu
  < inter-eye hoặc > inter-eye×6) có đúng ngưỡng không.
- [ ] **Try-on — cân nhắc thêm lựa chọn "studio backdrop" làm optional cho user** (2026-08-07):
  đợt edit-in-place bỏ hẳn nền studio/editorial framing (chủ đích, để fix mặt bị đổi thành
  người khác). Look đó (nền sạch, khung người mẫu cao) có giá trị thẩm mỹ riêng — có thể sau
  này thêm như 1 lựa chọn user tự bật (trade-off rõ: nhận nền đẹp hơn, đổi lại rủi ro mặt lệch
  quay lại). Chưa duyệt, chỉ ghi nhận ý tưởng.
- [ ] **Personal color v2 — device verify + curation** (2026-07-06): drape colours & 12
  palette (draft) cần design review trên máy thật; dual-flash timing 350ms cần thử
  iOS/Android. (countryCode ĐÃ wire qua `authStore.locationCountryCode` — chỉ còn verify
  trên máy thật rằng seasonal edit đổi hemisphere đúng với profile có country code phía nam.)
  — Nối thêm (2026-07-06): boards 26 màu/tone (8 neutrals + 12 core + 6 accents) và
  `TONE12_AVOID` skip-lists cũng là draft-curated bởi design lead, CHƯA qua design review
  trực quan trên máy thật. (Cập nhật cùng ngày, phiên measured-hex: 4 tên màu rust/mustard/
  fuchsia/grey KHÔNG còn bị loại — `PrimaryColor` union đã mở rộng +11 và `grey`→`gray` đã
  sửa, nên `soft_summer`/`deep_autumn` giờ fire đủ danh sách draft gốc. Design review trực
  quan trên máy thật vẫn CHƯA làm — vẫn cần design lead xác nhận bảng màu/skip-list nhìn có
  đúng ý không.) `TONE12_AVOID_MAX = 0.06` cũng CALIBRATION-PENDING, chưa tune với feedback thật.
- [ ] **Personal Colour v3 Phase A — chưa test trên thiết bị thật** (2026-08-04, session
  implement Phase A). Toàn bộ pipeline face-scan (screen-flash dual capture, BlazeFace box
  decode mới thêm ở `faceDetect.ts`, sclera white-reference correction, ambient subtraction,
  ITA°-anchored value axis) là code-complete + unit-tested (pure math) nhưng CHƯA chạy qua
  camera thật lần nào. Cần verify trên máy thật: (1) `expo-brightness` setBrightnessAsync/
  getBrightnessAsync hoạt động đúng trên cả iOS/Android không cần permission thêm; (2) box
  regression decode (channel 0-3 của BlazeFace SSD output) cho ra bounding box hợp lý — nếu
  sai thứ tự channel, `hairBand` region sẽ lệch; (3) SNR threshold 0.015 và sclera gain range
  [0.6, 1.6] có phù hợp ánh sáng thật không; (4) FACE_WORKING_WIDTH=192 có đủ pixel cho vùng
  má/trán sau khi co theo aspect ratio của các máy khác nhau không.
- [ ] **Personal Colour UX-simplify — chưa test trên thiết bị thật** (2026-08-06, xem
  `docs/personal-color-ux-simplify-instruction.md` + plan.md changelog cùng ngày). Rebuild
  UX shell (intro → prepare → face 1/2 → wrist 2/2 → result; AxisMeters; ResultView dùng
  chung cho onboarding + edit; collapsible FULL PALETTE/BEYOND THE WARDROBE/ADJUST THE
  RESULT; failure-state copy cho permission-denied/photo-fallback/save-error) là code-
  complete + `tsc`/`jest` xanh nhưng CHƯA chạy qua thiết bị thật lần nào — cần verify:
  (1) `LayoutAnimation` mượt trên Android thật (New Arch); (2) prepare→face-scan tap
  chuyển step đúng, back() từ face-scan quay lại đúng prepare (không nhảy thẳng về intro);
  (3) bố cục AxisMeters (dot vị trí theo axis) không bị lệch trên các kích thước màn hình
  khác nhau; (4) toàn bộ acceptance checklist trong instruction doc (5 taps camera happy
  path, zero jargon labels, v.v.) trên máy thật, không chỉ đọc code.
- [ ] **AxisMeters — highlight trục thấp nhất khi confidence thấp** (2026-08-06, đề xuất
  trong instruction doc §10 nhưng chưa duyệt implement): khi `result.confidence === 'low'`,
  khoanh một vòng tròn quanh dot của trục có margin thấp nhất (`classifyTone12`'s weakest
  axis) trên `AxisMeters.tsx` để chỉ rõ "đây là trục không chắc chắn" thay vì chỉ có caption
  chung "A quick drape session will sharpen this." bên dưới. Cần chốt UX với anh Khôi trước
  (thêm state/prop mới cho AxisMeters) nên để lại backlog thay vì tự quyết trong session này.
- [ ] **Persist `secondaryTone12`/`confidence` vào `profiles`** (deferred từ Phase A,
  2026-08-04) — theo đúng hợp đồng A5.5, hai field này hiện chỉ session-local (tính lại mỗi
  lần result screen mount, không lưu qua `savePersonalColor`). Nếu muốn hiển thị "leaning
  {tone}" ở profile/feed sau khi rời màn hình kết quả thì cần thêm cột + migration + thread
  qua `savePersonalColor` payload — ngoài phạm vi Phase A (hard constraint: không đổi DB
  schema/payload trong phase này).
- [ ] **Camera scan — EXIF fix efficacy**: xác nhận trên Android thật rằng bỏ
  `skipProcessing` cho pixel đứng thẳng và MoveNet detect được pose.
- [ ] **Camera scan — overlay/preview alignment**: skeleton SVG có thể lệch khi aspect
  still ≠ preview (cover-crop). Cosmetic, không ảnh hưởng số đo. Cần aspect ratio runtime.
- [ ] **Camera scan — surface estimate confidence**: `EstimatedMeasurements.confidence`
  tính rồi nhưng chưa hiển thị; cân nhắc badge/warning trên success veil. (Không làm trong
  đợt quét 2026-07-03 vì `measurements-scan.tsx` đang là WIP của phiên khác — tránh conflict.)
- [ ] **MoveNet dtype/dequant trên build thật**: nhánh float32 vs uint8 trong
  `poseEstimate.ts`, letterbox đen vs mid-grey, và retune `K` heuristics vs thước dây thật.
  **Tool đã sẵn sàng (2026-07-06)**: `scripts/measure-eval` (xem plan.md changelog
  cùng ngày) — capture scan qua `app/measurements-scan.tsx` (`__DEV__`, dòng log
  `[MEASURE_EVAL_JSON]`), điền tape-measure thật vào `groundTruth`, thả vào
  `scripts/measure-eval/fixtures/`, chạy `npm run measure-eval -- --calibrate` ra bias/
  MAE/RMSE per-field + tunables đề xuất — không cần quét lại. Blocker: cần capture ≥3
  subject thật (1 subject dễ overfit MAE về ~0, không đáng tin).
- [ ] **Try-On verdict — retune `GIRTH_K`/`GIRTH_RATIOS`** vs số đo thật; cân nhắc badge
  "estimated" trực quan trên client (hiện chỉ đổi copy).
- [ ] **Android 16 KB page-size**: `react-native-fast-tflite@2.0.0` đã fix trên giấy —
  phải rebuild + chạy `python scripts/check-16kb.py` + launch trên emulator 16 KB.
- [ ] **Splash Android 12+**: wordmark ngang có thể bị shrink/crop trên OS splash một số
  máy; nếu xấu → dùng M mark cho OS splash, wordmark chỉ ở JS splash.
- [ ] **Launcher icon — ACTION để thấy được**: rebuild + reinstall native (`npx expo
  run:android` / EAS); Android có thể cache icon cũ → uninstall trước. Sau đó commit
  `android/.../mipmap-*` + splash + manifest đã regenerate (chờ anh Khôi gật commit).
- [ ] **Pose accuracy — ý tưởng cần device tuning**: perspective/camera-tilt correction;
  ~~temporal averaging nhiều frame lấy median~~ [x] implemented 2026-07-06 (xem plan.md
  changelog "Measurement accuracy — multi-frame median aggregation" +
  `src/features/measurements/aggregateFrames.ts`) — còn lại: cross-check
  `noseAnkleHeightFraction` bằng eye/ear midpoint. Upper-arm/neck/thigh/foot vẫn
  manual-only (pose không với tới).
- [ ] **Multi-frame aggregation — device verify** (2026-07-06, xem plan.md changelog
  cùng tên): (1) latency của segmentation chạy 3× thay vì 1× tại thời điểm capture —
  đo trên máy thật xem 'processing' veil có đứng lâu khó chịu không, cân nhắc chạy
  song song (`Promise.all`) hoặc giảm `BUFFER_SIZE` nếu chậm; (2) xác nhận ring buffer
  (`frameBufferRef` trong `measurements-scan.tsx`) dọn sạch cả 3 file tạm — không leak
  ảnh nào qua khỏi phiên scan (privacy contract) — kiểm tra document directory trên máy
  thật sau vài lần scan liên tiếp (auto-capture, Capture-now, self-timer, và pose-lost
  giữa chừng).

- [ ] **Personal color — calibrate hue-angle thresholds (47°/57°) + skin gamut với ảnh cổ
  tay thật** (2026-07-06): ngưỡng hiện tại là ước lượng; cần vài ảnh wrist thật (flash bật/
  tắt) để tune. Cũng verify darkest-cluster tóc với tóc nhuộm/nền tối.

- [ ] **Try-on face compositing — device tuning** (2026-07-07, feature 010: xem plan.md
  changelog "Try-on face compositing — paste real face onto generated image" +
  `src/features/try-on/{faceDetect,faceCompositeMath,faceComposite}.ts`). Chưa smoke-test
  trên thiết bị/emulator thật (chỉ verify `tsc`/`jest` từ máy dev). Các tham số
  CALIBRATION-PENDING cần tune bằng ảnh thật:
  - BlazeFace input normalization: đang thử `[0,1]` trước (`NORMALIZE_TO_UNIT = true` trong
    `faceDetect.ts`); nếu model không detect được face nào trên thiết bị thật, đổi sang
    `[-1,1]` (`pixel/127.5 - 1`, đã có sẵn nhánh code, chỉ cần flip constant).
  - Feather radius + mask ellipse size (`MASK_RX_FACTOR`/`MASK_RY_FACTOR`/`MASK_FEATHER` trong
    `faceComposite.ts`) — hiện là bội số ước lượng của khoảng cách hai mắt, chưa test trực
    quan xem có che đúng vùng mặt (không dính tóc/tai/quai hàm) không.
  - Color-match strength (`colorTransfer` mean/std transfer trong `faceCompositeMath.ts`) —
    chưa biết paste vào có nhìn "dán" hay tự nhiên trên ảnh generated thật.
  - Alignment plausibility gate (`MIN/MAX_PLAUSIBLE_SCALE`, `MAX_PLAUSIBLE_ROT_DEG` trong
    `faceCompositeMath.ts`) — ngưỡng ước lượng, chưa biết bao nhiêu % ảnh thật bị reject/
    fallback do lệch góc/scale.
  - **Giới hạn đã biết trước (không phải bug)**: khi góc đầu giữa ảnh gốc và ảnh generated
    lệch quá nhiều (ví dụ ảnh gốc chụp nghiêng nhưng model generate ra mặt thẳng), gate sẽ
    reject và fallback về ảnh generated gốc (không ghép mặt) — chấp nhận được vì ghép mặt
    lệch góc quá sẽ bị méo, nhưng cần biết đây là behavior có chủ đích khi debug "sao không
    thấy mặt thật".

## C. Hoãn có chủ đích (đã quyết không làm bây giờ)

- [ ] **Live weather/temperature API**: season theo ngày+bán cầu đã đủ tốt; nhiệt độ thật
  là tier chính xác kế tiếp. Tiền đề: lưu GPS lat/lng (mục dưới). Hook sẵn: `EngineContext`
  đã có `weatherSeason`, fetch sẽ nằm ở generate-outfits + evaluate-item index.
- [ ] **Persist GPS lat/lng**: chính xác hemisphere cho nước xích đạo + unblock weather API.
  Cột mới + capture trong `locationService` (đã có GPS fix trong tay). Làm cùng weather API.
- [ ] **B-full — vision-camera realtime overlay** (~15fps): 4 native deps mới + rủi ro
  16 KB alignment; chỉ làm nếu B-lite (~1.2s poll) lag thật ngoài đời.
- [ ] **Branding 0b**: `MIEN-icon-dark` làm iOS dark/tinted icon; wordmark trên header
  Home/Profile. Cosmetic, làm khi polish branding.
- [ ] **Splash tone-shift**: splash bg #F2ECE0 ấm hơn canvas #FAF7F2 một chút tại handoff —
  để nguyên; muốn hết thì recolor png về #FAF7F2 hoặc để transparent.
- [ ] **Weather filter trên feed (nếu muốn quay lại)**: giờ mỗi outfit đã có `weatherBand`
  thật (2026-07-03) nên filter/auto-bias theo band đã khả thi — làm khi có nhu cầu UX.
- [ ] **Dịch data-catalog content (2026-07-06, từ i18n sweep)**: `src/data/index.ts`'s
  demo style/color/occasion display names (`'OLD MONEY'`, `'CASUAL FRIDAY'`, `'STREETWEAR'`…),
  `build.tsx`'s synthetic `style`/`context` fallback (`'CUSTOM'`, `'CASUAL'`), và server-side
  `FormulaCatalogItem.name`/`.description` (đã có field `nameVi` sẵn nhưng CHƯA ai đọc nó) đều
  là nội dung dữ liệu, không phải UI chrome — vẫn tiếng Anh bất kể ngôn ngữ app đang chọn.
  Cần một bilingual data layer (migration thêm cột `*_vi`, hoặc join catalogue theo locale)
  chứ không sửa được bằng key i18n phía client — hoãn lại như content work riêng.
- [ ] **Spot-check UI cả 2 ngôn ngữ trên thiết bị thật (2026-07-06, từ i18n sweep)**: sau khi
  externalize toàn bộ ~38 screens (5 batch + đợt hoàn thiện outfit/[id].tsx + error strings
  trong store/service), 980 keys en/vi đã sync và tsc/jest xanh — nhưng chưa chạy trên máy
  thật để kiểm tra layout/truncation khi tiếng Việt dài hơn tiếng Anh (dấu, độ dài chuỗi khác
  nhau có thể vỡ layout ở nút bấm ALL-CAPS hẹp, banner lỗi, v.v.).

## E. Bảo mật & crash risk — audit toàn app 2026-07-03 (4-agent review)

Đã fix ngay trong phiên này: 2 nút "Sign out" không gọi `authStore.logout()`
(`app/(tabs)/index.tsx`, `app/(tabs)/profile.tsx` — session/state cũ không bị xoá) +
bug URI `content://` Android khiến Try-On Scan và Add-to-Wardrobe AI-extract crash khi
chọn ảnh thư viện (`tryOnStore.ts` + `useAddWizard.ts` toDataUri, giờ đi qua
`manipulateAsync` như `tryOnWearService` đã làm).

**Bảo mật (edge functions) — cả 3 xử lý xong 2026-07-03 (phiên engine):**
**Crash / hang (Critical–High) — đã fix 2026-07-03:**
**Crash / hang (Medium):**
**Crash / hang (Low, latent):**
## F. Audit toàn repo 2026-07-03 (đợt 2, 6-agent Fable) — fix đợt lớn 2026-07-03

Trùng với section E thì không lặp lại. `tsc --noEmit` sạch toàn repo (142/142 jest pass).
Toàn bộ finding dưới đây đã được xác nhận (top 5 verify kỹ + live DB trước khi fix) rồi
fix song song bằng 10 agent + 4 việc Critical tự làm (migration DB + edge fn bảo mật).
Còn lại CHƯA fix: wardrobe-critic perf 16×/request (rủi ro correctness, xem note trong mục
Perf) và fix triệt để RC TRANSFER (cần gọi RC REST API, quyết định phạm vi mới). CHƯA deploy
edge functions / chưa chạy eas build — chờ anh Khôi duyệt riêng.

**Security (Critical–High) — tất cả FIXED 2026-07-03 (áp dụng qua Supabase MCP `apply_migration`, deploy edge fn CHỜ anh Khôi duyệt riêng):**
**Webhook RevenueCat (Medium) — tất cả FIXED 2026-07-03:**
**Data-corruption (High):**
**Bug logic (High–Medium):**
**Perf:**
- [ ] **wardrobe-critic chạy full pipeline tới ~16× / request — ĐÃ ĐIỀU TRA 2026-07-03,
  CHƯA FIX (rủi ro correctness).** baseline + mỗi archetype thiếu (~16 archetype) đều gọi
  lại `generateFormulaPools`/`generateCandidates`/`generateHeroCandidates` full trên
  `[...filtered, hypoItem]` rồi `rankCandidates` (tới ~500 formula + ~144 hero candidate
  mỗi lần) — risk CPU ceiling 546 với wardrobe lớn. Định làm "tính candidate list đã
  enrich 1 lần rồi share giữa archetype", nhưng `generateCandidates`/
  `generateHeroCandidates` (`generate-outfits/engine/generation.ts`) dùng CHUNG một
  `mulberry32` RNG stream theo seed cố định; số lượng/thứ tự `rand()` được rút phụ thuộc
  vào chính bộ item đưa vào (số color-family phát hiện được ở `poolMonochrome`/
  `poolTonalGradient`, độ dài mảng đưa vào `shuffle()`, v.v.). Thêm 1 hypo item vào bộ
  item làm lệch toàn bộ chuỗi rand() cho MỌI candidate sau đó — kể cả candidate không
  chứa hypo item — nên không đảm bảo các candidate "không liên quan tới hypo item" giống
  hệt byte-for-byte giữa lần chạy baseline và lần chạy archetype. Share/cache điểm số cũ
  có rủi ro âm thầm đổi kết quả xếp hạng thật (variant/accessory nào được chọn), không chỉ
  đổi hiệu năng. DỪNG LẠI theo yêu cầu — cần redesign RNG stream (VD: sub-seed riêng theo
  archetype/branch) trước khi có thể share an toàn. Xem `plan.md` mục "Server bug fixes"
  2026-07-03 để có phân tích đầy đủ.
- [ ] **"Comfort" như một sub-score tường minh trong engine** (2026-07-06, ý tưởng từ
  research body-shape — comfort là tiêu chí mua hàng hàng đầu cùng fit): hiện engine đã có
  các proxy rời rạc (ease số đo garment−body + cảnh báo "may be tight", fit vs preferredFit,
  fabric weight/season). Có thể gộp thành điểm "comfort" hiển thị được cho user ở
  evaluate-item. Chờ duyệt phạm vi.
- [ ] **Silhouette scan v2 — device verification + calibration** (2026-07-06): (1) verify
  selfie-segmenter float16 load được qua react-native-fast-tflite trên iOS/Android thật;
  (2) chất lượng mask khi đứng 2-3m, nền không trơn; (3) tay ép sát thân → run eo dính tay
  (đã đổi copy sang A-pose, cân nhắc thêm pose-gate check tay); (4) calibrate `S` bands +
  `contourShoulderInset` vs số thước dây thật của anh Khôi (shoulder thật, waist thật).
## G. Profile wiring — Subscription/Notifications (2026-07-07)

- [ ] **Push notification DELIVERY infrastructure not implemented** (2026-07-07,
  wiring the Profile "Notifications" row): expo-notifications registration,
  permission request, scheduling, and server-side triggers. The new
  `app/notifications.tsx` screen currently only persists preferences locally
  (`appStore.notificationPrefs`) — toggling a switch there does not cause any
  notification to actually be sent.
- [ ] **Profile rows "Location & weather" and "Connected accounts" are still
  unwired (no route)** (2026-07-07, same session as Subscription/Notifications
  wiring in `app/(tabs)/profile.tsx` SECTIONS) — tapping them still does nothing.

## H. Silhouette-first resolution (2026-07-12)

- [ ] **Port formula system to data-driven executor (compose(spec,pool)+matches(spec,outfit),
  YAML-style constraint specs) — deferred half of Option 2**; current formulas are 10
  hardcoded pool functions in `supabase/functions/generate-outfits/engine/generation.ts`.
  Reason: large/risky refactor, not needed for silhouette-first work.
- [ ] **Thread `targetSilhouette` into `buildAroundFixed`'s brute-force enumeration itself**
  (2026-07-12, silhouette-first resolution session) — the pinned/hero candidate paths
  (`generatePinnedCandidates`/`generateHeroCandidates`) only got a lighter touch (id-pool
  measurement-priority ordering, hero-ranking boost) instead of the full
  `pairAffinity`-style confidence-blend that `generateFromPool` got. Left out to keep the
  change surface small; `buildAroundFixed` operates on id arrays only (not `FitItem`s),
  so wiring this in properly needs a small refactor to pass items through.
## I. Body-measurement precision overhaul — pending (2026-07-12)

Xem `plan.md` changelog "Body-measurement pipeline precision overhaul (2026-07-12)" +
"BlazePose Heavy + MODNet model upgrade (2026-07-12)" cho toàn bộ thay đổi (refinement
pass, sub-pixel mask edges, mask-extent/heel scale blend, tilt gate, model upgrade,
latency guard, v.v.). Verify chỉ chạy được `tsc --noEmit` + `jest` từ máy dev — CHƯA chạy
trên thiết bị/emulator thật (yêu cầu rõ trong cả hai task: "on-device validation is out
of scope"/"Do NOT run the app").

- [ ] **Calibrate K constants với fixtures thật (tape measurements) qua scripts/measure-eval
  — chưa có fixture nào.** `CALIBRATABLE_KEYS` giờ có thêm `maskExtentFudge`,
  `shoulderBlendContour`, `kpShoulderFactor` (14 field); bản thân `maskExtentWeight`,
  `heelWeight`, `heightEstimateDisagreementBand`, `noseCrownFraction` (không nằm trong
  danh sách calibratable — xem note trong `landmarksToMeasurements.ts`) đều là số ước
  lượng physically-motivated, chưa test với ảnh thật. Cần capture ≥3 subject thật qua
  `app/measurements-scan.tsx` (`__DEV__`, dòng log `[MEASURE_EVAL_JSON]`) + tape đo thật vào
  `groundTruth` — capture nên có cả feet visible trong khung hình để exercise nhánh heel
  mới (nếu feet bị crop, `hHeel`/heel-based inseam đơn giản không kích hoạt, không lỗi).
- [ ] **Device verify — BlazePose Heavy + MODNet asset/shape thật** (2026-07-12, model
  upgrade session): xác nhận qua log `__DEV__` (`[BLAZEPOSE] inputs=/outputs=`,
  `[MODNET] inputs=/outputs=`) trên thiết bị thật rằng: BlazePose Heavy input đúng
  `[1,256,256,3]` float32 [0,1] và output có đúng 1 tensor length 195 (landmarks) + 1
  tensor length 1 (poseflag); MODNet input đúng `[1,3,512,512]` NCHW float32 [-1,1] và
  output length 1 tensor `[1,1,512,512]`. Nếu shape thực tế khác spec (model card), code
  đã defensive (length-based lookup → null → fallback) nhưng sẽ ÂM THẦM không bao giờ kích
  hoạt refine/matte pass — log là chỗ đầu tiên phải xem nếu nghi ngờ pipeline không chạy.
- [ ] **Device verify — GPU delegate** (2026-07-12): `loadModelWithGpuFallback`
  (modelLoad.ts) thử `'android-gpu'`/`'metal'` trước khi fallback CPU cho cả BlazePose
  Heavy và MODNet — CHƯA verify trên thiết bị thật delegate GPU có load được không (nhiều
  model không support mọi GPU delegate), và nếu load được thì tốc độ cải thiện bao nhiêu
  so với CPU. Log `[BLAZEPOSE] loaded delegate=...` / `[MODNET] loaded delegate=...` (in
  `__DEV__`) cho biết delegate nào thực sự đang chạy.
- [ ] **Device verify — latency guard** (2026-07-12): đo thời gian thực tế 'processing'
  veil với latency guard mới (refine tối đa 3/4 buffered frame, xem
  `MAX_REFINE_FRAMES` trong `measurements-scan.tsx`) — có đủ nhanh không so với bản cũ
  (refine cả 4 frame), và nhánh fallback (<2 refine thành công → full-frame segmentation
  lại TOÀN BỘ buffer) có làm capture chậm hẳn trong trường hợp xấu (refine fail nhiều)
  không. Dev log `[MEASURE_SCAN]` giờ có thêm `refined=X/Y (cap Z)` để debug nhánh nào chạy.
- [ ] **BlazePose z (depth) chưa dùng** (2026-07-12, ghi trong doc comment
  blazePoseDecode.ts/poseEstimate.ts) — model trả về depth tương đối theo hip nhưng hiện
  tại bị bỏ qua hoàn toàn. Future work: có thể dùng để cải thiện ước lượng độ sâu vòng
  ngực/eo/hông thay vì ellipse-perimeter fudge ratios cố định (`chestDepthRatio` etc.) nếu
  z đủ ổn định qua nhiều frame — chưa nghiên cứu.
- [ ] **App-size check: BlazePose Heavy (27.7MB) + MODNet (26MB) = +53.7MB so với Lightning
  + selfie-segmenter riêng** (2026-07-12) — nếu app size là mối lo, cân nhắc bản quantized
  nhẹ hơn của một hoặc cả hai model (nếu tồn tại) — chưa khảo sát.
- [ ] **Device verify — phần còn lại của 2026-07-06/07-12 sessions** (giống pattern các
  session trước — xem section B): tilt threshold `TILT_THRESHOLD_RAD = 0.21` (~12°) có
  hợp lý không (false-positive khi cầm hơi nghiêng tự nhiên?); crop margins
  (`marginTop/Bottom/Side` trong `cropMath.ts`, tuned cho Thunder nhưng giữ nguyên cho
  BlazePose) có đủ không bị cắt đầu/chân/tay trên ảnh thật.
- [ ] **Device verify — side-view (profile) depth capture** (2026-07-12, session mới nhất,
  xem plan.md changelog "Side-view (profile) depth capture — replaces BMI-guessed depth"):
  chỉ verify được `tsc`/`jest` từ máy dev, CHƯA chạy app thật. Cần kiểm tra trên thiết bị:
  - **BlazePose độ tin cậy ở tư thế profile**: model được huấn luyện chủ yếu trên ảnh
    front-facing; chưa rõ `assessSidePose`'s profile check (x-span < 0.10×frameFill) có
    quá chặt/quá lỏng không, và BlazePose Heavy refine có thực sự sharpen được keypoint ở
    góc nghiêng hay không (có thể cần nới/tune `SIDE_PROFILE_SPAN_MAX`).
  - **Bán kính xoá tay (`eraseDisk`, 0.06 × person-unit height)**: chưa biết có che đúng
    hết bàn tay không (quá nhỏ → sót tay dính vào contour hông; quá to → ăn luôn vào hông
    thật) trên ảnh thật với các tư thế tay thả lỏng khác nhau.
  - **Thời lượng turn interstitial (`TURN_INTERSTITIAL_MS = 2500`)**: đủ thời gian để người
    dùng xoay 90° và ổn định tư thế trước khi side loop bắt đầu chấm điểm không.
  - **Row-fraction cross-view registration**: giả định "cùng fraction của shoulder→hip
    span thì cùng hàng giải phẫu dù 2 ảnh khác khoảng cách/crop" — CHƯA kiểm chứng với ảnh
    thật (có thể lệch nếu góc camera/perspective giữa 2 lần chụp khác nhau đáng kể — đây
    cũng là lý do `capturePitchRad` được ghi log làm groundwork, chưa dùng để correct).
  - **Latency 2 lượt scan**: front + side (mỗi bên có refine+segment riêng) tốn bao nhiêu
    thời gian thực tế ở màn 'processing' — "x/y" progress line có giúp bớt cảm giác treo
    máy không, cân nhắc giảm `SIDE_BUFFER_SIZE`/`SIDE_MAX_REFINE_FRAMES` nếu chậm.
  - **`sideDepthWidthRatioMin`/`Max` (0.45/1.35) và `superellipseN` (mặc định 2.0, chưa
    đổi)**: cần ≥3 fixture thật (side.depthsU + tape đo thật vòng ngực/eo/hông) qua
    `scripts/measure-eval` để biết band/exponent này có hợp lý không — hiện chưa có fixture
    v2 nào (chỉ có `example.json` v1).

## H. Settings & monetization follow-ups (2026-07-23)

- [ ] **RevenueCat / IAP go-live** — full step-by-step checklist written in `plan.md`
  ("RevenueCat / In-App Purchase go-live plan — PLAN ONLY, not implemented (2026-07-23)").
  Scaffolding (SDK, `usePremium`, paywall, `revenuecat-webhook` edge fn) already exists;
  blocked on external account setup (App Store Connect + Google Play + RevenueCat dashboard)
  which only anh Khôi can do, plus a public SDK API key. Code+deploy is ~half a day once
  keys/products exist. PLAN ONLY per anh Khôi (2026-07-23) — no code yet.
- [ ] **Notifications row hidden — needs real delivery before re-enabling.** The Profile
  "Notifications" row was commented out (2026-07-23) because `app/notifications.tsx` is
  prefs-only: the 4 switches persist to `appStore` but there is NO delivery infra (no
  `expo-notifications`, no push token, no scheduling). To bring it back, wire real local
  reminders (`expo-notifications`) and/or a push server, then uncomment the `SECTIONS` row.
- [ ] **Profile rows "Location & weather" and "Connected accounts" hidden** (2026-07-23) —
  commented out in `app/(tabs)/profile.tsx` because they had no destination screen. Build
  the screens (or wire existing flows) then re-enable. "Location & weather" overlaps with the
  deferred live-weather/GPS work in section C.
## H. App identifier rename follow-ups (2026-07-31)

Rename `com.briank.mien` -> `tech.kioh.mien` done this session (see plan.md changelog
"App identifier rename: com.briank.mien -> tech.kioh.mien (2026-07-31)"). App was never
published so no store-side migration needed, but three things are still open:

- [ ] **Put the new App Store Connect `ascAppId` back into `eas.json`** (2026-07-31) —
  `submit.production.ios.ascAppId` was deleted (the old value `"6782307581"` pointed at
  the ASC app record for the old bundle id `com.briank.mien`, wrong target now). Once a
  new ASC app record exists for `tech.kioh.mien` ("Mien Fashion"), add its numeric Apple ID
  back into that field. Until then, `eas submit -p ios` will just prompt interactively to
  pick/create the app instead of failing outright.
- [ ] **RevenueCat needs a new/updated app entry for `tech.kioh.mien`** (2026-07-31) — the
  existing RevenueCat dashboard app is bound to the old bundle id `com.briank.mien` on both
  iOS and Android. Need: a new (or repointed) RevenueCat app for `tech.kioh.mien` on both
  stores, new public SDK API keys wired into the client (`EXPO_PUBLIC_REVENUECAT_API_KEY` in
  `eas.json`/`.env`), and the in-app-purchase products re-created under the new App Store
  Connect app + new Play Console app (product IDs are per-app on both stores). Purchases will
  not work until this is redone — overlaps with the still-unimplemented RevenueCat go-live
  plan (section A / plan.md "RevenueCat / In-App Purchase go-live plan", 2026-07-23).
- [ ] **Uninstall the old `com.briank.mien` build from any emulator/device** (2026-07-31) —
  since `applicationId` changed, the new `tech.kioh.mien` APK installs side-by-side rather
  than upgrading in place. Any emulator/device that had the old build installed needs it
  manually uninstalled (`adb uninstall com.briank.mien`) to avoid confusion from having both
  apps present.

- [ ] **Supabase free-tier auto-pause.** (2026-08-02) Project `trtjcsxcowqecsebvyme` bi
  pause (INACTIVE) do khong co traffic — toan bo backend offline cho toi khi restore
  thu cong. Can quyet: nang plan Pro hoac dat cron ping giu project active truoc khi
  co user that.
  2026-08-21: paused lai, xac nhan that. Chan ca 1 DB query (Management API
  `/database/query`: "Connection terminated due to connection timeout" roi HTTP 544 x3) lan
  1 lan deploy 5 function (xem muc "2026-08-21 fixes implemented + tested, NOT deployed" o
  tren). Da thu `POST /v1/projects/{ref}/restore` (body rong) — FAIL, error body rong, status
  check sau do van INACTIVE. Ket luan: /restore qua Management API KHONG dung duoc — nguoi sau
  di thang vao dashboard bam "Restore project" thay vi ton thoi gian qua API.

## Body-shape engine — findings tu sim (2026-08-03)

Harness: `scripts/sim/body-shape-sim.ts` (`npm run body-shape-sim`, Deno, offline).

- [ ] **App Store screenshots upscale tu ban da bi nen** (2026-08-03) — 9 anh trong
  `submit-assets/` la screenshot iPhone 17 THAT (anh Khoi xac nhan; 942x2048 = ti le 0.4600,
  dung bang native iPhone 17 / 6.3" = 1206x2622), NHUNG da bi ha xuong 2048px chieu cao trung
  gian (nen khi gui qua chat / Google Photos). Da resize sang `submit-assets/appstore-1284x2778/`
  (1284x2778, size Apple chap nhan cho 6.5"/6.7") — upscale x1.36 tu ban nen nen chu hoi mem.
  Neu lay lai duoc ban goc 1206x2622 (AirDrop / export full-res tu Photos) thi resize lai chi
  upscale x1.06, net hon han. Luu y: 1206x2622 KHONG nam trong danh sach size Apple nhan, nen
  du co ban goc van phai resize sang 1284x2778 — huong xu ly khong doi.
- [ ] **Trung anh trong submit-assets** (2026-08-03) — `e7c22fc4-...(1).jpg` va
  `e7c22fc4-....jpg` identical (cung MD5); cap `00a71162-...(1).jpg` (1284x2791) va
  `00a71162-....jpg` (942x2048) cung 1 screenshot khac scale. Chon 1 ban khi upload.

- [ ] **Paywall — Privacy Policy chưa host + 2 field App Store Connect chưa điền** (mở
  2026-08-04, RETITLED 2026-08-11: tiêu đề gốc "gãy trong build submit vì thiếu
  `react-native-purchases`" đã SAI kể từ 2026-08-04 — `react-native-purchases@^10.6.0` +
  `react-native-purchases-ui@^10.6.0` đã cài (`package.json` + `node_modules`),
  `app/_layout.tsx` đã wire `Purchases.configure()` + `Purchases.logIn(userId)`, và
  `app/paywall.tsx` đã render động toàn bộ `availablePackages` kèm đủ disclosure Apple
  3.1.2 (tên plan, giá, chu kỳ, câu auto-renew/24h, 2 link Terms+Privacy — xem `plan.md`
  "Paywall: dynamic package list + Apple 3.1.2 disclosures"). Cái THẬT còn treo trước khi
  submit App Store: (1) `src/config/legal.ts`'s `PRIVACY_URL` vẫn là placeholder chưa host
  trang nào (chi tiết đầy đủ ở mục "PRIVACY_URL là PLACEHOLDER" cùng section J); (2) 2 field
  trong App Store Connect — License Agreement (dùng được bản chuẩn của Apple) và Privacy
  Policy URL — vẫn chưa điền, chỉ làm được trong dashboard ASC, không phải code. Thiếu 1
  trong 2 → Apple reject Guideline 3.1.2. Còn thiếu RevenueCat key thật (`appl_…`/`goog_…`,
  hiện chỉ có Test Store key `test_…` dùng để dev-client local) trước khi build submit thật.

## J. Kinh te don vi / chi phi bien — audit 2026-08-04 (truoc khi dinh gia subscription)

- [ ] **Deadline cung: `gemini-2.5-*` bi Google tat 16/10/2026** (2026-08-04) — PARTIALLY
  ADDRESSED 2026-08-11: toàn bộ 9 chỗ gọi Gemini giờ đọc `GEMINI_FLASH_MODEL` qua env override
  (xem mục ngay trên), nên đổi model thật sau này chỉ là 1 lần `supabase secrets set`, không
  cần deploy code. NHƯNG default hardcoded VẪN CỐ Ý giữ `gemini-2.5-flash` (anh Khôi quyết
  định cost-first — xem mục mới trong section AE bên dưới: `gemini-3.6-flash` đắt 5x input/3x
  output, hoặc `gemini-3.5-flash-lite` cost-neutral nhưng vision yếu hơn). Deadline 16/10/2026
  VẪN CÒN TREO, chưa migrate thật. **Phát hiện thêm ngoài phạm vi mục này, ĐÃ FIX thật**:
  `gemini-3-pro-image-preview` (image-gen tier) hoá ra ĐÃ bị tắt từ 2026-06-25 (đã qua), không
  phải deadline tương lai — production đã gọi model đã retired suốt từ đó tới hôm nay. Đổi
  sang `gemini-3-pro-image` (GA), giá không đổi (~$0.134/ảnh).
- [ ] **Don bay giam gia von lon nhat: doi model image-gen** (2026-08-04) — **VẪN CHƯA LÀM**,
  đừng nhầm với fix 2026-08-11 ở trên (2 việc khác nhau): fix hôm đó chỉ SỬA model đã bị
  Google retired (`gemini-3-pro-image-preview` → `gemini-3-pro-image`, GIÁ KHÔNG ĐỔI, cùng
  ~$0.134/ảnh) — KHÔNG phải đòn bẩy giảm giá vốn này (đổi sang Flash Image/Imagen rẻ hơn
  ~50-85%). Vẫn cần A/B chất lượng ảnh trước khi đổi. `GEMINI_IMAGE_MODEL` env override
  (mới, 2026-08-11) giờ làm việc thử-rồi-rollback này rẻ hơn nhiều — chỉ cần đổi secret,
  không cần deploy.
- [ ] **`src/config/legal.ts` `PRIVACY_URL` la PLACEHOLDER, chua phai link that** (2026-08-05,
  phat sinh khi lam disclosure Apple 3.1.2 cho paywall). Gia tri hien tai la
  `https://mien.app/privacy` — domain chua host trang nao. Phai thay bang link that, cong khai
  truy cap duoc, truoc khi submit App Store: Apple reject app neu Privacy Policy URL gay loi
  hoac khong ton tai, va app nay thu thap ca body measurements lan anh (face selfie cho personal
  color, anh tu do/try-on) nen reviewer se doc ky trang nay. Can lam ca 2 viec: (1) host mot
  trang privacy policy that mo ta dung du lieu dang thu thap, (2) dien URL do vao ca
  `src/config/legal.ts` lan truong "Privacy Policy URL" trong App Store Connect.

- [ ] **Plan switching moi wire cho iOS, chua xu ly Android** (2026-08-05, phat sinh tu viec
  fix hai item tren). Luong upgrade/downgrade goi trong `handlePurchase` -> `purchase(pkg)`
  -> `Purchases.purchasePackage(pkg)` khong truyen them tham so gi, dua vao viec Apple tu
  prorate cho hai goi CUNG mot subscription group (dung tren iOS). Google Play KHONG lam vay
  tu dong — doi/nang cap goi tren Android can truyen ro `oldProductId` +
  `googleProductChangeInfo`/proration mode (`purchasePackage` co tham so rieng cho viec nay
  tren RevenueCat SDK). Truoc khi ra ban Android, phai quay lai `handlePurchase` trong
  `app/paywall.tsx` va them nhanh xu ly rieng cho `Platform.OS === 'android'` khi
  `planRelation` la 'upgrade'/'downgrade'/'switch', neu khong upgrade/downgrade tren Android
  se fail hoac tao subscription thu hai thay vi thay the.

- [ ] **Edge case da biet (chap nhan duoc, KHONG phai bug): premium qua `account_type` nhung
  khong co RevenueCat entitlement -> nut hien "CHUYEN SANG ..." thay vi "GOI HIEN TAI"**
  (2026-08-05, ghi lai khi review ban plan-switching de session sau khong tuong la loi).
  `planRelation` trong `app/paywall.tsx` tra `'switch'` khi `currentPkg` la null. `currentPkg`
  duoc suy ra tu `activeProductId` = `entitlements.active['premium'].productIdentifier`, nen
  no null khi user la premium theo DB (`account_type` = premium/admin, VD set tay qua
  service_role, hoac tai khoan admin) chu khong phai qua giao dich RevenueCat.
  Hau qua: nut bam duoc, nhung KHONG mat tien oan — Apple chan mua trung cung product va bao
  "already subscribed". Rui ro thap, tan suat thap. Neu muon sach hon thi khi `isPremium &&
  !currentPkg` co the disable nut kem nhan trung tinh.

- [ ] **Quyet dinh: giu paywall tu code hay chuyen sang RevenueCat Paywall Builder?**
  (2026-08-04, phat sinh khi anh Khoi hoi ve o "Custom URL Scheme" tren RC dashboard).
  `react-native-purchases-ui@^10.6.0` DA cai nhung CHUA duoc import o bat ky dau
  (grep `src/` + `app/`: 0 hit) — app dang dung `app/paywall.tsx` tu code theo design
  luxury-minimalism rieng. Hai duong: (a) giu paywall tu code -> co the go
  `react-native-purchases-ui` cho nhe bundle, va o "Custom URL Scheme" tren dashboard
  khong can dien (no chi phuc vu Paywall Preview cua Paywall Builder); (b) chuyen sang
  Paywall Builder -> doi duoc paywall tu dashboard khong can update app, nhung bi gioi han
  trong template cua RevenueCat nen kho khop design system MIEN. Scheme cua app da co san
  la `mien` (`app.json:11`) neu chon (b). Chua chot — can anh Khoi quyet.

- [ ] **`_layout.tsx` chi doc MOT bien RevenueCat key -> chi chay duoc 1 platform** (2026-08-04,
  phat hien khi huong dan dan key). `app/_layout.tsx:81` doc duy nhat
  `process.env['EXPO_PUBLIC_REVENUECAT_API_KEY']`, nhung RevenueCat cap key RIENG cho tung store
  (`appl_…` cho iOS, `goog_…` cho Android) — khong dung chung duoc. iOS-first thi khong sao,
  nhung khi len Google Play phai sua thanh chon key theo `Platform.OS` (VD 2 bien
  `..._IOS` / `..._ANDROID`, hoac giu 1 bien cho iOS va them bien thu 2). Neu quen, ban Android
  se configure bang key iOS -> SDK loi hoac khong tra ve offering nao.
  **XAC NHAN BANG RUNTIME 2026-08-10** (logcat, bản debug trên emulator Android):
  `[RevenueCat] The specified API Key is not recognized. Ensure that you are using the public
  app-specific API key, which should look like 'goog_1a2b3c4d5e6f7h'...` — đúng như dự đoán,
  `eas.json:14,29,41` đang đặt `appl_llObneTbxssMfXnooijYjkTNzKD` cho CẢ 3 profile, nên bản
  Android configure bằng key iOS. Đây là lỗi THẬT của bản Android production, không phải hạn
  chế emulator (lỗi `BILLING_UNAVAILABLE` đi kèm mới là do emulator không có Play Billing).
  → Phải sửa trước khi phát hành Play: tách key theo `Platform.OS` ở `app/_layout.tsx:81`.
- [ ] **Chu bi cat ky tu cuoi do letterSpacing (Android)** (2026-08-04) — token `type.ui` /
  `type.micro` co `letterSpacing` 1.5/1.8; Android lam tron chieu rong text xuong nen glyph cuoi
  bi clip ("BEGIN" -> "BEGI"). Da vá `PrimaryButton`, `SecondaryButton`, `TextLink` bang
  `paddingHorizontal: 2`. Cac cho khac dung cung token van chua vá: `Tag.tsx`, `Segmented.tsx`,
  `Field.tsx` (label + TextInput), `Photo.tsx`, `OfflineBanner.tsx`, va cac style inline
  `...type.ui` trong app/*. Can ra soat tren may Android that roi vá dong loat (hoac them padding
  ngay trong token, tru cho TextInput).

## K. Review 3 engine (suggest / rating / try-on) — 2026-08-06 (đề xuất, chưa duyệt)

Phát hiện từ đợt review Fable + 3 Explore agent. Các mục dưới đây CHƯA có trong backlog
trước đó (những mục đã có — rate-limit tryon, model hardcode, gemini-2.5-flash kill date
16/10/2026, hiển thị credit, device-test face composite, wardrobe-critic RNG — giữ nguyên
ở các section cũ).

### Bug thật / code chết (sửa rẻ, ăn ngay)
- [ ] **`neighbors` hand-sync giữa `filtering.ts` và migration `public.styles` là rủi ro
  còn treo** — `STYLE_CONFIGS[].neighbors` trong engine là nguồn tác giả thật, nhưng
  `public.styles.neighbors` (thứ client thật sự đọc) là bản copy tay qua migration, đã
  từng lệch một lần (`bohemian → y2k` chỉ một chiều, xem mục ~1771). Thêm style mới hoặc
  sửa trọng số neighbor ở `filtering.ts` mà quên đồng bộ migration sẽ không có lỗi biên
  dịch/test nào báo — nên cân nhắc generate migration từ mảng này thay vì copy tay.
  (2026-08-11, phát hiện trong lúc audit dead code ở trên)
### Chất lượng chấm điểm
- [ ] **Verdict và feed dùng 2 định nghĩa "đẹp" khác nhau** — verdict không có proportion/
  formality/anchor/taste; item 88 "Great pick" vẫn có thể "A bit of a stretch" với tủ đồ,
  2 con số hiện cạnh nhau không hoà giải. (2026-08-06)
- [ ] **`confidence` từ extraction bị bỏ** — không scale trọng số; đoán 0.3 nặng ngang
  0.95. (2026-08-06; scoring, chưa đụng tới — ngoài phạm vi phiên ingest-threading
  2026-08-11 bên dưới, ĐỪNG lẫn với mục đó.)
- [ ] **Giày/phụ kiện không bao giờ được chấm measurement** (0.25 weight rơi) — (2026-08-06;
  scoring, ngoài phạm vi, chưa đụng tới).
  - [ ] **Phát hiện mới (KHÔNG sửa, khác feature):** `map-measurements` (feature 009,
    "paste shop sizes") có `TARGET_KEYS`/`relevantKeys('bottom')` riêng
    (`supabase/functions/map-measurements/prompt.ts:11-15,44-55`) THIẾU
    `m_skirt_length` hẳn — Gemini map từ text shop nhưng `sanitizeMapResult` lọc theo
    `keys` nên skirt length luôn bị vứt dù model có đoán ra. `m_shoe_size` ở feature
    này thì ĐÃ đủ. Cần thêm `m_skirt_length` vào `TARGET_KEYS` + `relevantKeys('bottom')`
    + 1 dòng keyDef/synonym/SANE_BAND trong `prompt.ts` — là quyết định thiết kế nhỏ
    (chọn band cm hợp lý, câu synonym VN/EN) nên để anh Khôi duyệt trước khi làm.
    (2026-08-11)

### Vòng lặp dữ liệu (ROI cao nhất, quyết định thay cho câu hỏi "cần LLM?")
- [ ] **Occasion/mood wired server-side nhưng client không bao giờ gửi** — intent duy nhất
  client gửi là seasonOverride từ 4-band nhiệt độ; `times_worn`/`worn_cooldown_ids` cũng
  không ai gửi → không có rotation/novelty. (2026-08-06)
- [ ] **Try-on là ngõ cụt dữ liệu — MỘT PHẦN đã fix 2026-08-11.** ĐÃ LÀM: Flow B
  ("Wear on you", `app/try-on/wear.tsx`) giờ ghi interaction `tried_on` sau khi generate
  thành công (`logTriedOn`, `outfitInteractionService.ts`), taste vector server-side đã đọc
  type này với trọng số `TRIED_ON_WEIGHT=1.5` (giữa saved và worn — xem `engine/taste.ts`,
  CALIBRATION-PENDING). Flow A ("Scan") vẫn KHÔNG ghi (đúng, vì item chưa có
  `clothing_items.id` thật — xem `plan.md` changelog cùng ngày). File leak của render
  (documentDirectory/cacheDirectory) cũng đã fix (`useWearOnYou.ts`: xoá khi regenerate,
  pickAnother, và rời màn hình). CÒN THIẾU (chưa nằm trong phạm vi lần này, vẫn là quyết
  định sản phẩm mở): chưa có nơi PERSIST cái render đã tạo (chưa upload Supabase Storage,
  chưa có bề mặt "Saved" nào cho nó) — người dùng vẫn không "save được look" theo nghĩa xem
  lại sau; nó chỉ tồn tại trong phiên xem hiện tại rồi bị xoá. Cần quyết định trước khi làm:
  có đáng lưu render AI (chi phí storage + rủi ro privacy ảnh người dùng) hay không.
  (2026-08-06, cập nhật 2026-08-11)

## L. Gemini prepay credits CẠN — phát hiện 2026-08-07 khi debug try-on
- [ ] **NGUYÊN NHÂN try-on "Không kiểm tra được ảnh": Google API key hết prepay credits**
  (2026-08-07). Log function: Gemini 429 RESOURCE_EXHAUSTED "Your prepayment credits are
  depleted" → tryon-validate trả 502 → client hiện copy "kiểm tra kết nối" (gây hiểu nhầm).
  CHỈ anh Khôi nạp được: https://ai.studio/projects. Ảnh hưởng MỌI tính năng Gemini:
  tryon-validate/generate, generate-item-image (scan), evaluate-item note, curator
  (curator fail-open nên feed vẫn chạy, chỉ mất curated).
## M. Try-on full-body hard gate — theo dõi sau khi deploy (2026-08-08)
- [ ] **`full_body_visible` gate ở tryon-validate có thể reject nhầm ảnh thật của user** —
  Vietnamese trong nhà thường chụp thiếu chân/bị gương/kệ che phần dưới; nếu tỉ lệ reject
  cao gây khó chịu, cân nhắc nút "Dùng ảnh này luôn" (bỏ qua gate, chấp nhận rủi ro
  proportion/crop không hoàn hảo) thay vì chặn cứng 100%. Cần xem log/feedback thật sau khi
  deploy rồi mới quyết — chưa deploy đợt này. (2026-08-08)
- [ ] **`identity_ok`/`body_ok` verify field mới có thể gây hoàn credit oan (false refund)** —
  2 field này chưa có dữ liệu thực tế nào để biết gemini-2.5-flash so sánh 2 ảnh (gốc vs
  edit) có hay bị false-negative không (vd: ánh sáng/crop khác nhẹ do nén ảnh cũng có thể bị
  chấm `body_ok:false` dù thực ra đúng). Hậu quả nếu sai chỉ là hoàn nhầm credit (rẻ, không
  hại user) nhưng vẫn nên theo dõi tỉ lệ `quality_warning` sau khi deploy, so với baseline
  trước khi thêm 2 field này. (2026-08-08)

## N. APK size & emulator storage (2026-08-09)
- [ ] **Emulator `Medium_Phone` sắp hết đĩa** — data partition chỉ 6G, system image
  google_apis_playstore_ps16k đã ăn 4.9G, còn ~700M. Install APK debug 174M (4 ABI) fail
  `INSTALL_FAILED_INSUFFICIENT_STORAGE`. Workaround đang dùng: build 1 ABI
  (`./gradlew assembleDebug -PreactNativeArchitectures=x86_64` → 102.5M, cài OK).
  Fix dứt điểm: sửa `disk.dataPartition.size` lên 16G trong
  `~/.android/avd/Medium_Phone.avd/config.ini` — CHƯA làm vì có rủi ro phải wipe data
  (mất state login/wardrobe trên máy ảo). (2026-08-09)
- [ ] **`expo run:android` build đủ 4 ABI → APK 170M → `INSTALL_FAILED_INSUFFICIENT_STORAGE`**
  CHƯA có cách tự động. Đã THỬ VÀ THẤT BẠI 2026-08-10: đặt `ndk { abiFilters }` trong
  buildType `debug` của `android/app/build.gradle` → APK **phình lên 265 MB và vẫn đủ 4
  ABI**; `abiFilters.clear()` không lọc được mà còn phá khâu strip symbol (libs vào APK ở
  dạng chưa strip). Đã revert.
  Cách DUY NHẤT đang chắc chắn chạy: `./gradlew assembleDebug -PreactNativeArchitectures=x86_64`
  (→ ~102 MB), nhưng `expo run:android` không truyền được property này.
  Các hướng chưa thử: (a) đặt `reactNativeArchitectures=x86_64` trong
  `~/.gradle/gradle.properties` — user-level đè project-level, EAS không bị ảnh hưởng,
  NHƯNG nguy hiểm vì anh Khôi build AAB release cục bộ → có thể vô tình ship AAB thiếu
  arm64 lên Play; (b) tăng data partition emulator để 170 MB vừa thoải mái. (2026-08-10)
- [ ] **ML Kit `barcode-scanning` (~6M, kéo transitive qua `expo-camera`) exclude được —
  OCR thì KHÔNG** (2026-08-09, câu hỏi mở đã RESOLVED 2026-08-11: đã verify call-site, đừng
  điều tra lại). `text-recognition:16.0.1` (OCR, ~11M, khai ở
  `modules/expo-item-extract/android/build.gradle:75`) THẬT SỰ được gọi qua
  `ExpoItemExtractModule` — không thể bỏ. `barcode-scanning:17.3.0` (~6M, kéo transitive từ
  `node_modules/expo-camera/android/build.gradle:31`) có ZERO call site trong toàn app —
  MIEN không quét mã vạch ở đâu cả, việc còn lại chỉ là exclude nó khỏi build (Gradle
  exclude transitive dependency trên `expo-camera`, hoặc packaging/proguard exclude tương
  đương) để lấy lại ~6M mà không đụng OCR. `libmlkitcommonpipeline` (11.6M) là runtime
  dùng chung cho mọi ML Kit feature — không tách được nếu còn giữ OCR, đừng nhắm vào nó.

## O. Production readiness — phát hiện khi review build (2026-08-09)
- [ ] **BẮT BUỘC QA bản release trên máy thật trước khi upload store** — R8 build PASS
  không chứng minh app chạy đúng; lỗi minify lộ ở runtime (`ClassNotFoundException`,
  deserialize sai field name). Phải đi hết: đăng nhập → wardrobe add/extract (ML Kit
  segmentation + OCR) → generate outfit → try-on → **paywall/restore purchase**
  (RevenueCat là chỗ rủi ro nhất vì deserialize theo tên field). Nếu gãy, cách lùi nhanh:
  đặt `android.enableMinifyInReleaseBuilds=false`. (2026-08-09)
  LƯU Ý: **không QA được RevenueCat trên emulator** — xác nhận 2026-08-09 qua logcat:
  `PurchasesError(code=PurchaseNotAllowedError, ... BILLING_UNAVAILABLE ... Billing service
  unavailable on device)`. Phải test paywall trên máy thật có Play Store + tài khoản
  license tester. Đây cũng đúng là nhánh code R8 dễ gãy nhất → không thể bỏ qua bước này.
- [ ] **AAB release: 54.8 MB / ~94 MB là model TFLite nhúng cứng** — ĐO THẬT 2026-08-09 từ
  `app-release.aab` (108.35 MB, trừ 13.61 MB BUNDLE-METADATA không giao cho user →
  **~94 MB tải về cho máy arm64**). Cơ cấu: `res/raw` **54.8 MB**
  (blazepose-heavy 24.97 + modnet 22.88 + movenet-lightning 2.2 + selfie-segmenter/
  face-detector), `lib/arm64-v8a` 16.02, `drawable-mdpi` 9.43, `dex` 8.15, `assets` 4.66.
  → **Model chiếm hơn nửa app, không phải ML Kit/RN như phán đoán ban đầu.**
  Hướng giảm (chưa làm, cần anh Khôi quyết): (a) tải model theo yêu cầu lần đầu dùng thay
  vì nhúng — KHÔNG vi phạm ràng buộc "body data on-device only" vì đó là tải model xuống,
  không phải gửi ảnh đi; (b) đổi BlazePose Heavy → Full/Lite; (c) quantize fp16→int8.
  Bị `require()` tĩnh ở `poseEstimate.ts:129,154`, `silhouette.ts:70,91`,
  `faceDetect.ts:48` nên Metro luôn nhúng. (2026-08-09)
- [ ] **Demo wardrobe images — AAB chưa đo lại sau đợt nén 2026-08-11** (`drawable-mdpi`,
  97 file, `src/data/index.ts:51+` `require()` tĩnh toàn bộ `assets/items/*.png`; đây là
  code production, KHÔNG bị `.easignore` loại). RETITLED 2026-08-11: con số "9.43 MB" của
  audit gốc (2026-08-09) đã STALE — 43/97 file đã được tái nén cùng ngày (palette PNG
  quantization + max deflate, giữ nguyên alpha, downscale cạnh dài >1600px xuống
  ~1200×1600): 18.40 MB → 8.25 MB trên đĩa (**-55.2%**), verify alpha/aspect ratio giữ
  nguyên + kiểm tra mắt 3 file nén nhiều nhất không banding/viền cứng (chi tiết: `plan.md`
  changelog 2026-08-11). Ước tính `drawable-mdpi` trong AAB co theo tỷ lệ tương tự (còn
  khoảng ~4-5 MB) nhưng **CHƯA build release để đo số chính xác** — việc còn lại của mục
  này chỉ còn là bước đo, không phải bước nén.
  **Tiền đề "chỉ là rác chờ xoá" cũng bị đảo ngược** (ghi nhận cùng đợt 2026-08-11): data
  demo này có tải trọng sản phẩm thật — `app/(tabs)/index.tsx:160` set `isDemo =
  wardrobeItems.length === 0`, nghĩa là MỌI user thật mới (tủ đồ rỗng) đang xem chính feed
  demo này (bản chất T022 "demo feed cho user mới"), và `OUTFITS` cũng là fallback khi
  generation chưa ra kết quả. Xoá thẳng bộ demo = xoá luôn empty-state cho user mới — quyết
  định sản phẩm cần anh Khôi chốt, không phải dọn dẹp kỹ thuật đơn thuần. Đòn bẩy an toàn
  còn lại: chỉ `OUTFITS.slice(0, 2)` thực sự được dùng cho demo feed rỗng — cắt riêng phần
  item mà 2 outfit đó tham chiếu (không phải toàn bộ 43 file) là hướng giảm tiếp không đụng
  sản phẩm.
- [ ] **`com.amazon.device:amazon-appstore-sdk:3.0.5` bị kéo vào build** — phát hiện qua
  R8 warning khi build release. Nhiều khả năng do RevenueCat kéo transitive (hỗ trợ Amazon
  Appstore). MIEN chỉ phát hành Play + App Store → nhiều khả năng loại được để giảm dex.
  Chưa đụng vì chưa verify RevenueCat có gọi tới nó vô điều kiện lúc init không. (2026-08-09)
- [ ] **OTP demo cũ (`000000`) vẫn lộ trong git history — repo đã PUBLIC** (2026-09-19).
  Password demo đã rotate 2026-09-19 (`demo@mien.app`, `demo-woman@mien.app`, secret
  `DEMO_PASSWORD` mới; password cũ verify bị từ chối). OTP trong `DEMO_WHITELIST` CHƯA đổi vì
  đổi thì phải cập nhật App Review Notes trên ASC. Đường OTP chỉ qua fn `auth` có rate-limit
  theo email. Vẫn cần verify RLS: tài khoản demo không đọc/ghi được dữ liệu user khác.
- [ ] **Style catalog (22 style, 2026-08-10): toàn bộ `image_url` là null, kể cả 14 style
  mới** — DB `public.styles.image_url` null cho cả 22 row (đúng như 8 style cũ trước đây).
  8 style cũ còn có ảnh Unsplash qua fallback tĩnh `src/data/index.ts` `STYLES[].img`; 14
  style mới KHÔNG có ảnh thật nào (client dùng `img: ''` → `Photo` render tile màu +
  label, không phải ảnh thật). Cần ảnh đại diện thật cho `feminine`, `officechic`,
  `parisian`, `coquette`, `cleangirl`, `darkacademia`, `cottagecore`, `grunge`, `athflow`,
  `elegant`, `kfashion`, `vintage`, `resort`, `artsy` — cả ở DB (`image_url`) lẫn client
  fallback. (2026-08-10)
- [ ] **Tên/mô tả style KHÔNG có đường dịch tiếng Việt** — xác nhận trước khi làm gì
  (2026-08-10): style name/description luôn đến từ `public.styles` (tiếng Anh) hoặc
  fallback tĩnh `src/data/index.ts` `STYLES` (cũng tiếng Anh); `src/i18n/locales/
  {en,vi}.json` không có key nào cho tên style — kể cả 8 style cũ. Giữ nguyên cơ chế này
  cho 14 style mới (không tự chế hệ dịch mới), nhưng đây là gap có thật nếu app cần hiển
  thị tên style bằng tiếng Việt.
- [ ] **`modest` — style bị DỪNG, chưa ship, thiếu attribute "độ phủ da"** — yêu cầu đợt 2
  có `modest`, nhưng ràng buộc định danh của style này (tay/chân dài, cổ kín) không có trục
  nào trong `StyleConfig`/`FitItem` diễn tả được. `filterByStyle` chỉ kiểm 5-6 trục hiện có:
  màu, fabric, fit, formality, banned features (type) — không trục nào liên quan tới độ dài
  tay áo/gấu quần/cổ áo. `GarmentMeasurements` có số đo (`sleeves`, `body_length`...) nhưng
  không có ngưỡng tối thiểu nào gắn với style, và không có field categorial nào cho "độ phủ
  da". Cần anh Khôi quyết: thêm attribute coverage mới vào `FitItem`/`StyleConfig` (thiết kế
  mới, có ripple sang enrichment/ingestion), hoặc chấp nhận xấp xỉ có mất mát qua silhouette
  — không tự chế bằng cách cấm `bodycon` (vừa thừa vừa thiếu: cấm nhiều đồ bodycon vẫn kín,
  lọt nhiều đồ relaxed nhưng hở). Chưa thêm vào `STYLE_CONFIGS` hay `public.styles`. Xác
  nhận lại 2026-08-11 (lúc duyệt unlock `mobwife`): lý do stop vẫn giống hệt, chưa authorize
  làm. (2026-08-10)
## AC. Style filtering tightening — `BannedFeature` + `typesBanned` (2026-08-10)

Phát hiện khi siết `filterByStyle` theo 2 trục mới (xem `plan.md` "Style filtering:
`BannedFeature` vocabulary + `typesBanned`" cùng ngày). Giữ nguyên toàn bộ diff đã ship —
các mục dưới đây là những gì CHƯA làm, cố ý dừng để báo cáo thay vì tự mở rộng.

- [ ] **`sheer`/`cutout`/`sequin`/`animal_print` — CHƯA thêm vào `BannedFeature`** — đúng
  theo nguyên tắc "chỉ thêm feature có tín hiệu suy được": rà `FitItem` (colorProfile,
  graphics, fabric.pattern) không có field nào carry được 4 tín hiệu này. Cần sửa pipeline
  extraction (ingest-time AI/manual) trước — thêm attribute mới vào `ClothingItemRow`/
  `FitItem`, có ripple sang `generate-item-image`/`backfill-item-metadata`. Việc riêng,
  ngoài scope task này. **CẬP NHẬT 2026-08-11**: giờ đã có tiền lệ đầy đủ để copy —
  `distressed` (mục ngay trên) đi đúng con đường này (cột DB nullable + field trên
  `FitItem`/`FabricProfile` + enforcement fail-open trong `featuresPasses` + backfill sau) và
  đã chứng minh chạy được end-to-end. Làm 4 feature này chỉ là lặp lại đúng pattern đó 4 lần,
  không cần thiết kế lại từ đầu.
- [ ] **`abstract_print` được implement (vào `BannedFeature` + `featuresPasses`) nhưng
  KHÔNG gán cho style nào** — bucket `abstract` gộp chung `print`/`abstract`/`camo`/
  `polka dot` (`enrichment.ts` `STORED_PATTERN_MAP`) quá dị biệt để có case "chắc chắn":
  một style có thể muốn cấm camo nhưng giữ polka dot (VD pinup) — cấm cả bucket sẽ sai một
  nửa. Sẵn sàng dùng khi có style cụ thể cần, nhưng không tự gán để tránh siết nhầm.

## AD. Womenswear demo data — fetch-item session (2026-08-11)

Thêm 10 món nữ + 2 outfit demo (`o7`/`o8`) vào `src/data/index.ts`. Xem `plan.md`
"Womenswear demo data — 10 items + 2 outfits" cùng ngày để biết chi tiết nguồn/sourcing.
Các mục dưới đây là việc chưa làm/chưa hoàn hảo, cố ý dừng để báo cáo.

- [ ] **`skirt-pleated-beige` không thực sự là màu be** — không tìm được colorway be/camel
  thật trong 3 SKU chân váy pleated đã thử trên Uniqlo VN/US (E470922, E479916, E467640) —
  chỉ có xám/đen/olive/pastel. Dùng tạm màu "Stone" (xám ấm nhạt, tone 1) từ E470922 màu
  51 — đủ gần để hợp category nhưng KHÔNG phải be thật. Nếu cần be chuẩn, thử thêm nguồn
  khác (Zara/Mango/ASOS) hoặc đổi tên hiển thị màu.
- [ ] **`camisole-blush` không phải lụa** — brief gốc xin "áo hai dây lụa" (`camisole-silk`)
  nhưng Uniqlo AIRism Bra Camisole (E465707) là polyester/cupro/spandex, không phải lụa.
  Đổi slug thành `camisole-blush`, material ghi `Polyester` thay vì bịa `Silk`. Nếu cần một
  món cami lụa thật, phải tìm ở brand khác (Everlane/COS thường có silk cami nhưng hầu hết
  ảnh sản phẩm của họ là người mẫu, không có ảnh flat/ghost sạch — chưa tìm được nguồn đạt).
- [ ] **`price`/`size`/`measurements` bỏ trống cho cả 10 món nữ** — Uniqlo và Charles &
  Keith render giá/size qua client-side JS, không có trong static HTML fetch được qua
  `curl`. Nếu cần điền, phải dùng trình duyệt thật (Chrome tool) để đọc DOM sau khi JS
  chạy, hoặc tìm API endpoint JSON của từng site.
- [ ] **Kiến trúc lọc còn thiếu 2 kiểu ràng buộc** — nhận ra khi thiết kế `typesBanned`
  (chỉ thêm được "cấm loại đồ X"), nhưng `filterByStyle` chưa có cơ chế cho:
  (a) **"bắt buộc phải có"** — VD style X yêu cầu ít nhất 1 món trong nhóm Y mới coi là
  outfit hợp lệ (khác cơ chế `hasOutfitCoverage`/an toàn hiện tại, vốn chỉ đảm bảo top+
  bottom+shoes tồn tại, không đảm bảo ĐÚNG style-defining piece nào có mặt — VD "Business
  Formal" nên bắt buộc có BLAZER/TROUSERS chứ không chỉ bất kỳ top/bottom nào pass filter);
  (b) **"cấm theo tổ hợp"** — VD "không được mặc SNEAKERS cùng SUIT" là ràng buộc giữa 2
  món trong cùng outfit, không phải ràng buộc trên 1 món đơn lẻ như 6 trục hiện tại
  (`palette`/`fabricsAllowed`/`fabricsBanned`/`allowedFits`/`formalityRange`/
  `bannedFeatures`/`typesBanned`) đều đang làm việc theo item, không theo cặp/outfit. Cả
  hai là thiết kế mới (ripple sang `generation.ts`/`filtering.ts`), cần anh Khôi quyết
  trước khi làm — không tự chế trong task này.
- [ ] **2 bảng fabric-keyed chưa điền cho `fur`** (2026-08-11, cân nhắc khi unlock
  `mobwife`): `enrichment.ts`'s `MATERIAL_STYLE_BOOSTS` (map material → style id) và
  `scoring.ts`'s `NATURAL_FABRICS` ("đọc sang/đắt tiền" bonus set). Cố ý bỏ qua:
  `MATERIAL_STYLE_BOOSTS` là bảng cũ chưa từng được điền cho bất kỳ style nào trong 23
  style mở rộng gần đây (chỉ có 8 style gốc) — điền riêng cho fur/mobwife sẽ lệch pha
  với tiền lệ. `NATURAL_FABRICS` thì mơ hồ hơn: lông thật đọc sang, lông giả thì không,
  và `FitItem` không phân biệt được hai loại (đúng lý do 'fur' gộp chung real+faux) —
  thêm vào có thể thưởng sai cho lông giả. Cần anh Khôi quyết trước khi làm.
## AE. Backlog-clearing session — new follow-ups (2026-08-11)

Việc mới phát sinh/còn treo từ đợt dọn backlog lớn hôm nay (nhiều agent song song). Các mục
đã RESOLVE được đánh dấu `[x]` ngay tại vị trí gốc của chúng ở các section phía trên — đây là
những gì đợt này phát hiện thêm mà CHƯA làm.

- [ ] **Onboarding resume chỉ best-effort — nút Skip không để lại dấu vết** (2026-08-11) —
  `src/features/onboarding/resumeRoute.ts` (mới) tự ghi rõ trong comment: KHÔNG có cột/bảng
  `onboarding_step` checkpoint thật, resume signal tái dùng dữ liệu mỗi bước đã lưu khi bấm
  Continue. Một bước bị bấm "Skip" (VD measurements' skip button) không ghi sentinel phân biệt
  "đã ghé qua và bỏ qua" với "chưa bao giờ ghé qua" — nên resume sẽ đưa user quay lại đúng bước
  đó dù họ đã cố ý skip trước đây (tệ nhất chỉ là bấm Skip lại 1 lần, không mất dữ liệu). Muốn
  chính xác tuyệt đối cần thêm checkpoint thật (cột/bảng mới) — chưa authorize, chỉ ghi nhận.
- [ ] **`sheer`/`cutout`/`sequin`/`animal_print` giờ có tiền lệ đầy đủ để làm theo** — xem mục
  đã cập nhật ở section AC phía trên: `distressed` hôm nay đã đi trọn vẹn con đường "cột DB
  nullable + field trên `FitItem` + enforcement fail-open + backfill sau" — 4 feature này chỉ
  cần lặp lại đúng pattern đó, không cần thiết kế mới. Vẫn cần anh Khôi duyệt trước khi làm
  (đổi vocabulary + ripple sang ingestion, giống mọi lần trước).
- [ ] **Theo dõi xáo trộn thứ hạng feed sau khi deploy `ranking.ts`'s re-sort** (2026-08-11) —
  đo bằng eval harness (before/after engine copy diff): outfit SET không đổi, nhưng với
  `streetwear` fixture, 23/24 outfit chung đổi vị trí và top-10 hiển thị turn-over 40% (4
  outfit vào/ra khỏi top-10). Đây là thay đổi CHỦ Ý (owner đã duyệt hướng "penalty phải ảnh
  hưởng thứ tự thật"), nhưng biên độ xáo trộn lớn hơn dự kiến ban đầu — nên theo dõi phản hồi
  người dùng thật (feed có "nhảy" bất thường không) sau khi deploy `generate-outfits`.
- [ ] **Quyết định gemini-2.5-flash-lite cần xem lại NGAY khi Google công bố shutdown date**
  (2026-08-11) — quyết định "ở lại lite tier" (section J, mục model env override) là cost-first
  VÀ có điều kiện: hiện KHÔNG có deadline nào cho `gemini-2.5-flash-lite` (khác hẳn 2.5-flash/
  -pro đã có 16/10/2026). `GEMINI_FLASH_LITE_MODEL` env override đã tồn tại nên khi cần đổi chỉ
  là đổi secret — nhưng cần AI Khôi/agent nào đó chủ động theo dõi trang deprecations của Google
  định kỳ, vì không có cơ chế tự động cảnh báo. 2 đường nâng cấp đã định giá sẵn trong code
  comment (`describe-outfit/index.ts`, `evaluate-item/note.ts`): `gemini-3.1-flash-lite`
  ($0.25/M in, $1.50/M out, tự nó cũng shutdown 2027-05-07) hoặc `gemini-3.5-flash-lite`
  ($0.30/M in, $2.50/M out, chưa công bố shutdown).
- [ ] **Flash-tier migration ĐẾN HẠN trước 16/10/2026 — chỉ còn cách 1 Supabase secret**
  (2026-08-11) — anh Khôi quyết định GIỮ default `gemini-2.5-flash` (không đổi sang
  `gemini-3.6-flash` như một session trước từng làm rồi bị revert) vì `GEMINI_FLASH_MODEL`
  override đã tồn tại ở mọi call site (`generate-item-image`, `backfill-item-metadata`,
  `map-measurements`, `tryon-validate`, `tryon-generate`'s `TRYON_VERIFY_MODEL`,
  `generate-outfits/engine/curator.ts`, `scripts/eval-feed/judge.ts`) nên migrate thật sau
  này chỉ là 1 lần `supabase secrets set GEMINI_FLASH_MODEL=...`, không cần deploy code. 2
  đường nâng cấp đã định giá sẵn: (1) `gemini-3.6-flash` — $1.50/M in + $7.50/M out, đắt hơn
  5x input / 3x output so với `gemini-2.5-flash` hôm nay ($0.30/$2.50); (2)
  `gemini-3.5-flash-lite` — cost-neutral ($0.30/$2.50, chưa công bố shutdown) nhưng tier lite
  yếu hơn ở vision so với flash hiện tại. Ai nhặt việc này lên cần cân nhắc giá vs chất lượng
  vision trước 16/10/2026 — xem `generate-item-image/index.ts`'s VISION_MODEL comment để có
  lý do đầy đủ.
- [ ] **`proportionBalance`'s target-silhouette blend vẫn KHÔNG đo được bằng eval harness**
  (2026-08-11, phát hiện khi làm mục trên) — `run.ts` không bao giờ gọi
  `resolveTargetSilhouette` (silhouette.ts) để build `ctx.targetSilhouette`/`silhouetteConf`,
  chỉ `index.ts` (edge function thật) mới làm việc đó. Nghĩa là dù `measured`/`measured-goal`
  đã đo được `shapeGoalDelta`, phần "silhouette-first" của `proportionBalance` (blend giữa
  `scoreProportionBalance` chung và `scoreTargetSilhouette`) vẫn mù với harness. Chưa làm vì
  ngoài phạm vi yêu cầu hôm nay (`shapeGoalDelta` không cần `ctx.targetSilhouette`). Cần một
  phiên riêng: có thể thêm bước gọi `resolveTargetSilhouette` vào `run.ts`'s ctx-building step
  (giống cách `shapeGoal` vừa được thread qua) rồi verify bằng snapshot.
- [ ] **Shoe/accessory measurement data trong fixture `measured` vẫn INERT** (2026-08-11, đã
  biết từ trước, xác nhận lại) — `shoe_size`/`shoe_width` trên 4 đôi giày và `waist` trên belt
  đã có trong fixture, nhưng `scoreItemFit` (scoring.ts) không branch cho category
  `'shoes'`/`'accessory'` bao giờ, và `LABEL_TO_KEY` (enrichment.ts) không có entry cho
  `shoe_size`/`shoe_width`. Fixture đã sẵn sàng — chỉ còn thiếu code fix (mapping table +
  scoring branch mới) để dữ liệu này thực sự có tác dụng.
- [ ] **8/10 formula chưa bao giờ sinh được outfit cho onepiece (dress/jumpsuit)** (2026-08-12,
  phát hiện khi fix bug starvation outerwear của `generateOnepieceCandidates`) —
  `getFormulaPools` (generation.ts) build pool từ `cats.top`/`cats.bottom`, còn `categorize`
  xếp onepiece vào bucket riêng (`cats.onepiece`), không bao giờ vào `top`/`bottom`. Nên một
  chiếc váy chỉ có thể được sinh ra qua đúng 2 formula mà `generateOnepieceCandidates` hardcode
  (`one_two_three` khi bare/+accessory, `layering_stack` khi có outerwear) — 8 formula còn lại
  trong `FORMULA_CATALOG` (`monochrome`, `neutral_pop`, `tonal_gradient`, `high_low`,
  `texture_stack`, `pattern_solid`, `rule_of_thirds`, `contrast_pairing`) KHÔNG BAO GIỜ sinh
  được outfit cho onepiece, dù về mặt màu/chất liệu/formality chiếc váy đó có hợp formula nào
  đi nữa. Đây là gap thật (không phải bug vừa fix — phần vừa fix chỉ là starvation trong 2
  formula sẵn có), nhưng scope lớn hơn nhiều (cần thread onepiece pool qua toàn bộ hệ thống
  formula-pool, hoặc viết path onepiece-aware riêng cho từng formula) và là quyết định sản
  phẩm (formula nào thực sự hợp lý cho 1 món đồ liền thân) — chưa làm, chỉ ghi lại. Chi tiết:
  `plan.md` mục "One-piece candidate generation..." 2026-08-12, phần "Out of scope".
- [ ] **Re-backfill `can_layer` cho ~67 item đã backfill bằng prompt cũ** (2026-08-12, phát
  hiện khi sửa bias "regular-fit shirt không layer được" trong `deriveCanLayer` +
  `prompt.ts`) — sửa prompt KHÔNG tự động cập nhật lại các row đã backfill trước đó; chúng
  giữ nguyên `can_layer` do prompt cũ suy ra (thiên về fabric/fit, bỏ sót shirt mềm regular-
  fit) cho tới khi có một lần re-backfill riêng. Vướng: `backfill-item-metadata` chỉ điền
  cột đang `NULL`, nên phải xoá `can_layer` về `NULL` cho các row đó trước (ghi đè phá huỷ
  dữ liệu hiện có) rồi mới backfill lại được — cần anh Khôi duyệt trước khi chạy vì đây là
  destructive write trên DB live (không có dev/prod tách biệt). Chưa chạy gì, chỉ ghi lại.
  Chi tiết: `plan.md` mục "`can_layer` bias fix..." 2026-08-12, phần "Out of scope".
- [ ] **HENLEY có nên bỏ khỏi nhánh LAYER_FABRICS/heavy-weight shortcut trong
  `deriveCanLayer` không?** (2026-08-12, phát hiện khi sửa bias can_layer, do coordinator
  yêu cầu cân nhắc giữa chừng) — henley chỉ có placket ngắn 2–4 nút ở cổ, không phải nút cài
  dọc hết thân như shirt, nên về lý thuyết KHÔNG thể mặc mở được dù vải flannel/wool/denim
  hay dày (heavy). Hai shortcut này có từ trước phiên làm việc hôm nay (không phải bug mới),
  nên chưa động vào — chỉ SHIRT-only cho nhánh `regular && fitReal` mới thêm hôm nay bị chặn
  khỏi HENLEY. Nếu xoá 2 shortcut đó khỏi HENLEY sẽ đổi hành vi production thật (item henley
  flannel/heavy nào đang `true` sẽ thành `false`) — cần anh Khôi quyết trước khi làm. Chi
  tiết: `plan.md` mục "`can_layer` bias fix..." 2026-08-12, phần "HENLEY explicitly excluded".

## AF. Demo woman account + womenswear wardrobe (2026-08-12)

Seeded `demo-woman@mien.app` (uid `b543c515-0b5d-4b8e-8d40-caf76a46ed67`) on the live DB with a
True Winter premium persona + partial womenswear wardrobe. Detail in `plan.md` same date. Open
items below — stopped rather than improvised, per this task's ground rules.

- [ ] **`delete-user` doesn't protect the new account.** Its guard is
  `account_type in ('demo','admin')` (`supabase/functions/delete-user/index.ts:66`), but this
  account is `premium` as requested — and the demo password ships in the public JS bundle, so
  anyone with the app can sign in as demo-woman and permanently delete it. Fix option: extend the
  guard to also protect emails in `DEMO_ACCOUNTS`. Needs a redeploy — not done here.
- [ ] **All 32 imported womenswear items have NULL `m_*` measurements and NULL `size`** (7 from
  phase 1 + 4 from phase 2 + 6 from phase 3 + 15 from phase 4, 2026-08-12), so the fit engine
  scores them neutrally;
  the wardrobe-critic results for this account exercise style/colour but not fit. Compare the man
  demo, which carries `size` on 32/32 and `m_*` on 30/32. Would need real size-chart data per SKU
  (same root cause the source product pages never exposed price/size — see backlog §AD).
- [ ] 🔴 **Cardigan renders with its bottom half missing in the feed collage** (2026-08-12, user
  screenshot of `cardigan_cream` in demo-woman's feed). NOT yet root-caused. Ruled out with
  evidence, so don't re-investigate these:
  - The asset is fine — `assets/items/cardigan-cream.png` (1200×1600) contains the whole garment.
  - The Storage object is fine — 551270 bytes, byte-identical to the local PNG (and all 17 of that
    wardrobe's objects match their local assets exactly).
  - `contentBounds.measureContentBounds` does NOT truncate it. Ported verbatim into Node and run
    over the real bytes through a faithful repro of `contentBoundsUri.ts`'s resize→flatten→JPEG
    pipeline: measured bottom edge 0.8082 vs true alpha bbox bottom 0.7806 — *generous* by ~2.8%,
    i.e. the deliberate `PAD`. Same result flattening alpha to white and to black, and with a naive
    unpremultiplied downscale. Same test over `blouse-white`, `camisole-blush`,
    `dress-floral-midi`, `skirt-pleated-beige`, `coat-trench-beige`, `sneakers-white-women` — all
    generous by 1.7–2.9%, none truncated.
  - `ASPECT` missing a `CARDIGAN` entry (also missing `SWEATER`/`HOODIE`/`VEST`/`PARKA`) cannot
    crop: `Collage.tsx:34-48` only clips in the `measure` branch, and when an item is measured
    `item.aspect` is used directly so `ASPECT` is never consulted; unmeasured items render
    `resizeMode="contain"`, which letterboxes rather than crops. Worth filling in anyway for
    correct slot sizing, but it is not this bug.
  - The uncommitted 2026-08-12 `COLLAGE` retune only changes size caps/gaps; `fitTopLeft` and the
    scale-to-fit pass both preserve aspect, so they can reposition/shrink boxes but never crop.
  - `Collage.tsx`'s crop maths were re-derived by hand and are correct
    (`left = -(rect.x/rect.w)*100%` with `width = (1/rect.w)*100%` maps the rect's left edge to 0).
  - `useItemContentMeasure.ts` has no consumers outside its own feature, so the collage is the only
    surface that crops — the screenshot must be the feed.
  Leading remaining hypothesis: a **truncated on-device cache file**. `ensureCloudCached`
  (`src/services/itemPhotoService.ts:129-138`) returns a cached file on `info.exists` alone — no
  size check, no checksum, no decode probe, no retry — so a `downloadAsync` interrupted partway
  (backgrounding, low storage, dropped connection) leaves a partial PNG that is served forever
  after. PNG being scanline-encoded top-to-bottom, a truncated file renders exactly like this:
  top intact, bottom gone. NEXT STEP (needs a device — anh Khôi has to launch the emulator):
  compare the cached file's byte size on the repro device against 551270. If it is short, that
  confirms it. Fix would be to validate size/decode before trusting the cache and re-download on
  failure, plus a per-itemId in-flight promise map to stop concurrent remounts racing (the pattern
  in `contentBoundsUri.ts:35` already does this), plus a one-time cache sweep for devices already
  holding a corrupted file.
- [ ] **`TYPE_OPTIONS` offers 10 garment types the DB will reject** (2026-08-12, found while adding
  `FLATS`; 8 of 10 now closed as of 2026-08-13). `src/features/wardrobe-add/vocab.ts:7` lets the
  user pick any of 55 types, but `clothing_items.type` has an FK to `garment_types(type_key)` and
  the live table was missing: `BODYSUIT, CAPE, CORSET, CROP, FLATS, GLOVES, KIMONO, TIGHTS, TUNIC,
  WEDGES`. A user who adds a croptop/bodysuit/kimono through the picker hit a raw FK violation.
  `FLATS` was closed 2026-08-12 (migration `20260812000002_garment_type_flats.sql`, needed for the
  demo-woman import); `CROP, BODYSUIT, TUNIC, CORSET, CAPE, KIMONO, WEDGES` were closed 2026-08-13
  (migration `20260813000001_garment_types_picker_backfill.sql`) by mechanically mirroring
  `enrichment.ts`'s `category`/`TYPE_FORMALITY`/`STYLE_AFFINITIES` values into `garment_types` rows,
  the same way the `FLATS` migration did. `garment_types` is now 61 rows (was 53 before either
  migration). Only `GLOVES`/`TIGHTS` remain open — the engine has no formality, style-affinity, or
  layer-role metadata for either (`CATEGORY_MAP` covers them, defaulting both to `accessory`, but
  that's it), so closing them needs a real product decision, not a mechanical copy.
  UPDATE 2026-08-21: the `CATEGORY_MAP` half of the 7 DB-only types (`CARGO, DERBY, GILET, JOGGERS,
  SOCKS, TANK, WINDBREAKER`) is now closed — see the "6 of the remaining 7 DB-only types" entry
  below — but their formality/style-affinity values remain undecided, same as `GLOVES`/`TIGHTS` here.
  Converse drift — **NOT lower severity, this one ships wrong outfits** (corrected 2026-08-12
  after it bit us live): `garment_types` has 8 types nothing else knows about —
  `CARGO, DERBY, GILET, JOGGERS, SLIDES, SOCKS, TANK, WINDBREAKER`. Verified: all 8 are absent from
  the engine's `CATEGORY_MAP` (`enrichment.ts:15-26`) AND from `collageLayout.ts`'s `ASPECT` and
  `ACCESSORY_TYPES`. `categoryOf` (`enrichment.ts:27`) falls back to `?? 'accessory'`, so such an
  item silently becomes an ACCESSORY in outfit generation.
  **Live proof:** the woven `SLIDES` imported in phase 4 filled the accessory slot of a
  `layering_stack` outfit that already had Chelsea `BOOTS` in the shoes slot — the feed served a
  5-item look with TWO pairs of footwear (screenshot 2026-08-12). It also rendered at clothing size
  in the collage rather than in the accessory row, because `SLIDES` is missing from
  `ACCESSORY_TYPES`/`ASPECT` too.
  Fix for `SLIDES` specifically needs 4 layers + a redeploy of the 3 engine-importing edge
  functions: `CATEGORY_MAP` `'shoes'`, `BASE_FORMALITY` (DB says 1.0), `STYLE_AFFINITY` (DB says
  athleisure/streetwear), `TYPE_FIT_DEFAULT`, plus `collageLayout`'s `ACCESSORY_TYPES` + `ASPECT`,
  plus `vocab.ts` `TYPE_OPTIONS`. The other 7 need real formality/affinity calls first.
  **`SLIDES` CLOSED 2026-08-13** — wired through every list `SANDALS` appears in (`enrichment.ts`'s
  `CATEGORY_MAP`/`STYLE_AFFINITIES`/`TYPE_DEFAULT_FIT`/`TYPE_FORMALITY`, `collageLayout.ts`'s
  `ACCESSORY_TYPES`/`ASPECT`, `vocab.ts`/`measureSchema.ts`/`buckets.ts`/`wardrobeService.ts`/
  `itemTypeMap.ts`/`generate-item-image/prompt.ts`/`map-measurements/prompt.ts`, plus the two engine
  test files' type-set copies), regression test added, all 3 engine-importing functions +
  `generate-item-image` + `backfill-item-metadata` + `map-measurements` redeployed. See `plan.md`
  "`SLIDES` garment type missing from the fit engine" for the full list and verify numbers. The other
  7 (`CARGO, DERBY, GILET, JOGGERS, SOCKS, TANK, WINDBREAKER`) remain open below — still need real
  formality/affinity/category decisions, not a mechanical copy.
- [ ] **`garment_types.category` disagrees with the engine on the 4 one-piece types**
  (2026-08-13). Live has `DRESS, GOWN, JUMPSUIT, OVERALLS` under `category='bottom'`;
  `enrichment.ts:20` calls them `onepiece`. No runtime effect while the engine keeps its own
  hardcoded map, but it becomes a real bug the moment the engine reads categories from the DB
  (the migration `docs/engine-migration-plan.md` plans). Decide which side is canonical before
  that move.
- [ ] **The 21 phase-3 + phase-4 items have NULL AI-extracted metadata** (2026-08-12; 6 from
  phase 3, 15 from phase 4, plus `slides_black_w.material` which the product page never stated): `warmth_season`,
  `can_layer`, `print_scale`, `drape`, `visual_interest`, `graphics`, `distressed` were left NULL
  on purpose — those are Gemini-extracted-from-photo fields owned by `backfill-item-metadata`,
  whose row selector is `.or('fit.is.null,…,visual_interest.is.null')`, so NULL is the correct
  "not yet extracted" state and these rows self-select on the next run. Hand-filling them would
  have excluded them permanently. The run was NOT performed: the endpoint requires header
  `x-admin-secret == BACKFILL_ADMIN_SECRET` and `supabase secrets list` returns only digests, not
  the plaintext. Needs anh Khôi to supply the secret (or rotate it via `supabase secrets set`,
  which overwrites production config). Until then the fit engine treats these 6 with
  fabric-derived fallbacks rather than photo-derived values.
- [ ] **`profiles.email` for the existing (man) demo user is stale** — it reads `demo@mily.app`
  while `auth.users.email` is `demo@mien.app` (left over from the app rename). Cosmetic drift,
  not fixed here.
- [ ] **Other fabric vocabulary likely still missing from `fabric_types`/`MATERIALS`/
  `FABRIC_DEFAULTS`** (2026-08-12, phase 2): confirmed absent from the live `fabric_types` table
  while closing the rayon gap above — `modal`, `lyocell`, `spandex`, `tencel`, `acrylic`, `ramie`.
  Not added; anh Khôi to decide which (if any) are common enough in the catalogue to warrant the
  same 3-layer treatment rayon just got.
- [ ] **Rayon's placement in the engine's OTHER material-keyed tables is an open call**
  (2026-08-12, phase 2): `FABRIC_DEFAULTS` now has a `Rayon` entry, but `enrichment.ts`'s
  `MATERIAL_STYLE_BOOSTS` (style-tag boosts), `FABRIC_NAME_MAP`/the `FabricName` union (canonical
  fabric tag used elsewhere in scoring), and `deriveFormality`'s luxury-material bump
  (`Wool`/`Cashmere`/`Silk`/`Fur` → +0.5 formality) do NOT include rayon — left out rather than
  guessed, per this task's spec. Note several other real materials already in `FABRIC_DEFAULTS`
  (`Acetate`, `Plated`, `Steel`) are likewise absent from all three, so this isn't obviously wrong,
  just undecided. If rayon should read as "elevated"/get a style boost/get a `FabricName`, needs a
  deliberate call.

## AG. Cardigan trong suốt làm base layer trần — gate `opacity` (2026-08-13)

Fix chi tiết ở `plan.md` cùng ngày ("Sheer cardigan worn as the sole torso layer"). Ba việc còn
treo, ghi lại đây theo đúng yêu cầu của lead khi giao task:

- [ ] **Cardigan oversized + quần ống rộng trên thân hình đồng hồ cát xoá mất vòng eo, trong khi
  card vẫn hiển thị "SHAPE: HOURGLASS"** (2026-08-13, phát hiện cùng lúc điều tra bug cardigan
  sheer). Engine không có khái niệm "volume chồng volume xoá silhouette" trong scoring — chỉ
  render nhãn hình dáng cơ thể tĩnh (`body_shape`) mà không phạt điểm khi outfit thực tế che mất
  hình dáng đó. Cần thêm một tín hiệu phạt volume-on-volume vào `scoring.ts`, chưa làm ở đây.
- [ ] **[Đã sửa lại 2026-08-13, evidence gốc sai] Accessory có thể thiếu trục formality — nhưng
  CHƯA có ca lỗi thật nào chứng minh.** Mục gốc ghi "túi xách dạ hội đính sequin bị ghép với giày
  sneaker trắng dưới tag `minimalist · everyday`" — đó là đọc nhầm từ thumbnail render nhỏ trên
  màn hình. Đối chiếu lại DB thật: item đó là `Leather Tote Bag`, màu Black, id `2fb20c62…`, trong
  wardrobe của `demo-woman@mien.app` — một cái túi tote da đen trơn, không sequin, không dạ hội.
  Túi tote da đen đi với sneaker trắng dưới tag minimalist là một cặp hoàn toàn hợp lý, không phải
  bug. Bằng chứng ban đầu của mục này không tồn tại. Ý tưởng "accessory không có trục formality
  riêng trong engine" tự nó có thể vẫn đúng về mặt kỹ thuật (chưa kiểm tra lại), nhưng giờ chỉ còn
  là một đề xuất CHƯA CHỨNG MINH, không có ca lỗi quan sát được đứng sau — cần tìm một
  counter-example thật (một accessory formality rõ ràng bị ghép sai tông trong outfit thật) trước
  khi ai bỏ công làm trục formality cho accessory. Đừng coi đây là bug đã xác nhận.
- [ ] **Volume-on-volume xoá eo — mới có ở tầng curator (taste), chưa có ở `scoring.ts`
  (deterministic)** (2026-08-14, cập nhật cho mục "Cardigan oversized + quần ống rộng..." phía
  trên). `engine/curator.ts`'s `describeItem` giờ gửi tag `drape` (`structured`/`fluid`) cho model,
  và `SYSTEM_PROMPT` có thêm câu phạt "fluid top + fluid bottom xoá eo" — nhưng đây CHỈ là tầng LLM
  curation, best-effort và có fallback khi lỗi/timeout/thiếu API key (`curatorEnabled()` false thì
  bỏ qua hoàn toàn). Rule engine (`scoring.ts`) vẫn không có tín hiệu phạt volume-on-volume nào —
  mục gốc phía trên (thêm penalty vào `scoring.ts`) vẫn treo y nguyên, chưa làm ở đây vì đó là
  thay đổi tầng scoring, ngoài phạm vi task này (chỉ được giao làm giàu candidate line cho curator).
- [ ] **Bản sao thứ ba của phân loại "món mặc trên thân"** (2026-08-13). Fix sole-torso-layer ở
  `describe-outfit/prompt.ts` vừa thêm `TORSO_LAYER_TYPES` (`prompt.ts:34-41`) — set các garment
  type coi là lớp mặc trên thân, dùng bởi `deriveSoleTorsoLayerIndex` (`prompt.ts:50`). Đây là bản
  sao cục bộ, viết tay, của phân loại đã tồn tại sẵn hai chỗ: `LAYER_ROLE_BY_TYPE`
  (`generate-outfits/engine/enrichment.ts:282-290`) và `OUTER_TOPS`/`MID_TOPS`/`INNER_TOPS`
  (`src/components/outfit/collageLayout.ts:46-51`). Comment ở `prompt.ts:9-33` đã tự nhận đây là
  trùng lặp CỐ Ý — mỗi Supabase Edge Function deploy độc lập theo thư mục riêng nên
  `describe-outfit` không import chéo được từ `generate-outfits`, và `collageLayout.ts` vốn đã
  chấp nhận tradeoff này trước đó. Nhưng hệ quả cụ thể: thêm một garment type mới giờ phải sửa
  ĐÚNG ba chỗ đồng bộ bằng tay, và ba chỗ lệch nhau thì không có gì báo lỗi — chạy im lặng với kết
  quả sai. Bằng chứng là đã có lệch thật: `PARKA` nằm trong `TORSO_LAYER_TYPES` (outer, `prompt.ts:40`)
  và trong `LAYER_ROLE_BY_TYPE` (outer, `enrichment.ts:289`), nhưng `OUTER_TOPS` ở `collageLayout.ts:46`
  KHÔNG có `PARKA`. Chưa rõ ảnh hưởng thực tế của lệch này (collage layout dùng để xếp hình, không
  liên quan sole-torso-layer), nhưng nó chứng minh rủi ro "ba bản sao lệch nhau, không ai biết" là
  có thật chứ không phải giả định. Chưa làm gì ở đây — cần cân nhắc có nên gom về một nguồn chung
  (build-time codegen bơm vào từng bundle, hoặc test đối chiếu ba set) hay chấp nhận rủi ro tiếp.
- [ ] **`tsc --noEmit` gives ZERO type coverage for edge-function code.** Discovered 2026-08-21
  while verifying the three fixes above. `tsconfig.json`'s `exclude` lists `supabase/functions`
  entirely, so `npx tsc --noEmit` never touches any edge function — "tsc clean" reported as
  evidence for an edge-function change is reporting nothing. `deno test` (which runs `deno check`
  first) is the only real type gate today. Suggestion, not implemented: either a separate
  `tsconfig.json` scoped to `supabase/functions`, or a `deno check` step in the verify routine.

- [ ] **Bug gốc CHƯA ĐƯỢC SỬA, chấp nhận tạm thời (2026-08-13, ghi lại khi huỷ `opacity`).** Sau khi
  huỷ toàn bộ gate `opacity`/`deriveCanBeSoleTop`, bug gốc mục này từng nhắm tới vẫn còn nguyên:
  engine có thể chọn một chiếc cardigan lưới xuyên thấu (`951ad59f-3152-46a8-bffb-423c4571b702`)
  làm garment DUY NHẤT trên thân — xác nhận trực tiếp trong log production của `generate-outfits`
  lúc 19:25:53, item này được chọn làm sole torso garment ở HAI outfit riêng biệt trong cùng lần
  chạy. Phần copy ("HOW TO WEAR") không còn tự mâu thuẫn nữa — `describe-outfit`'s
  `deriveSoleTorsoLayerIndex`/`TORSO_LAYER_TYPES` (dựa trên TYPE, không phụ thuộc `opacity`) vẫn
  hoạt động, nên app sẽ không còn bảo người dùng "mở cúc" một món đang là lớp duy nhất — nhưng bản
  thân OUTFIT vẫn sai: một cardigan xuyên thấu vẫn bị gợi ý mặc một mình, không có gì che bên
  trong. Không sửa ở đây theo yêu cầu — cột `opacity` (không dùng) vẫn còn trên DB
  (`clothing_items.opacity`, migration `20260814000001_item_opacity.sql`) nếu sau này cần một
  hướng tiếp cận khác cho vấn đề này.

## AI. Auto shape-tier ranking follow-ups (2026-08-13)

Fix chi tiết ở `plan.md` cùng ngày ("Auto shape-tier ranking — the default 'auto' shapeGoal path
had NO resulting-shape preference"). Bốn việc chủ động hoãn lại khi làm task này, ghi lại đây theo
đúng yêu cầu của lead khi giao task:

- [ ] **Bốn hệ số tier (`AUTO_SHAPE_FLATTER=+0.06` / `AUTO_SHAPE_STRAIGHT=+0.02` /
  `AUTO_SHAPE_NEUTRAL=0` / `AUTO_SHAPE_COUNTER=-0.04`) là CALIBRATION-PENDING** (2026-08-13) —
  `engine/ranking.ts`. Đây là thứ tự A>B>C>D hợp lý về mặt logic, đặt trong cùng biên độ với các
  delta khác đã có (`shapeGoal`/`gender`/`house`), nhưng CHƯA từng đối chiếu với dữ liệu feed thật
  (CTR/save/worn theo tier). Cần một lượt calibration thực tế trước khi coi các con số này là
  đúng, không chỉ "hợp lý".
- [ ] **Cả 5 fixture của `scripts/eval-feed/` đều dùng `body_shape='rectangle'`** (2026-08-13) —
  `scripts/eval-feed/fixture.ts:22`. Nghĩa là mọi hàng KHÁC 'rectangle' trong cả ba bảng tier
  (`AUTO_SHAPE_WOMAN`/`AUTO_SHAPE_MAN`/`AUTO_SHAPE_NEUTRAL_TABLE`) — tức phần lớn nội dung ba bảng
  — CHƯA từng được harness offline chạy qua, dù unit test (`auto-shape-tier.test.ts`) đã cover
  đúng-sai logic. Cần thêm ít nhất 1 fixture cho mỗi `body_shape` còn lại (`triangle`,
  `inverted_triangle`, `hourglass`, `apple`) để đo movement thật trên feed.
- [ ] **Fixture `resort` cho ra 100% outfit đọc là rectangle/straight** (2026-08-13) — wardrobe
  của fixture này toàn item `relaxed`-fit nên mọi outfit compose ra đều rơi vào cùng một
  silhouette, không có candidate nào chạm được tier A/B khác — tier delta mới thêm không thể giúp
  gì khi wardrobe tự nó không có lựa chọn khác để xếp hạng lên trên. Không phải bug của tier
  table, nhưng là giới hạn cần biết khi đọc kết quả eval của fixture này.
- [ ] **`genderStylingDelta` vẫn đọc `ctx.gender` (opt-in `gender_aware`) trong khi bảng tier mới
  đọc `ctx.profileGender` (raw profile, không opt-in)** (2026-08-13) — `scoring.ts` +
  `ranking.ts`. Hai nguồn gender khác nhau cùng chạy trong một lượt scoring, là quyết định có chủ
  đích (xem `types.ts` comment ở `EngineContext.profileGender`) nhưng đáng xem lại: một user tắt
  `gender_aware` vẫn bị bảng tier tự động áp dụng theo gender hồ sơ của họ, trong khi
  `genderStylingDelta` thì không. Nếu sau này quyết định gộp lại một nguồn, đây là chỗ cần sửa.
- [ ] **Cân nhắc migrate ảnh (wardrobe-photos + ảnh try-on AI) từ Supabase Storage sang Cloudflare
  R2 + Cloudflare Images** (2026-08-29) — đề xuất chưa duyệt, phát sinh khi khảo sát chương trình
  Cloudflare for Startups (tier bootstrapped = $10k credit/1 năm, R2 cap $10k). Lý do: Supabase
  Storage tính egress $0.09/GB còn R2 egress = $0, và Cloudflare Images tự sinh variant nên không
  cần lưu nhiều size. Chỗ phải sửa: `src/services/itemPhotoService.ts` (upload/getPublicUrl) và
  các edge function ghi ảnh (`generate-item-image`, `tryon-generate`, `backfill-item-metadata`).
  Timing: app (đổi tên thành **The MIEN**, `tech.kioh.mien`) CHƯA release nên DB chưa có ảnh
  thật — đổi bây giờ gần như free, đổi sau release phải move file + rewrite URL đã lưu trong DB.
  Đây là lập luận nên làm SỚM, ngược với thói quen hoãn. R2 có free tier riêng (10GB, egress $0)
  nên không cần chờ credit Cloudflare mới làm được. Điều kiện kích hoạt: trước mốc release.

## Chặn release (rà 2026-08-29)

- [ ] **Chuyển đăng nhập demo sang edge function `demo-signin`** (2026-08-30) — anh Khôi chốt
  hướng: bỏ `EXPO_PUBLIC_DEMO_PASSWORD` khỏi client bundle, đẩy việc sign-in sang edge function
  giữ secret. Lưu ý MIEN hiện KHÔNG có edge function auth nào (OTP thật đi thẳng Supabase Auth
  qua `verifyEmailOtp`/`verifyPhoneOtp`; nhánh demo bypass hoàn toàn client-side trong
  `authStore.ts:verifyOtp`). Rủi ro còn lại KHÔNG phải tiền mà là: nhiều người lạ dùng chung một
  uid demo -> ghi đè wardrobe seeded (32 items) và profile của nhau, phá trải nghiệm demo của
  Apple reviewer. **Phạm vi mở rộng 2026-08-30 theo anh Khôi chốt:** không làm riêng function
  demo nữa mà gom TOÀN BỘ login/OTP về một edge function `auth`; function chỉ gọi lại đúng các
  hàm Supabase Auth client đang gọi, khác duy nhất là email/phone trong demo whitelist thì auto
  pass. Instruction đầy đủ ở `docs/auth-edge-function-instruction.md`, sẵn sàng giao Sonnet.
  Rào cản quan trọng nhất đã tra ra: Supabase Auth rate-limit `verifyOtp` 360/giờ mỗi IP (burst
  30, KHÔNG chỉnh được), nên khi proxy qua edge function tất cả user chung một IP — phải gửi
  header `Sb-Forwarded-For` (Supabase KHÔNG honor `X-Forwarded-For`), và header này phải bật
  riêng + cần secret key.
  **2026-08-30 — ĐÃ IMPLEMENT** (`supabase/functions/auth/index.ts` + `index_test.ts`,
  `authService.ts`, `demo.ts`, `authStore.ts`, `eas.json`, `.env`, 2 file i18n). Kiểm tra:
  `tsc --noEmit` sạch, `npx jest` 602/602 (44 suite), `deno test` 17/17. CHƯA deploy, CHƯA
  commit. Còn lại của anh Khôi — rà lại 2026-09-12:
  - (a) secrets `DEMO_PASSWORD` + `DEMO_WHITELIST` — **ĐÃ SET** (`supabase secrets list` cho
    thấy cả hai, updated 2026-09-07). Xong.
  - (b) deploy `auth` — **ĐÃ XONG**; `POST /functions/v1/auth` với anon key trả
    `{"error":"Not found"}` cho action lạ, tức code function đã chạy. Lưu ý: deploy hiện tại
    BẬT `verify_jwt` (gọi không header -> `UNAUTHORIZED_NO_AUTH_HEADER` từ gateway), và như
    vậy là ĐÚNG — supabase-js gửi anon key làm bearer nên login vẫn qua được; KHÔNG cần
    `--no-verify-jwt` như instruction cũ viết.
  - (c) **CÒN LẠI, sửa lại theo docs 2026-09-13** (https://supabase.com/docs/guides/auth/rate-limits):
    `Sb-Forwarded-For` chỉ được Supabase honor khi ĐỒNG THỜI (i) bật "IP Address Forwarding" ở
    Dashboard → Authentication → Rate Limits VÀ (ii) request dùng SECRET API key
    (`sb_secret_...`) — publishable key và anon/service_role key kiểu cũ ĐỀU KHÔNG được hỗ trợ.
    `supabase/functions/auth/index.ts:30,123` hiện dựng client bằng `SUPABASE_ANON_KEY` -> header
    đang bị bỏ qua dù có bật setting trên dashboard hay không.
    Việc còn lại: tạo/dùng một secret key, đổi `buildAuthClient` sang key đó (vẫn giữ
    `persistSession: false`, không bao giờ trả key ra ngoài), rồi mới bật setting trên dashboard.
    - ĐÃ XÁC NHẬN 2026-09-13 là giả được: `getClientIp` (`supabase/functions/auth/index.ts:108`)
      lấy phần tử ĐẦU của `x-forwarded-for`, nhưng Supabase KHÔNG ghi đè header client gửi mà nối
      IP thật vào sau (`x-forwarded-for: spoofed,68.65.164.215`) — nguồn
      https://github.com/orgs/supabase/discussions/34647. Header `cf-connecting-ip` chứa IP thật.
    - Hệ quả: rate limit `/verify` của Supabase CHỈ theo IP, không có khoá theo user
      (https://github.com/orgs/supabase/discussions/26477) → nếu bật forwarding với code hiện
      tại, attacker xoay IP giả mỗi request và brute-force OTP 6 số được.
    - Hiện trạng (chưa bật) có lỗ ngược lại: mọi user chung một bucket IP của function (burst
      30) → một người spam 30 request sai là chặn login của toàn bộ user (DoS), không mất tài
      khoản.
    - Kế hoạch sửa, CHỜ anh Khôi duyệt, làm theo thứ tự:
      1. Deploy tạm function probe echo headers, gọi với `X-Forwarded-For` giả để xác nhận cấu
         trúc trên project mình, rồi xoá probe. Chọn `cf-connecting-ip` hoặc phần tử CUỐI của XFF.
      2. **DONE 2026-09-13** — giới hạn 5 lần/15 phút theo từng phone/email (bucket riêng
         send/verify), độc lập IP: bảng `public.otp_attempts` + fn `consume_otp_attempt` (migration
         `20260913000001_otp_attempt_rate_limit.sql`, đã apply lên production), gọi từ
         `handleSendOtp`/`handleVerifyOtp` trước nhánh demo. `auth` đã deploy version 2. Chi tiết ở
         `plan.md` 2026-09-13.
      3. Đổi `buildAuthClient` sang secret key + bật IP Address Forwarding trên dashboard.

Trạng thái code lúc rà: `npx jest` 602/602 pass (44 suite), `npx tsc --noEmit` sạch. Chất lượng
code KHÔNG phải thứ đang chặn release.

- [ ] **Landing page MIEN — bản artifact chỉ có tủ đồ nam** (2026-09-02) — 22 item, closet nữ
  (`*-women.png`, đã có sẵn trong `assets/items/`) chưa đưa vào; chưa có bản copy tiếng Việt;
  metadata material/fit/warmth của các item ngoài `docs/fetched-items.json` là tự điền tay chứ
  không đọc từ DB (vì DB đang pause). Artifact:
  https://claude.ai/code/artifact/f7bb4297-611e-4cd8-bd73-c210f5ea938c
  Nguồn: scratchpad `page.tpl.html` + `mien-closet.html` — chưa commit vào repo.

- [ ] 🔴 **ĐỔI PASSWORD APPLE ID — đã phơi nhiễm công khai, chưa xoay** (2026-09-06, xử lý
  2026-09-12). Password Apple ID từng nằm plaintext trong `.claude/settings.local.json`
  (permission allow-list của EAS build), rồi bị chép lại lần hai vào chính mục backlog này và
  commit lên (`c2547f1`, 2026-09-06) khi repo **đang PUBLIC**.
  ĐÃ LÀM 2026-09-12:
  - Xoá chuỗi khỏi HEAD, commit + push.
  - Chuyển repo `kioh-studio/true-clothes` về **PRIVATE** (`gh repo edit --visibility private`).
    Muốn public lại thì đổi password xong đã.
  - `git filter-repo --replace-text` trên toàn bộ history + force push 2 nhánh có dính
    (`010-wardrobe-critic`, `main`); 4 nhánh cũ không dính nên SHA giữ nguyên. Verify: quét
    toàn bộ blob của mọi ref -> 0 hit. Backup trước khi rewrite ở scratchpad phiên
    (`pre-rewrite-backup.bundle`, 143MB) — scratchpad sẽ bị dọn, không phải nơi giữ lâu dài.
  CÒN LẠI:
  - **Đổi password trên appleid.apple.com** + rà thiết bị/phiên lạ trong Apple ID. Đây là fix
    dứt điểm DUY NHẤT: rewrite history không cứu được, vì repo đã public một thời gian và
    GitHub vẫn giữ commit mồ côi `c2547f1` — verify 2026-09-12 `gh api .../commits/c2547f1`
    vẫn trả patch chứa password (commit `a08a978` cũng còn tồn tại). Private chỉ chặn người
    ngoài, không xoá.
  - Sau khi đổi xong: mở ticket GitHub Support xin GC dangling objects (`c2547f1`, `a08a978`)
    rồi mới cân nhắc public lại.
  - KHÔNG chép lại giá trị password vào bất kỳ file nào trong repo, backlog này bao gồm.

- [ ] **Không có cơ chế nào rà credential trước khi commit** (2026-09-12) — phát hiện khi anh
  Khôi hỏi "sao bảo có rule rà credential rồi mà". Soi lại: `.git/hooks/` rỗng (không có
  `pre-commit`), `~/.claude/hooks/safe-approver.bash` 24 dòng không đả động secret,
  `.claude/settings*.json` chỉ có permission allow-list, không có gitleaks/trufflehog/CI scan.
  Dòng "đánh giá security trước MỌI thay đổi" trong CLAUDE.md là kỳ vọng, không có gì enforce —
  và nó đã không chặn được vụ `c2547f1`. Đề xuất (chưa làm, chờ anh Khôi duyệt): thêm
  `.git/hooks/pre-commit` gọi `gitleaks protect --staged` hoặc một regex scan tối thiểu
  (password/secret/token/`appl_`/`sk-`/JWT không phải anon key). Phải là hook thật, không phải
  ghi thêm một dòng vào CLAUDE.md.

- [ ] **KHÔNG ai verify được layout iPad từ máy này — máy dev là Windows** (2026-09-13) —
  ghi lại cho khỏi vòng vo lần sau. iOS simulator không chạy trên Windows, và `expo start --web`
  cũng không phải đường vòng: `react-native-web` + `react-dom` KHÔNG có trong `package.json`
  (chỉ có mỗi script `web`), nên bật web target là phải thêm 2 dependency chỉ để xem layout —
  mà web vẫn không phản ánh đúng native. Kết luận: mọi mục "device verify" liên quan iPad chỉ
  anh Khôi đóng được, trên Mac hoặc iPad thật.

- [ ] **Audit responsive tĩnh 2026-09-13 — không tìm thấy lỗi cấu trúc, nhưng đó KHÔNG phải
  bằng chứng đã đúng.** Đã rà: (a) 0 chỗ dùng `Dimensions.get()` ở module scope (đúng luật ghi
  trong `layout.ts`); (b) 7 màn trong `app/` không có tín hiệu responsive nào hoá ra đều là
  màn mỏng uỷ quyền xuống `src/features/*` — component thật đã bọc `Bounded`/`useResponsive`;
  (c) các `aspectRatio` cứng còn lại đều nằm trên card lưới (`width:'100%'` trong ô lưới) nên
  bề rộng đã do số cột quyết định — đúng như `src/design/responsive/design.md` mô tả, không vi
  phạm luật media sizing; (d) `maxWidth` số cố định còn lại chỉ nằm trên khối CHỮ (giới hạn độ
  dài dòng), không nằm trên ảnh; (e) hero `winH * 0.58` lấy từ `useWindowDimensions` nên sống
  theo xoay màn hình. Cái audit này chỉ chứng minh không có lỗi thuộc loại grep bắt được —
  giãn thưa, khoảng trắng chết, chữ trôi, sticky footer đè, thì phải nhìn mới biết.

- [ ] **Media full-bleed chưa test trên iPad thật** (2026-09-08) — bỏ `MEDIA_MAX 520` và bỏ luôn
  aspect 4:5 của hero: feed collage full-bleed, detail hero full-bleed × `winH * 0.58` (cùng tỉ lệ
  màn hình trên mọi thiết bị). Mới verify bằng tsc + jest, chưa chạy trên iPad/emulator để xem
  collage giãn ngang ở 1024pt có bị thưa (khoảng trắng giữa slot) không, và hero 58% chiều cao
  còn đủ chỗ cho hàng item bên dưới không. Cùng luật đã áp cho hero màn item detail
  (`app/item/[id].tsx`, đã đưa ra ngoài `<Bounded>`) — cũng chưa xem trên máy thật.
  2026-09-09: đã bọc `<Bounded>` cho 18 màn còn lại (onboarding, edit, paywall, help,
  notifications, wardrobe-report, try-on, measurements-scan) + đổi grid 12-tone của
  `DrapeSession` sang adaptive columns. Toàn bộ mới verify tĩnh (tsc + 602 test), anh Khôi
  test trên iPad Pro 13" simulator; cần soi kỹ: sticky footer của paywall/formulas/measurements
  (đã chuyển `flexDirection:'row'` sang `Bounded`), lưới swatch colors-edit, và màn
  measurements-scan (camera giữ nguyên, chỉ chữ/nút bị bọc).
  2026-09-09: add-to-wardrobe wizard (upload/processing/review/done + stepper,
  `MethodChooser` sheet capped via style props) và try-on (`ScanScreen`, `ResultScreen`,
  `MixMatchFeed`'s bottom bar, `MatchFeedCard`'s meta strip) cũng đã bọc. Vẫn chỉ verify
  tsc + jest — phần còn lại của mục này thuần là test trên iPad thật.

- [ ] **Test MIEN trên iOS 27 (phát hành 14/09/2026)**: Liquid Glass được chỉnh lại cho dễ
  đọc, nhiều app hỗ trợ xoay ngang hơn — kiểm tra layout, tab bar, modal. (2026-09-13, iOS 27
  ra chính thức ngay sau Apple event 09/09)
- [ ] **Đề xuất: App Intents cho Siri AI trên iOS** (vd "Siri, hôm nay mặc gì?") — iOS 27 bỏ
  SiriKit, Siri AI chỉ gọi app qua App Intents; app React Native cần native module.
  (2026-09-13, đề xuất chưa duyệt; nguồn chủ yếu từ blog dev, chưa đối chiếu tài liệu Apple)
- [ ] **Đề xuất: cân nhắc Apple Foundation Models cho một số tính năng AI trên iOS** — dev
  trong Small Business Program (dưới 2 triệu lượt tải) được dùng model trên Private Cloud
  Compute miễn phí; phải so chất lượng với Gemini và giữ tương đương trên Android. (2026-09-13,
  đề xuất chưa duyệt; thông tin từ blog dev, chưa đối chiếu Apple)

- [ ] **App Review note: demo account can't be deleted** (2026-09-20) — `delete-user` returns
  403 for `account_type` demo/admin. If the reviewer tests Delete Account with the demo login they
  will see "This account cannot be deleted". Explain this in the ASC App Review notes (or give them
  a way to create a fresh account) before submitting.

## Pre-submission review findings (2026-09-20)

- [ ] **MEDIUM — no "report this result" on AI try-on output** (`app/try-on/wear.tsx` ~460).
  Apple asks AI image apps for a way to flag objectionable output. Needs an app build.
- [ ] **MEDIUM — `expo-constants` missing as direct dep + 3 packages behind SDK** — run
  `npx expo install expo-constants` and `npx expo install --fix` before the next build.
- [ ] **LOW — Supabase session stored in AsyncStorage, not SecureStore** (`src/services/supabase.ts`).
- [ ] **LOW — DB hardening:** policies `TO public` → `TO authenticated`; revoke EXECUTE on
  `handle_new_user` from anon/authenticated; `set_updated_at()` pin search_path; storage buckets
  lack UPDATE policy (upsert replace will fail).
- [ ] **LOW — `react-native-fast-tflite` untested on New Architecture** — smoke-test the scan flow
  on a real iPhone from TestFlight.
