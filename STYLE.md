# SmartMeeting — Style Guide (Legacy Enterprise — Bỏ scale x1.25)

> Nguồn chân lý: `src/theme.less` (Less vars ng-zorro) + `src/styles.scss` (SCSS tokens + overrides) + `src/styles/list-page-scroll.scss`. Đồng bộ với hệ cũ 13 nhóm. Bỏ scale x1.25 — giá trị vật lý chuẩn, không dùng `zoom:1.25`.

## 1. Design Tokens Gốc

### Palette CSS Variables `:root` (`styles.scss:172`)

| Token | Hex | Usage |
|---|---|---|
| `--bs-cyan-deep` / `@primary-color` | `#075985` | Primary, button blue, tab ink, menu active |
| `--bs-blue-ocean` | `#005993` | Link, sider menu text, icon select arrow |
| `--bs-blue-ocean-2` | `#005994` | Biến thể |
| `--bs-sky-primary` | `#0284c7` | Accent |
| `--bs-sky-light` | `#7dd3fc` | Light |
| `--bs-sky-bright` | `#38bdf8` | Bright |
| `--bs-sky-pale` | `#e0f2fe` | Bg badge |
| `--bs-teal-dark` | `#082f49` | Dark |
| `--bs-ice-blue` | `#f1fbfe` | Ice |
| `--bs-border` / `--border-default/strong` | `#C9D9EA` | Border duy nhất toàn hệ thống |
| `--bs-red` / `--danger` | `#dc2626` | Danger, delete, tab detail ink, count badge |
| `--bs-pale-grey` | `#DADADA` |  |
| `--bs-medium-grey` | `#666666` |  |
| `--bs-blue-grey` | `#607D8B` |  |
| `--bs-dark` / `--text-primary` | `#0f172a` / `#1f2937` | Text |
| `--bg-page` | `#f5fafd` | Nền layout `.ant-layout-content.app-content` |
| `--bg-subtle` / zebra even | `#f4f8fb` | Drawer grey, zebra even |
| `--bg-surface` | `#ffffff` | Card, table |

Compat: `--primary-600: var(--bs-cyan-deep)`, `--primary-500:#0369a1`, `--primary-100:#e6f0fa`, `--border-default:var(--bs-border)`.

### Radius — NGUỒN DUY NHẤT

```css
--radius-none:0; --radius-sm:5px (input/button/tag); --radius-md:6px (card/dropdown/modal)
--radius-pill:9999px (badge/chip); --radius-full:50% (avatar)
--bs-border-radius/-sm = var(--radius-sm); -lg/xl/xxl = var(--radius-md)
theme.less: @border-radius-base:5px @border-radius-sm:5px @border-radius-lg:6px
```

Không hard-code `border-radius: px` nơi khác — dùng `var(--radius-*)`.

### Scrollbar

`--sb-w:8px` (dự phòng, runtime `app.ts:setScrollbarWidthVar`/`shell.ts` đo thật ghi đè `:root`), `* {scrollbar-width:thin}`, `::-webkit-scrollbar {width:var(--sb-w)}`, `thumb: background var(--bs-border) radius var(--radius-sm)`, `button {display:none}` fix vuông đè border, `scrollbar-gutter:stable` tại `.list-page-body` + `.ant-drawer-body`.

### Typography

`@font-face SVN-Gilroy 200/100/300/400/500/600/700/800/900/950 + italic`, `body {font-size:16px !important; font-family:var(--app-font-family)}`, global `*:not(.material-icons):not(.anticon):not(.bi):not(.font-mono) {font-family:var(--app-font-family)!important}`, `.ant-select-arrow {color:#005993!important}`.

`--font-size-xs:15px --font-size-sm:16px --font-size-base:16px --font-size-md:20px --font-size-lg:23px --font-size-xl:24px`, `--line-height:1.5`, `--font-family:'SVN-Gilroy',sans-serif`.

### Utilities sinh tự động

- `w-0..100%, h-0..100%, w-1..1000px, h-1..1000px, max-w/h, min-w/h, top/right/bottom/left 0..100%, z-0..100, border-radius-0..100px/%`
- `fw-100..900, fs-10..100px` (`.fs-12` bị override bởi selector table 3 cấp)
- `@each $my-map -> .text-color-*, .bg-color-*, .border-color-*, .text-hover-*`
- `m-0..20 (0-5rem, 0.25rem step), mt/mb/ms/me/mx/my, p/pt/pb/ps/pe/px/py`
- `flex-wrap, justify-content-*, align-items-*, gap-1..10 (4-40px)`, `text-center/start/end/justify`, `cursor-pointer` v.v.
- Compat SMR: `.flex, .gap-*, .text-*, .mt-*, .w-full` giữ.

