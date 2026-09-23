# Frontend Design — SmartMeeting

## 1. Mục đích

`frontend-design.md` là quy định thiết kế frontend dành riêng cho SmartMeeting, được chuyển hóa từ tư duy của `frontend-design/SKILL.md` thành các nguyên tắc phù hợp với một hệ thống cộng tác và quản lý cuộc họp doanh nghiệp.

Mục tiêu:
- Tạo giao diện có chủ đích, không mang cảm giác template.
- Ưu tiên khả năng hoàn thành công việc hơn trang trí.
- Giữ bản sắc SmartMeeting nhất quán trên toàn hệ thống.
- Dùng đúng ngữ cảnh doanh nghiệp: rõ ràng, tin cậy, mật độ thông tin hợp lý.
- Không biến frontend-design thành lý do để thêm hiệu ứng hoặc thành phần không cần thiết.

> SmartMeeting là enterprise productivity application, không phải landing page, portfolio hoặc marketing website.

---

## 2. Định hướng thiết kế

### 2.1. Design direction

SmartMeeting sử dụng hướng:

**Clean Enterprise / Productivity UI**

Đặc trưng:
- Sáng, sạch, trung tính.
- Chủ đạo trắng + xanh dương.
- Mật độ thông tin trung bình đến cao.
- Cấu trúc rõ ràng.
- Border mảnh.
- Radius nhỏ.
- Shadow tối thiểu.
- Typography dễ đọc.
- Ít hiệu ứng.
- Ít yếu tố trang trí.
- Ưu tiên table, list, toolbar, tabs và section hơn card.

Không sử dụng mặc định:
- Glassmorphism.
- Gradient lớn.
- Neon.
- Background decoration.
- Blob.
- Heavy shadow.
- Card bo tròn lớn.
- Dashboard KPI card hàng loạt.
- Animation để gây ấn tượng.
- Icon hoặc illustration chỉ để lấp khoảng trống.

---

## 3. Nguyên tắc cốt lõi

### 3.1. Thiết kế phải bắt đầu từ subject

Trước khi tạo một screen mới, xác định:
1. Người dùng là ai?
2. Họ đang ở đâu trong hệ thống?
3. Họ cần làm gì?
4. Thông tin nào quan trọng nhất?
5. Hành động chính là gì?
6. Trạng thái nào có thể xảy ra?

Không bắt đầu bằng: "Trang này nên có card gì?"

Mà bắt đầu bằng: "Người dùng cần hoàn thành việc gì trên trang này?"

### 3.2. Mỗi screen có một primary intent

Mỗi screen phải có một mục đích chính.

| Screen | Primary intent |
|---|---|
| Dashboard | Nắm nhanh tình hình và đi tới công việc cần làm |
| Meeting List | Tìm và quản lý cuộc họp |
| Meeting Detail | Xem và thao tác với một cuộc họp |
| Document List | Tìm và quản lý tài liệu |
| Document Detail | Xem/chỉnh sửa một tài liệu |
| Personnel List | Tìm và quản lý người dùng |
| Meeting Room | Tham gia và cộng tác trong cuộc họp |
| Minutes | Xem và xử lý biên bản |

Không thêm section chỉ vì "trang đang trống".

### 3.3. Mỗi element chỉ có một job

- Label → mô tả field.
- Button → thực hiện action.
- Status → biểu diễn trạng thái.
- Breadcrumb → cho biết context.
- Table → hiển thị dữ liệu có cấu trúc.
- Search → tìm kiếm.
- Filter → lọc.
- Empty state → hướng dẫn bước tiếp theo.

---

## 4. Design planning trước khi code

Không code UI ngay khi nhận yêu cầu.

Trước tiên phải lập một design plan ngắn.

### 4.1. Color

Sử dụng Design System hiện tại:

Primary:
```text
#2563EB
#3B82F6
#DBEAFE
#EFF6FF
```

Neutral:
```text
#F8FAFC
#FFFFFF
#F1F5F9
#E2E8F0
#CBD5E1
#0F172A
#475569
#94A3B8
```

Semantic:
```text
Success #16A34A
Warning #D97706
Danger  #DC2626
Info    #2563EB
```

