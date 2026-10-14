# SmartMeeting — Báo cáo Audit UI/UX & Đề xuất Style / Cấu trúc FE mới

> Ngày audit: 07/10/2026 · Phạm vi: `FE/` (Angular 22 + ng-zorro 22) · Chế độ: **chỉ phân tích & đề xuất, không sửa code**
> Công cụ: Playwright 1.56 (Chromium) + axe-core 4.10 (WCAG 2.0/2.1 A, AA) · Viewport 1440×900 và 375×812
> Script: `ui-audit/audit.mjs` · Mock BE: `ui-audit/mock-api.mjs` · Kết quả thô: `ui-audit/output/results.json`
> Ảnh: `ui-audit/output/desktop/*.png`, `ui-audit/output/mobile/*.png`

## 0. Phương pháp & giới hạn (đọc trước)

| Hạng mục | Cách làm | Ảnh hưởng tới kết luận |
|---|---|---|
| Backend | **Không chạy BE-Java/SQL Server.** Toàn bộ request `http://localhost:5228/**` được Playwright chặn và trả dữ liệu giả lập theo đúng DTO trong `core/models/*`. Tên người/phòng ban lấy từ `seed_realistic_master_data.sql`. | Bố cục, trạng thái và luồng màn hình là thật. Riêng số liệu và thời gian là giả lập. |
| Đăng nhập | Ghi token giả vào `localStorage` (`smr.access_token`, `smr.user`), đúng cơ chế của `AuthService` | Không ảnh hưởng tới UI. |
| SignalR `/meetinghub` | Bị chặn | Badge **"Mất kết nối realtime"** trong phòng họp là do môi trường audit, **không phải lỗi**. Các console error "Failed to complete negotiation" cũng do nguyên nhân này. |
| Jitsi | Thay bằng stub hiển thị 4 ô video tối và phát sự kiện `videoConferenceJoined` | Ảnh phòng họp hiển thị đúng phần giao diện của SMR (top bar, control bar, side panel), còn video là giả. |
| **17 file không sao chép được** (thư mục sâu quá 7 cấp so với thư mục được chia sẻ) | `meetings/detail/components/{info,participants,docs,ai,recordings}-tab/*` và `meetings/room/components/{room-docs-panel,room-tasks-panel,whiteboard}/*` được thay bằng **stub** hiển thị khung gạch "[… stub]" | **[not reached]** Nội dung bên trong các tab và panel này chưa được audit. Muốn audit, hãy chia sẻ thêm thư mục `FE/src/app/pages/meetings` rồi chạy lại `audit.mjs`. |
| Mobile full-page | Nội dung cuộn trong container bên trong (`.smr-page`) chứ không cuộn ở `body`, nên ảnh mobile chỉ chụp được màn hình đầu tiên | Bản thân việc cuộn ở container trong cũng là một finding (F-18). |

---

# A. Hiện trạng

## A1. Bảng kiểm kê màn hình

Thang điểm mức độ vấn đề: **1** = tốt, **5** = nghiêm trọng (cản trở luồng chính hoặc vi phạm a11y nặng).

| Route | Màn hình (mã Chương 9) | Workflow | Ảnh (desktop · mobile) | Mức độ |
|---|---|---|---|---|
| `/login` | Đăng nhập (UI-01) | 01 Xác thực & phiên | `desktop/login.png`, `desktop/login-error.png` · `mobile/login.png` | 2 |
| `/dashboard` | Tổng quan (UI-03) | 03, 13 | `desktop/dashboard.png`, `-empty`, `-api-error` · `mobile/dashboard.png` | 3 |
| `/meetings` | Danh sách cuộc họp (UI-04) | 03 Quản lý cuộc họp | `desktop/meetings.png`, `meetings-empty.png` · `mobile/meetings.png` | 3 |
| `/meetings` → modal | Tạo/sửa cuộc họp (UI-05) | 03 | `desktop/meetings-create-modal.png` | 3 |
| `/meetings/:id` | Chi tiết cuộc họp (UI-06) | 03, 08, 10, 12 | `desktop/meeting-detail*.png` · `mobile/meeting-detail.png` | **4** |
| `/meetings/:id` tab nội dung | Tổng quan / Người tham gia / Tài liệu / AI / Ghi hình | 06, 08, 10, 12 | (stub) | **[not reached]** |
| `/meetings/:id/tasks` | Công việc theo cuộc họp (UI-15) | 13 | `desktop/meeting-tasks.png` | 3 |
| `/meetings/:id/join` (prejoin) | Phòng chờ (UI-07) | 04 Phòng chờ & thiết bị | `desktop/meeting-room-prejoin.png` | **4** |
| `/meetings/:id/join` (live) | Phòng họp chính (UI-08, 09, 10) | 05, 06, 07, 11 | `desktop/meeting-room-{live,chat,participants,ai}.png` · `mobile/meeting-room-live.png` | **4** |
| Room → panel Tài liệu / Công việc / Bảng trắng | UI-11, UI-12 | 08, 09 | (stub) | **[not reached]** |
| Room → panel Phiên âm | UI-13 | 11 | không tìm được nút mở panel theo aria-label/title (xem F-12) | **[not reached]** |
| `/tasks` | Công việc (UI-15) | 13 | `desktop/tasks.png`, `tasks-detail-drawer.png`, `tasks-create-modal.png` · `mobile/tasks.png` | **4** |
| `/profile` | Thông tin cá nhân | 02 | `desktop/profile.png` | 2 |
| `/catalogs/contacts` | Danh bạ + cây tổ chức (UI-17) | 02 | `desktop/catalog-contacts.png` · `mobile/catalog-contacts.png` | 3 |
| `/catalogs/titles` | Chức danh (UI-17) | 02, 15 | `desktop/catalog-titles.png` | 3 |
| — | Khách tham gia (UI-02), Báo cáo (UI-16), Vai trò & quyền (UI-18), Cấu hình (UI-19), Nhật ký (UI-20) | 01, 14, 15 | **chưa có route** | [not reached] (chưa triển khai) |

Redirect: `/` → `/dashboard`, `/contacts` → `/catalogs/contacts`, `**` → `/dashboard`.

## A2. Findings, sắp theo mức độ

### Mức 5: nghiêm trọng

**F-01. Không có primary color duy nhất, 2–3 hệ "xanh" song song**
- Bằng chứng: `theme.less:11` khai báo `@primary-color: #075985`. Nhưng `#2563eb` và `#1d4ed8` (primary cũ đã bị STYLE.md §13 loại bỏ) vẫn còn **23 lần**: `meeting-room.scss` ×17, `sidebar.scss` ×3, `styles.scss` ×2, `login.scss` ×1. Thêm vào đó, `:root` có `--bs-blue-ocean #005993`, `--bs-blue-ocean-2 #005994`, `--bs-blue-link #337ab7`, `--bs-sky-primary #0284c7` (`styles.scss:176-196`). Toàn bộ SCSS/LESS có **144 mã hex khác nhau**.
- Trên ảnh: menu active (xanh nhạt `#e0eff8`), nút "Tạo cuộc họp" (navy), khối brand sidebar (gradient xanh) và nút "TT" phụ đề trong phòng họp (xanh dương sáng) lệch tông nhau (`desktop/dashboard.png`, `desktop/meeting-room-live.png`).
- Ảnh hưởng: giao diện thiếu nhận diện, mỗi màn hình trông như của một sản phẩm khác.

