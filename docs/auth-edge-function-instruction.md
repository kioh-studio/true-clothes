# Instruction: gom toàn bộ login/OTP về edge function `auth`

Ngày: 2026-08-30. Thiết kế: Opus (theo hướng anh Khôi chốt). Execute: Sonnet 5.
Thay thế `docs/demo-signin-instruction.md` (bản cũ chỉ làm riêng demo — phạm vi sai, đã xoá).

## Mục tiêu

MỘT edge function cho mọi đăng nhập. Client không gọi `sb.auth.*` cho login nữa.
Function chỉ **gọi lại đúng những hàm Supabase Auth mà client đang gọi** — không tự làm auth.
Khác biệt duy nhất: email nằm trong demo whitelist thì không đi qua OTP thật của Supabase, mà
đối chiếu với OTP riêng của chính email đó trong whitelist (map `email:OTP`) rồi đăng nhập bằng
password. Không có auto pass.

Lợi ích: credential demo rời khỏi bundle; một chỗ duy nhất để log/chặn abuse sau này.

## Nguyên tắc

1. **Function KHÔNG tự làm auth.** Không sinh JWT, không hash password, không quản session,
   không user table riêng. Nó gọi `signInWithOtp` / `verifyOtp` / `signInWithPassword` của
   Supabase Auth và trả session Supabase cấp về NGUYÊN VẸN.
2. **Giữ nguyên chữ ký 4 hàm trong `authService.ts`** (`sendPhoneOtp`, `sendEmailOtp`,
   `verifyPhoneOtp`, `verifyEmailOtp`) — chỉ thay RUỘT từ `sb.auth.*` sang gọi edge function.
   Nhờ vậy `authStore.ts` gần như không phải sửa. Diff nhỏ nhất có thể.
3. Gặp chỗ mơ hồ thì HỎI, đừng tự mở rộng phạm vi.

## Bẫy phải xử lý ngay từ đầu: `Sb-Forwarded-For`

Supabase Auth rate-limit `verifyOtp` ở mức **360 request/giờ mỗi IP, burst 30, KHÔNG chỉnh
được**. Khi mọi login đi qua edge function, Supabase thấy tất cả user chung một IP → toàn app
dùng chung 360/giờ, và 30 người verify cùng lúc là chạm trần. Triệu chứng khi vỡ trông như
"Supabase hỏng", rất khó lần ra.

Cách xử lý (cơ chế chính thức của Supabase cho kiến trúc proxy):

- Function phải gửi header **`Sb-Forwarded-For`** = IP client thật, lấy từ
  `req.headers.get('x-forwarded-for')?.split(',')[0].trim()`.
- Supabase Auth **KHÔNG** honor `X-Forwarded-For` — phải đúng tên `Sb-Forwarded-For`.
- Header này phải được **bật riêng trong dashboard/Management API** và cần secret key để xác
  thực. **Việc bật là của anh Khôi, KHÔNG chặn task này** — cứ gửi header; nếu chưa bật thì
  Supabase bỏ qua nó, không hỏng gì, chỉ là rate limit vẫn gộp chung IP cho tới khi bật. Nhắc
  lại điều này trong phần báo cáo cuối để anh Khôi không quên bật trước khi có user thật.

Có `Sb-Forwarded-For` rồi thì **KHÔNG tự viết rate limiter trong function** — để Supabase Auth
lo. Ít code hơn, và đó là chỗ vốn đã làm việc này đúng.

## 1. File mới: `supabase/functions/auth/index.ts`

Convention: theo `supabase/functions/delete-user/index.ts` (corsHeaders, `Deno.serve`, nhánh
OPTIONS, `createClient` từ `https://esm.sh/@supabase/supabase-js@2`). Dispatch theo đuôi path,
giống cách `voci/supabase/functions/subscription` làm nhiều route trong một function.

**Routes** (method khác POST → 405, path lạ → 404):

- `POST /functions/v1/auth/send-otp`   body `{ phone?: string, email?: string }`
- `POST /functions/v1/auth/verify-otp` body `{ phone?: string, email?: string, code: string }`

**Client dùng:** anon client, KHÔNG service_role (function này không cần quyền admin):

```ts
createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
  global: { headers: { 'Sb-Forwarded-For': clientIp } },
})
```

Tạo client MỚI cho mỗi request (vì `Sb-Forwarded-For` khác nhau mỗi request) — đừng dùng
client dựng sẵn ở module scope.