Không tự tạo màu mới cho từng screen nếu token hiện tại đã đáp ứng.

### 4.2. Typography

Font implementation hiện tại của SmartMeeting:

```text
SVN-Gilroy
```

Fallback:

```text
'Segoe UI', Arial, sans-serif
```

Typography phải phục vụ khả năng đọc dữ liệu:
- Page title rõ nhưng không oversized.
- Section title phân cấp vừa đủ.
- Body dễ đọc.
- Data ưu tiên khả năng scan.
- Không dùng nhiều font family trên cùng một screen.
- Không dùng typography như decoration.

### 4.3. Layout

Mỗi screen phải xác định:
- AppShell.
- Sidebar.
- Top Header.
- Screen content.
- Section.
- Data region.
- Action region.
- Responsive behavior.

Wireframe phải được xác định trước khi code.

```text
┌──────────────────────────────────────────────────────────┐
│ Sidebar │ Top Header                                    │
├─────────┼────────────────────────────────────────────────┤
│         │ Section Header                    Action       │
│         ├────────────────────────────────────────────────┤
│         │ Filter / Search                                │
│         ├────────────────────────────────────────────────┤
│         │ Data Table / List                              │
│         ├────────────────────────────────────────────────┤
│         │ Pagination                                     │
└─────────┴────────────────────────────────────────────────┘
```

---

## 5. Visual identity của SmartMeeting

### 5.1. Signature

Signature của SmartMeeting không phải animation hay illustration.

Signature là:

**Information-first enterprise workspace**

Thể hiện qua:
- Sidebar điều hướng ổn định.
- Top Header thể hiện context.
- Section rõ ràng.
- Toolbar gọn.
- Data table/list có mật độ hợp lý.
- Status nhất quán.
- Primary action nổi bật vừa đủ.
- Không trang trí thừa.

### 5.2. Visual hierarchy

Ưu tiên:

```text
Context
  ↓
Page / Screen purpose
  ↓
Primary action
  ↓
Important information
  ↓
Secondary information
  ↓
Supporting actions
```

Không để secondary action, icon, decoration hoặc status color át nội dung quan trọng.

---

## 6. Layout principles

### 6.1. AppShell

```text
AppShell
├── Sidebar
├── TopHeader
└── Screen
```

Desktop:
- Sidebar expanded: 240px.
- Sidebar collapsed: 64px.
- Top Header: 56px.

Mobile:
- Sidebar chuyển thành Drawer.
- Top Header vẫn 56px.
- Screen padding giảm.

### 6.2. Page title

Page Title nằm trong Top Header.

Không tạo Page Header riêng chỉ để lặp lại title.

```text
[Sidebar Toggle]
[Primary Icon]
[Page Title]
[Breadcrumb / Current Context]
[Global Search]
[Notification]
[Language]
[Avatar]
```

Page-specific action không đưa vào global header.

### 6.3. Page-specific action

Action thuộc screen phải nằm trong screen.

```text
Cuộc họp
────────────────────────────────────────
[ Tạo cuộc họp ]

[ Tìm kiếm ] [ Trạng thái ] [ Thời gian ]

Data table
```

---

## 7. Information architecture

### 7.1. Ưu tiên cấu trúc thay vì decoration

Dùng:
- Section.
- Divider.
- Table.
- List.
- Tabs.
- Toolbar.
- Breadcrumb.
- Status.
- Alignment.

Chỉ dùng decorative element nếu nó có ý nghĩa với nội dung.

Không dùng numbering nếu con số không biểu diễn thứ tự hoặc sequence thực sự.

---

## 8. Component principles

### 8.1. Reuse trước khi tạo mới

Thứ tự:
1. Kiểm tra component chung.
2. Kiểm tra ng-zorro.
3. Nếu đã tồn tại → reuse.
4. Nếu cần khác biệt → wrap/extend.
5. Chỉ tạo `.smr-*` khi là pattern đặc thù của SmartMeeting.

Không tạo lại Button, Input, Select, Modal, Table, Pagination, Tabs, Avatar, Status cho từng screen.

