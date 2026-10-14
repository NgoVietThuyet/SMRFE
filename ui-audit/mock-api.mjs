// Mock BE (http://localhost:5228) cho audit UI — dữ liệu dựa trên seed_realistic_master_data.sql.
// Chỉ dùng để chụp màn hình; KHÔNG thay đổi code ứng dụng.
const H = 3600e3;
const base = new Date('2026-10-07T02:00:00Z').getTime(); // 09:00 giờ VN
const iso = (ms) => new Date(ms).toISOString();

export const users = [
  ['an.nguyen', 'Nguyễn Văn An', 'ORG_BOD', 'Ban Tổng Giám đốc', 'CEO', 'Tổng Giám đốc (CEO)'],
  ['binh.tran', 'Trần Thị Bình', 'ORG_TECH', 'Khối Công nghệ & Sản phẩm', 'CTO', 'Giám đốc Công nghệ (CTO)'],
  ['cuong.le', 'Lê Minh Cường', 'ORG_DEV', 'Phòng Phát triển Phần mềm', 'TECH_LEAD', 'Trưởng nhóm Kỹ thuật (Tech Lead)'],
  ['dung.pham', 'Phạm Thu Dung', 'ORG_PROD', 'Phòng Quản trị Sản phẩm & Thiết kế', 'PO_LEAD', 'Trưởng nhóm Quản trị Sản phẩm (Lead PO)'],
  ['hai.vo', 'Võ Thanh Hải', 'ORG_AI', 'Trung tâm Nghiên cứu Trí tuệ Nhân tạo', 'AI_ENG', 'Kỹ sư Trí tuệ Nhân tạo (AI/LLM)'],
  ['lan.do', 'Đỗ Ngọc Lan', 'ORG_QA', 'Phòng Đảm bảo Chất lượng', 'QA_LEAD', 'Trưởng nhóm Kiểm thử (QA Lead)'],
  ['minh.hoang', 'Hoàng Đức Minh', 'ORG_DEV', 'Phòng Phát triển Phần mềm', 'SR_FRONTEND', 'Kỹ sư Frontend Cao cấp (Senior Web)'],
  ['ngoc.bui', 'Bùi Bảo Ngọc', 'ORG_PROD', 'Phòng Quản trị Sản phẩm & Thiết kế', 'UI_UX', 'Chuyên viên Thiết kế Giao diện (UI/UX)'],
  ['quang.dang', 'Đặng Nhật Quang', 'ORG_INFRA', 'Phòng Hạ tầng & An ninh mạng', 'DEVOPS_ENG', 'Kỹ sư Hạ tầng & DevOps (Cloud Engineer)'],
  ['thao.ngo', 'Ngô Phương Thảo', 'ORG_HR', 'Phòng Hành chính - Nhân sự', 'HR_MGR', 'Trưởng phòng Hành chính Nhân sự'],
  ['tuan.vu', 'Vũ Anh Tuấn', 'ORG_SALES', 'Phòng Kinh doanh Doanh nghiệp', 'SALES_MGR', 'Trưởng phòng Kinh doanh'],
  ['yen.ly', 'Lý Hải Yến', 'ORG_FIN', 'Phòng Tài chính - Kế toán', 'CHIEF_ACC', 'Kế toán trưởng'],
].map(([userName, fullName, orgId, organizationName, titleCode, titleName], i) => ({
  userName, fullName, email: `${userName}@smartmeeting.vn`, phone: `09${(12345670 + i * 7919) % 100000000}`.slice(0, 10),
  address: 'Hà Nội', orgId, organizationName, titleCode, titleName, isActive: i !== 10,
  lastLoginAt: iso(base - i * 5 * H), createDate: iso(base - 90 * 24 * H),
}));
export const me = users[2];