**Secrets (`Deno.env`):**

- `DEMO_WHITELIST` — **bắt buộc**. Map `email:OTP`, các cặp phân tách bằng dấu phẩy:
  `demo@mien.app:123456,demo-woman@mien.app:654321`. MỖI email demo có OTP RIÊNG. Không có
  chuyện auto pass: email nằm trong whitelist mà OTP không khớp cặp của chính nó → 401.
  Parse: tách theo `,` → tách theo `:` LẦN ĐẦU TIÊN (`indexOf(':')`, không phải `split(':')`,
  phòng khi OTP chứa dấu hai chấm). Email `trim().toLowerCase()`, OTP chỉ `trim()`.
  Cặp sai định dạng (thiếu `:`, email rỗng, OTP rỗng) → bỏ qua cặp đó + `console.error`,
  KHÔNG làm sập cả function. Whitelist rỗng sau khi parse → 500.
- `DEMO_PASSWORD` — bắt buộc. Dùng chung cho mọi tài khoản demo (khớp hiện trạng).
- `DEMO_PHONE` — tùy chọn, mặc định `+84000000000`. Đăng nhập bằng số này thì map sang cặp
  ĐẦU TIÊN trong `DEMO_WHITELIST` (khớp hành vi hiện tại: `pendingPhone === DEMO_PHONE` →
  `DEMO_ACCOUNTS[0]`), và vẫn phải khớp OTP của cặp đó.

**`send-otp`:**

1. Parse body. Không có cả `phone` lẫn `email` → 400.
2. Là demo (email hoặc phone khớp whitelist, so sánh sau khi `trim().toLowerCase()`)?
   → trả `200 { ok: true }` NGAY, KHÔNG gửi gì. Demo không có OTP thật để gửi.
3. Không phải demo → `auth.signInWithOtp({ phone | email, options: { shouldCreateUser: true } })`,
   giữ nguyên tham số client đang dùng hôm nay. Lỗi → trả nguyên `error.message` (đây là luồng
   user thật, message của Supabase là thứ user cần đọc).

**`verify-otp`:**

1. Parse body. Thiếu `code` → 400.
2. Là demo (email ∈ `DEMO_WHITELIST`, hoặc phone === `DEMO_PHONE` → lấy cặp đầu tiên)?
   - `code !== <OTP của chính cặp đó>` → 401 `{ error: 'Invalid demo credentials' }`.
     KHÔNG được so `code` với OTP của cặp khác — mỗi email chỉ mở bằng OTP của nó.
   - Khớp → `auth.signInWithPassword({ email: <email của cặp>, password: DEMO_PASSWORD })`.
3. Không phải demo → `auth.verifyOtp({ phone|email, token: code, type: 'sms' | 'email' })`.
4. Thành công → `200 { access_token, refresh_token, expires_at, isDemo }` lấy từ `data.session`.
   Thất bại → trả `error.message` của Supabase với status tương ứng.

**Logging:** không bao giờ log `code`, `DEMO_PASSWORD`, `access_token`, `refresh_token`.
Log được: route, có phải demo không, mã lỗi, email/phone (không phải secret).

## 2. Client

### `src/services/authService.ts`

- 4 hàm `sendPhoneOtp` / `sendEmailOtp` / `verifyPhoneOtp` / `verifyEmailOtp`: **GIỮ NGUYÊN
  tên và tham số**, đổi ruột sang
  `sb.functions.invoke('auth/send-otp' | 'auth/verify-otp', { body })`.
- Hai hàm `verify*` sau khi nhận session phải gọi
  `sb.auth.setSession({ access_token, refresh_token })`; `setSession` lỗi cũng trả `{ ok:false }`.
- Kiểu trả về: mở rộng `AuthResult` để nhánh `ok: true` có thêm `isDemo?: boolean`.
- XOÁ `signInWithPassword` (không còn ai gọi).
- `toE164`, `getCurrentUserId`, `signOut`: giữ nguyên, không đụng.

### `src/config/demo.ts`

- XOÁ `DEMO_PASSWORD` và `DEMO_OTP` (giờ là secret của function).
- GIỮ `DEMO_PHONE`, `DEMO_EMAIL`, `DEMO_ACCOUNTS`, `findDemoAccount`, `DEMO_PROFILE`,
  `DEMO_PROFILE_WOMAN` — dữ liệu công khai, client vẫn cần để áp profile sau khi login demo.
  Không phải secret nên giữ lại không vi phạm mục tiêu.