## 2. Layout Khung

### Shell (`shell.html/scss` + `styles.scss:342`)

```html
<div class="smr-layout">
  <app-sidebar [collapsed]="collapsed()" />
  <div class="smr-content">
    <app-top-header [collapsed]="collapsed()" ... />
    <main class="smr-page"><router-outlet /></main>
  </div>
</div>
```

`:host {display:block;height:100%}`, `.smr-layout {display:flex;height:100vh;overflow:hidden}`, `.smr-content {flex:1;display:flex;flex-direction:column;overflow:hidden;background:#f8fafc->#f5fafd}`, `.smr-page {flex:1;overflow-y:auto;padding:24px 32px (bỏ scale)}`, `.ant-layout-content.app-content {background:#f5fafd!important;padding:0;display:flex;flex-direction:column; >*:not(router-outlet){flex:1;height:100%;overflow:hidden}}`. Trang con không tự thêm padding.

### Sider (`sidebar.scss` + `styles.scss:426`)

`--sidebar-width:376px --sidebar-collapsed-width:64px --app-sider-width:376px` sync tại `shell.ts:syncSiderWidth()`.

- `.smr-brand {height:90px; background:linear-gradient(90deg,#005993 38%,#ea114e 100%); ::before 18% clip-path ::after 16%}` , logo 48px, name 19px 600 #fff.
- `.smr-nav {padding:16 16 10; overflow-y:auto}` collapsed `16 6`; Item `height59 line59 margin0 0 16 bg #fff border1px #e3ecf5 radius8 shadow0 1 3 rgba(15,39,71,.08) font18 weight300 color #005993 i19` hover `#eef5fc` selected `#e3f0fb border #bcdcf4 ::before width4 #075985`. Badge `min-width32 height20 radius999 bg #e60012 font12`.
- `shell.ts` cũng đo `sb-w` thật (`setScrollbarWidthVar`).

### TopHeader (`top-header.scss` + `styles.scss:464`)

Giữ nguyên theo đề xuất: `height70 flex space-between gap20 padding0 30 bg #fff border-bottom1px #C9D9EA`. Left: toggle + back + breadcrumb `gap10`. Right: search `350px` + bell `--unread 9px #075985 border2 #fff` + locale `VI/EN pill 2px border #C9D9EA active #eff6ff #075985` + avatar `30px bg #075985`.

### Portal (giữ nếu dùng)

`vtb-header 66px gradient ::before235 ::after205 clip-path`, `portal-header-bar 66px padding0 30 0 58`.

## 3. Table Render (`styles.scss:935` + legacy bundle)

Header: `.ant-table-thead>tr>th {font-weight:400!important;text-transform:uppercase;font-size:16px!important;background:#fff!important;border-bottom:1px solid var(--bs-border)!important; ::before{display:none!important}}` (tắt vạch ngăn dọc). Trong `.list-page-card` border-bottom đậm hơn.

Body: `td {font-size:16px!important; vertical-align:middle!important}`

Zebra: `tr:nth-child(even)>td {background:#f4f8fb}, odd #fff, tr:hover>td {background:inherit!important} + even:hover #f4f8fb odd:hover #fff, placeholder #fff`.

Container: `.ant-table-container {overflow:hidden;border-bottom-left/right-radius:var(--radius-sm)}` fix vuông-bo.

Row height: `tr.ant-table-row>td {height:76px!important;box-sizing:border-box}` (KHÔNG min-height vì table layout bug), chỉ `tr.ant-table-row` để tránh `nz-table-measure-row height0`.

Cell padding variants: detail `th 8 12 td 12`, meta `.bid-meta-item 10 0 dashed`, `.table-th-cell pl15 border-bottom`, `.cell-min-time min140`, `col-sm 90/md150/min-w-xl 1200`, table cell control `height32 padding0 8 radius-sm`.

Border ngoài: `.border-DADADA {border1px solid var(--bs-border);border-radius:var(--radius-sm)}`.

Scroll vars: `src/styles/list-page-scroll.scss` `--lp-scroll-basic:322 --lp-scroll-tab:385 (=basic+64) --lp-scroll-2row-head:397` dùng `nzScroll.y = calc(100vh - var(--lp-scroll-*))` (bỏ JS đo).

SMR compat: `.smr-section table` cũng áp zebra/header legacy.

## 4. Paging / Pagination

Thanh `list-page-paging` (`styles.scss:legacy`):