**F-02. Icon trong nút primary bị "tàng hình"**
- Bằng chứng: `desktop/dashboard.png`. Các nút "Tạo cuộc họp", "Xem chi tiết", "Tham gia" có một khoảng trống bên trái. Đó là icon tối màu nằm trên nền navy. Logo trong khối brand sidebar và trên trang login cũng là icon tối trên nền xanh (`desktop/login.png`).
- Ảnh hưởng: icon mất tác dụng, nút trông lệch tâm.

**F-03. Tương phản màu không đạt WCAG AA (axe: 280 node, mức serious)**
- Bằng chứng: `results.json`, rule `color-contrast`. Phần tử lỗi nhiều nhất: `.smr-avatar` (các biến thể pastel), `.list-page-header-subtitle`, `#live-title`, `.smr-status--ongoing`, `.login__auth-error`.
- Đo thực tế: `--text-muted #94a3b8` trên nền trắng chỉ đạt **2.56:1**, cần ≥ 4.5. Text mô tả cuộc họp, phụ đề trang và placeholder đều dùng màu này. `--success #16a34a` trên nền `#f0fdf4` đạt 3.15:1, `--warning #d97706` trên nền `#fffbeb` đạt 3.07:1.

**F-04. Form control không có label (axe: 61 node, mức critical)**
- Bằng chứng: `.list-page-header-select … input[readonly]`, tức các select lọc ở `/meetings`, `/tasks`, `/catalogs/*` và trong modal tạo cuộc họp.
- Ảnh hưởng: trình đọc màn hình không biết từng ô lọc dùng để làm gì.

### Mức 4: cao

**F-05. Bốn kiểu page header và ba kiểu bộ lọc khác nhau**
- Page header:
  - Dashboard: tiêu đề đen, phụ đề nằm dưới, nút primary đặc.
  - Meetings / Contacts / Titles: tiêu đề **xanh**, phụ đề nằm cùng dòng, nút viền.
  - Tasks: tiêu đề xanh, phụ đề nằm dưới.
  - Detail: không có page header, chỉ có card.
  - Lớp `.smr-page-header` và `.smr-toolbar` được định nghĩa trong `styles.scss:522, 777` nhưng **không trang nào dùng** (dead CSS).
- Bộ lọc:
  - Meetings: ô tìm kiếm + popover filter + Xuất Excel.
  - Tasks: 4 select hiển thị trực tiếp, tràn khỏi vùng chứa.
  - Contacts: label "Tìm kiếm nhân sự" + select + nút "Bỏ lọc".
- Bằng chứng: `desktop/meetings.png`, `desktop/tasks.png`, `desktop/catalog-contacts.png`, `desktop/dashboard.png`.

**F-06. Bảng Công việc tràn ngang ở 1440px**
- Bằng chứng: `desktop/tasks.png`. Cột "THAO TÁC" bị cắt chỉ còn "Xe…". Ô lọc "Cuộc họp" cũng bị cắt.
- Ô tìm kiếm co lại còn "Tìm kiế…" và kẹp hai nút 28px không đều viền (`tasks.html:37-41`).
- Ảnh hưởng: hành động chính của mỗi dòng bị che ngay trên màn hình laptop phổ biến.

**F-07. Chi tiết cuộc họp lặp thông tin 3–4 lần và thiếu CTA chính**
- Bằng chứng: `desktop/meeting-detail.png`. Thời gian, người tổ chức, số người tham gia, mã phòng và phạm vi xuất hiện ở:
  - (1) dòng phụ dưới tiêu đề,
  - (2) dải 5 thông số trong header card,
  - (3) card "Thông tin cuộc họp" bên phải,
  - (4) card "Trạng thái" (status cũng lặp lại).
- Nút **"Tham gia" / "Bắt đầu"** không xuất hiện trên trang, chỉ có menu "⋮". Trang còn bị lồng card trong card (`list-page-card` > header card).
- Trên mobile, dải thông số đẩy tabs xuống quá màn hình đầu tiên (`mobile/meeting-detail.png`).

**F-08. Control bar phòng họp quá tải và mơ hồ**
- Bằng chứng: `desktop/meeting-room-live.png`. Thanh điều khiển có 12 nút **chỉ có icon, không có nhãn**. Có tới **3 điều khiển ngôn ngữ**: "CC · VI" trên header, dropdown "VI∨" cạnh nút phụ đề, và nút "VI|EN".
- Hai nút đỏ "Kết thúc cuộc họp" và "Rời phòng" nằm cạnh nhau, đều nổi bật như nhau.
- Trên mobile, control bar xuống 2 dòng và chiếm khoảng 20% chiều cao (`mobile/meeting-room-live.png`).

**F-09. Phòng họp nửa sáng nửa tối**
- Bằng chứng: `desktop/meeting-room-live.png`. Top bar và control bar nền trắng, vùng video đen, side panel trắng.
- Các nền tảng họp (Meet, Teams, Zoom) dùng giao diện tối đồng nhất để giảm chói và làm video nổi bật.
- Header và side panel dùng `#2563eb` (F-01).

**F-10. Số người tham gia mâu thuẫn**
- Header phòng hiển thị "4", badge nút người tham gia hiển thị "7", panel ghi "Trong cuộc họp (7)" và liệt kê cả người chưa vào (`desktop/meeting-room-participants.png`).
- Ảnh hưởng: người dùng không biết ai đang thực sự có mặt.

**F-11. Avatar rỗng không có chữ cái đầu**
- Avatar ở top header, trong drawer công việc và trong danh sách người tham gia của phòng họp chỉ là hình tròn xanh đặc, không có chữ (`desktop/dashboard.png` góc phải, `desktop/tasks-detail-drawer.png`, `desktop/meeting-room-participants.png`).
- Ở dashboard và danh bạ thì avatar có initials. Như vậy cùng component nhưng hai cách hiển thị.

**F-12. Thiếu tên cho nút icon-only (a11y)**
- Không tìm được nút mở panel **Phiên âm** bằng `aria-label`/`title` chứa "phiên âm/transcript".
- `.room__tabs` có role tablist nhưng thiếu children `tab` (axe `aria-required-children`, mức critical).
- `.room__joined-dot` dùng `aria-label` trên phần tử không có role (`aria-prohibited-attr`, 8 node).

