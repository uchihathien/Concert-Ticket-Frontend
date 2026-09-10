# Chạy toàn bộ hệ thống ở máy local

Thứ tự bắt buộc: **hạ tầng → backend → frontend**. Service khởi động khi PostgreSQL chưa sẵn sàng
sẽ chết ngay lúc chạy Flyway, và thông báo lỗi lúc đó không nói gì về việc thiếu database.

Toàn bộ lệnh dưới đây chạy trong **Git Bash** (không phải PowerShell), từ thư mục gốc repo backend
(`F:/kltnnnn`) trừ khi ghi rõ khác.

---

## 0. Kiểm tra công cụ

```bash
docker --version
java -version      # cần JDK 21
node -v            # cần >= 20
pnpm -v            # shim ở C:\Users\thien\bin
```

Git Bash không tự thấy JDK — đặt trước mỗi phiên làm việc với backend:

```bash
export JAVA_HOME="/c/Program Files/Eclipse Adoptium/jdk-21.0.12.101-hotspot"
export PATH="$JAVA_HOME/bin:$PATH"
```

---

## 1. Hạ tầng dùng chung (Docker)

```bash
cd F:/kltnnnn
docker compose -f deploy/compose/infra.yml up -d
./scripts/apply-rabbitmq-topology.sh
```

| Thành phần | Địa chỉ                                 | Ghi chú                                        |
| ---------- | --------------------------------------- | ---------------------------------------------- |
| PostgreSQL | `localhost:5432`                        | user/pass `postgres`, mỗi service một database |
| Redis      | `localhost:6379`                        |                                                |
| RabbitMQ   | `localhost:5672` · UI `localhost:15672` | `nexaticket` / `nexaticket`                    |
| Keycloak   | `localhost:8081`                        | admin `admin` / `admin`, realm `nexaticket`    |
| Mailpit    | SMTP `1025` · UI `localhost:8025`       | xem email hệ thống gửi                         |

> **Đừng dùng `--wait`.** Healthcheck của Keycloak trong `infra.yml` gọi `/health/ready`, nhưng
> Keycloak 26 chỉ mở đường đó khi bật `KC_HEALTH_ENABLED` và nó nằm ở cổng quản trị 9000 — nên
> healthcheck **không bao giờ pass** và `--wait` luôn báo `keycloak is unhealthy`, dù Keycloak
> hoàn toàn bình thường. Kiểm tra thật bằng:
>
> ```bash
> curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8081/realms/nexaticket   # mong đợi 200
> ```
>
> Đây là lỗi cấu hình ở repo backend, cần người sửa (xem cuối file).

`apply-rabbitmq-topology.sh` là idempotent — chạy lại bao nhiêu lần cũng được. Phải chạy **sau khi**
RabbitMQ healthy và **trước khi** bật service, nếu không service sẽ không tìm thấy queue của nó.

---

## 2. Backend

### 2.1. Build (lần đầu, và mỗi khi sửa `platform/*`)

```bash
cd F:/kltnnnn/backend
./mvnw -B -DskipITs install
```

**`install` chứ không phải `verify`.** `spring-boot:run` nạp các module `platform/*` từ `~/.m2`, nên
sửa shared-kernel/starter-* mà chỉ `verify` thì service vẫn chạy code cũ — bản sửa đúng trông y như
sai. Muốn chạy cả integration test (cần Docker, chậm) thì bỏ `-DskipITs`.

### 2.2. Chạy service — chọn theo việc đang làm

Không cần bật cả 11 service. Mỗi service chiếm 10 kết nối PostgreSQL mà cụm chỉ cho 100, nên bật
hết là mấy service cuối chết với `remaining connection slots are reserved`.

| Cần xem gì                                        | Service phải bật                                             | Cổng             |
| ------------------------------------------------- | ------------------------------------------------------------ | ---------------- |
| Trang chủ, danh sách, chi tiết sự kiện, đăng nhập | `api-gateway`, `identity-service`, `catalog-service`         | 8080, 8090, 8091 |
| Thêm: chọn chỗ, đơn hàng, ví vé, soát vé QR       | `inventory-service`, `ordering-service`, `ticketing-service` | 8092, 8093, 8097 |
| Thêm: doanh thu tổ chức                           | `analytics-service`                                          | 8099             |
| Thêm: sổ cái, thanh toán, chi trả                 | `ledger-service`, `payment-service`, `payout-service`        | 8094, 8095, 8096 |
| Thêm: email, cập nhật ghế realtime                | `notification-service`, `realtime-gateway`                   | 8098, 8100       |