const M = (id, name, startOffH, durH, status, extra = {}) => ({
  id, name, description: 'Cuộc họp định kỳ để rà soát tiến độ và thống nhất các quyết định quan trọng.',
  expectedStartTime: iso(base + startOffH * H), expectedEndTime: iso(base + (startOffH + durH) * H),
  status, visibility: 1, roomCode: 'SMR-' + id.slice(-4).toUpperCase(), joinUrl: `/meetings/${id}/join`,
  participantCount: 4 + (id.charCodeAt(id.length - 1) % 8), isHost: startOffH % 2 === 0, hostName: me.fullName, ...extra,
});
export const meetings = [
  M('m-0001', 'Daily stand-up Sprint 14', 0, 0.5, 2),
  M('m-0002', 'Review thiết kế màn hình phòng họp', 1.5, 1, 1),
  M('m-0003', 'Họp kế hoạch tích hợp AI tóm tắt biên bản', 5, 1.5, 1),
  M('m-0004', 'Sprint Planning 15', 26, 2, 1),
  M('m-0005', 'Họp giao ban Khối Công nghệ', 50, 1, 1),
  M('m-0006', 'Demo tính năng phụ đề trực tiếp', -20, 1, 3),
  M('m-0007', 'Retrospective Sprint 13', -48, 1, 3),
  M('m-0008', 'Họp với khách hàng VietinBank — giai đoạn 2', -72, 2, 3),
  M('m-0009', 'Đánh giá bảo mật hạ tầng Q3', -96, 1, 4),
  M('m-0010', 'Workshop quy trình kiểm thử tự động', 74, 3, 0),
  M('m-0011', 'Onboarding nhân sự mới tháng 10', -120, 1, 5),
];

const participants = users.slice(0, 7).map((u, i) => ({
  userName: u.userName, fullName: u.fullName, email: u.email, organizationId: u.orgId, titleCode: u.titleCode,
  role: [1, 2, 3, 4, 4, 5, 5][i], isJoined: i < 4, joinTime: i < 4 ? iso(base - i * 60e3) : null,
}));
const settings = { lobbyEnabled: true, allowGuests: false, allowJoinBeforeHost: false, chatEnabled: true, screenShareEnabled: true,
  whiteboardEnabled: true, fileUploadEnabled: true, recordingEnabled: true, captionsEnabled: true, aiMinutesEnabled: true,
  minutesTemplateId: '', hasPassword: false };
const detail = (m) => ({ ...m, agenda: '1. Rà soát tiến độ\n2. Vướng mắc & rủi ro\n3. Phân công công việc tiếp theo',
  timeZone: 'Asia/Ho_Chi_Minh', cancellationReason: m.status === 4 ? 'Trùng lịch với buổi làm việc của Ban Tổng Giám đốc.' : '',
  settings, participants, rowVersion: 'AAAAAAAAB9E=', canManage: true,
  activity: ['Created', 'Published', 'ParticipantAdded', 'Updated'].map((a, i) => ({ id: 'a' + i, action: a, actorId: me.userName, occurredAt: iso(base - (4 - i) * 24 * H), version: i + 1 })) });

const T = (i, title, meetingIdx, offDays, status, priority, level = 0, extra = {}) => {
  const m = meetingIdx == null ? null : meetings[meetingIdx]; const a = users[(i * 3) % users.length];
  return { id: 't-' + String(i).padStart(4, '0'), meetingId: m?.id ?? null, meetingName: m?.name ?? null, meetingStartTime: m?.expectedStartTime ?? null,
    parentId: null, level, childrenCount: level === 0 ? 3 : 0, completedChildrenCount: level === 0 ? 1 : 0, progress: status === 2 ? 100 : status === 1 ? 45 : 0,
    title, description: 'Chi tiết công việc phát sinh từ cuộc họp.', assigneeUserName: a.userName, assigneeFullName: a.fullName,
    dueDate: offDays == null ? null : iso(base + offDays * 24 * H), status, priority, isPublic: i % 3 === 0, isCreator: i % 2 === 0, canEdit: true,
    createBy: me.userName, createDate: iso(base - 5 * 24 * H), updateDate: iso(base - 24 * H), sourceRef: null, ...extra };
};
export const tasks = [
  T(1, 'Hoàn thiện API tóm tắt biên bản bằng LLM', 2, 2, 1, 2),
  T(2, 'Viết test E2E cho luồng tạo cuộc họp', 6, -1, 0, 2),
  T(3, 'Cập nhật thiết kế màn hình phòng chờ', 1, 0, 1, 1),
  T(4, 'Chuẩn bị tài liệu demo cho khách hàng', 7, 3, 0, 1),
  T(5, 'Cấu hình Jibri ghi hình trên môi trường staging', 5, 5, 0, 0),
  T(6, 'Rà soát phân quyền chủ trì / thư ký', null, -3, 1, 2),
  T(7, 'Tối ưu tốc độ tải danh bạ', null, 7, 2, 0),
  T(8, 'Viết hướng dẫn sử dụng phụ đề trực tiếp', 5, null, 2, 1),
];