**F-13. Phòng chờ chưa đáp ứng UI-07**
- Bằng chứng: `desktop/meeting-room-prejoin.png`. Màn hình chỉ là một card nhỏ giữa nền trống, **không có xem trước camera, không chọn được mic/loa, không có thanh đo âm lượng**. Chương 9 yêu cầu "Preview, thiết bị".
- Hai nút "Bắt đầu cuộc họp" và "Tham gia ngay" đứng ngang hàng, không rõ khác nhau ở đâu.

### Mức 3: trung bình

**F-14. Badge trạng thái không nhất quán**
- Ở `/meetings`, trạng thái "ĐANG DIỄN RA" viết HOA, cỡ chữ lớn và đậm, còn "Sắp diễn ra" và "Đã kết thúc" viết thường cỡ nhỏ (`desktop/meetings.png`).
- Ở `/tasks`, nhãn là "Đang thực hiện", nhưng trong drawer lại ghi "Đang làm" (`desktop/tasks-detail-drawer.png`).

**F-15. Header bảng không thống nhất, mật độ quá thưa**
- Bảng Tasks viết HOA header (theo STYLE.md §15), còn Meetings dùng sentence case.
- Hàng cao 76px (STYLE.md §3) và control cao 48px (`--control-height`), nên một màn 900px chỉ hiện được khoảng 7 dòng.
- Ở bảng Chức danh, các hành động "Xem / Sửa / Xóa" bị xuống dòng (`desktop/catalog-titles.png`).

**F-16. Trạng thái lỗi hiển thị thông điệp kỹ thuật**
- Bằng chứng: `desktop/dashboard-api-error.png`. Màn hình hiện nguyên chuỗi `Http failure response for http://localhost:5228/api/Meeting/dashboard: 500 Internal Server Error`.
- Phòng họp dùng hình **hộp thư rỗng** cho trạng thái lỗi kết nối, sai ngữ nghĩa giữa empty và error.

**F-17. Nút tạo mới không nhất quán**
- Dashboard dùng nút **đặc** "Tạo cuộc họp". Meetings, Tasks và Contacts dùng nút **viền**, và Tasks ghi "+ Công việc" thay vì "Tạo công việc".
- STYLE.md §6 quy định "hệ 3 màu" chỉ gồm nút viền, nhưng thực tế dashboard đã dùng nút đặc. Tài liệu và code không khớp nhau.

**F-18. Trải nghiệm trên mobile**
- Sidebar ẩn sau nút hamburger và không có bottom navigation.
- Trên Tasks, phần lọc chiếm khoảng 40% màn hình đầu.
- Trên Contacts, cây phòng ban bị đẩy xuống dưới form lọc và tên phòng ban bị cắt.
- Trang cuộn trong container lồng nhau thay vì cuộn ở `body`, nên thanh địa chỉ trình duyệt mobile không tự ẩn và không có pull-to-refresh.
- Bằng chứng: `mobile/*.png`.

**F-19. Tên trong cây tổ chức bị cắt cụt mà không có tooltip**
- Ví dụ "Trung tâm Nghiên cứu Trí tuệ Nhân…", "Khối Vận hành & Quản trị Doanh nghi…" (`desktop/catalog-contacts.png`).

**F-20. Ngôn ngữ trộn lẫn**
- Phân trang hiển thị "10 / page" (do ng-zorro dùng `en_US` trong `app.config.ts:76`), trong khi toàn bộ UI là tiếng Việt.
- Ngày hạn công việc viết "09-10", còn nơi khác viết "09/10".

### Mức 2: thấp

**F-21. Login**
- Placeholder ô mật khẩu lệch xuống so với ô email (`desktop/login.png`).
- Khoảng cách giữa ô mật khẩu và hàng "Ghi nhớ" quá sát.
- Thông báo lỗi nằm phía trên form, xa ô nhập liệu (`desktop/login-error.png`).

**F-22. KPI "Biên bản chờ duyệt —" hiển thị dấu gạch thay vì số 0 hoặc trạng thái "chưa hỗ trợ"** (`desktop/dashboard.png`).

**F-23. Profile**: các ô nhập rộng khác nhau và label nằm inline không thẳng hàng (`desktop/profile.png`).

### Findings từ code

| # | Vấn đề | Bằng chứng | Ảnh hưởng |
|---|---|---|---|
| C-01 | `styles.scss` **3.471 dòng / 79 KB** gánh mọi thứ: font, tokens, reset, layout, override ng-zorro, utility | `src/styles.scss` (20 khối chú thích từ `// 0.` đến `// 18.+`) | Khó tìm, khó review. Mọi thay đổi đều có rủi ro ảnh hưởng toàn cục. |
| C-02 | **439 lần `!important`** (405 trong styles.scss) | đếm bằng grep | Không thể override có kiểm soát, specificity leo thang. |
| C-03 | Tokens khai báo **2 lần ở 2 ngôn ngữ**: LESS `@primary-color…` (`theme.less`) và CSS `--primary-600…` (`styles.scss:174-310`), đồng bộ thủ công | so sánh `theme.less:11-69` với `styles.scss:176-266` | Dễ lệch nhau (lệch đó chính là nguồn gốc của F-01). |
| C-04 | Tên token đặt theo **màu** (`--bs-cyan-deep`, `--bs-blue-ocean-2`) và tiền tố `--bs-` dù không dùng Bootstrap | `styles.scss:176-198` | Không thể đổi theme. Đổi màu thì tên biến sai nghĩa. |
| C-05 | Hard-code radius trong component (**37 chỗ**, 12 giá trị từ 3 đến 24px) vi phạm STYLE.md §15 "MUST NOT hard-code radius px" | `grep border-radius:[0-9] app/**/*.scss` | Bo góc không đồng nhất. |
| C-06 | Hơn 20 cỡ chữ (9 → 42px, gồm 15/17/19/23/25…) | grep `font-size` | Thang typography không tồn tại trên thực tế. |
| C-07 | Di sản từ dự án ngân hàng: class `btn-vtb-*` (39 lần), ảnh `logo_VTB.png`, `BackgroundLoginVietinbank.webp`, icon `Loan/Bank/Tax/Insurance…`, `app.html` còn template mặc định NG-ZORRO | `styles.scss`, `tasks.html`, `meetings.html`, `public/` | Tên class không mô tả mục đích. Asset thừa (`bg-header-portal.png` 7,6 MB, `logoVTB.png` 1,2 MB). |
| C-08 | `meeting-room.scss` 33,6 KB **vượt budget cảnh báo 30 KB** (`angular.json` anyComponentStyle). `meeting-room.ts` 946 dòng. | `angular.json`, `wc` | Component "god object": quản lý media, chat, phụ đề, panel và i18n trong một file. |
| C-09 | i18n phòng họp viết tay (`room-i18n.ts`) chỉ dùng trong room. Các trang khác hard-code tiếng Việt, ng-zorro dùng `en_US`. | `room-i18n.ts`, `app.config.ts:76` | Nút VI/EN trên top header gần như không có tác dụng ngoài phòng họp. |
| C-10 | `pages/` trộn trang và component con. Model, service và API dồn chung trong `core/`. Không có lớp `shared/ui`; chỉ có 2 component dùng chung (`activity-item`, `file-list-item`). | cây `src/app` | Mỗi trang tự viết lại header, filter, status, avatar, empty state. Đây là nguồn gốc của F-05, F-11, F-14. |
| C-11 | `.ant-btn, .ant-input… {height:48px !important}` ép toàn cục, rồi lại viết ngoại lệ 28/24px | STYLE.md §6, cuối `styles.scss` | Nút tìm kiếm 28px kẹp cạnh input 48px (F-06). |
| C-12 | `@angular/animations ^20` lệch major so với core `^22`, nên `npm ci` báo lỗi ERESOLVE (phải chạy với `--legacy-peer-deps`) | `package.json` | Rủi ro build trên máy mới hoặc CI. |