`display:flex;justify-content:flex-end;align-items:center;gap:14px;flex-shrink:0;height:62.31px;padding:6 16;border-top1px solid var(--bs-border);background:#fff;font-size:16;color:#64748b;margin-top:auto;z-index:2` Mobile `max-width640 flex-direction column overflow-x auto`.

Ant pagination global:

`.ant-pagination-item {border:none;background:rgb(238 244 255)!important;border-radius:var(--radius-sm)} hover #e1ebfa a #075985 active bg #075985!important border #075985 a #fff`, `prev/next 16px`, `margin0!important`.

Legacy `divPaging`: `bg #fff border1px #C9D9EA radius-sm padding3 8 gap2 span height24`, `paging-nav-btn 24x24 border none bg transparent radius-sm icon18 disabled #cbd5e1 hover #075985 bg rgba(7,89,133,.08)`, `paging-select height24 border none bg transparent selector height24 padding0 16 0 2 font16 weight500 color #333 arrow10 #666`.

SMR `app-pagination` (nếu dùng): `gap12 24 font16 #64748b summary b #0f172a 600`, `__page 28x28 radius999 hover #e1ebfa active #075985`, `size-select margin-left8 selector 28 radius999 border #0284c7`.

## 5. Card

- `.smr-section`/`.dash-card` legacy: `bg #fff border1px #C9D9EA radius-sm overflow hidden shadow none`; `__header {padding12 14 or 0 20 height62 border-bottom1px #C9D9EA bg #fff}`.
- `.vtb-form-panel {bg #fff border1px #C9D9EA radius-sm padding32 margin-bottom16; title flex gap8 margin0 0 32 color #075985 font20 weight500; grid 2col gap4 20 (767 1col)}`.
- `.list-page-card {flex1 margin0 32 bg #fff border1px #C9D9EA radius5 5 0 0 overflow hidden; inner padding32 32 0}`.
- `.border-DADADA / .dash-card-body-scroll {height100% overflow-y auto padding32 flex1 scrollbar 4px}`.

## 6. Button — Hệ 3 màu duy nhất

Base `%btn-vtb-base`: `height48 padding0 20 font16 weight500 radius-sm inline-flex gap6 bg #fff`.

| Kiểu | Border | Color | Alias cũ |
|---|---|---|---|
| `%btn-vtb-gray` (Hủy/Đóng/Reset/Sửa) | `1px #C9D9EA` | `#475569` | `btn-vtb-cancel/reset` |
| `%btn-vtb-blue` (Lưu/Duyệt/Tạo/Mở khóa) | `1px #075985` | `#075985` | `btn-vtb-save/unlock/approve` |
| `%btn-vtb-red` (Xóa/Từ chối/Khóa) | `1px #dc2626` | `#dc2626` + svg currentColor | `btn-vtb-lock/danger/force/warn/reject` |

`.btn-vtb-action.btn-vtb-gray/blue/red` + `.drawer-btn-save -> blue gap4 48x20`, `.drawer-btn-close -> gray 48x48 i18`, `.btn-add-new 48 #075985 shadow hover #0369a1`.

Confirm modal: `.ant-modal-confirm .ant-modal-content radius-sm; body 22 24 18; icon #075985 22; title 15 700 #1f2937; content mt8 16 #475569; btns mt20 default->gray primary->blue dangerous->red; :has(dangerous) icon #dc2626`.

Chiều cao chuẩn 48px toàn cục cuối file: `.ant-btn.ant-btn, .ant-input.ant-input, .ant-input-affix-wrapper, .ant-select-selector {height48!important;font-size16!important;line-height38px!important}` (38=48-2border-8padding), `.ant-select-single.ant-select height48` fix host 32 clip con, multiple auto min48, ngoại lệ `search/refresh 28, pagination size 28, tree btn 28, paging-nav 24`, `change-password affix height auto`.

SMR `.ant-btn-primary` cũng map về `#075985` hover `#0369a1`.

## 7. Input / Select / Picker / Form

Trong `ant-drawer-body`: `input.ant-input/textarea/.ant-input-number {border1px #C9D9EA radius0 height48 line48 padding0 11 font16 #0f172a bg #fff hover/focus #075985 focus shadow 0 0 0 2 rgba(7,89,133,.15) readonly #f8fafc #64748b}`, `affix input {height auto border none}`, `nz-select:not(.paging-select) {height48 selector border1px #C9D9EA radius0 min48 line48 padding0 11}`, `nz-date-picker/.ant-picker {height48 border1px #C9D9EA radius0 padding0 11}`, `textarea min80 padding8 12`.

Ngoài drawer (toolbar): `input.custom-input {border1px #C9D9EA radius0 height36->48}`.

