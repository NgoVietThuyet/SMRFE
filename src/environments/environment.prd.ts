/**
 * Bản production: gọi BE trên CÙNG domain với trang (https://<domain>/api, /meetinghub).
 * Web server phía trước (IIS — public/web.config, hoặc nginx trong Docker) chuyển tiếp /api và /meetinghub
 * sang jar ở http://localhost:5228. Nhờ vậy không có CORS, không bị chặn Mixed Content khi trang chạy HTTPS,
 * không lộ IP nội bộ / cổng 5228, và đổi domain không cần build lại.
 */


export const environment = {
     serverUrl: "https://localhost:4558",
    baseUrl: "https://localhost:4558/api",
}