---

# B. Đề xuất Style mới — "SmartMeeting Calm Enterprise"

**Định hướng:** giữ nhận diện hiện có (font SVN-Gilroy và tông xanh `#075985`) nhưng chuẩn hóa lại. Mục tiêu là UI **dày thông tin vừa phải, yên tĩnh, một màu nhấn**. Phòng họp là ngoại lệ duy nhất: dùng **dark theme riêng**.

## B1. Design tokens 3 tầng

### Tầng 1: Primitive (giá trị thô, chỉ khai báo ở 1 file)

```scss
// styles/tokens/_primitives.scss
$brand: (50:#f0f7fc, 100:#e0eff8, 200:#bfdcef, 300:#8cc1e3, 400:#4f9fd0,
         500:#1f7fb8, 600:#0b6699, 700:#075985, 800:#0a4a6e, 900:#0c3d5a);
$slate: (0:#ffffff, 25:#f8fafc, 50:#f1f5f9, 100:#e2e8f0, 200:#c9d9ea, 300:#94a3b8,
         500:#64748b, 600:#475569, 800:#1e293b, 900:#0f172a, 950:#0b1220);
$green: (50:#f0fdf4, 200:#bbf7d0, 600:#16a34a, 700:#15803d);
$amber: (50:#fffbeb, 200:#fde68a, 600:#d97706, 700:#b45309);
$red:   (50:#fef2f2, 200:#fecaca, 600:#dc2626, 700:#b91c1c);
$violet:(50:#f5f3ff, 600:#7c3aed);   // dành riêng cho tính năng AI
```

### Tầng 2: Semantic (CSS custom properties, tên theo **vai trò**)

| Token | Light | Room (dark) | Tương phản trên nền tương ứng |
|---|---|---|---|
| `--color-bg-page` | slate-25 `#f8fafc` | slate-950 `#0b1220` | — |
| `--color-bg-surface` | `#ffffff` | `#111827` | — |
| `--color-bg-subtle` | slate-50 | `#1f2937` | — |
| `--color-border` | slate-200 `#c9d9ea` | `#273244` | — |
| `--color-text` | slate-900 `#0f172a` | `#e5e7eb` | 17.85 · 14.33 ✅ |
| `--color-text-secondary` | slate-600 `#475569` | `#9ca3af` | 7.58 · 6.99 ✅ |
| `--color-text-muted` | **slate-500 `#64748b`** (thay cho `#94a3b8`) | `#9ca3af` | **4.76** (cũ 2.56 ❌) ✅ |
| `--color-primary` | brand-700 `#075985` | brand-400 `#4f9fd0` | 7.56 trên nền trắng ✅ |
| `--color-primary-hover` | brand-800 | brand-300 | — |
| `--color-primary-subtle` | brand-100 `#e0eff8` | brand-900 | primary trên subtle 6.44 ✅ |
| `--color-on-primary` | `#ffffff` | `#0b1220` | 7.56 ✅ |
| `--color-success-text / -bg` | green-700 / green-50 | — | **4.79** (cũ 3.15 ❌) ✅ |
| `--color-warning-text / -bg` | amber-700 / amber-50 | — | **4.84** (cũ 3.07 ❌) ✅ |
| `--color-danger-text / -bg` | red-700 / red-50 | — | 5.91 ✅ |
| `--color-danger-solid` | red-600 (nền nút Kết thúc) | red-600 | chữ trắng 4.83 ✅ |
| `--color-ai` | violet-600 | violet-400 | dùng cho badge "AI", nguồn trích dẫn |
| `--focus-ring` | `0 0 0 3px rgb(7 89 133 / .35)` | `0 0 0 3px rgb(79 159 208 / .5)` | — |

### Typography (Gilroy, thang 1.2)

| Token | Size / line-height | Weight | Dùng cho |
|---|---|---|---|
| `--text-xs` | 12 / 16 | 500 | badge, caption, meta |
| `--text-sm` | 14 / 20 | 400–500 | **body mặc định**, bảng, form |
| `--text-md` | 16 / 24 | 500–600 | tiêu đề card, nút lớn |
| `--text-lg` | 20 / 28 | 600 | tiêu đề section |
| `--text-xl` | 24 / 32 | 700 | tiêu đề trang (H1) |
| `--text-2xl` | 30 / 38 | 700 | số KPI |

Chỉ nạp 4 weight (Regular, Medium, SemiBold, Bold) thay vì 20 file `.otf`. Nên chuyển sang `.woff2` và đặt `font-display: swap`.

### Spacing, radius, shadow, motion

- **Spacing (bội số 4):** `--space-1:4 · 2:8 · 3:12 · 4:16 · 5:20 · 6:24 · 8:32 · 10:40 · 12:48`
- **Radius:** `--radius-sm:6` (input, nút, badge) · `--radius-md:10` (card, modal) · `--radius-lg:16` (ô video, panel nổi) · `--radius-full:9999`
- **Shadow:** `--shadow-1: 0 1px 2px rgb(15 23 42/.06)` (card) · `--shadow-2: 0 4px 12px rgb(15 23 42/.08)` (dropdown) · `--shadow-3: 0 12px 32px rgb(15 23 42/.16)` (modal, drawer)
- **Kích thước control:** `--control-sm:32 · --control-md:40 (mặc định) · --control-lg:48 (login, CTA phòng họp)`. Thay cho mức 48px ép toàn cục bằng `!important`.
- **Motion:** `--duration-fast:120ms · --duration-base:200ms · --ease-standard: cubic-bezier(.2,0,0,1)`, tôn trọng `prefers-reduced-motion`.

### Tầng 3: Component tokens

```scss
--btn-height: var(--control-md);   --btn-radius: var(--radius-sm);
--table-row-height: 56px;          --table-header-bg: var(--color-bg-subtle);
--card-padding: var(--space-5);    --card-radius: var(--radius-md);
--sidebar-width: 248px;            --sidebar-collapsed: 72px;  --topbar-height: 56px;
--room-control-size: 48px;         --room-bg: var(--color-bg-page) /* dark */;
```

