# E2E của web-customer (Playwright)

```bash
# từ thư mục frontend/
corepack pnpm --filter @nexaticket/web-customer test:e2e
# chỉ một file
corepack pnpm --filter @nexaticket/web-customer test:e2e -- e2e/tests/public.spec.ts
```

`test:e2e` KHÔNG nằm trong `test` — `pnpm test` / turbo vẫn chỉ chạy Vitest.

## Chạy cái gì

`playwright.config.ts` dựng hai tiến trình, mỗi cái trên một cổng trống lấy lúc chạy:

| Tiến trình | Vai trò |
| --- | --- |
| `node e2e/stub-server.mjs` | Gateway giả (`/v1/**`) **và** issuer OIDC giả (`/realms/nexaticket/**`). Dữ liệu trong `fixtures/*.json`, cùng hình dạng với kiểu của `@nexaticket/ts-sdk`. Trạng thái (giữ chỗ, đơn, huỷ, trả tiền) ở bộ nhớ, về lại ban đầu bằng `POST /__reset` trước mỗi test. |
| `next dev` (web-customer) | App thật, `NEXT_DIST_DIR=.next-e2e` để không đụng `.next` của dev server bạn đang chạy. |

Biến môi trường truyền cho `next dev` đều là giá trị **chỉ dùng cho test**: `AUTH_SECRET` sinh ngẫu
nhiên mỗi lần chạy, `KEYCLOAK_ISSUER` trỏ vào máy chủ giả, client secret là chuỗi giả, không có
`REDIS_URL` (store phiên in-memory của chế độ dev). Biến đặt ở tiến trình thắng `.env.local`, nên
không secret nào trong `.env.local` được dùng.

Playwright cần Chromium build 1243 — khớp `@playwright/test@1.63.0`. Máy chưa có thì
`corepack pnpm --filter @nexaticket/web-customer exec playwright install chromium`.

### Giới hạn tài nguyên

- Chỉ MỘT `next dev` chạy cùng lúc (`workers: 1`). Playwright tự dừng cả cây tiến trình khi xong.
- Không chạy `next build` của web-customer trong lúc suite đang chạy.
- Lần đầu, `next dev` biên dịch từng route khi được mở — test đầu của mỗi route có thể mất 10–30 giây.

## Hành trình được phủ

| File | Hành trình |
| --- | --- |
| `public.spec.ts` | Trang chủ hiện sự kiện; `/events` liệt kê, tìm kiếm từ header (`q` → `query`), chip thể loại, lọc giá (`minPrice`/`maxPrice`), lọc thành phố, "Xoá tất cả", lọc thời gian (khoảng `from`/`to`); chi tiết sự kiện (địa điểm, suất theo giờ Việt Nam, hạng vé, giá, nút "Chọn chỗ" / chưa mở bán); slug lạ → 404; dữ liệu chứa HTML/script hiện thành chữ, không đoạn mã nào chạy. |
| `auth-guard.spec.ts` | Mọi route cần đăng nhập (`/booking/…`, `/me/orders`, `/me/tickets`, `/orders/…/pay`, `/orders/…/tickets`, `/account`) chuyển về `/login?returnUrl=<đích>`; trang công khai không bị chặn; trang đăng nhập có đủ nút; `returnUrl` trỏ ra ngoài bị thay bằng `/`; `/auth/start` chặn `Sec-Fetch-Site: cross-site`; `returnTo` trỏ ra ngoài vẫn quay về trong app. |
| `checkout.spec.ts` | Đăng nhập qua luồng OIDC thật của app (Authorization Code + PKCE với issuer giả) → lịch sử đơn; mua vé trọn vòng: chọn khu → giữ chỗ → đặt đơn (hai `Idempotency-Key` khác nhau) → trang thanh toán (link payOS, số tiền, đồng hồ) → giả lập webhook payOS → tự chuyển sang trang vé; huỷ đơn chưa thanh toán; ví vé. |

### Vì sao đăng nhập "thật" được mà không cần Keycloak

App không có đường tiêm phiên nào dành cho test, và suite này không thêm đường nào. Thay vào đó máy
chủ giả đóng vai một issuer OIDC: discovery, `/auth` tự đồng ý rồi trả `code` về đúng
`redirect_uri` của app, `/token` kiểm PKCE và cấp `id_token` ký RS256 (khoá sinh lúc khởi động),
`/certs` phát JWKS. Auth.js của app đi nguyên luồng như với Keycloak; gateway giả chỉ nhận access
token do chính issuer giả cấp, nên một trang lỡ gọi API không kèm token sẽ nhận 401 như thật.

## Những gì KHÔNG được phủ (và cần gì để phủ)

| Hành trình | Vì sao chưa | Điều kiện để phủ |
| --- | --- | --- |
| Màn đăng nhập/đăng ký của Keycloak (form mật khẩu, quên mật khẩu, đăng ký tài khoản mới, Google IdP) | Đó là UI của Keycloak, không phải của app; issuer giả bỏ qua nó. | Keycloak dev của repo (`deploy/keycloak/nexaticket-realm.json`) đang chạy ở `KEYCLOAK_ISSUER`, một tài khoản test trong realm, và realm có IdP `google` cấu hình thật (cho nút Google). |
| Trang thanh toán của payOS | Trang bên thứ ba; link chỉ được kiểm `href`. Webhook được giả lập bằng `POST /__orders/:id/pay`. | Tài khoản sandbox payOS + payment-service thật nhận webhook ký. |
| Làm mới access token khi hết hạn / phiên bị thu hồi giữa chừng | Token giả sống 300 giây, dài hơn mọi test. | Issuer giả cấp `expires_in` rất ngắn, hoặc một endpoint test để thu hồi refresh token. |
| Cập nhật sơ đồ chỗ realtime (WebSocket) | Máy chủ giả không có realtime-gateway. | realtime-gateway thật hoặc giả. |
| Sơ đồ khán phòng vẽ bằng `SeatMapCanvas` trên trang đặt vé | Fixture cố ý không có toạ độ ghế/mặt bằng (`/floor-plan` trả 404), nên app rơi về danh sách khu — đường mua đã phủ; phần vẽ đã có unit test ở `@nexaticket/ui`. | Thêm `fixtures/floor-plans.json` khớp `FloorPlan` và toạ độ ghế trong `seat-maps.json`. |
