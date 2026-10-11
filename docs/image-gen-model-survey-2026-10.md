# Khảo sát model sinh ảnh cho MIEN (2026-10-11)

Phạm vi: job (1) tách món đồ `generate-item-image`, job (2) thử đồ `tryon-generate`. Chỉ dùng trang giá chính thức; ghi "unknown" khi không xác minh được. Chưa có phép đo thực tế nào trên ảnh của MIEN.

## 1. Bảng giá hiện hành (USD/ảnh)

| Model | Giá | Nguồn / ghi chú |
|---|---|---|
| gemini-3-pro-image | 1K/2K $0.134; 4K $0.24; batch 1K/2K $0.067, 4K $0.12; ảnh input ~$0.0011/ảnh (560 token) | https://ai.google.dev/gemini-api/docs/pricing |
| gemini-3.1-flash-image ("Nano Banana 2") | 0.5K $0.045; 1K $0.067; 2K $0.101; 4K $0.151; batch ~một nửa. Input $0.50/1M token | cùng nguồn |
| gemini-3.1-flash-lite-image | 1K $0.0336; batch $0.0168 | cùng nguồn |
| gemini-2.5-flash-image | $0.039 (1024x1024); batch $0.0195. **Trang ghi deprecated, shutdown 2026-10-02** (trang cập nhật 2026-10-09, nên cần kiểm tra còn chạy không) | cùng nguồn |
| Imagen 4 / Fast / Ultra | Không có giá trên ai.google.dev. Trang Vertex ghi 3 endpoint `imagen-4.0-*-generate-001` bị **discontinued**, thay bằng Gemini 2.5 Flash Image, khuyến nghị đổi trước 2026-06-30 | https://docs.cloud.google.com/vertex-ai/generative-ai/docs/image/overview. Trang giá Vertex không tải được nội dung, giá unknown |
| Vertex `virtual-try-on-001` | Giá unknown (không đọc được trang giá) | trang overview ở trên |
| OpenAI gpt-image-2 | Token: image in $8/1M, image out $30/1M, text in $5/1M | https://developers.openai.com/api/docs/pricing |
| gpt-image-1.5 | image in $8, out $32, text in $5 (/1M) | cùng nguồn |
| gpt-image-1 | image in $10, out $40, text in $5 (/1M) | cùng nguồn |
| gpt-image-1-mini | image in $2.50, out $8, text in $2 (/1M) | cùng nguồn |
| (OpenAI tổng) | Giá/ảnh theo quality **unknown**: trang giá chỉ trỏ tới calculator; không xác minh được số token/ảnh. Guide có ghi model `gpt-image-2.5-*` (tên trong docs, chưa có giá) | https://developers.openai.com/api/docs/guides/image-generation |
| FLUX.1 Kontext [pro] / [max] | $0.04 / $0.08 mỗi ảnh (phẳng) | https://docs.bfl.ai/quick_start/pricing |
| FLUX.2 edit | klein 4B từ $0.014; klein 9B từ $0.015; pro từ $0.045; flex từ $0.05; max từ $0.07 ("từ", tính theo megapixel, cách tính ảnh input unknown) | cùng nguồn |
| FLUX VTO (BFL) | Có trên bfl.ai/pricing nhưng giá không hiển thị | https://bfl.ai/pricing |
| fal nano-banana (/edit) | $0.0398/ảnh (relay model 2.5, cùng rủi ro deprecation) | https://fal.ai/pricing |
| fal Kling Kolors Virtual Try-On v1.5 | $0.07/lần (từ kết quả search tới trang model fal, chưa fetch trực tiếp) | https://fal.ai/models/fal-ai/kling/v1-5/kolors-virtual-try-on |
| fal FASHN try-on v1.5 / v1.6 | $0.075/lần; output chỉ 576x864 | https://fal.ai/models/fal-ai/fashn/tryon/v1.5 |
| IDM-VTON, Stability, Replicate | Không tìm được giá chính thức trong lần khảo sát này: unknown | - |

Lưu ý: ý tưởng "Gemini 2.5 Flash / Imagen" ban đầu không còn là lựa chọn an toàn: Imagen 4 đã discontinued, 2.5 Flash Image deprecated. Tầng rẻ thực tế hiện nay là **3.1 Flash Image** ($0.067, rẻ hơn Pro 50%) và **3.1 Flash Lite Image** ($0.0336, rẻ hơn 75%).

## 2. Khả năng kỹ thuật theo job

Chỉ ghi những gì đã thấy trong nguồn chính thức; còn lại unknown.