### 8.2. Component responsibility

```text
BaseButton  → action
SearchInput → search
FilterBar   → filtering
DataTable   → structured data
StatusBadge → status
EmptyState  → next action when no data
```

Không biến một component thành "god component".

---

## 9. Cards

Card không phải layout mặc định.

Chỉ dùng card khi cần tách một nhóm nội dung có boundary rõ.

Ưu tiên:

```text
Section
  └── content
```

thay vì nested cards.

Dashboard SmartMeeting không dùng hàng loạt KPI/statistic cards chỉ để tạo cảm giác dashboard.

---

## 10. Tables và data-heavy UI

Table/list là first-class UI của SmartMeeting.

Ưu tiên:
- Scan nhanh.
- Alignment.
- Column hierarchy.
- Status.
- Row action.
- Sorting/filtering khi cần.
- Responsive overflow hợp lý.

Không:
- Nhồi quá nhiều action vào row.
- Dùng màu cho mọi column.
- Biến mỗi row thành card.
- Dùng icon không có tooltip/ý nghĩa rõ ràng.

---

## 11. Color usage

Màu không dùng để trang trí.

Primary blue:
- Primary action.
- Link.
- Active navigation.
- Focus.
- Selected state.
- Information.

Green:
- Success.
- In progress.
- Completed khi phù hợp.

Orange:
- Warning.
- Pending.
- Attention.

Red:
- Error.
- Destructive action.
- Cancelled.
- Validation error.

---

## 12. Radius và border

```text
Button: 4px
Input: 4px
Select: 4px
Panel: 4px
Table: 4px
Modal: 6px
Tag: 3px
Avatar: 50%
```

Không tự ý dùng radius 12px, 16px, 20px, 24px cho business components thông thường.

Border:
```text
Default: #E2E8F0
Strong/Input: #CBD5E1
```

Border được ưu tiên hơn shadow để phân tách vùng.

---

## 13. Shadow

Không dùng shadow cho:
- Sidebar.
- Header.
- Table.
- Section.
- Panel thông thường.

Chỉ dùng shadow nhẹ cho:
- Modal.
- Dropdown.
- Popover.
- Tooltip.
- Date picker.
- Context menu.

Shadow biểu diễn elevation, không phải trang trí.

---

## 14. Motion

Motion phải có lý do.

Có thể dùng cho:
- Drawer open/close.
- Modal open/close.
- Dropdown.
- Loading transition.
- State transition.
- Hover/focus feedback.
- Realtime meeting interactions.

Không dùng:
- Page-load animation dài.
- Scroll animation hàng loạt.
- Parallax.
- Floating decoration.
- Animation chỉ để gây ấn tượng.

Nguyên tắc:

> Nếu bỏ animation mà UX không giảm, animation đó có thể không cần thiết.

Luôn tôn trọng `prefers-reduced-motion`.

---

## 15. Responsive design

Responsive không phải chỉ làm nhỏ desktop.

Mỗi screen phải xác định:
- Desktop layout.
- Laptop layout.
- Tablet behavior.
- Mobile behavior.
- Overflow behavior.
- Hidden/collapsed behavior.
- Touch target.

Breakpoints:

```text
Desktop: >= 1280px
Laptop:  1024–1279px
Tablet:  768–1023px
Mobile:  < 768px
```

Table trên mobile có thể horizontal scroll nếu chuyển sang list làm mất khả năng sử dụng.

---

## 16. Accessibility

Frontend phải đạt quality floor:
- Keyboard navigation.
- Visible focus.
- Semantic HTML khi phù hợp.
- Button có accessible name.
- Input có label.
- Icon-only button có tooltip/aria-label phù hợp.
- Color không phải phương thức duy nhất để biểu diễn trạng thái.
- Contrast đủ đọc.
- Reduced motion được hỗ trợ.

---

## 17. Content và microcopy

Text là một phần của design.

### 17.1. Viết từ góc nhìn người dùng

Dùng:

```text
Tạo cuộc họp
Lưu thay đổi
Xóa cuộc họp
Tham gia cuộc họp
Tải tài liệu
```