Form label: `.ant-form-item-label {padding0 0 6 height28 label font16 500 #334155 height22 line22 ::after none; &.ant-form-item-required::before none ::after "*" #ef4444 16 ml4 SimSun}`, `.ant-form-item {margin-bottom16}`.

Search icon trong input: `input {padding0 68 0 12 height34}` 2 nút absolute `right32 right4 28x28 #64748b hover #075985`.

## 8. Drawer

`.ant-drawer-content-wrapper {box-shadow: -4 0 24 rgba(15,23,42,.15)}`, `.drawer-grey-background {header/body bg #f4f8fb}`, `.ant-drawer-header {padding32 calc(32+var(--sb-w)) 16 32 min-height96 border none bg #fff; title 24 500 #075985; extra gap8}`, `.ant-drawer-body {padding0 32 16 bg #fff scrollbar-gutter stable}`, inline drawer `.ant-drawer:has(>.layout-inline-drawer){left var(--app-sider-width)}`, modal inline `.ant-modal-wrap.layout-inline-modal {left var(--app-sider-width)}`.

## 9. Tabs

Global: `.ant-tabs-nav-list {gap4}`, `.ant-tabs-tab {padding6 12 or 12 0 margin0 4 0 0 or 32?)}`.

List tabs `.list-page-tab-header {height64 min64 padding0 32 16 bg transparent flex stretch gap12; tabset flex1 height48 width100% nav height100% justify flex-start stretch ::before none, tab inline-flex align center height100% padding0 10 font16 ink bottom0, content-holder none}`, badge count `.list-page-tab-count {min25 height20 ml3 padding0 6 top -9 radius-pill bg #dc2626 #fff font12 500 is-active same}`.

Detail tabs `.bid-detail-tabs {width100% padding0 border-top none; nav::before border-bottom1px #C9D9EA; ink bg #dc2626; tab #9eb3c9 active #062a46; separator ::before 1x14 #d7e2ec, tab padding8 12 8 0 + sibling pl12 font16}`.

SMR `.ant-tabs-ink-bar #075985 height2, active #075985`.

## 10. List Page Kiến Trúc

```
.list-page (or .list-page-tabs) {flex1 height100% overflow hidden bg transparent}
  > .list-page-header {flex-shrink0 padding32 32 24 bg transparent gap12}
      .list-page-header-back {34x34 radius-sm #45566e hover #f1f5f9 #075985}
      .list-page-header-title {flex1 gap10}
        .list-page-header-heading {font24 500 #075985 line1.35}
        .list-page-header-subtitle {font16 #94a3b8}
      .list-page-header-actions {gap8 flex-wrap justify flex-end ml auto form contents .ant-btn 48}
      .list-page-header-search {height34 width240 (is-wide300/is-sm30 100%) bg #fff border #C9D9EA radius0 padding0 12 font16}
      .list-page-header-select {width260 min200 max320 flex0 0 260 height34 selector 34 radius0}
      .list-page-header-icon-btn {48x48 radius-sm bg #fff border1px #C9D9EA #45566e hover #075985}
  > .list-page-card {flex1 margin0 32 bg #fff border1px #C9D9EA radius5 5 0 0 overflow hidden}
      .list-page-card-inner {flex1 padding32 32 0}
        .list-page-filter-bar {flex-shrink0 padding0 var(--sb-w) 12 0 bg #fff gap8}
          label {font16 #64748b}
          row {gap0 search~* ml8; search flex1 260 height34 input padding0 68 0 12; phase 220 height34}
        .list-page-body {flex1 overflow auto bg #fff scrollbar-gutter stable padding0}
          table-wrapper width100% ; tr>td middle height76
        .list-page-paging {height62.31 ...}
```

Bộ lọc popup: `trigger relative inline-flex is-filtering border #075985 bg #e6f0fa, btn radius0, count absolute -6 -6 min18 h18 radius-pill bg #075985 border #fff font10 600, popover inner0 radius-md transform-origin top right anim .18s, list-filter 520 (wide640) max100vw-32, head 10 16 border-bottom bg #f8fafc title20 500 #075985 badge pill18, body grid2col gap12 16 padding14 16 field span16 600 #334155, range gap8 picker48 radius0, foot flex-end gap8 padding10 16 border-top, mobile 820 1col`.

## 11. Detail Page