**Cách A — mỗi service một terminal** (dùng khi đang sửa chính service đó, có hot reload):

```bash
cd F:/kltnnnn/backend
./mvnw -pl services/catalog-service spring-boot:run
```

**Cách B — chạy nhiều service bằng jar, một terminal** (dùng khi chỉ cần backend sống để làm frontend):

```bash
cd F:/kltnnnn/backend/services
for s in identity-service catalog-service inventory-service \
         ordering-service ticketing-service analytics-service api-gateway; do
  (cd "$s" && nohup java -jar target/*-SNAPSHOT.jar > "/tmp/$s.log" 2>&1 &)
done
```

Gateway nên bật **cuối** — nó không cần service khác lúc khởi động, nhưng bật sau thì lần gọi đầu
tiên đã có đích để tới.

### 2.3. Kiểm tra

```bash
for p in 8080 8090 8091 8092 8093 8097 8099; do
  printf "%s: " $p
  curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:$p/actuator/health"
done
# 200 = sống. Chờ 20–40s sau khi khởi động.
```

Log của cách B nằm ở `/tmp/<tên-service>.log`.

### 2.4. Dừng

```bash
# Cách B (jar):
taskkill //F //IM java.exe          # giết mọi JVM, kể cả IDE — cân nhắc
```

Với **cách A** thì Ctrl+C ở terminal Maven **không đủ**: `spring-boot:run` fork một JVM con, nên
Maven chết mà app vẫn giữ cổng. Tìm và giết theo cổng:

```bash
netstat -ano | grep ":8091 " | grep LISTENING    # lấy PID ở cột cuối
taskkill //F //PID <pid>
```

---

## 3. Frontend

```bash
cd F:/kltnnnn/frontend
pnpm install     # lần đầu, hoặc sau khi package.json đổi
pnpm dev         # chạy cả 4 app cùng lúc
```

| App            | Cổng                  | Dành cho          |
| -------------- | --------------------- | ----------------- |
| `web-customer` | http://localhost:3000 | khách mua vé      |
| `web-admin`    | http://localhost:3001 | ban tổ chức       |
| `web-scanner`  | http://localhost:3002 | nhân viên soát vé |
| `web-platform` | http://localhost:3003 | quản trị nền tảng |

Chạy đúng một app cho nhẹ máy:

```bash
pnpm --filter @nexaticket/web-customer dev
```

Bốn file `.env.local` (một cho mỗi app) đã có sẵn trong repo. Nếu thiếu, chép từ `.env.example` vào
**từng thư mục app** — mỗi app là một tiến trình Next riêng và dùng một client Keycloak riêng.

> **Đừng chạy `pnpm build` khi `pnpm dev` còn sống.** Cả hai ghi vào cùng `.next` của mỗi app, nên
> bản build ghi đè chunk ngay dưới chân dev server. Triệu chứng là trang trắng không CSS — thật ra
> đó là trang lỗi 500 của Next với `Cannot find module './xxx.js'`.
>
> Cần kiểm tra build mà không dừng dev:
>
> ```bash
> cd apps/web-customer && NEXT_DIST_DIR=.next-check npx next build
> rm -rf .next-check      # xong thì dọn, và bỏ dòng .next-check trong tsconfig.json mà Next tự thêm
> ```

---

## 4. Dữ liệu demo

Catalog tự dựng 22 sự kiện mẫu lúc khởi động. Nhưng đơn hàng và vé thì **không** — `ordering_db` và
`ticketing_db` khởi đầu rỗng, nên "Vé của tôi", "Đơn hàng của tôi" và app soát vé đều là màn trống.

```bash
cd F:/kltnnnn/frontend
node scripts/seed-demo-orders.mjs             # 8 đơn, đơn cuối để nguyên chờ thanh toán
node scripts/seed-demo-orders.mjs --dry-run   # xem sẽ làm gì, không ghi
```

Script đi qua API thật (giữ chỗ → đặt đơn → xác nhận thanh toán → ticketing phát hành vé), nên vé
sinh ra có chữ ký hợp lệ và máy quét chấp nhận. Cần `inventory`, `ordering`, `ticketing`, `gateway`
đang chạy.