Không dùng technical wording như Submit, Execute, Trigger API, Create Entity nếu người dùng không cần biết.

### 17.2. Action phải nói rõ kết quả

Không ưu tiên:

```text
Submit
OK
Action
Process
Continue
```

nếu có thể nói chính xác:

```text
Lưu thay đổi
Xóa cuộc họp
Tham gia
Tải xuống
Tạo cuộc họp
```

Tên action phải nhất quán xuyên suốt workflow.

### 17.3. Không dùng copy để trang trí

Ưu tiên:
```text
Cuộc họp sắp tới
Tài liệu gần đây
Hoạt động gần đây
```

thay vì các câu marketing không phục vụ task.

---

## 18. Loading state

Loading là trạng thái UI chính thức.

Phải xác định loading cho:
- Page.
- Table.
- List.
- Button action.
- Modal.
- Meeting room.
- AI processing.

Không để màn hình trắng trong lúc chờ API.

---

## 19. Empty state

Empty state phải trả lời:
1. Hiện tại không có gì?
2. Tại sao?
3. Người dùng có thể làm gì tiếp?

Ví dụ:

```text
Chưa có cuộc họp sắp tới

Bạn chưa có cuộc họp nào được lên lịch.

[ Tạo cuộc họp ]
```

Không dùng illustration lớn nếu không giúp người dùng hiểu hoặc hành động.

---

## 20. Error state

Error phải:
- Nói rõ vấn đề.
- Không đổ lỗi cho người dùng.
- Không vague.
- Có hướng xử lý nếu có thể.

Ví dụ:

```text
Không thể tải danh sách cuộc họp.

Vui lòng thử lại.

[ Thử lại ]
```

---

## 21. Destructive action

Các action nguy hiểm:
```text
Xóa
Kết thúc cuộc họp
Xóa tài liệu
Xóa người tham gia
```

Dùng Danger style.

Nếu action không thể hoàn tác, phải có confirmation phù hợp.

Confirmation phải nói rõ:
- Đang xóa gì.
- Hậu quả.
- Action xác nhận.

---

## 22. State-driven design

Không chỉ thiết kế happy path.

Mỗi screen cần xem xét:

```text
Normal
Loading
Empty
Error
Disabled
Success
Selected
Focused
Hover
Active
Permission denied
No permission
```

Meeting states:

```text
Upcoming
In progress
Ended
Cancelled
```

State phải được thể hiện nhất quán bằng component chung.

---

## 23. Meeting Room

Meeting Room là screen đặc biệt.

Primary intent:

**Tham gia và cộng tác trong cuộc họp.**

Hierarchy:

```text
Meeting context
        ↓
Video / participants
        ↓
Meeting controls
        ↓
Collaboration
        ├── Chat
        ├── Documents
        ├── Whiteboard
        └── Participants
```

Realtime state quan trọng hơn decoration.

Controls phải dễ tìm, dễ thao tác và có feedback rõ.

---

## 24. Dashboard

Primary intent:

**Nắm nhanh tình hình và đi tới công việc cần làm.**

Cấu trúc ưu tiên:

```text
Upcoming Meetings
Recent Meetings
Recent Documents
Recent Activity
```

Không mặc định dùng KPI cards, big number cards hoặc decorative charts nếu không phục vụ nghiệp vụ SmartMeeting.

---

## 25. One deliberate visual decision

Mỗi screen có thể có một điểm nhấn visual có chủ đích.

Với SmartMeeting, điểm nhấn nên đến từ:
- hierarchy;
- spacing;
- data density;
- status;
- selected state;
- interaction;
- contextual information.

Không cố tạo "wow effect".

> Spend visual boldness in one place, then keep everything else disciplined.

---

## 26. Anti-template checklist

Trước khi hoàn thành screen:

- [ ] Có đang dùng card chỉ vì "dashboard nên có card" không?
- [ ] Có gradient không cần thiết không?
- [ ] Có shadow không cần thiết không?
- [ ] Có radius quá lớn không?
- [ ] Có icon trang trí không?
- [ ] Có animation chỉ để làm đẹp không?
- [ ] Có section nào không phục vụ primary intent không?
- [ ] Có button nào không rõ action không?
- [ ] Có màu nào không thuộc Design System không?
- [ ] Có typography nào không có lý do không?
- [ ] Có duplicate component không?
- [ ] Có thông tin nào có thể loại bỏ không?

