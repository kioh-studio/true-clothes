## Feature

- Help user import their clothes to wardrobe easier

## Flow

- App gọi edge func với 1 ảnh do user cung cấp, mỗi ảnh user chọn extract by AI sẽ call 1 edge func riêng với đúng 1 ảnh đó
- Edge func nhận hình ảnh, gọi gemini AI để detect ra có bao nhiêu item, extract ra các meta data của từng item mà user mặc trong outfit đó dưới dạng array of JSON object, mỗi object cần có :
  - **`type`** ⭐ — loại garment, BẮT BUỘC chọn đúng 1 giá trị trong enum `type` system cung cấp (xem mục Controlled Vocabulary). Đây là field engine phụ thuộc nặng nhất (suy ra category, formality, fit mặc định, style tags, warmth).
  - **`name`** — tên ngắn mô tả món đồ
  - **`description`** — miêu tả đặc trưng item, dùng làm prompt cho nano banana (KHÔNG feed engine)
  - **`color`** — màu sắc, chọn đúng 1 trong danh sách màu system cung cấp
  - **`material`** ⭐ — chất liệu, chọn 1 trong vocab material system cung cấp (quyết warmth/season/formality/fabric). Nếu không chắc, chọn giá trị gần nhất.
  - **`fit`** — form dáng, chọn 1 trong vocab fit system cung cấp
  - **`pattern`** — hoạ tiết, chọn 1 trong vocab pattern system cung cấp (tách riêng, KHÔNG để engine đoán từ name)
  - **`warmth_season`** — độ ấm/mùa, BẮT BUỘC chọn đúng 1 trong 4 giá trị: `lightweight_summer | midweight_transitional | warm_winter | all_season`
  - **`measurements`** — số đo garment (m_chest, m_waist, m_hip, m_inseam, ...). CHỈ điền khi đọc được từ ảnh/nguồn đáng tin; mặc định để `null`. KHÔNG suy từ số đo cơ thể user (sẽ tạo điểm fit giả). Item thiếu measurements được engine chấm fit 0.5 trung tính — an toàn.
  - **`tags`** — chỉ phục vụ UI/filter, KHÔNG feed engine (engine tự suy style tags từ type/color/material)

> **Lưu ý compatibility:** Mọi giá trị enum (`type`, `color`, `material`, `fit`, `pattern`, `warmth_season`) PHẢI nằm đúng trong Controlled Vocabulary ở cuối file. Engine normalize qua map cứng — sai chữ là tín hiệu rơi về default *âm thầm*, không báo lỗi. AI phải xuất đúng giá trị enum, không xuất văn xuôi tự do.
- Với mỗi object, call 1 API song song đến nano banana 2 với 2 param : ảnh reference ( ảnh gốc mà user đưa ) + miêu tả đặc trưng item đó trên hình để nano banana 2 có thể extract được
E.g "Hãy gen lại hình ảnh {} mà user đang mặc trong tấm hình, có màu {}. Item gen ra phải đặt trên nền trắng và không dính kèm bất cứ item nào" với tên item và màu sắc
- Mỗi kết quả trả về của nano banana 2, ghi vào field item_image của object JSON tương ứng của item đó.
- Sau khi toàn bộ item đã được gen hết, trả về array of JSON đó cho client app

## Note

- Có thể thêm meta data từ user input vào làm enrich thêm prompt, để cho model hiểu rõ context và cách gen, extract item. Nên phải chú ý về prompt injection ở đây.
- Nhớ là JSON data và image phải match nhau lúc trả về response, để app có thể sắp xếp item image vào đúng ô item đó, đồng thời auto fill data đúng.
- Ảnh gen ra fix ở 1K chất lượng để có thể scale vào outfit card trên home screen.
- Nếu item có logo, cần extract thêm thông tin về logo: có logo hay không, kích thước logo (nhỏ / vừa / lớn), loại (brand logo / slogan text / graphic), và OCR text nếu đọc được. Đây là tín hiệu cho statement strength của item. **MVP:** vẫn extract & lưu, nhưng CHƯA feed vào engine (engine hiện chưa có cột graphics; chỉ suy từ keyword trong `name`). Để dành dùng sau khi engine thêm cột graphics.

## Controlled Vocabulary (engine reads these — phải khớp tuyệt đối)

Nguồn sự thật: `supabase/functions/generate-outfits/engine/enrichment.ts`. Engine chỉ `SELECT` các cột: `type, name, color, material, fit, pattern, warmth_season` + measurements (`m_*`). Cột khác (brand, size, occasion_tags, piece_role, ...) engine KHÔNG đọc.

- **`type`** (40 giá trị, UPPERCASE):
  `TEE, POLO, KNIT, SHIRT, BLOUSE, VEST, SWEATER, CARDIGAN, HENLEY, JACKET, BLAZER, COAT, HOODIE, PARKA, OVERCOAT, JEANS, TROUSERS, CHINOS, SHORTS, SKIRT, DRESS, JUMPSUIT, OVERALLS, GOWN, LOAFERS, SNEAKERS, BOOTS, HEELS, SANDALS, OXFORDS, MULES, BAG, BELT, SCARF, WATCH, CAP, NECKLACE, SUNGLASSES, HAT, RING, BRACELET`

- **`color`** (37 tên, Title Case):
  `White, Cream, Ivory, Beige, Sand, Stone, Dove, Tan, Camel, Gold, Mustard, Ochre, Yellow, Orange, Rust, Terracotta, Burgundy, Wine, Red, Pink, Purple, Olive, Green, Sage, Forest, Emerald, Teal, Blue, Indigo, Navy, Slate, Grey, Charcoal, Black, Brown, Multicolor, Natural`

- **`material`** (boost chỉ kích hoạt với các giá trị này, Title Case):
  `Cotton, Wool, Linen, Silk, Cashmere, Denim, Leather, Suede, Nylon, Polyester, Canvas, Corduroy, Tweed, Flannel, Jersey, Fleece, Velvet`

- **`fit`** (chuẩn hoá về 5 nhóm — chấp nhận các alias sau):
  `slim | fitted | skinny`, `regular | standard | classic`, `relaxed | comfort | loose`, `wide | wide-leg`, `oversized | boxy`

- **`pattern`** (alias hợp lệ):
  `solid`, `striped | stripe`, `plaid | houndstooth | tartan`, `checked | checkered | check | gingham`, `floral`, `graphic`, `print | abstract | camo | polka dot`

- **`warmth_season`** (CHỈ 4 giá trị — không dùng tên mùa "Summer"...):
  `lightweight_summer | midweight_transitional | warm_winter | all_season`

- **`measurements`** (cm, đều optional, để `null` nếu không chắc): các cột engine đọc:
  `m_chest, m_shoulder_width, m_sleeves, m_body_length, m_upper_arm, m_waist, m_hip, m_inseam, m_thigh, m_rise`