**Một nguồn duy nhất cho theme ng-zorro:** khai báo token trong SCSS, rồi dùng ng-zorro CSS-variable theme (`nz-config` với `theme.primaryColor`) hoặc sinh `theme.less` tự động từ token. Không còn viết tay hai nơi (C-03).

## B2. Chuẩn component

| Component | Biến thể | Trạng thái bắt buộc | Quy tắc dùng |
|---|---|---|---|
| **Button** | `primary` (đặc), `secondary` (viền), `ghost` (chỉ chữ), `danger` (đặc đỏ), `danger-ghost` · cỡ sm 32 / md 40 / lg 48 | hover, active, focus-visible (ring), disabled, loading | **Mỗi vùng màn hình tối đa 1 nút primary.** Hành động "Tạo …" luôn là primary, đặt ở page header bên phải. Icon trong nút dùng `currentColor` (sửa F-02). Nhãn có động từ: "Tạo công việc", không viết "+ Công việc". |
| **Input / Select / DatePicker** | md 40, lg 48 (login) | default, hover, focus, error (viền đỏ + thông báo ngay dưới ô), disabled, readonly | Luôn có `<label>` hiển thị, hoặc `aria-label` cho ô lọc trong toolbar (sửa F-04). Placeholder chỉ là ví dụ, không thay cho label. |
| **Table** | default, compact (row 48) | hover dòng, dòng được chọn, sort, loading skeleton, empty, error | Header **sentence case** 12px/600 trên nền subtle. Hàng 56px. Cột "Thao tác" cố định bên phải (`nzRight`), tối đa 1 hành động text + menu "⋯". Cột trạng thái dùng `<smr-status-badge>`. |
| **Card / Section** | `section` (có header, body), `kpi`, `highlight` (viền trái màu) | loading, empty | **Không lồng card trong card.** Trang chi tiết dùng grid gồm các section phẳng. |
| **Modal** | sm 480 / md 640 / lg 800 | — | Dùng cho tác vụ ngắn, ít hơn 6 trường. Form dài (tạo cuộc họp) chuyển thành **trang riêng hoặc drawer full-height** có các bước rõ ràng. |
| **Drawer** | 480 / 720 | — | Dùng để xem chi tiết một bản ghi trong danh sách (công việc, nhân sự). Footer cố định chứa hành động. |
| **Toast** | success, info, warning, error | tự đóng sau 4s (error không tự đóng) | Tiếng Việt, không có URL hay mã HTTP. Lỗi có nút "Thử lại" khi được. |
| **Status badge** | `scheduled, ongoing(pulse), ended, cancelled, draft, archived` · `todo, doing, done, overdue` | — | **Một map trạng thái → (nhãn, màu) dùng chung toàn app.** Nhãn sentence case, 12px, có dot (sửa F-14). |
| **Avatar / AvatarStack** | xs 20, sm 28, md 36, lg 48 | ảnh, initials, fallback icon | Màu nền sinh **xác định từ userName** trong 8 cặp màu đã kiểm tương phản ≥ 4.5. Không bao giờ hiển thị hình tròn rỗng (sửa F-11). |
| **Empty state** | `no-data`, `no-result` (khi có lọc), `first-use` | — | Gồm icon, tiêu đề, một câu giải thích và tối đa 1 CTA. |
| **Error state** | `inline`, `page` | — | Icon cảnh báo (không dùng hình hộp thư rỗng). Thông điệp thân thiện, có "Thử lại", chi tiết kỹ thuật ẩn trong `<details>` (sửa F-16). |
| **Loading skeleton** | dòng bảng, card, KPI | — | Hiện sau 300ms để tránh nhấp nháy. Giữ đúng kích thước nội dung thật để tránh layout shift. |
| **Page header** | `list`, `detail` | — | Gồm: breadcrumb (chỉ ở detail), H1 24px màu text (không dùng màu xanh), phụ đề 14px muted, vùng hành động bên phải. **Một component duy nhất** `<smr-page-header>` (sửa F-05). |
| **Filter bar** | — | — | Gồm: ô tìm kiếm (icon bên trong, không kẹp nút rời), tối đa 2 bộ lọc nhanh, nút "Bộ lọc (n)" mở popover cho các lọc còn lại, chip hiển thị các lọc đang áp dụng kèm nút "Xóa lọc". Một component `<smr-filter-bar>`. |

## B3. Layout shell

**App shell (desktop ≥ 1024px):**

```
┌───────────────┬───────────────────────────────────────────────────────────────┐
│ ◧ SmartMeeting │  ☰  Cuộc họp / Chi tiết          [⌕ Tìm (Ctrl K)]  [#Mã] 🔔 VI ◉ │ ← topbar 56px, trắng
│───────────────│───────────────────────────────────────────────────────────────│
│ ▣ Tổng quan    │  H1 Tiêu đề trang                         [Phụ] [Primary]    │ ← page header
│ ▣ Lịch họp     │  Phụ đề muted                                                  │
│ ▣ Công việc    │  ┌────────────── nội dung (max-width 1280, padding 24) ─────┐ │
│ ▣ Biên bản     │  │                                                          │ │
│ ─────────────  │  │                                                          │ │
│ TỔ CHỨC        │  └──────────────────────────────────────────────────────────┘ │
│ ▣ Danh bạ      │                                                               │
│ ▣ Chức danh    │                                                               │
│               │                                                               │
│ ◉ Lê Minh Cường│                                                               │
└───────────────┴───────────────────────────────────────────────────────────────┘
  248px nền trắng, chỉ dùng 1 màu nhấn cho mục active (nền brand-100, chữ brand-700, thanh 3px)
```

- Brand block bỏ gradient, dùng logo màu brand trên nền trắng (sửa F-02).
- **Tablet (768–1023px):** sidebar thu còn 72px chỉ có icon (có tooltip).
- **Mobile (< 768px):** ẩn sidebar. Thêm **bottom tab bar** gồm Tổng quan · Lịch họp · Công việc · Thêm. Nút "Tạo / Tham gia" là FAB. Trang cuộn ở `body` (sửa F-18).

**Mẫu trang danh sách:**

```
H1 Lịch họp                                                    [Xuất Excel] [+ Tạo cuộc họp]
[Tất cả 11] [Sắp diễn ra 4] [Đang diễn ra 1] [Đã kết thúc 3] [Đã hủy 1]   ← segmented + count
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ [⌕ Tìm theo tên cuộc họp…        ] [Thời gian ▾] [Người tổ chức ▾] [Bộ lọc (2)]          │
│ Đang lọc: (Tuần này ×) (Của tôi ×)  Xóa lọc                                              │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ Cuộc họp                       Thời gian        Trạng thái     Tổ chức        │ Thao tác │
│ Daily stand-up Sprint 14       Hôm nay 09:00    ● Đang diễn ra  LC Lê M.Cường │ [Tham gia] ⋯│ ← sticky
│ 6 người · Nội bộ                                                              │          │
└────────────────────────────────────────────────── Tổng 11 · ‹ 1 2 › · 10 / trang ───────┘
```

