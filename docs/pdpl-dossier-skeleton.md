# Khung hồ sơ PDPL điền sẵn cho MIEN (2026-10-11)

Hai hồ sơ theo NĐ 356/2025: (1) Đánh giá tác động xử lý dữ liệu, Điều 19, báo cáo Mẫu số 10, thông báo Mẫu 02a/02b; (2) Đánh giá tác động chuyển dữ liệu ra nước ngoài, Điều 18, báo cáo Mẫu số 09, thông báo Mẫu 01a/01b. Hạn nộp: 60 ngày kể từ ngày bắt đầu xử lý / bắt đầu chuyển. Nộp Bộ Công an (chuyển Công an tỉnh, NQ 22/2026/NQ-CP). Chi tiết nguồn: `docs/compliance-pdpl-appstore-tax-2026-10.md`. Dấu `[LUẬT SƯ]` = luật sư điền/duyệt; `[ANH KHÔI]` = anh điền. Bản nháp, không phải tư vấn pháp lý.

## Phần chung (cả hai hồ sơ)

1. Bên kiểm soát: cá nhân Bùi Khôi, thương hiệu Kioh, ứng dụng MIEN (`tech.kioh.mien`), Việt Nam. Địa chỉ, CCCD, liên hệ: [ANH KHÔI]. Đã đăng ký hộ kinh doanh? [ANH KHÔI] (quyết định có hưởng miễn Điều 41 khoản 2 không).
2. Đầu mối bảo vệ dữ liệu: [ANH KHÔI] (tự đảm nhiệm), contact@kioh.tech.
3. Căn cứ pháp lý xử lý: sự đồng ý của chủ thể (Luật Điều 9), từng mục đích riêng. Dữ liệu tài khoản để thực hiện dịch vụ: [LUẬT SƯ] xác nhận có cần cơ sở khác ngoài đồng ý.
4. Bên xử lý/nhận (processor): Supabase (DB, Auth, Storage, Edge Functions); Google (Gemini API); PostHog (analytics); Sentry (crash). Hợp đồng/DPA của từng bên đính kèm: [ANH KHÔI] thu thập (Supabase DPA, Google Cloud/Gemini API Data Processing terms, PostHog DPA, Sentry DPA).

## Bảng dữ liệu theo tính năng

| Tính năng | Dữ liệu | Nơi xử lý | Trong phạm vi hồ sơ? |
|---|---|---|---|
| Số đo cơ thể (chiều cao, cân nặng, vòng) | số đo | chỉ trên thiết bị | Không: "không rời thiết bị, không nằm trong phạm vi hồ sơ" [LUẬT SƯ xác nhận cách hiểu "xử lý" on-device] |
| Đo bằng ảnh (pose) | ảnh cơ thể | chỉ trên thiết bị | Không, như trên |
| Phân tích màu da từ selfie | ảnh mặt | chỉ trên thiết bị | Không, như trên |
| Tủ đồ | ảnh món đồ, thuộc tính | Supabase Storage/DB, vùng [ANH KHÔI: xác nhận region project trtjcsxcowqecsebvyme], link ký có hạn | Có (xử lý); xuyên biên giới nếu region ngoài VN (hầu như chắc chắn) |
| Try-on | ảnh toàn thân + ảnh món đồ | Edge Function `tryon-generate` rồi Google Gemini (Mỹ/toàn cầu) | Có, cả hai hồ sơ; coi là nhạy cảm theo hướng thận trọng |
| Tài khoản | email/SĐT, user id | Supabase Auth | Có |
| Sự kiện sử dụng | event, id thiết bị | PostHog, vùng [ANH KHÔI] (US/EU?) | Có, cả hai hồ sơ |
| Lỗi/crash | stack, thiết bị | Sentry, vùng [ANH KHÔI] | Có, cả hai hồ sơ |
| Phản hồi trong app | nội dung form | [ANH KHÔI: nơi lưu] | Có |

## Hồ sơ 1 — Mẫu số 10 (xử lý), 7 nội dung theo Điều 19 khoản 3

