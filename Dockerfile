# syntax=docker/dockerfile:1
# =============================================================================
# SMR 3.FrontEnd (Angular 20) — build tĩnh, phục vụ bằng nginx.
#
# nginx vừa trả trang Angular vừa chuyển tiếp /api và /meetinghub (WebSocket) sang BE,
# nên trình duyệt chỉ làm việc với một domain (không cần CORS, chạy được trên domain bất kỳ).
#
#   docker build -t smr-frontend ./3.FrontEnd
#   docker run -d --name smr-frontend -p 80:80 -e BACKEND_URL=http://<host-hoặc-tên-container-BE>:5228 smr-frontend
#
# BACKEND_URL: địa chỉ BE mà container nginx gọi tới (mặc định http://smr-backend:5228 —
# đúng khi hai container cùng một Docker network và container BE tên smr-backend).
# =============================================================================

# ---------- Build ----------
FROM node:22-alpine AS build
WORKDIR /src

COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --no-audit --no-fund

COPY . .
RUN npx ng build --configuration production

# ---------- Runtime ----------
FROM nginx:1.27-alpine

# nginx.conf đặt vào thư mục templates: lúc khởi động nginx thay ${BACKEND_URL} rồi ghi ra conf.d/default.conf.
COPY nginx.conf /etc/nginx/templates/default.conf.template
COPY --from=build /src/dist/SMR.FE/browser /usr/share/nginx/html

ENV BACKEND_URL=http://smr-backend:5228 \
    NGINX_ENVSUBST_FILTER=BACKEND_URL

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -q -O /dev/null http://127.0.0.1/ || exit 1
