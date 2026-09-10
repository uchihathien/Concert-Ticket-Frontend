# NexaTicket — Frontend

4 app Next.js cho nền tảng bán vé sự kiện NexaTicket.

> **Backend và toàn bộ tài liệu thiết kế nằm ở repo riêng:**
> [uchihathien/Concert-Ticket-Platform](https://github.com/uchihathien/Concert-Ticket-Platform/tree/nexaticket-v2)
>
> - [Hướng thiết kế giao diện](https://github.com/uchihathien/Concert-Ticket-Platform/blob/nexaticket-v2/docs/architecture-v2/ui-direction.md) — token, bố cục, sơ đồ chỗ ngồi
> - [Plan frontend](https://github.com/uchihathien/Concert-Ticket-Platform/blob/nexaticket-v2/docs/architecture-v2/plan/frontend.md) — kế hoạch theo màn, theo giai đoạn
> - [Kiến trúc v2](https://github.com/uchihathien/Concert-Ticket-Platform/blob/nexaticket-v2/docs/architecture-v2/README.md) — tổng quan hệ thống

## Yêu cầu

Node 20+ · pnpm 9.

Nếu `corepack enable pnpm` báo lỗi quyền (ghi vào `Program Files`), gọi trực tiếp không cần shim:

```bash
corepack pnpm install
corepack pnpm dev
```

## Chạy

```bash
pnpm install
pnpm dev          # chạy cả 4 app
pnpm build
pnpm typecheck
pnpm lint
pnpm test
```

> **Đừng chạy `pnpm build` khi `pnpm dev` còn sống.** Cả hai ghi vào cùng thư mục `.next` của
> mỗi app, nên bản build production sẽ ghi đè chunk ngay dưới chân dev server đang chạy. Triệu
> chứng là trang trắng không có CSS — thật ra đó là trang lỗi 500 của Next với
> `Cannot find module './xxx.js'`. Cách chữa: dừng dev, `rm -rf apps/*/.next`, chạy `pnpm dev` lại.
>
> Cần kiểm tra build mà không muốn dừng dev thì build ra thư mục khác:
> `cd apps/web-customer && NEXT_DIST_DIR=.next-check npx next build`. Xong nhớ `rm -rf .next-check`
> và bỏ dòng `.next-check/types/**/*.ts` mà Next tự thêm vào `tsconfig.json`.

> `turbo` gọi `pnpm` qua PATH. Nếu chỉ có `corepack pnpm` mà không có shim `pnpm`, mọi lệnh gọi
> qua turbo (`dev`, `build`, `lint`, `typecheck`, `test`) sẽ dừng ở
> `Unable to find package manager binary`. Chạy từng package bằng
> `corepack pnpm --filter @nexaticket/ui test` để đi vòng.

> Chạy cả backend lẫn frontend từ máy trắng: xem [docs/chay-local.md](docs/chay-local.md) —
> thứ tự khởi động, service nào cần cho màn nào, và các bẫy đã gặp thật.

### Dữ liệu demo cho ví vé và đơn hàng

Catalog có sẵn sự kiện mẫu, nhưng `ordering_db` và `ticketing_db` khởi đầu rỗng, nên "Vé của tôi",
"Đơn hàng của tôi" và app soát vé đều là màn trống. Sinh dữ liệu bằng:

```bash
node scripts/seed-demo-orders.mjs            # tạo 8 đơn, đơn cuối để nguyên chờ thanh toán
node scripts/seed-demo-orders.mjs --dry-run  # xem sẽ làm gì, không ghi
```

Script đi qua **API thật**: giữ chỗ → đặt đơn → xác nhận thanh toán → ticketing tự phát hành vé.
Không chèn SQL, vì vé mang chữ ký Ed25519 và số liệu analytics dựng từ sự kiện miền — chèn tay thì
máy quét từ chối hết và số liệu không bao giờ khớp.

> Chỉ dùng ở môi trường dev. Bước xác nhận thanh toán gọi thẳng `/internal/orders/{id}/confirm-payment`
> của ordering-service, endpoint cố ý không đi qua gateway.

Script cũng tự tạo khoá ký vé nếu `ticketing_db.signing_keys` còn rỗng — xem phần "Việc phía
backend" bên dưới.

### Biến môi trường

Chép `.env.example` thành `.env.local` **trong thư mục của từng app** — mỗi app là một tiến trình
Next riêng, đọc `.env.local` của chính nó, và dùng một client Keycloak riêng.

Backend cần chạy sẵn để đăng nhập và gọi API — xem hướng dẫn ở repo backend.

`AUTH_GOOGLE_ENABLED` mặc định `false`. Chỉ bật sau khi đã chạy `scripts/setup-google-idp.sh` ở
repo backend để khai identity provider `google` trong Keycloak — bật trước thì nút có hiện, nhưng
bấm vào là ra trang lỗi của Keycloak.

## Bốn app

| App            | Cổng | Persona                             | Nền     |
| -------------- | ---- | ----------------------------------- | ------- |
| `web-customer` | 3000 | Khách mua vé (mobile là kênh chính) | Sáng    |
| `web-admin`    | 3001 | Tổ chức                             | Sáng    |
| `web-scanner`  | 3002 | Nhân viên soát vé                   | **Tối** |
| `web-platform` | 3003 | Superadmin                          | Sáng    |

`web-platform` tách khỏi `web-admin` vì ranh giới tài chính là ranh giới bảo mật: nó gọi deployable `finance`, có client OIDC riêng, và không nên chạy chung bundle với app mà tổ chức dùng.

**Scanner giữ nền tối có lý do**: dùng ngoài trời buổi tối ở cửa soát vé, nền tối đỡ chói và đỡ tốn pin. Đừng "thống nhất" nó về nền sáng.

## Packages

```text
packages/
  tokens/     CSS variables — palette v2 (nền sáng, đỏ ấm #c02a2a, vàng kim #f2b705)
  brand/      logo (3 biến thể) + favicon — MỘT nguồn cho cả 4 app
  config/     tsconfig, eslint (flat), vitest dùng chung
  ui/         BrandLogo, Button, Input, Select, Table, Modal, Drawer, Toast, Badge, Skeleton,
              EmptyState, ErrorState, Countdown, CopyField, MoneyText
              + errors.ts (mã lỗi → tiếng Việt) + format.ts (VND, giờ Asia/Ho_Chi_Minh)
  ts-sdk/     ApiClient + type + hook TanStack Query cho identity / inventory / ledger
  auth/       Auth.js + Keycloak, 4 client, refresh token VÀ access token giữ phía server
              (cookie chỉ mang `refreshRef` — xem đầu file src/access-token.ts)
```

Sẽ thêm theo giai đoạn: `seatmap/` (renderer SVG dùng chung customer + admin preview).

`packages/seatmap` là điểm tái sử dụng quan trọng nhất: màn khách `C-SEATS` và màn xem trước của trình thiết kế chỗ ngồi vẽ **cùng một** cấu trúc dữ liệu. Viết hai lần là cầm chắc lệch nhau.

### `ts-sdk` chỉ bọc API đã có thật

Phạm vi hiện tại đúng bằng phần backend đã expose REST: **identity**, **inventory**, **ledger**.
`catalog`, `ordering`, `payment`, `ticketing` chưa có controller nào, nên SDK cũng chưa có gì —
cố tình để trống thay vì đoán hình dạng JSON rồi phải sửa lại khi backend chốt.

Hai chỗ SDK khác tài liệu, vì code backend mới là nguồn đúng:

- Mã lỗi thật là `HOLD_LIMIT_EXCEEDED`, `CUSTOMER_LIMIT_EXCEEDED`, `SALES_CLOSED`,
  `INVENTORY_UNAVAILABLE` — không phải `TOO_MANY_SEATS`, `PURCHASE_LIMIT_EXCEEDED`,
  `SESSION_NOT_ON_SALE`, `REDIS_UNAVAILABLE` như bảng ở plan §7. `errors.ts` nhận cả hai tên.
- `GET /v1/sessions/{id}/seats` trả `status` thô của backend (`AVAILABLE`, `HELD`, `RESERVED`,
  `SOLD`, `BLOCKED`). API **không** phân biệt "ghế của tôi" với "ghế người khác giữ"; trạng thái
  thứ sáu mà `ui-direction §6` đòi phải suy ra ở client từ lựa chọn hiện tại và từ
  `HoldCreated.seatIds`.

## Ba luật cứng

1. **Refresh token không bao giờ rời server.** Session ở cookie httpOnly do route handler quản lý.
2. **Access token không bao giờ chạm `localStorage`/`sessionStorage`** — chỉ giữ trong memory, lấy lại qua `/api/auth/token`.
3. **Sơ đồ chỗ ngồi cập nhật bằng DOM attribute, không qua React.** Delta WebSocket đổi `el.dataset.status`; màu do CSS lo. Không re-render 1.500 node cho mỗi delta.

## Hướng giao diện

Bố cục theo mô hình site bán vé Việt Nam: header ưu tiên tìm kiếm → hero xoay vòng → chip thể loại → dải sự kiện cuộn ngang → thẻ 4 dòng (ảnh, tên, ngày, giá từ).

Nền sáng, màu chính đỏ ấm `#c02a2a`, nhấn phụ vàng kim `#f2b705`, và **nội dung đặt trước thương hiệu** trên trang chủ.

> **Logo và bảng màu đang lệch nhau.** Logo dùng dải xanh lơ → xanh dương → hồng magenta, còn
> `ui-direction.md §3` chốt đỏ ấm + vàng kim. Hiện tại logo được dùng nguyên bản, không chỉnh
> màu — đây là quyết định thương hiệu, không phải quyết định kỹ thuật. Ba đường xử lý, cần chọn
> một: (1) giữ nguyên, coi logo là điểm nhấn lạnh duy nhất; (2) đổi bảng màu app theo logo; (3)
> làm bản logo đơn sắc cho header và giữ bản màu cho chỗ hiện lớn.

Luật 1 và 2 được ép ở `packages/auth`, không phải bằng quy ước:

- Refresh token nằm trong `RefreshTokenStore` phía server; cookie phiên chỉ mang một tham chiếu
  ngẫu nhiên. Mặc định là bản trong tiến trình — **chỉ đủ cho `next dev`**; production phải cắm
  store dùng chung (Redis) vào `createNexaAuth({ refreshTokenStore })`.
- Session trả về cho client cố ý **không** chứa access token, nên `/api/auth/session` không lộ
  token. Client lấy token qua `/api/auth/token` và giữ trong biến module (memory), không storage.
  ESLint chặn `localStorage` ở toàn workspace để luật này không trôi theo thời gian.

## Trạng thái

Nền tảng dùng chung đã xong: `config`, `brand`, `ui`, `ts-sdk`, `auth` — kèm 59 test (`pnpm test`).
Bốn app đã nối `NexaQueryProvider` + `ToastProvider`, có route `/api/auth/[...nextauth]`,
`/api/auth/token` và middleware chặn theo trạng thái đăng nhập.

Màn hình nghiệp vụ dựng từ G1. `web-customer` đã có khung bố cục trang chủ để chốt hướng thị
giác — chạy `pnpm dev` rồi mở http://localhost:3000.

Các trang công khai của `web-customer` đã có: `/`, `/events`, `/events/[slug]`, `/terms`,
`/privacy`, `/support`, `/login`. Dữ liệu sự kiện vẫn là placeholder gom trong
`src/lib/placeholder-events.ts` — nối `catalog-service` là xoá đúng file đó.

Chưa làm, vì backend chưa có API hoặc thuộc giai đoạn sau: chọn chỗ (C-SEATS, cần
`packages/seatmap`), checkout (C-HOLD, C-PAY), vé (C-TICKET), và ba màn của `web-scanner`.