1. Thông tin các bên: mục "Phần chung".
2. Cán bộ bảo vệ dữ liệu: [ANH KHÔI].
3. Mục đích, loại dữ liệu, hoạt động, sơ đồ luồng: bảng trên; sơ đồ luồng try-on: app, Supabase Edge Function, Gemini, trả ảnh, xoá [ANH KHÔI vẽ; xác nhận TTL thật, nội dung code `tryon-generate`].
4. Đồng ý và thời hạn lưu: đồng ý riêng cho try-on (xem `docs/tryon-consent-copy.md`); lưu trong thời gian tồn tại tài khoản; ảnh try-on đầu vào xoá sau khi sinh [xác minh]; xoá tài khoản thì xoá toàn bộ (hàm delete-user) [ANH KHÔI xác nhận phạm vi purge, gồm Storage].
5. Biện pháp an ninh: RLS theo user, bucket private + signed URL, TLS khi truyền, mã hoá at-rest của nhà cung cấp, JWT bật cho hàm người dùng, giới hạn OTP, giới hạn credit AI. Quy trình báo sự cố 72 giờ [LUẬT SƯ].
6. Kết quả tuân thủ (tự đánh giá): [LUẬT SƯ].
7. Rủi ro và giảm thiểu: bảng dưới.

## Hồ sơ 2 — Mẫu số 09 (chuyển ra nước ngoài), 9 nội dung theo Điều 18 khoản 3

1. Bên chuyển: như trên. Bên nhận: Google LLC (Gemini API), Supabase Inc. và nhà cung cấp hạ tầng đám mây [xác nhận entity và region], PostHog Inc. (US), Functional Software (Sentry, US). Đầu mối từng bên: [ANH KHÔI].
2. Mục đích, loại dữ liệu, luồng: try-on = ảnh toàn thân + ảnh món đồ tới Gemini; còn lại theo bảng.
3. Đồng ý và thời hạn lưu: như hồ sơ 1 mục 4. Với Gemini: [ANH KHÔI xác nhận thời hạn Google giữ dữ liệu API].
4. Biện pháp sau chuyển: điều khoản không huấn luyện (gói trả phí Gemini API) [xác minh nguyên văn và lưu bằng chứng]; TLS; không gửi định danh dư thừa (không kèm tên, email trong request) [xác nhận code].
5. Hệ thống bên nhận: tài liệu bảo mật công khai của Google Cloud/Supabase/PostHog/Sentry (SOC 2, ISO 27001) [ANH KHÔI gom liên kết].
6. Chuyển tiếp tiếp: sub-processor của từng bên [LUẬT SƯ].
7. Tự đánh giá tuân thủ: [LUẬT SƯ].
8. Rủi ro và giảm thiểu: bảng dưới.
9. Đính kèm: hợp đồng/DPA từng bên, chính sách quyền riêng tư (đã host, contact@kioh.tech).

## Đánh giá rủi ro (khả năng x tác động, thang 1-3)

| Rủi ro | KN | TĐ | Mức | Giảm thiểu |
|---|---|---|---|---|
| Lộ ảnh toàn thân/mặt (lỗi RLS, link ký lộ) | 1 | 3 | 3 | RLS, signed URL ngắn hạn, xoá ảnh đầu vào sau khi sinh |
| Tái định danh khuôn mặt từ ảnh/kết quả | 2 | 3 | 6 | Chỉ gửi khi đã đồng ý; không giữ ảnh gốc lâu; không dùng nhận diện |
| Bên nhận dùng ảnh huấn luyện mô hình | 1 | 3 | 3 | Gemini API gói trả phí: điều khoản không huấn luyện [xác minh]; không dùng gói miễn phí cho dữ liệu người dùng thật |
| Rò dữ liệu qua analytics/crash | 2 | 1 | 2 | Không gửi ảnh/PII vào PostHog/Sentry [rà code], scrub dữ liệu |
| Người dùng rút đồng ý nhưng dữ liệu còn | 2 | 2 | 4 | Nút rút đồng ý xoá ngay, log |
| Sự cố bảo mật không báo kịp | 1 | 3 | 3 | Quy trình 72 giờ, lưu hồ sơ vi phạm |

Mức: 1-2 thấp, 3-4 trung bình, 6+ cao. Người đánh giá và điều chỉnh: [LUẬT SƯ].

## Việc trước khi nộp

- [ANH KHÔI] Xác nhận region Supabase, PostHog, Sentry; TTL ảnh try-on; phạm vi hàm xoá user.
- [LUẬT SƯ] Phân loại ảnh body/mặt (cơ bản hay sinh trắc), cá nhân không đăng ký có hưởng Điều 41 không, hồ sơ xuyên biên giới có được miễn không (văn bản Điều 41 không nêu Điều 20), mẫu 02a/02b/01a/01b cho cá nhân hay tổ chức.
- Cập nhật hồ sơ định kỳ 6 tháng nếu phải nộp (Luật Điều 22 khoản 1).
