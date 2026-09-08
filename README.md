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
```

Backend cần chạy sẵn để đăng nhập và gọi API — xem hướng dẫn ở repo backend.

## Bốn app

| App | Cổng | Persona | Nền |
| --- | --- | --- | --- |
| `web-customer` | 3000 | Khách mua vé (mobile là kênh chính) | Sáng |
| `web-admin` | 3001 | Tổ chức | Sáng |
| `web-scanner` | 3002 | Nhân viên soát vé | **Tối** |
| `web-platform` | 3003 | Superadmin | Sáng |

`web-platform` tách khỏi `web-admin` vì ranh giới tài chính là ranh giới bảo mật: nó gọi deployable `finance`, có client OIDC riêng, và không nên chạy chung bundle với app mà tổ chức dùng.

**Scanner giữ nền tối có lý do**: dùng ngoài trời buổi tối ở cửa soát vé, nền tối đỡ chói và đỡ tốn pin. Đừng "thống nhất" nó về nền sáng.

## Packages

```text
packages/
  tokens/     CSS variables — palette v2 (nền sáng, đỏ ấm #c02a2a, vàng kim #f2b705)
  config/     tsconfig dùng chung
```

Sẽ thêm theo giai đoạn: `ui/` (component), `seatmap/` (renderer SVG dùng chung), `ts-sdk/` (client sinh từ OpenAPI), `auth/` (Auth.js).

`packages/seatmap` là điểm tái sử dụng quan trọng nhất: màn khách `C-SEATS` và màn xem trước của trình thiết kế chỗ ngồi vẽ **cùng một** cấu trúc dữ liệu. Viết hai lần là cầm chắc lệch nhau.

## Ba luật cứng

1. **Refresh token không bao giờ rời server.** Session ở cookie httpOnly do route handler quản lý.
2. **Access token không bao giờ chạm `localStorage`/`sessionStorage`** — chỉ giữ trong memory, lấy lại qua `/api/auth/token`.
3. **Sơ đồ chỗ ngồi cập nhật bằng DOM attribute, không qua React.** Delta WebSocket đổi `el.dataset.status`; màu do CSS lo. Không re-render 1.500 node cho mỗi delta.

## Hướng giao diện

Bố cục theo mô hình site bán vé Việt Nam: header ưu tiên tìm kiếm → hero xoay vòng → chip thể loại → dải sự kiện cuộn ngang → thẻ 4 dòng (ảnh, tên, ngày, giá từ).

Nền sáng, màu chính đỏ ấm `#c02a2a`, nhấn phụ vàng kim `#f2b705`, và **nội dung đặt trước thương hiệu** trên trang chủ.

## Trạng thái

Khung 4 app + design token. Màn hình thật dựng từ giai đoạn G1.
`web-customer` đã có khung bố cục trang chủ để chốt hướng thị giác — chạy `pnpm dev` rồi mở http://localhost:3000.

Dữ liệu hiện là placeholder; nối vào `catalog-service` là việc của G1.