- Sửa comment đầu file cho khớp: credential giờ nằm ở edge function `auth`.

### `src/stores/authStore.ts`

- Import: bỏ `DEMO_OTP`, `DEMO_PASSWORD`, `signInWithPassword`.
- Trong `verifyOtp`: **XOÁ HẲN nhánh demo bypass ở đầu hàm.** Giờ gọi
  `verifyEmailOtp`/`verifyPhoneOtp` như user thường cho MỌI trường hợp — server tự phán.
- Sau khi verify thành công, nếu kết quả có `isDemo === true` thì mới chạy phần áp profile demo
  hiện có (`markOnboardingComplete` + `updateMyProfile(userId, demoAcct.profile)` +
  `hydrateProfile`), với `demoAcct` tra bằng `findDemoAccount`/`DEMO_PHONE` như cũ. Không phải
  demo → chạy nhánh `updateMyProfile` thường như hiện tại.
- Bỏ nhánh `if (!DEMO_PASSWORD) ... authStore_demoNotConfigured`. Grep key
  `authStore_demoNotConfigured`; nếu không còn ai dùng thì xoá khỏi cả `en.json` và `vi.json`.
  Giữ `authStore_demoSignInFailed`.

### `eas.json`

XOÁ `EXPO_PUBLIC_DEMO_PASSWORD` khỏi CẢ BA profile (`development`, `preview`, `production`).

### `.env`

Xoá dòng `EXPO_PUBLIC_DEMO_PASSWORD` nếu có (file không nằm trong git — báo lại, đừng im lặng).

## 3. Check phải để lại

- `supabase/functions/auth/index_test.ts` — `deno test` cho phần CÓ NHÁNH; tách các hàm đó ra
  `export` để test không cần dựng HTTP server:
  - parse `DEMO_WHITELIST`: nhiều cặp, khoảng trắng thừa, cặp hỏng bị bỏ qua mà không sập,
    OTP chứa dấu `:` vẫn parse đúng;
  - phân giải demo: email khớp / khác hoa-thường / có khoảng trắng / phone demo / email lạ;
  - **OTP phải đúng CẶP**: OTP của `demo-woman@` không mở được `demo@` và ngược lại — đây là
    test quan trọng nhất, nó chính là thứ phân biệt thiết kế này với auto-pass;
  - lấy client IP từ `x-forwarded-for` nhiều giá trị (`"1.2.3.4, 5.6.7.8"` → `1.2.3.4`).

  KHÔNG test phần gọi Supabase Auth — đó là code của Supabase.
- `npx jest` và `npx tsc --noEmit` phải xanh. Mốc trước khi sửa: **602/602 pass, tsc sạch**.
  Test giảm thì phải giải thích được vì sao.

## 4. Deploy — anh Khôi tự chạy, KHÔNG tự động chạy

```
npx supabase secrets set \
  DEMO_PASSWORD='<mật khẩu demo hiện tại>' \
  DEMO_WHITELIST='demo@mien.app:<otp1>,demo-woman@mien.app:<otp2>' \
  --project-ref trtjcsxcowqecsebvyme
npx supabase functions deploy auth --no-verify-jwt --project-ref trtjcsxcowqecsebvyme
```

`--no-verify-jwt` là **BẮT BUỘC**: đây là endpoint pre-auth, chưa có JWT nào để verify. Thiếu
cờ này thì Supabase chặn thẳng mọi request và triệu chứng nhìn y như function hỏng.

Hai OTP demo là giá trị anh Khôi tự chọn lúc set secret, không nằm trong code. Đưa cho Apple
reviewer qua App Store Connect review notes. Đổi OTP sau này = set lại secret, không đụng code.

## 5. Ngoài phạm vi — đừng làm

- Đổi `DEMO_LIMITS` / `consume_usage_credit` — hạn mức chi tiêu demo đã vá 2026-08-11.
- Reset wardrobe seeded mỗi phiên demo — vấn đề khác, chưa chốt, nằm ở backlog.
- Đụng `signOut`, refresh token, hay bất cứ luồng auth nào ngoài 4 hàm nêu trên. Refresh token
  vẫn đi THẲNG từ client tới Supabase, không qua function — đúng như vậy, đừng "gom nốt cho
  đồng bộ".