**Mẫu trang chi tiết cuộc họp (sửa F-07):**

```
Lịch họp / Review thiết kế màn hình phòng họp
H1 Review thiết kế màn hình phòng họp         [Sao chép lời mời] [Sửa] ⋯   [▶ Tham gia]
● Sắp diễn ra · Hôm nay 10:30–11:30 · Lê Minh Cường · 6 người · Nội bộ · SMR-0002   ← 1 dòng meta duy nhất
──────────────────────────────────────────────────────────────────────────────────────────
Tổng quan | Người tham gia 6 | Tài liệu 2 | Biên bản AI ✦ | Ghi hình & Transcript | Công việc 3
──────────────────────────────────────────────────────────────────────────────────────────
┌ Chương trình nghị sự ───────────────────────┐ ┌ Cài đặt phòng ───────────┐
│ 1. Rà soát tiến độ                          │ │ ✓ Phòng chờ  ✓ Phụ đề     │
│ 2. Vướng mắc & rủi ro                       │ │ ✓ Ghi hình   ✓ AI biên bản│
└─────────────────────────────────────────────┘ ├ Hoạt động gần đây ───────┤
┌ Mô tả ──────────────────────────────────────┐ │ • Cường cập nhật · 2 ngày │
└─────────────────────────────────────────────┘ └──────────────────────────┘
```

Route `/meetings/:id/tasks` gộp thành tab **Công việc** của trang chi tiết. URL `?tab=tasks` vẫn giữ để deep-link.

**Mẫu phòng họp, dark theme (sửa F-08, F-09, F-10):**