`.detail-page {flex column width100% height100% overflow-x hidden bg #fff min-height calc(100vh-48)}`, `.detail-scroll-pane {overflow-y auto pb50}`, `.bid-detail-header {flex column flex-shrink0 width100% bg #fff border-bottom1px #C9D9EA margin0 0 12}`, top `flex row between gap12 padding10 16`, title flex1, back `ml auto`, tabs `width100% padding0 border-top none`, body `flex1 padding16 overflow-y auto`, `vtb-detail-toolbar {flex between wrap gap8 mb32 padding8 12 bg #fff border1px #C9D9EA; total 16 600 #075985 amount 16 700 #dc2626}`.

## 12. Các Component Khác

- Badge/tag: `nz-tag.ant-tag, .badge {radius-sm weight500 padding1 8 line20} tag11 badge16`
- Checkbox chuẩn: `.vtb-check-options flex column gap2, option flex align center gap8 width100% padding6 border none font16 line1.35 hover #f1f5f9 is-checked #075985 weight600 tick 16x16 border1px #C9D9EA radius0 bg #fff icon12 is-checked tick #075985 bg #075985 icon opacity1; disabled tick #e2e8f0 bg #f1f5f9, box variant width auto padding2, mobile 991 flex row wrap`
- Tree: `.list-page-tree.ant-tree bg transparent font16 overflow-x hidden, treenode flex align center width100% min-height40 mb2 indent20 switcher 24x40 #075985 icon22, content-wrapper flex1 min40 line40 padding0 bg transparent, tree-list-row flex gap8 min40 padding0 8 0 4 radius-sm hover #f4f6f8, code 22 bg #e6f0fa #075985 11.5 700 radius-sm, name16 #333d4d ellipsis, actions width60 gap2 btn28 bg transparent add #075985 hover #e6f0fa delete #e5484d hover #fff1f0`
- Timeline: `vtb-timeline flex column; indicator width48 mr16 flex column center; line 1.5 #cbd5e1 left50% translate -50%; avatar 48x48 radius50 bg #fff border #cbd5e1 img cover scale1.15; avatar-text 18 700 #fff bg #075985; header between mb4 name16 500 #062a46; reply14 #005993 hover underline; time13 #005993 mb12; box bg #f7f6fb radius4 padding10 color #334155 15 line1.5; wrapper border-left2 #cbd5e1 pl10`
- Transfer: `.transfer-full width100% mb12 &.ant-transfer flex gap20 font16; list width50% flex1 height calc(100vh-140); checkbox font16`
- Notification: `.ant-message top80 z100000, .custom-notification padding12 desc max-height calc(100vh-136) overflow auto`

## 13. Quy chuẩn thay đổi

- **Bỏ scale x1.25:** tokens về vật lý chuẩn, xóa `zoom:1.25` trong `.smr-sidebar > *`, `--space-* 5/10/15... -> 4/8/12...`, `--control-height 45 -> 48`, `--sidebar-width 400 -> 376`.
- **Primary:** `#2563EB -> #075985` (theme.less + :root).
- **Border:** `#e2e8f0 -> #C9D9EA`.
- **Radius:** `4/5/8 -> 5/6/9999/50%` duy nhất.
- **Table:** header `#f8fafc -> #fff uppercase`, zebra giữ, row `48-56 -> 76`.
- **Paging:** thêm `62.31px` sticky bottom.
- **Card:** thêm `.list-page-card` floating `margin0 32 radius5 5 0 0`.
- **Button:** hệ 3 màu duy nhất + 48px toàn cục.
- **Scroll:** `8px fixed -> var(--sb-w) đo thật + gutter stable`.

## 14. File Mapping

- `src/theme.less` — Less vars đồng bộ legacy
- `src/styles.scss` — SCSS global (tokens + resets + scrollbar + legacy bundle)
- `src/styles/list-page-scroll.scss` — vars scroll
- `src/app/layout/shell/shell.ts` — sync `--app-sider-width` + `--sb-w`
- `src/app/layout/sidebar/sidebar.scss` — menu 59px legacy
- `src/app/layout/top-header/*` — giữ, border #C9D9EA
- Các page `dashboard/meetings/tasks/contacts` — kế thừa tokens, có thể migrate sang `.list-page*` khi cần

## 15. MUST / MUST NOT (cập nhật)

MUST: dùng `var(--bs-border)`/`var(--radius-*)`, table header uppercase, row 76, paging 62.31, button 3 màu, drawer 32+sb-w, list-page thẻ nổi, scroll vars.

MUST NOT: hard-code radius px, dùng `@height-base 45`, border `#e2e8f0`, header `#f8fafc`, scale `x1.25`/`zoom`, measure-row bị đè.

---
*Cập nhật 2026-09-14 — áp toàn bộ spec cũ, bỏ scale, đồng bộ 13 nhóm.*