const ok = (data, message = 'OK') => ({ status: true, message, data });
const paged = (items, page = 1, pageSize = 20) => ({ items: items.slice((page - 1) * pageSize, page * pageSize), totalItems: items.length,
  totalPages: Math.max(1, Math.ceil(items.length / pageSize)), page, pageSize });

const tabFilter = { upcoming: [1], ongoing: [2], ended: [3], cancelled: [4], draft: [0], archived: [5] };

export function handle(method, path, query, body) {
  const p = path.replace(/^\/api/, '');
  // Auth
  if (p === '/Auth/Login') return ok({ success: true, token: 'mock.jwt.token', refreshToken: 'r', userName: me.userName, fullName: me.fullName, email: me.email, mustChangePassword: false });
  if (p === '/Auth/Profile') return ok({ ...me, organizationName: me.organizationName, titleName: me.titleName });
  if (p.startsWith('/Auth/')) return ok(null);
  // Meeting
  if (p === '/Meeting/dashboard') return ok({ upcoming: 4, ongoing: 1, ended: 3, cancelled: 1, nextMeetings: meetings.filter((m) => m.status === 1 || m.status === 2).slice(0, 5) });
  if (p === '/Meeting/query') {
    let list = meetings;
    if (body?.status != null) list = list.filter((m) => m.status === body.status);
    else if (tabFilter[body?.tab]) list = list.filter((m) => tabFilter[body.tab].includes(m.status));
    if (body?.startDate) list = list.filter((m) => m.expectedStartTime >= body.startDate && m.expectedStartTime <= body.endDate);
    if (body?.keyword) list = list.filter((m) => m.name.toLowerCase().includes(body.keyword.toLowerCase()));
    return ok(paged(list, body?.page, body?.pageSize));
  }
  let mm = p.match(/^\/Meeting\/([^/]+)(\/.*)?$/);
  if (mm) {
    const m = meetings.find((x) => x.id === mm[1]) ?? meetings[0]; const sub = mm[2] ?? '';
    if (!sub) return ok(detail(m));
    if (sub === '/join-info') return ok({ meetingId: m.id, roomName: m.roomCode, domain: 'meet.invalid', externalApiUrl: 'https://meet.invalid/external_api.js', displayName: me.fullName, isModerator: true, startWithAudioMuted: true, startWithVideoMuted: true });
    if (sub === '/messages') return ok([
      { id: 'c1', senderUserId: 'binh.tran', senderName: 'Trần Thị Bình', messageText: 'Mọi người xem giúp slide số 3 nhé.', createdAt: iso(base - 10 * 60e3) },
      { id: 'c2', senderUserId: me.userName, senderName: me.fullName, messageText: 'Đã nhận, em sẽ cập nhật sau buổi họp.', createdAt: iso(base - 8 * 60e3) }]);
    if (sub === '/transcripts') return ok([
      { meetingId: m.id, speakerUserName: 'binh.tran', speakerName: 'Trần Thị Bình', text: 'Chúng ta bắt đầu với phần rà soát tiến độ sprint.', language: 'vi-VN', isFinal: true, timestamp: iso(base - 9 * 60e3) },
      { meetingId: m.id, speakerUserName: me.userName, speakerName: me.fullName, text: 'Phần API tóm tắt đã xong 80%, còn lại phần trích dẫn nguồn.', language: 'vi-VN', isFinal: true, timestamp: iso(base - 7 * 60e3) }]);
    if (sub === '/ai/status') return ok({ meetingId: m.id, indexed: true, chunkCount: 42, lastIndexedAt: iso(base - H), sourcesSummary: 'Transcript, chat, 3 tài liệu' });
    return ok(detail(m));
  }
  // Files
  if (p.startsWith('/File/GetMeetingFiles')) return [
    { id: 'f1', fileName: 'Bao-cao-tien-do-Sprint-14.pdf', fileSize: 1832000, mimeType: 'application/pdf', type: 1, createDate: iso(base - 26 * H) },
    { id: 'f2', fileName: 'Thiet-ke-phong-hop-v3.fig', fileSize: 8420000, mimeType: 'application/octet-stream', type: 1, createDate: iso(base - 30 * H) },
    { id: 'f3', fileName: 'recording-2026-10-06.mp4', fileSize: 254000000, mimeType: 'video/mp4', type: 2, createDate: iso(base - 20 * H) }];
  if (p === '/User/Search') return users.map(({ userName, fullName, email }) => ({ userName, fullName, email }));
  // Task
  if (p === '/Task/query') {
    let list = tasks;
    if (body?.status != null) list = list.filter((t) => t.status === body.status);
    if (body?.meetingId) list = list.filter((t) => t.meetingId === body.meetingId);
    return ok({ ...paged(list, body?.page, body?.pageSize), summary: { total: tasks.length, mine: 5, overdue: 2, today: 1 } });
  }
  mm = p.match(/^\/Task\/([^/]+)$/);
  if (mm) { const t = tasks.find((x) => x.id === mm[1]) ?? tasks[0]; return ok({ ...t, shares: [{ userName: 'dung.pham', fullName: 'Phạm Thu Dung', permission: 1 }], children: tasks.slice(1, 4).map((c) => ({ ...c, parentId: t.id, level: 1 })) }); }
  // Human resources
  if (p === '/human-resources/organization-tree') {
    const orgs = [['ORG_BOD', '', 'Ban Tổng Giám đốc'], ['ORG_TECH', 'ORG_BOD', 'Khối Công nghệ & Sản phẩm'], ['ORG_PROD', 'ORG_BOD', 'Phòng Quản trị Sản phẩm & Thiết kế'],
      ['ORG_BIZ', 'ORG_BOD', 'Khối Kinh doanh & Khách hàng'], ['ORG_CORP', 'ORG_BOD', 'Khối Vận hành & Quản trị Doanh nghiệp'], ['ORG_DEV', 'ORG_TECH', 'Phòng Phát triển Phần mềm'],
      ['ORG_AI', 'ORG_TECH', 'Trung tâm Nghiên cứu Trí tuệ Nhân tạo'], ['ORG_INFRA', 'ORG_TECH', 'Phòng Hạ tầng & An ninh mạng'], ['ORG_QA', 'ORG_TECH', 'Phòng Đảm bảo Chất lượng'],
      ['ORG_SALES', 'ORG_BIZ', 'Phòng Kinh doanh Doanh nghiệp'], ['ORG_HR', 'ORG_CORP', 'Phòng Hành chính - Nhân sự'], ['ORG_FIN', 'ORG_CORP', 'Phòng Tài chính - Kế toán']];
    return orgs.map(([id, pId, name], i) => ({ id, pId, name, orderNumber: i + 1, expanded: true, isActive: true, notes: null, employeeCount: users.filter((u) => u.orgId === id).length }));
  }
  if (p === '/human-resources/titles') {
    const seen = new Map(); users.forEach((u, i) => seen.set(u.titleCode, { code: u.titleCode, name: u.titleName, notes: null, orderNumber: i + 1, isActive: true, employeeCount: 1 }));
    return [...seen.values()];
  }
  if (p === '/human-resources/employees') return paged(users, Number(query.get('page') ?? 1), Number(query.get('pageSize') ?? 20));
  mm = p.match(/^\/human-resources\/employees\/([^/]+)$/);
  if (mm) return users.find((u) => u.userName === decodeURIComponent(mm[1])) ?? users[0];
  return ok(null);
}