Nếu có, simplify trước khi hoàn thành.

---

## 27. Design critique trước khi code

AI Agent phải tự review plan:

### Question 1
Thiết kế này có thể được copy cho một SaaS khác mà gần như không cần thay đổi không?

Nếu có → chưa đủ specific.

### Question 2
Mọi visual decision có xuất phát từ SmartMeeting không?

Nếu không → loại bỏ hoặc thay đổi.

### Question 3
Có element nào chỉ tồn tại để làm đẹp không?

Nếu có → loại bỏ nếu không tạo giá trị.

### Question 4
Primary intent có rõ ngay khi mở screen không?

Nếu không → sửa hierarchy.

### Question 5
Screen có quá nhiều visual emphasis không?

Nếu có → giữ lại một hierarchy chính.

---

## 28. Implementation rules

Khi code:

1. Đọc `style.md`.
2. Đọc `rules.md`.
3. Đọc module specification tương ứng.
4. Xác định primary intent.
5. Xác định Layout.
6. Xác định Style.
7. Reuse common components.
8. Reuse ng-zorro.
9. Implement responsive.
10. Implement states.
11. Kiểm tra accessibility.
12. Chạy simplification audit.

Không được:
- Tự tạo design system riêng trong từng module.
- Tự đổi màu primary.
- Tự đổi radius.
- Tự thêm font.
- Tự thêm animation framework chỉ cho một screen.
- Rebuild component đã tồn tại.
- Hard-code style phá vỡ token chung.

---

## 29. Quy tắc Layout + Style

Mọi UI specification của SmartMeeting phải được mô tả theo:

```md
# [UI Name]

## 1. Layout

Mô tả cấu trúc:
- Thành phần nào tồn tại.
- Thành phần nằm ở đâu.
- Thứ tự.
- Kích thước.
- Quan hệ giữa các vùng.
- Responsive behavior.

## 2. Style

Mô tả:
- Màu.
- Typography.
- Border.
- Radius.
- Shadow.
- Spacing.
- Hover.
- Focus.
- Active.
- Disabled.
- Error.
```

Không trộn Layout và Style.

---

## 30. Definition of Done

### Design
- [ ] Primary intent rõ.
- [ ] Layout phản ánh workflow.
- [ ] Visual hierarchy rõ.
- [ ] Tuân thủ SmartMeeting Design System.
- [ ] Không có decoration thừa.
- [ ] Không có template pattern không cần thiết.

### Component
- [ ] Reuse common components.
- [ ] Reuse ng-zorro khi phù hợp.
- [ ] Không duplicate component.
- [ ] Component có responsibility rõ.

### State
- [ ] Normal.
- [ ] Loading.
- [ ] Empty.
- [ ] Error.
- [ ] Disabled.
- [ ] Success/feedback khi cần.

### Responsive
- [ ] Desktop.
- [ ] Laptop.
- [ ] Tablet.
- [ ] Mobile.

### Accessibility
- [ ] Keyboard.
- [ ] Focus.
- [ ] Label.
- [ ] Accessible icon action.
- [ ] Contrast.
- [ ] Reduced motion.

### Final critique
- [ ] Đã loại bỏ element không tạo giá trị.
- [ ] Không có visual effect chỉ để gây ấn tượng.
- [ ] Screen vẫn rõ ràng khi giảm decoration.
- [ ] Người dùng hiểu primary action ngay.

---

## 31. Nguyên tắc cuối cùng

SmartMeeting không cần trở thành một sản phẩm "artistic".

Mục tiêu của frontend-design trong SmartMeeting là:

```text
Intentional
    ↓
Clear
    ↓
Consistent
    ↓
Efficient
    ↓
Distinctive
```

Sự khác biệt của SmartMeeting đến từ cách nó tổ chức và trình bày công việc của người dùng, không phải từ việc thêm nhiều hiệu ứng.

**Design less. Decide more.**
