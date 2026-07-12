# Feature Specification: Wardrobe Critic — Gap Analysis

**Feature Branch**: `010-wardrobe-critic`

**Created**: 2026-07-03

**Status**: Draft

**Input**: User description: "Wardrobe Critic — gap analysis tủ đồ như một stylist thật. MIEN phân tích tủ đồ hiện tại của user và (1) chỉ ra khoảng trống cấu trúc: món nền tảng đang thiếu khiến nhiều combo không thể tồn tại, (2) lượng hóa giá trị mỗi gợi ý bằng số outfit MỚI nó mở khóa — chạy thử outfit engine với item giả định, so số outfit đạt chuẩn trước/sau, (3) trình bày như lời khuyên stylist ngắn gọn theo thẩm mỹ MIEN, không phải danh sách mua sắm. Liên kết try-before-you-buy: từ gợi ý gap đi tới Try-On scan khi mua sắm."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Xem báo cáo khoảng trống tủ đồ (Priority: P1)

Là một người dùng đã có tủ đồ trong MIEN, tôi muốn được "stylist của app" chỉ ra những
món nền tảng tôi đang thiếu — kèm bằng chứng cụ thể là mỗi món sẽ mở khóa bao nhiêu
outfit mới đạt chuẩn — để tôi biết lần mua sắm tiếp theo nên nhắm vào đâu thay vì mua
cảm tính.

**Why this priority**: Đây là giá trị lõi của feature — không có báo cáo gap thì không
có gì để hành động. Một mình nó đã là MVP dùng được.

**Independent Test**: Với một tủ đồ mẫu ~30 món cố tình thiếu giày trang trọng, mở
Wardrobe Critic → nhận được gợi ý "một đôi loafers da tối màu" với số outfit mở khóa
> 0, lời khuyên bằng giọng stylist, không nhắc thương hiệu.

**Acceptance Scenarios**:

1. **Given** tủ đồ ≥ 10 món có khoảng trống cấu trúc rõ (ví dụ không có giày nào formality cao), **When** user mở Wardrobe Critic, **Then** hiển thị tối đa 3 gợi ý xếp theo số outfit mở khóa giảm dần, mỗi gợi ý gồm: archetype món đồ (loại + họ màu + register — KHÔNG phải sản phẩm/thương hiệu cụ thể), số outfit MỚI đạt chuẩn được mở khóa, và một câu lời khuyên stylist (vi/en theo ngôn ngữ app).
2. **Given** một gợi ý nói "mở khóa N outfit mới", **When** user thêm một món đúng archetype đó vào tủ và feed được tạo lại, **Then** có ít nhất N outfit đạt chuẩn SỬ DỤNG món mới đó (con số là lời hứa thật, không phải ước lượng trang trí), và gợi ý đó biến mất khỏi báo cáo (đã sở hữu). *(Chỉnh câu chữ 2026-07-03 khớp research.md D2: "tổng số đạt chuẩn tăng N" là bất khả thi cấu trúc vì feed có trần xếp hạng; lời hứa đúng là N look dùng món đó.)*
3. **Given** tủ đồ đã cân bằng (không archetype nào mở khóa thêm đáng kể), **When** user mở Wardrobe Critic, **Then** hiển thị trạng thái "tủ đồ đã tròn" bằng giọng MIEN — tuyệt đối không bịa ra gợi ý yếu chỉ để có nội dung.

---

### User Story 2 - Từ gợi ý đến hành động mua sắm (Priority: P2)

Là người dùng đã thấy gợi ý gap, khi đi mua sắm tôi muốn đi tiếp từ gợi ý sang việc
kiểm chứng món đồ thật: mở luồng Try-On scan để xem món tôi đang cầm trên tay có đúng
là "mảnh ghép" được gợi ý không (khớp hướng try-before-you-buy).

**Why this priority**: Biến insight thành hành vi — cầu nối trực tiếp tới vòng lặp
Try-On đã có, tăng giá trị cả hai feature.

**Independent Test**: Từ một gợi ý gap, tap hành động "thử khi mua sắm" → vào thẳng
luồng Try-On scan; sau khi scan một món khớp archetype, kết quả đánh giá có nhắc rằng
món này lấp khoảng trống đã gợi ý.

**Acceptance Scenarios**:

1. **Given** một gợi ý gap đang hiển thị, **When** user chọn hành động đi kèm, **Then** luồng Try-On scan mở ra và gợi ý gốc được ghi nhớ để đối chiếu.
2. **Given** user đã scan một món khớp archetype của gợi ý, **When** xem kết quả Try-On, **Then** kết quả nêu rõ món này khớp khoảng trống nào và giữ nguyên số outfit mở khóa thực tế của chính món vừa scan.
3. **Given** user không muốn theo một gợi ý, **When** user bỏ qua (dismiss) nó, **Then** gợi ý đó không xuất hiện lại cho đến khi tủ đồ thay đổi đáng kể.

---

### User Story 3 - Nhận diện dư thừa (Priority: P3)

Là người dùng, tôi muốn stylist cũng nói thật về phần dư: "anh đã có 9 chiếc tee trắng —
chiếc thứ 10 không mở thêm outfit nào", để tôi tránh mua lặp.

**Why this priority**: Hoàn thiện vai "critic" hai chiều (thiếu + thừa), nhưng đứng sau
gap vì không dẫn tới hành động mua có giá trị ngay.

**Independent Test**: Với tủ đồ có ≥ 5 món gần trùng nhau (cùng loại + họ màu + register),
báo cáo có một mục "dư thừa" nêu đúng cụm đó.

**Acceptance Scenarios**:

1. **Given** tủ đồ có một cụm ≥ 5 món gần trùng, **When** user mở báo cáo, **Then** phần dư thừa nêu cụm đó với số lượng chính xác và một câu khuyên nhẹ nhàng (không phán xét).

---

### Edge Cases

- Tủ đồ quá thưa (< 10 món hoặc thiếu hẳn một slot lõi top/bottom/giày): critic chuyển sang chế độ "khởi đầu" — gợi ý bộ khung capsule tối thiểu thay vì phân tích gap (phân tích unlock không có nghĩa khi chưa đủ nền).
- Tủ đồ trống: dẫn về luồng thêm item đầu tiên, không hiển thị báo cáo.
- User có nhiều style profile được chọn: gợi ý phải phục vụ các style ĐÃ chọn, không đề xuất archetype lệch hẳn gu (một gợi ý "blazer" cho user thuần streetwear là sai).
- Item thiếu metadata (màu/chất liệu chưa có): phân tích vẫn chạy trên phần dữ liệu thật; không phóng đại unlock count từ dữ liệu đoán.
- Mọi gợi ý phải khác archetype với TẤT CẢ món user đang có (không bao giờ khuyên mua thứ đã sở hữu).
- Offline / lỗi mạng: hiển thị báo cáo gần nhất đã lưu kèm dấu thời gian; không màn hình lỗi trắng.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Hệ thống PHẢI phân tích tủ đồ hiện tại và tạo tối đa 3 gợi ý khoảng trống, xếp theo số outfit mới mở khóa giảm dần; chỉ hiển thị gợi ý có unlock count vượt ngưỡng tối thiểu (mặc định ≥ 3 outfit mới).
- **FR-002**: Mỗi gợi ý PHẢI ở mức archetype — loại món + họ màu + register (ví dụ "một sơ mi trắng đứng dáng") — KHÔNG phải sản phẩm, thương hiệu, hay link mua cụ thể.
- **FR-003**: Unlock count PHẢI được tính bằng chính chuẩn chất lượng của feed hằng ngày (một outfit "đạt chuẩn" trong báo cáo = đạt chuẩn trên feed), bằng cách mô phỏng tủ đồ có thêm món giả định và so số outfit đạt chuẩn trước/sau.
- **FR-004**: Mỗi gợi ý PHẢI kèm một câu lời khuyên giọng stylist MIEN (tiết chế, không phán xét, không giọng bán hàng), sẵn cả tiếng Việt và tiếng Anh.
- **FR-005**: Báo cáo PHẢI được tính lại khi tủ đồ thay đổi (thêm/xóa/sửa item) và được lưu lại để mở tức thì giữa các lần thay đổi.
- **FR-006**: User PHẢI bỏ qua (dismiss) được từng gợi ý; gợi ý bị bỏ qua không xuất hiện lại cho đến khi tủ đồ thay đổi đáng kể (mặc định: có item thêm/xóa).
- **FR-007**: Từ một gợi ý, user PHẢI đi được tới luồng Try-On scan, và kết quả scan của món khớp archetype PHẢI đối chiếu ngược lại gợi ý gốc.
- **FR-008**: Với tủ đồ thưa (< 10 món hoặc thiếu slot lõi), hệ thống PHẢI chuyển sang gợi ý khung capsule khởi đầu thay vì báo cáo gap.
- **FR-009**: Báo cáo PHẢI có nhà riêng là mục "Wardrobe Report" trong tab Menu (đầy đủ), VÀ một card gọn ở cuối feed hằng ngày dẫn vào báo cáo đầy đủ — card chỉ hiện khi báo cáo có ít nhất một gợi ý đang mở. *(Chốt bởi anh Khôi 2026-07-03.)*
- **FR-010**: Free tier thấy gợi ý #1 (đầy đủ nội dung — teaser bằng giá trị thật); paid tier mở cả 3 gợi ý + phần dư thừa (US3). Gating hiển thị nhất quán với mô hình curator paid hiện có. *(Chốt bởi anh Khôi 2026-07-03.)*
- **FR-011**: Gợi ý PHẢI tôn trọng style profile user đã chọn — archetype đề xuất phải hợp lệ với ít nhất một style đã chọn.