| Model | (a) Edit giữ subject | (b) Nhiều ảnh tham chiếu | (c) Chữ/logo | (d) Độ phân giải/aspect | (e) Watermark |
|---|---|---|---|---|---|
| gemini-3-pro-image | Có (đang dùng) | Có (đang dùng) | unknown (chưa đo) | 1K/2K/4K | SynthID: unknown, chưa xác minh |
| gemini-3.1-flash(-lite)-image | unknown, cùng họ API | unknown | unknown | 0.5K-4K (Flash) | unknown |
| Imagen 4 | Guide Vertex có edit + customization (subject/style), nhưng trang không nói variant nào hỗ trợ; endpoint đã discontinued | - | - | - | - |
| gpt-image-1/1.5/2 | Edit endpoint có | Có (nhiều ảnh, ví dụ 4 ảnh) | unknown | size tuỳ ý, bội của 16 (docs 2.5), cạnh tối đa 3840 | unknown |
| FLUX Kontext / FLUX.2 | Là model edit theo thiết kế (không có số liệu trong nguồn đã đọc) | Kontext: unknown; FLUX.2: giá edit có, số ảnh ref unknown | unknown | theo megapixel | unknown |
| FASHN / Kling VTO | Chỉ thử đồ, không tách món | 2 ảnh (người + đồ) | Không kiểm soát | FASHN 576x864 (thấp) | unknown |

## 3. Chất lượng/độ chính xác (edit)

- Arena image-edit (https://arena.ai/leaderboard/image-edit): có bảng Single Image Edit và Multi Image Edit (29M+ vote) nhưng WebFetch không đọc được thứ hạng. **Chưa có số liệu xếp hạng xác minh được.**
- Chỉ có tin thứ cấp: Jeff Dean nói Nano Banana Pro đứng #1 image-edit LMArena (12/2025, thứ cấp, cũ). Techsy cho rằng GPT Image 2 dẫn đầu Artificial Analysis arena (06/2026, blog, đó là text-to-image, không phải edit). Không dùng làm căn cứ quyết định.
- Không có benchmark công khai nào đo "giữ danh tính + giữ hoạ tiết áo" cho các model trên. Kết luận: **phải tự đo bằng A/B**.

## 4. Mô hình chi phí thực

Giá mỗi ảnh thành công = giá × (1 + tỷ lệ retry) + (1 + retry) × chi phí validator (V, mỗi lần sinh ảnh đều bị validator chấm; V unknown, nên bảng dưới CHƯA gồm V). Vì MIEN hoàn credit khi validator fail, mỗi lần fail vẫn đốt 1 lần sinh + 1 lần validator mà không thu được gì. Giá input ảnh nhỏ (~$0.001), bỏ qua.

| Model (1K) | Giá gốc | Retry 0% | Retry 20% | Retry 40% |
|---|---|---|---|---|
| gemini-3-pro-image (hiện tại) | 0.134 | 0.134 | 0.161 | 0.188 |
| gemini-3.1-flash-image | 0.067 | 0.067 | 0.080 | 0.094 |
| gemini-3.1-flash-lite-image | 0.0336 | 0.034 | 0.040 | 0.047 |
| FLUX.2 [pro] edit (giá "từ") | 0.045 | 0.045 | 0.054 | 0.063 |

Cách đọc: model rẻ chỉ thua nếu retry cao gấp quá mức. Flash 3.1 (nửa giá Pro) hoà vốn với Pro khi (1+r_flash) = 2 × (1+r_pro), tức ví dụ Pro retry 0% thì Flash phải retry >100%. Với Pro 20% / Flash 40%: 0.161 vs 0.094, Flash vẫn rẻ hơn 42%. Nghịch lý "rẻ mà đắt hơn" chỉ xảy ra với model rẻ hơn rất nhiều nhưng fail nặng, hoặc khi V (validator) và trải nghiệm người dùng (chờ thêm vòng) lớn so với giá sinh ảnh. Cũng cần tính chi phí gián tiếp: ảnh qua validator nhưng sai tinh tế (màu, logo) mà validator không bắt được, nên đo bằng người, không chỉ tỷ lệ validator pass.

## 5. Khuyến nghị

- Không đổi sang Imagen 4 hay 2.5 Flash Image: một cái discontinued, một cái deprecated (2026-10-02).
- Extraction: A/B **gemini-3.1-flash-image** (và Flash Lite làm nhánh phụ) so với Pro. Việc tách nền một món là bài dễ, khả năng cao tầng flash đủ dùng.
- Try-on: **giữ Pro làm mặc định**; chỉ A/B 3.1 Flash trên nhánh nhỏ (10-20% traffic) vì lỗi danh tính/hoạ tiết tốn nhiều hơn tiết kiệm.
- Đo: ΔE màu áo (CIEDE2000 so với ảnh gốc), logo đọc được (người chấm 3 mức), độ giống danh tính (cosine ArcFace, try-on), tỷ lệ pass validator, p50/p95 latency, retry/ảnh thành công.
- Cỡ mẫu: >=100 ảnh mỗi nhánh mỗi job, cùng bộ ảnh đầu vào, có ca khó (hoạ tiết, logo, đồ sáng/tối).
- Go (extraction): pass validator >= 90% của Pro, ΔE trung bình tăng <= 2, logo hỏng không tăng >5 điểm %, chi phí/ảnh thành công thấp hơn >= 30%.
- Go (try-on): giống trên cộng identity similarity không thấp hơn Pro quá 0.03; nếu không đạt thì giữ Pro.
- Cầm chắc: "flash cho extraction, giữ Pro cho try-on" là kết quả kỳ vọng, nhưng chỉ là giả thuyết cho tới khi chạy A/B.
- Chưa xác minh: SynthID và khả năng ref nhiều ảnh của nhánh flash, giá Vertex try-on, giá OpenAI/ảnh. Nên xem lại khi cần.
