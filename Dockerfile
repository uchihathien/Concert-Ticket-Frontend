# Ảnh dùng chung cho cả bốn app Next.js.
#
# MỘT Dockerfile với tham số `APP`, cùng lý do với bản backend: bốn app khác nhau ở đúng một thứ —
# thư mục nào được build — nên đó là tham số, không phải bốn file gần giống hệt nhau.
#
#   docker build -f frontend/Dockerfile --build-arg APP=web-admin -t nexaticket/web-admin frontend
#
# Bối cảnh build là gốc của repo frontend: pnpm workspace cần cả cây để phân giải package nội bộ.

# ---------------------------------------------------------------------------
# Tầng 1 — phụ thuộc
# ---------------------------------------------------------------------------
FROM node:22-alpine AS deps
WORKDIR /app
RUN corepack enable

# Chỉ chép manifest trước rồi mới cài: tầng này chỉ vỡ khi phụ thuộc đổi, không vỡ khi sửa code.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/ apps/
COPY packages/ packages/

# `--frozen-lockfile` để bản build không bao giờ tự nâng phiên bản: một bản build hôm nay và một
# bản build tháng sau từ cùng một commit phải ra cùng một thứ.
RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

# ---------------------------------------------------------------------------
# Tầng 2 — build
# ---------------------------------------------------------------------------
FROM node:22-alpine AS build
WORKDIR /app
RUN corepack enable

COPY --from=deps /app ./

ARG APP
RUN test -n "$APP" || (echo "Thiếu --build-arg APP=<tên app>" && exit 1)

# Biến `NEXT_PUBLIC_*` được NHÚNG vào bundle lúc build, không đọc lúc chạy.
#
# Nghĩa là một image không dùng lại được giữa staging và production nếu địa chỉ API khác nhau —
# phải build riêng mỗi môi trường, hoặc đưa địa chỉ đó qua một endpoint cấu hình lúc chạy. Ghi ra
# đây vì đó là thứ sẽ làm người ta mất một buổi khi thấy app production gọi vào gateway staging.
ARG NEXT_PUBLIC_API_BASE_URL
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL

# `AUTH_SECRET` giả CHỈ để build đi qua được.
#
# `createNexaAuth` cố ý dựng config theo từng request chứ không lúc import, nên build không cần
# secret thật. Giá trị này không đi vào bundle và bị ghi đè lúc chạy — nhưng thiếu nó thì một số
# đường prerender vẫn hỏng, và lỗi khi đó không nói gì về nguyên nhân.
ARG AUTH_SECRET=build-time-placeholder-khong-dung-luc-chay

RUN pnpm --filter "@nexaticket/$APP" build

# `public/` là tuỳ chọn với Next, nhưng `COPY` thì hỏng nếu nguồn không tồn tại — và hỏng ở tầng
# runtime, sau khi đã build xong. Tạo sẵn thư mục rỗng để một Dockerfile dùng chung cho bốn app
# không phụ thuộc vào việc app nào có tài nguyên tĩnh.
RUN mkdir -p "apps/$APP/public"

# ---------------------------------------------------------------------------
# Tầng 3 — chạy
# ---------------------------------------------------------------------------
FROM node:22-alpine AS runtime
WORKDIR /app

RUN addgroup -S nodejs -g 1001 && adduser -S nextjs -u 1001 && apk add --no-cache wget

ENV NODE_ENV=production
# Tắt telemetry: nó gửi dữ liệu build ra ngoài, và một dịch vụ bán vé không nên gửi gì ra ngoài mà
# không có quyết định tường minh.
ENV NEXT_TELEMETRY_DISABLED=1

ARG APP

# Bố cục thật của `standalone` trong monorepo — đã kiểm bằng cách build và mở ảnh ra xem, không
# phải suy từ tài liệu:
#
#   standalone/node_modules/          ← đã cắt tỉa, chỉ còn thứ cần lúc chạy
#   standalone/packages/<ten>/        ← package workspace, nhờ outputFileTracingRoot
#   standalone/apps/<app>/server.js   ← điểm vào, KHÔNG nằm ở gốc
#
# Giữ nguyên hình dạng đó: `server.js` gọi `chdir(__dirname)` và tìm `.next` cạnh nó, còn Node lần
# ngược lên `/app/node_modules` để phân giải module. Dời file đi là phá cả hai.
COPY --from=build --chown=nextjs:nodejs /app/apps/$APP/.next/standalone ./
# Hai thứ standalone KHÔNG gom vào: tài nguyên tĩnh và thư mục public.
COPY --from=build --chown=nextjs:nodejs /app/apps/$APP/.next/static ./apps/$APP/.next/static
COPY --from=build --chown=nextjs:nodejs /app/apps/$APP/public ./apps/$APP/public

# ENTRYPOINT dạng exec không giãn biến, mà đường tới server.js thì phụ thuộc `APP`.
#
# Symlink giải quyết được mà không cần shell: Node phân giải symlink về đường thật, nên `__dirname`
# vẫn là `/app/apps/<app>` và mọi phép tìm đường bên trong server.js giữ nguyên ý nghĩa. Dùng
# `sh -c` thì tín hiệu TERM dừng ở shell và container chết bằng SIGKILL sau thời gian chờ thay vì
# tắt êm — người dùng đang giữ chỗ sẽ mất phiên thay vì được phục vụ nốt.
RUN ln -s "apps/$APP/server.js" /app/server.js

USER nextjs
ENV PORT=3000 HOSTNAME=0.0.0.0
EXPOSE 3000

HEALTHCHECK --interval=15s --timeout=3s --start-period=20s --retries=3   CMD wget -qO- http://127.0.0.1:3000/login >/dev/null || exit 1

ENTRYPOINT ["node", "server.js"]