### Key Entities

- **WardrobeGapReport**: Báo cáo một lần phân tích — thời điểm tạo, trạng thái tủ đồ lúc phân tích, danh sách gợi ý, phần dư thừa (nếu có), trạng thái "tủ đã tròn" hoặc "chế độ khởi đầu".
- **GapRecommendation**: Một gợi ý — archetype (loại, họ màu, register), unlock count, lời khuyên stylist (vi/en), trạng thái (đang hiện / đã bỏ qua / đã lấp), liên kết tới lần Try-On đối chiếu (nếu có).
- **HypotheticalItem**: Món giả định dùng trong mô phỏng — mang đủ thuộc tính như một item thật để engine xử lý y hệt, nhưng không bao giờ xuất hiện trong tủ đồ của user.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Với tủ đồ đại diện 20–40 món có khoảng trống thật, báo cáo tìm ra ít nhất 1 gợi ý có unlock count ≥ 5 outfit mới.
- **SC-002**: 100% gợi ý giữ đúng lời hứa: thêm món đúng archetype vào tủ rồi tạo lại feed cho ra ít nhất `unlock count` outfit đạt chuẩn CHỨA món mới, và gợi ý tương ứng rời khỏi báo cáo. *(Câu chữ chỉnh 2026-07-03 — xem research.md D2.)*
- **SC-003**: 0 gợi ý trùng archetype với món user đã sở hữu, và 0 gợi ý lệch style profile đã chọn (kiểm trên bộ tủ đồ mẫu).
- **SC-004**: Báo cáo mở trong ≤ 5 giây khi tính mới, tức thì khi đã lưu.
- **SC-005**: ≥ 30% user mở báo cáo tương tác với ít nhất một gợi ý (xem chi tiết, đi tới Try-On, hoặc dismiss có chủ đích) trong 30 ngày đầu ra mắt.

## Assumptions

- Gợi ý ở mức archetype, không tích hợp catalog/affiliate mua sắm nào trong phạm vi này (hướng "shop recommendations" trong roadmap là feature tương lai riêng).
- Bộ archetype ứng viên để mô phỏng là danh sách tuyển chọn hữu hạn (vài chục archetype nền tảng phổ quát theo từng style), không phải không gian vô hạn — đủ để phủ các khoảng trống cấu trúc thường gặp.
- Phân tích chạy on-demand khi user mở báo cáo + tự tính lại nền sau khi tủ đồ thay đổi; không có job định kỳ.
- Chuẩn "outfit đạt chuẩn" tái dùng nguyên trạng từ feed hằng ngày — báo cáo không định nghĩa chuẩn chất lượng riêng.
- Hạ tầng mô phỏng item giả định tái dùng cơ chế transient/pin item sẵn có của Try-On (feature 008) — món giả định đi qua đúng đường xử lý của một món scan.
- Ngôn ngữ báo cáo theo ngôn ngữ app (vi/en) như các phần nội dung stylist hiện có.
- Số gợi ý tối đa 3 mỗi báo cáo để giữ giọng stylist tiết chế (một stylist thật không đưa danh sách 10 món).
