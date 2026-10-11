# Màn đồng ý try-on đám mây — bản nháp copy (2026-10-11)

Căn cứ: Luật 91/2025/QH15 Điều 9 (khoản 2: tự nguyện, biết loại dữ liệu/mục đích/bên xử lý/quyền; khoản 4a: theo từng mục đích; 4d: im lặng không là đồng ý), Điều 10 (rút đồng ý); NĐ 356/2025 Điều 6 khoản 3 (cấm mặc định đồng ý) và khoản 4 (báo rõ dữ liệu nhạy cảm). Bản nháp, cần luật sư duyệt. Chưa thêm vào `en.json`/`vi.json`.

Giọng văn theo các key hiện có (`outfitDetail_tryOnGenerate` = "GENERATE ON YOU"; nút IN HOA, câu thân ngắn có dấu chấm, VI dùng "bạn", "Vui lòng").

## Yêu cầu bắt buộc, đối chiếu

| Yếu tố | Nằm ở câu |
|---|---|
| Mục đích | "dựng ảnh thử đồ" |
| Loại dữ liệu + có thể coi là nhạy cảm/sinh trắc | "ảnh toàn thân/khuôn mặt ... có thể được xem là dữ liệu nhạy cảm" |
| Bên nhận | Google (Gemini) |
| Nước nhận | ngoài Việt Nam |
| Lưu trữ/xoá | xoá ngay sau khi dựng xong [ANH KHÔI xác nhận TTL thực tế] |
| Rút đồng ý | Cài đặt, nút có sẵn |
| Hậu quả từ chối | tính năng không dùng được, phần còn lại không ảnh hưởng |
| Hành động chủ động | checkbox KHÔNG tick sẵn, nút chính bị khoá tới khi tick |

## English

Title: `Your photo, your call.`

Body (96 words):
To generate this look on you, MIEN sends your full-body photo and the garment image to Google (Gemini), which processes them on servers outside Vietnam. Your photo may be treated as sensitive personal data, including biometric data. Used only to create this image. Deleted from our servers once it is ready [verify]. Google does not train its models on it [verify: paid tier terms]. You can withdraw consent anytime in Settings and request deletion. If you decline, try-on stays unavailable. Everything else in MIEN works as before.

Checkbox (unchecked): `I agree to send my photo to Google, outside Vietnam, for this purpose.`
Buttons: `AGREE AND CONTINUE` (disabled until checked) / `NOT NOW`

Settings withdraw line: `Try-on photo consent` — `Withdraw consent and delete my try-on photos.`

## Tiếng Việt

Tiêu đề: `Ảnh của bạn, bạn quyết định.`

Nội dung (khoảng 100 từ):
Để dựng bộ đồ này trên bạn, MIEN gửi ảnh toàn thân của bạn và ảnh món đồ tới Google (Gemini), xử lý trên máy chủ ngoài Việt Nam. Ảnh của bạn có thể được xem là dữ liệu cá nhân nhạy cảm, gồm cả dữ liệu sinh trắc học. Chỉ dùng để tạo ảnh này. Xoá khỏi máy chủ của chúng tôi khi ảnh hoàn tất [xác minh]. Google không dùng để huấn luyện mô hình [xác minh điều khoản gói trả phí]. Bạn có thể rút đồng ý bất cứ lúc nào trong Cài đặt và yêu cầu xoá. Nếu từ chối, tính năng thử đồ sẽ không dùng được; các phần còn lại của MIEN vẫn hoạt động bình thường.

Checkbox (không tick sẵn): `Tôi đồng ý gửi ảnh của mình tới Google, ngoài Việt Nam, cho mục đích này.`
Nút: `ĐỒNG Ý VÀ TIẾP TỤC` (khoá tới khi tick) / `ĐỂ SAU`

Dòng Cài đặt: `Đồng ý dùng ảnh thử đồ` — `Rút đồng ý và xoá ảnh thử đồ của tôi.`

## Key đề xuất (chưa thêm)

```
tryon_consent_title
tryon_consent_body
tryon_consent_checkbox
tryon_consent_agree
tryon_consent_decline
tryon_consent_settingsLabel
tryon_consent_settingsWithdraw
```

## Ghi chú triển khai cho luật sư và anh Khôi

- Đồng ý phải lưu bằng chứng có thể kiểm chứng (NĐ 356 Điều 6 khoản 1): ghi `consent_version`, thời điểm, user id vào bảng server; đổi nội dung thì tăng version và hỏi lại.
- Rút đồng ý theo luật là "bằng văn bản, kể cả điện tử" (Luật Điều 10 khoản 2): nút trong Cài đặt đủ nếu có log; xử lý trong 15 ngày (NĐ 356), nên xoá ngay lập tức.
- Dòng "Google không huấn luyện" chỉ giữ nếu đã xác minh điều khoản gói trả phí Gemini API; nếu chưa chắc thì bỏ câu đó (không hứa sai).
- Cần kèm liên kết Chính sách quyền riêng tư dưới nút (không tính vào 120 từ).
- Nếu có nhập mặt thật dán lên (face composite), dữ liệu khuôn mặt càng gần sinh trắc; xác nhận với luật sư trước khi bật.
