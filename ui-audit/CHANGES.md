# Những gì đã sửa theo REPORT.md (07/10/2026)

Kết quả kiểm chứng (cùng script `ui-audit/audit.mjs`, 24 tình huống × 2 viewport, mock API):

| Chỉ số | Trước | Sau |
|---|---|---|
| axe `color-contrast` (serious) | 280 node | 0 * |
| axe `label` (critical) | 61 node | 0 |
| axe `aria-required-children` + `aria-prohibited-attr` | 14 node | 0 |
| Lỗi runtime (`pageerror`) | 0 | 0 |
| Unit test (bỏ login.spec vì lỗi biên dịch sẵn có) | 44/47 pass | 54/56 pass (gồm login.spec đã sửa) |
| Production build | OK | OK, initial 1.75 MB (trước 1.73 MB), không vượt budget |

\* Còn 6 node trong khung "[… stub]" — là bản thay thế tạm cho 17 file không sao chép được, không phải code thật.
2 test còn fail đã fail từ trước: `app.spec.ts` (vẫn chờ chữ "Hello" của template mặc định) và `meeting-detail.spec.ts › should cancel meeting…` (timeout 5s).

## Đợt 1 — Design tokens, màu, a11y (F-01…F-04, F-20, C-03, C-12)
- **Mới** `src/styles/tokens/_tokens.scss`: nguồn token duy nhất (primitive → semantic → component), `.theme-dark`, `.theme-light`.
- `styles.scss`: token cũ (`--bs-*`, `--primary-*`, `--text-*`…) thành alias trỏ về token mới; bỏ 48px/16px/76px hard-code → `--control-height`, `--font-size-base`, `--table-row-height`; icon trong nút dùng `currentColor`; focus ring; sửa input trong affix-wrapper bị lệch placeholder.
- `theme.less`: control 40px, chữ 14px, radius 6/10 — khớp token.
- Bỏ `#2563eb/#1d4ed8` ở sidebar, login, phòng họp.
- `app.config.ts`: ng-zorro `vi_VN` ("10 / trang"), `provideA11yPatch()`.
- **Mới** `shared/a11y/select-a11y.directive.ts`, `shared/a11y/a11y-patch.ts`: tên truy cập cho select/checkbox/phân trang/cây của ng-zorro.
- `package.json`: `@angular/animations` 20 → 22.1.6 (khớp core) — `npm ci` chạy được không cần `--legacy-peer-deps`.

## Đợt 2 — Component dùng chung + 4 trang danh sách (F-05, F-06, F-11, F-14…F-17, F-19)
- **Mới** `shared/ui/avatar/avatar.ts` (`<smr-avatar>` initials + 8 màu cố định theo tên), `shared/utils/status-map.ts`, `shared/utils/friendly-error.ts`.
- Page header thống nhất (H1 màu chữ, phụ đề dưới, nút "Tạo …" primary đặc) cho Cuộc họp, Công việc, Danh bạ, Chức danh.
- Công việc: bảng không còn tràn ngang, cột thao tác cố định phải, bỏ inline style, chỉ 2 lọc nhanh + "Bộ lọc".
- Cuộc họp: nút Tạo/Xuất Excel lên header, cột tổ chức có avatar, "Tham gia" là nút nhỏ, bỏ chữ HOA.
- Chức danh: "Sửa" + menu ⋯ (Xem, Xóa). Danh bạ: avatar mới, tooltip tên phòng ban dài.
- Lỗi tải hiển thị câu thân thiện, không lộ URL/HTTP.

## Đợt 3 — Chi tiết cuộc họp (F-07)
- Header 1 dòng meta + CTA theo trạng thái (Vào phòng chờ / Tham gia / Xem biên bản) + "Sao chép lời mời".
- Bỏ card lồng card và 2 card lặp thông tin; sidebar Tổng quan = "Cài đặt phòng" + "Hoạt động gần đây".
- Tab mới **Công việc** (tải theo cuộc họp, link sang bảng đầy đủ); tab "Sau cuộc họp" → "Biên bản & ghi hình".

## Đợt 4 — Phòng họp & phòng chờ (F-08…F-10, F-12, F-13)
- Dark theme đồng nhất; bảng bên nền sáng (như Google Meet); `meeting-room.scss` 33,6 KB → ~27 KB.
- Control bar 4 nhóm có nhãn; 1 điều khiển ngôn ngữ phụ đề; chỉ 1 nút đỏ "Rời phòng ▾" (host: "Kết thúc cho mọi người" trong menu); mobile: 5 nút + "Thêm".
- Đếm người 1 nguồn; panel tách "Đang trong phòng" / "Đã mời, chưa vào".
- **Mới** `room/prejoin-preview/*`: xem trước camera, đo mức micro, chọn micro/camera/loa; trạng thái mic/cam và thiết bị chuyển sang Jitsi (`jitsi.service.ts` thêm `devices`).
- Lỗi kết nối dùng icon cảnh báo thay vì hình "hộp thư rỗng"; sửa role tablist/aria.

## Đợt 5 — App shell, dashboard, login (F-18, F-21, F-22)
- Brand sidebar nền trắng, logo màu brand; menu "Danh mục" → "Tổ chức".
- Mobile: bottom navigation (Tổng quan · Cuộc họp · Công việc · Thêm).
- Dashboard: KPI "Chưa hỗ trợ" thay "—", ngày dạng dd/MM, nút "Thử lại" rõ.
- Login: căn ô mật khẩu, logo tương phản. Profile: màu theo token.

## Chưa làm (cần quyền xóa/di chuyển file trên máy hoặc file không đọc được)
- Dời thư mục sang `core/` · `features/` · `shared/` (REPORT §C) và dọn asset/class `btn-vtb-*` cũ.
- 17 file trong `meetings/detail/components/*` và `meetings/room/components/*`: chưa sửa (chúng vẫn nhận token mới qua biến CSS).
- Form tạo cuộc họp dạng nhiều bước (roadmap bước 13).