```
┌──────────────────────────────────────────────────────────────────────── nền #0b1220 ┐
│ ← Daily stand-up Sprint 14 · 00:12:31 · ● REC          👥 4 đang trong phòng  ⚙     │
│ ┌──────────────────┐ ┌──────────────────┐   ┌ Panel 360px ────────────────────────┐ │
│ │                  │ │                  │   │ [Người] [Chat] [Phiên âm] [Tài liệu]│ │
│ │   Lê Minh Cường 🎙│ │  Trần Thị Bình   │   │ [Công việc] [AI ✦]                  │ │
│ └──────────────────┘ └──────────────────┘   │  Đang trong phòng (4)               │ │
│ ┌──────────────────┐ ┌──────────────────┐   │  Đã mời, chưa vào (3)               │ │
│ │                  │ │                  │   └─────────────────────────────────────┘ │
│ └──────────────────┘ └──────────────────┘                                           │
│  “Phần API tóm tắt đã xong 80%…” — Lê Minh Cường                ← phụ đề overlay    │
│                                                                                     │
│ [🎙 Mic][📷 Cam][🖥 Chia sẻ] │ [✋][CC Phụ đề ▾VI][✎ Bảng trắng][⏺ Ghi] │ [👥][💬][✦] │ [📞 Rời ▾] │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

- 4 nhóm điều khiển, có nhãn dưới icon từ 1280px trở lên, tooltip kèm phím tắt.
- Chỉ **một** điều khiển ngôn ngữ phụ đề (dropdown của CC). Ngôn ngữ giao diện chuyển vào ⚙.
- **"Rời ▾"** là split button: Rời phòng / *Kết thúc cho mọi người* (chỉ host). Chỉ còn 1 nút đỏ.
- Số người trong phòng lấy từ một nguồn duy nhất, tách "đang trong phòng" và "đã mời" (sửa F-10).
- Mobile: control bar 1 dòng gồm 5 nút (Mic, Cam, Chat, Người, Rời), các nút còn lại vào "⋯" (bottom sheet).

**Phòng chờ (sửa F-13):** layout 2 cột gồm preview camera (16:9) với nút bật/tắt mic, cam và thanh đo âm lượng, cùng select thiết bị mic, loa, camera. Bên phải là thông tin cuộc họp, danh sách người đã vào và **một CTA** ("Bắt đầu cuộc họp" cho host, "Tham gia" cho người dự).

## B4. Trước / Sau cho 5 màn hình có vấn đề nặng nhất

| Màn hình | Trước (bằng chứng) | Sau (đề xuất) |
|---|---|---|
| **Phòng họp** | Top bar và control bar trắng, video đen. 12 nút icon không nhãn. 3 điều khiển ngôn ngữ. 2 nút đỏ. Số người 4 ≠ 7. (`desktop/meeting-room-live.png`) | Dark theme đồng nhất. Control bar 4 nhóm có nhãn. Một dropdown CC. Split button "Rời ▾". Đếm người từ một nguồn. Phụ đề overlay trên video. |
| **Chi tiết cuộc họp** | Thông tin lặp 3–4 lần, card lồng card, không có nút Tham gia, tabs bị đẩy xuống. (`desktop/meeting-detail.png`) | 1 dòng meta, CTA "Tham gia/Bắt đầu" ở header, 6 tab (gộp Công việc), grid section phẳng 8/4 cột. |
| **Công việc** | Bảng tràn ngang, cột Thao tác bị cắt, ô tìm kiếm co lại, 4 select xếp ngang. (`desktop/tasks.png`) | `<smr-filter-bar>` gồm tìm kiếm + 2 lọc nhanh + "Bộ lọc (n)". Cột thao tác cố định. Chip trạng thái thống nhất. Thêm chế độ xem Kanban (Chưa bắt đầu / Đang làm / Hoàn thành). |
| **Phòng chờ** | Card nhỏ trên nền trống, không có preview thiết bị, 2 CTA mơ hồ. (`desktop/meeting-room-prejoin.png`) | Preview camera, chọn thiết bị, đo mic. Một CTA theo vai trò. Hiện "Còn 25 phút nữa bắt đầu". |
| **Tổng quan** | Icon nút vô hình, KPI "—", 2 tông xanh, thông báo lỗi kỹ thuật. (`desktop/dashboard.png`, `-api-error.png`) | Icon `currentColor`. KPI luôn là số và có link xem thêm. Một màu primary. Error state thân thiện kèm "Thử lại". |

---

# C. Đề xuất cấu trúc FE mới

## C1. Cây thư mục `src/app` (feature-first, standalone)

```
src/
├─ app/
│  ├─ app.config.ts · app.routes.ts · app.ts
│  ├─ core/                         # singleton, không phụ thuộc feature
│  │  ├─ api/          api.config.ts, api-response.ts (ApiResponse<T>), http-error.mapper.ts
│  │  ├─ auth/         auth.service.ts, auth.guard.ts, auth.interceptor.ts, auth.models.ts
│  │  ├─ realtime/     meeting-hub.service.ts
│  │  ├─ i18n/         locale.service.ts, vi.ts, en.ts   (gộp room-i18n vào đây)
│  │  └─ media/        jitsi.service.ts, speech-recognition.service.ts
│  ├─ layout/
│  │  ├─ app-shell/    shell, sidebar, topbar, bottom-nav (mobile)
│  │  └─ room-shell/   layout full-screen dark cho phòng họp
│  ├─ shared/
│  │  ├─ ui/           page-header, filter-bar, status-badge, avatar, avatar-stack,
│  │  │                kpi-card, section-card, empty-state, error-state, skeleton,
│  │  │                confirm-dialog, file-list-item, activity-item, icon
│  │  ├─ pipes/        relative-date.pipe, file-size.pipe, initials.pipe
│  │  └─ utils/        status-map.ts (nguồn duy nhất nhãn/màu trạng thái), date.ts
│  └─ features/
│     ├─ auth/         login/
│     ├─ dashboard/    dashboard.page.ts, dashboard.service.ts, widgets/{next-meeting,today-list,task-inbox,post-meeting}
│     ├─ meetings/
│     │  ├─ data/      meeting.service.ts, meeting.models.ts, file.service.ts
│     │  ├─ list/      meetings-list.page.ts
│     │  ├─ editor/    meeting-editor.page.ts (tạo/sửa dạng trang hoặc drawer, có bước)
│     │  ├─ detail/    meeting-detail.page.ts, tabs/{overview,participants,documents,ai-minutes,recordings,tasks}
│     │  └─ room/      room.page.ts, prejoin/, stage/, control-bar/, panels/{people,chat,transcript,docs,tasks,ai}, whiteboard/, room.store.ts
│     ├─ tasks/
│     │  ├─ data/      task.service.ts, task.models.ts
│     │  ├─ list/      tasks.page.ts (table + kanban)
│     │  └─ components/ task-editor-modal, task-detail-drawer
│     ├─ directory/    data/, contacts/, titles/, org-tree/
│     └─ profile/
├─ styles/
│  ├─ tokens/         _primitives.scss, _semantic.scss, _semantic-dark.scss, _component.scss
│  ├─ base/           _fonts.scss, _reset.scss, _typography.scss, _scrollbar.scss
│  ├─ vendors/ng-zorro/ _theme.scss (map token → biến ng-zorro), _button.scss, _table.scss,
│  │                   _form.scss, _modal.scss, _drawer.scss, _tabs.scss, _pagination.scss
│  ├─ layout/         _page.scss, _grid.scss
│  ├─ utilities/      _spacing.scss, _text.scss, _visually-hidden.scss
│  └─ index.scss      # chỉ @use theo thứ tự trên
└─ main.ts
```

**Nguyên tắc:**
1. Feature không import lẫn nhau. Phần dùng chung đặt vào `shared/`.
2. Mỗi page component ≤ 300 dòng. Logic phức tạp (phòng họp) tách vào `room.store.ts` (signals) và các component con.
3. Component SCSS chỉ dùng token, **không có mã hex hay `!important`** (lint bằng stylelint).
4. Dùng `@use` thay `@import`. Build hiện đang cảnh báo deprecation ở `styles.scss:1763`.

## C2. Ánh xạ file hiện tại → vị trí mới

| Hiện tại | Mới | Ghi chú |
|---|---|---|
| `core/config/api.config.ts` | `core/api/api.config.ts` | Đọc từ `environment` thay vì hard-code `localhost:5228` |
| `core/models/auth.models.ts` (ApiResponse) | `core/api/api-response.ts` + `core/auth/auth.models.ts` | Tách envelope dùng chung |
| `core/services/auth.service.ts`, `guards/*`, `interceptors/*` | `core/auth/*` | — |
| `core/services/meeting-hub.service.ts` | `core/realtime/` | — |
| `core/services/jitsi.service.ts`, `speech-recognition.service.ts` | `core/media/` | — |
| `core/services/locale.service.ts` + `pages/meetings/room/room-i18n.ts` | `core/i18n/` | Một hệ i18n cho toàn app; ng-zorro dùng `vi_VN` |
| `core/services/meeting.service.ts`, `models/meeting.models.ts`, `models/dashboard.models.ts` | `features/meetings/data/` | Gộp 2 enum `MeetingVisibility` đang trùng ở 2 file |
| `core/services/task.service.ts`, `models/task.models.ts` | `features/tasks/data/` | — |
| `core/services/directory.service.ts`, `models/directory.models.ts` | `features/directory/data/` | — |
| `core/services/dashboard.service.ts` | `features/dashboard/` | — |
| `layout/shell`, `sidebar`, `top-header` | `layout/app-shell/*` | Thêm `bottom-nav` |
| `layout/shell/custom-icon/*` | `shared/ui/icon/` | Chỉ giữ các icon đang dùng (7 file trên khoảng 100) |
| `shared/activity-item`, `shared/file-list-item` | `shared/ui/*` | — |
| `pages/login/*` | `features/auth/login/` | — |
| `pages/dashboard/*` | `features/dashboard/` + `widgets/` | Tách 4 widget |
| `pages/meetings/meetings.*` | `features/meetings/list/` | — |
| `pages/meetings/components/create-meeting-modal/*` | `features/meetings/editor/` | Modal chuyển thành trang hoặc drawer có bước |
| `pages/meetings/detail/meeting-detail.*` + `components/*-tab` | `features/meetings/detail/` + `tabs/*` | Thêm tab `tasks` (gộp route `/meetings/:id/tasks`) |
| `pages/meetings/room/meeting-room.*` (946 + 465 dòng, SCSS 33 KB) | `features/meetings/room/{room.page, prejoin, stage, control-bar, panels/*, room.store}` | Tách theo vùng UI |
| `pages/meetings/room/components/*` | `features/meetings/room/panels/*`, `whiteboard/` | — |
| `pages/tasks/*` + `components/*` | `features/tasks/{list,components}` | — |
| `pages/catalogs/contacts`, `titles` | `features/directory/{contacts,titles,org-tree}` | Tách cây tổ chức thành component riêng |
| `pages/profile/*` | `features/profile/` | — |
| `src/styles.scss` (3.471 dòng) | `src/styles/**` (khoảng 25 partial) | Theo bảng mục 0–18 hiện có |
| `src/theme.less` | `styles/vendors/ng-zorro/_theme.scss` (sinh từ token) | Bỏ khai báo token hai lần |
| `src/styles/_workspace.scss`, `list-page-scroll.scss` | `styles/layout/_page.scss` | — |
| `app.html` (template NG-ZORRO mặc định) | **xóa** | Không được dùng (`app.ts` đã có template inline) |
| `public/img/*VietinBank*`, `logoVTB.png`, `bg-header-portal.png` (7,6 MB)… | **xóa sau khi xác nhận** | Di sản dự án khác |

## C3. Tái cấu trúc điều hướng / IA

**Menu mới:**

```
CHÍNH
  ▣ Tổng quan                 /dashboard
  ▣ Lịch họp                  /meetings          (list | calendar view)
  ▣ Công việc                 /tasks             (table | kanban)
  ▣ Biên bản & Ghi hình       /minutes           (MỚI — tập trung kết quả sau họp, UI-13/14)
TỔ CHỨC  (đổi tên từ "Danh mục", vì "Danh mục" không mô tả nội dung)
  ▣ Danh bạ                   /directory/contacts
  ▣ Chức danh                 /directory/titles
QUẢN TRỊ  (chỉ admin, theo lộ trình Chương 12)
  ▣ Vai trò & quyền           /admin/roles       (UI-18)
  ▣ Cấu hình & mẫu biên bản   /admin/settings    (UI-19)
  ▣ Nhật ký hệ thống          /admin/audit       (UI-20)
  ▣ Báo cáo                   /reports           (UI-16)
```

- **Topbar:** thêm ô "Tham gia bằng mã" toàn cục và tìm kiếm nhanh (Ctrl K) để tìm cuộc họp, công việc và người. Bỏ nút VI/EN khỏi topbar, chuyển vào menu avatar → Ngôn ngữ.
- **Route mới / đổi:** `/meetings/new`, `/meetings/:id/edit`, `/meetings/:id?tab=…`, `/join/:roomCode` (khách, UI-02), `/directory/*` (giữ redirect từ `/catalogs/*` và `/contacts`).
- **Luồng chính rút ngắn:** Tổng quan → [Tham gia] (1 click, vào thẳng phòng chờ) → Phòng họp → khi kết thúc tự chuyển tới **Chi tiết › tab Biên bản AI** → từ biên bản, nút "Tạo công việc" điền sẵn nguồn trích dẫn → Công việc.

---

# D. Lộ trình di chuyển

> **Chỉ là kế hoạch.** Chưa bước nào được thực hiện. Mỗi bước có thể merge độc lập. Sau mỗi bước, chạy lại `node ui-audit/audit.mjs` để so sánh ảnh trước và sau.

| # | Bước | File chạm tới | Rủi ro | Công sức |
|---|---|---|---|---|
| 1 | Sửa `package.json` (đưa `@angular/animations` lên ^22). Thêm stylelint với rule cấm hex, cấm `!important`, cấm px radius trong `app/**/*.scss` (chế độ cảnh báo). | `package.json`, `.stylelintrc` | Thấp | 0,5 ngày |
| 2 | Tạo `styles/tokens/*` (primitive, semantic, dark). Map token cũ `--bs-*`, `--primary-*` sang token mới bằng alias để **không vỡ UI**. | `src/styles/tokens/*`, `styles.scss:171-310` | Thấp | 1 ngày |
| 3 | Sinh theme ng-zorro từ token, bỏ khai báo tay ở `theme.less`. Đổi i18n ng-zorro sang `vi_VN`. | `theme.less`, `app.config.ts` | Trung bình (màu component ng-zorro có thể thay đổi) | 1 ngày |
| 4 | Tách `styles.scss` thành các partial theo mục 0–18, chuyển `@import` sang `@use`. Không đổi selector. | `src/styles.scss` → `src/styles/**`, `angular.json` | Trung bình (thứ tự cascade) | 1,5 ngày |
| 5 | Sửa nhanh a11y và tương phản: `--text-muted` sang slate-500, success/warning sang -700, icon nút dùng `currentColor`, `aria-label` cho select lọc và nút icon, sửa `role` của `.room__tabs`. | `styles/tokens`, `room/*.html`, `meetings.html`, `tasks.html`, `contacts.html`, `titles.html` | Thấp | 1 ngày |
| 6 | Xây `shared/ui` gồm page-header, filter-bar, status-badge (+ `status-map.ts`), avatar (initials, màu xác định), empty-state, error-state, skeleton. | `shared/ui/*` (mới) | Thấp | 3 ngày |
| 7 | Áp `shared/ui` cho 4 trang danh sách. Sửa tràn bảng Tasks và cố định cột thao tác. Thống nhất nút "Tạo …". | `pages/meetings/meetings.*`, `pages/tasks/tasks.*`, `pages/catalogs/**` | Trung bình | 3 ngày |
| 8 | Dời file sang cấu trúc `core/`, `features/`, `shared/` (chỉ đổi đường dẫn import, chưa đổi logic) và cập nhật `app.routes.ts`. | toàn bộ `src/app/**` | Trung bình (dễ xung đột merge, nên làm khi ít branch đang mở) | 1 ngày |
| 9 | Làm lại trang chi tiết cuộc họp: header một dòng meta + CTA, gộp tab Công việc, bỏ card lồng. | `features/meetings/detail/**`, `app.routes.ts` | Trung bình | 2 ngày |
| 10 | Tách `meeting-room` thành room.store, stage, control-bar và panels. Áp dark theme. Gộp điều khiển ngôn ngữ. Split button Rời/Kết thúc. Thống nhất đếm người. | `features/meetings/room/**`, `core/i18n` | **Cao** (realtime, Jitsi, phụ đề) | 5 ngày |
| 11 | Phòng chờ có preview thiết bị (`getUserMedia`, `enumerateDevices`). | `features/meetings/room/prejoin/*` | Trung bình (quyền trình duyệt) | 2 ngày |
| 12 | App shell mới: sidebar trắng, thu gọn được ở tablet, bottom nav và FAB trên mobile, cuộn ở `body`. Đổi menu "Danh mục" thành "Tổ chức". | `layout/**`, `styles/layout/*` | Trung bình | 2 ngày |
| 13 | Form tạo/sửa cuộc họp: chuyển từ modal sang trang hoặc drawer có bước (Thông tin → Thành phần → Cài đặt & AI → Tài liệu). | `features/meetings/editor/**` | Trung bình | 2,5 ngày |
| 14 | Dọn dẹp: xóa `app.html`, asset VietinBank, icon không dùng, các class `btn-vtb-*` (sau khi đã alias), dead CSS (`.smr-page-header`, `.smr-toolbar`). Bật stylelint ở chế độ error. Cập nhật `STYLE.md` theo token mới. | `public/**`, `styles/**`, `STYLE.md` | Thấp (cần xác nhận asset không dùng) | 1 ngày |

**Tổng ước lượng: khoảng 26 ngày công.** Nếu thời gian khóa luận hạn chế, nên ưu tiên các bước **2, 5, 6, 7, 9, 10**. Đây là các bước tác động trực tiếp tới những gì hội đồng sẽ thấy khi demo: danh sách, chi tiết và phòng họp.

---

## Phụ lục: tóm tắt axe-core (cả 2 viewport, 48 lần chụp)

| Rule | Mức | Số node | Màn hình |
|---|---|---|---|
| `color-contrast` | serious | 280 | gần như mọi màn |
| `label` | critical | 61 | meetings, tasks, meeting-tasks, catalogs, modal tạo cuộc họp |
| `aria-prohibited-attr` | serious | 8 | room › người tham gia |
| `aria-required-children` | critical | 6 | room › panels (`.room__tabs`) |

Console error trong môi trường audit chỉ gồm: SignalR negotiation (do hub bị chặn), lỗi 500 cố ý (kịch bản `dashboard-api-error`), và `ERR_FAILED` của request realtime. **Không có runtime exception (`pageerror`) nào từ code ứng dụng.**
