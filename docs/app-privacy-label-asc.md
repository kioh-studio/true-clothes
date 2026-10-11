# App Privacy label (App Store Connect) — MIEN

Cập nhật 2026-10-11. Khớp với privacy policy trên site (mp_l1a..l1i) + `src/services/analytics.ts`.
ASC không có API: bấm tay tại App Store Connect → App Privacy.

**Tracking = NO.** Lý do: không có SDK quảng cáo, không đọc/gửi IDFA (không xin ATT), PostHog dùng distinct_id ẩn danh của riêng nó + `identify(userId)` Supabase uuid (first-party), không chia sẻ dữ liệu với data broker / ad network, không cross-app/cross-site.

## Bảng khai báo

| ASC data type | Collected? | Linked to user? | Tracking? | Purposes |
|---|---|---|---|---|
| Contact Info → Email Address | Yes | Yes | No | App Functionality |
| Contact Info → Phone Number | Yes | Yes | No | App Functionality |
| Contact Info → Name (display name) | Yes | Yes | No | App Functionality |
| Health & Fitness → Fitness | Yes | Yes | No | App Functionality |
| User Content → Photos or Videos | Yes | Yes | No | App Functionality |
| User Content → Customer Support | Yes | Yes | No | App Functionality |
| User Content → Other User Content | Yes | Yes | No | App Functionality |
| Location → Coarse Location | Yes | Yes | No | App Functionality |
| Identifiers → User ID | Yes | Yes | No | App Functionality, Analytics |
| Identifiers → Device ID | Yes | Yes | No | Analytics (xem ghi chú) |
| Purchases → Purchase History | Yes | Yes | No | App Functionality |
| Usage Data → Product Interaction | Yes | Yes | No | Analytics |
| Diagnostics → Crash Data | Yes | No | No | App Functionality |
| Diagnostics → Performance Data | Yes | No | No | App Functionality |
| Sensitive Info | **No** | — | — | — |

## Ghi chú từng dòng

- **Body measurements (height/weight/chest/waist/hip, body shape):** chọn **Health & Fitness → Fitness**. Apple định nghĩa Fitness gồm dữ liệu cơ thể/vận động; "Health" thiên về y tế/lâm sàng nên không chọn. Số đo được lưu server (bảng profiles) khi user đồng ý => tính là collected + linked. Không tick "Health" riêng.
- **Photos or Videos:** ảnh tủ đồ + ảnh try-on (ảnh chọn lưu cloud thì lên Supabase Storage). Ảnh cơ thể cho body scan xử lý 100% on-device, không gửi đi => không thuộc mục này.
- **Customer Support:** nội dung form feedback (bảng `public.feedback`, gắn `user_id`).
- **Other User Content:** chi tiết món đồ (loại, màu, brand, ghi chú), outfit đã lưu, style/colour profile (undertone, color season, palette). Gender/DOB (tuỳ chọn): khai thêm **Other Data Types** (purpose App Functionality, linked) hoặc tick Demographics không có trong list — dùng Other Data Types.
- **Coarse Location:** low-accuracy GPS hoặc city/country user tự nhập, dùng cho thời tiết.
- **User ID:** Supabase uuid; PostHog `identify(userId)` => thêm purpose Analytics.
- **Device ID:** posthog-react-native tự sinh anon distinct_id (lưu trong app storage), RevenueCat sinh app user id ẩn danh. **Không dùng IDFA, không dùng IDFV tường minh.** Khai Device ID để an toàn (linked vì sau identify, PostHog gộp với uuid); Purpose: Analytics. Không tick Tracking.
- **Purchase History:** RevenueCat (gói subscription).
- **Product Interaction:** PostHog events (onboarding_completed, item_added, outfit_saved, try_on_started, paywall_viewed, purchase_completed, feedback_submitted...). Linked vì có `identify(userId)`. Không session replay, không autocapture, props bị scrub (body/photo/PII).
- **Crash Data / Performance Data:** Sentry (`app/_layout.tsx`): `sendDefaultPii: false`, `attachScreenshot: false`, KHÔNG gọi `Sentry.setUser` (đã grep, không có) => **Not linked to user**. Performance Data: chỉ khai nếu bật tracing; hiện không set `tracesSampleRate` nên có thể bỏ dòng này — giữ lại cũng không sai (chỉ thừa).
- **Sensitive Info = NO.** Undertone/colour season/palette KHÔNG nằm trong danh sách Sensitive của Apple (racial/ethnic, sexual orientation, pregnancy, disability, religion, political, genetic, biometric...). Body scan không tạo template sinh trắc học gửi đi, dữ liệu ở on-device. Nếu sau này đưa selfie lên server để phân tích màu da thì xem lại.

## Thứ tự bấm trong ASC

1. App Store Connect → MIEN → App Privacy → Get Started; "Do you or your third-party partners collect data?" = **Yes**.
2. Tick lần lượt: Email, Phone, Name; Fitness; Photos or Videos, Customer Support, Other User Content, Other Data Types; Coarse Location; User ID, Device ID; Purchase History; Product Interaction; Crash Data (+ Performance Data nếu muốn).
3. Với MỌI mục: "Linked to user" = **Yes** (trừ Crash/Performance = **No**); "Used for tracking" = **No**.
4. Purposes theo bảng trên (đa số App Functionality; User ID/Device ID/Product Interaction có Analytics).
5. Nhập Privacy Policy URL = trang `/products/mien/privacy` trên site Kioh → Publish. Xong xoá mục backlog.