Kiểm tra đã có dữ liệu:

```bash
docker exec nexaticket-infra-postgres-1 psql -U postgres -d ordering_db  -tAc "select status, count(*) from orders group by status"
docker exec nexaticket-infra-postgres-1 psql -U postgres -d ticketing_db -tAc "select count(*) from tickets"
```

---

## 5. Tài khoản thử

Mật khẩu trùng tên đăng nhập.

| Tài khoản    | Vào app | Ghi chú                                            |
| ------------ | ------- | -------------------------------------------------- |
| `customer`   | 3000    | khách mua vé                                       |
| `organizer`  | 3001    | thuộc tổ chức "Công ty Cổ phần Sự kiện NexaTicket" |
| `staff`      | 3002    | **mặc định không thuộc tổ chức nào** — xem bẫy #3  |
| `superadmin` | 3003    | quản trị nền tảng                                  |

---

## 6. Bẫy đã gặp thật

**#1 — Đổi tài khoản mà vẫn vào bằng người cũ.** Keycloak giữ phiên SSO ở `localhost:8081`, dùng
chung cho cả bốn app. Đăng nhập `customer` ở cổng 3000 rồi mở 3001 thì Keycloak tự cho vào bằng
`customer` luôn, không hỏi mật khẩu — và `customer` không thuộc tổ chức nào nên app tổ chức báo
"Bạn chưa thuộc tổ chức nào", trông y như lỗi phân quyền. Cách xử lý: đăng xuất hẳn, hoặc mở cửa sổ
ẩn danh cho mỗi vai.

**#2 — Sửa `platform/*` nhưng service chạy code cũ.** Xem mục 2.1: phải `install`, không phải
`verify`.

**#3 — Soát vé trả 403 `No organization context`.** Tài khoản `staff` không thuộc tổ chức nào, mà
ticketing lấy tổ chức từ tư cách thành viên. Mời vào tổ chức: đăng nhập `organizer` ở cổng 3001 →
**Thành viên** → mời `staff@nexaticket.local` với vai trò `CHECKIN_STAFF` → đăng nhập `staff` và mở
đường dẫn lời mời.

**#4 — Ctrl+C không giết được service.** Xem mục 2.4: `spring-boot:run` fork JVM con.

**#5 — Bật quá nhiều service rồi service cuối chết.** `remaining connection slots are reserved` —
mỗi service chiếm 10 kết nối, cụm cho 100. Bật đúng những service cần (bảng ở 2.2), hoặc hạ
`DB_POOL_SIZE`.

**#6 — "Vé của tôi" rỗng dù đã seed.** Kiểm `ticketing-service` (8097) có sống và
`ticketing_db.signing_keys` có khoá đang hoạt động:

```bash
docker exec nexaticket-infra-postgres-1 psql -U postgres -d ticketing_db -tAc "select count(*) from signing_keys where is_active"
```

Bằng `0` thì chạy `node scripts/seed-demo-orders.mjs` — script tự tạo khoá. Hệ thống đang chạy
không có đường nào khác để tạo khoá ký đầu tiên (xem mục 7).

---

## 7. Việc cần người xử lý ở repo backend

Bốn điểm này chặn hoặc gây khó khi chạy local; frontend không sửa được:

1. **Healthcheck Keycloak không bao giờ pass** (`deploy/compose/infra.yml`) — `/health/ready` trả 404
   trên Keycloak 26 `start-dev`. Cần thêm `KC_HEALTH_ENABLED: "true"` và probe cổng 9000, hoặc đổi
   probe sang `/realms/master`. Hệ quả: `docker compose up --wait` luôn thất bại.

2. **Không có đường tạo khoá ký vé đầu tiên** — `SigningKeyStore.rotate()` chỉ được gọi từ test, nên
   lần phát hành vé đầu tiên trên môi trường sạch sẽ ném `NO_SIGNING_KEY`.

3. **Gateway chưa khai route `/v1/admin/**`** và analytics-service không nằm trong bảng route → màn
   "Doanh thu" của app tổ chức không lấy được dữ liệu dù service có chạy.

4. **`OrderView` thiếu `eventSessionId`** và **`TicketView` thiếu tên sự kiện / giờ diễn** → frontend
   phải tra ngược qua catalog, tốn nhiều request và không hoạt động cho đơn chưa thanh toán.
