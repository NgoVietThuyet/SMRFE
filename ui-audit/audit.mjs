// UI/UX audit — chụp mọi route ở 1440px & 375px, ghi console error, request lỗi, axe-core.
// Chạy: node ui-audit/audit.mjs [baseUrl]   (app phải đang chạy, mặc định http://localhost:4200)
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import fs from 'node:fs';
import path from 'node:path';
import { handle, me } from './mock-api.mjs';

const BASE = process.argv[2] ?? 'http://localhost:4200';
const OUT = path.resolve('ui-audit/output');
fs.mkdirSync(OUT, { recursive: true });

const viewports = { desktop: { width: 1440, height: 900 }, mobile: { width: 375, height: 812 } };

// name, url, auth?, action (tùy chọn: mở modal/tab để chụp trạng thái)
const scenarios = [
  ['login', '/login', false],
  ['login-error', '/login', false, async (p) => {
    await p.route('**/api/Auth/Login', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: false, message: 'Sai tài khoản hoặc mật khẩu', data: null }) }));
    await p.locator('input').first().fill('sai@smartmeeting.vn');
    await p.locator('input[type=password]').fill('123456');
    await p.locator('button[type=submit], button:has-text("Đăng nhập")').first().click();
  }],
  ['dashboard', '/dashboard', true],
  ['meetings', '/meetings', true],
  ['meetings-create-modal', '/meetings', true, async (p) => { await p.getByRole('button', { name: /tạo|thêm|cuộc họp mới/i }).first().click(); }],
  ['meeting-detail', '/meetings/m-0002', true],
  ['meeting-detail-participants', '/meetings/m-0002', true, async (p) => { await p.getByRole('tab', { name: /người tham gia|thành phần/i }).first().click(); }],
  ['meeting-detail-post', '/meetings/m-0006', true, async (p) => { await p.getByRole('tab', { name: /sau cuộc họp|biên bản/i }).first().click(); }],
  ['meeting-tasks', '/meetings/m-0003/tasks', true],
  ['meeting-room-prejoin', '/meetings/m-0002/join', true],
  ['meeting-room-live', '/meetings/m-0001/join', true],
  ['meeting-room-chat', '/meetings/m-0001/join', true, async (p) => { await clickByHandler(p, "togglePanel('chat')"); }],
  ['meeting-room-transcript', '/meetings/m-0001/join', true, async (p) => { await clickByHandler(p, "togglePanel('chat')"); await p.locator('[role=tab][title="Phiên âm"]').click(); }],
  ['meeting-room-participants', '/meetings/m-0001/join', true, async (p) => { await clickByHandler(p, "togglePanel('participants')"); }],
  ['meeting-room-ai', '/meetings/m-0001/join', true, async (p) => { await clickByHandler(p, "togglePanel('chat')"); await p.locator('[role=tab][title="Trợ lý AI"]').click(); }],
  ['tasks', '/tasks', true],
  ['tasks-detail-drawer', '/tasks', true, async (p) => { await p.locator('.responsive-card:visible, .task-row:visible').first().click(); }],
  ['tasks-create-modal', '/tasks', true, async (p) => { await p.locator('#btn-create-task').click(); }],
  ['profile', '/profile', true],
  ['catalog-contacts', '/catalogs/contacts', true],
  ['catalog-titles', '/catalogs/titles', true],
  ['dashboard-empty', '/dashboard', true, null, { empty: true }],
  ['meetings-empty', '/meetings', true, null, { empty: true }],
  ['dashboard-api-error', '/dashboard', true, null, { fail: true }],
];

const JITSI_STUB = `window.JitsiMeetExternalAPI = class {
  constructor(d, o) { this.h = {}; const n = o.parentNode; n.innerHTML = '<div style="width:100%;height:100%;display:grid;grid-template-columns:repeat(2,1fr);gap:8px;padding:8px;box-sizing:border-box;background:#111827">' +
    ['Lê Minh Cường','Trần Thị Bình','Phạm Thu Dung','Võ Thanh Hải'].map(x => '<div style="background:#1f2937;border-radius:12px;display:flex;align-items:flex-end;padding:12px;color:#e5e7eb;font:14px sans-serif">' + x + '</div>').join('') + '</div>';
    setTimeout(() => (this.h.videoConferenceJoined || []).forEach(f => f({})), 300); }
  addEventListener(e, f) { (this.h[e] ||= []).push(f); } removeEventListener() {} executeCommand() {} dispose() {}
  getNumberOfParticipants() { return 4; } isAudioMuted() { return Promise.resolve(true); } isVideoMuted() { return Promise.resolve(true); }
};`;
async function clickByHandler(p, handler) {
  // Angular không giữ (click) trong DOM → tìm nút theo aria-label/title/text của panel
  await p.waitForTimeout(800);
  const map = { "togglePanel('chat')": /trò chuyện|chat/i, "togglePanel('transcript')": /phiên âm|transcript/i,
    "togglePanel('participants')": /người tham gia|participants/i, "togglePanel('ai')": /\bAI\b|trợ lý/i };
  const re = map[handler]; const btns = p.locator('button'); const n = await btns.count();
  for (let i = 0; i < n; i++) {
    const b = btns.nth(i);
    const label = [await b.getAttribute('aria-label'), await b.getAttribute('title'), await b.innerText().catch(() => '')].join(' ');
    if (re.test(label)) { await b.click(); return; }
  }
  throw new Error('Không tìm thấy nút ' + handler);
}

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined });
const results = [];

for (const [vpName, vp] of Object.entries(viewports)) {
  for (const [name, url, auth, action, mode = {}] of scenarios) {
    const ctx = await browser.newContext({ viewport: vp, locale: 'vi-VN', timezoneId: 'Asia/Ho_Chi_Minh', deviceScaleFactor: 1 });
    await ctx.clock.install({ time: new Date('2026-10-07T02:10:00Z') }).catch(() => {});
    if (auth) {
      await ctx.addInitScript((u) => {
        localStorage.setItem('smr.access_token', 'mock.jwt.token');
        localStorage.setItem('smr.refresh_token', 'r');
        localStorage.setItem('smr.user', JSON.stringify({ userName: u.userName, fullName: u.fullName, email: u.email }));
      }, me);
    }
    const page = await ctx.newPage();
    const consoleErrors = []; const failed = [];
    page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 300)); });
    page.on('pageerror', (e) => consoleErrors.push('pageerror: ' + e.message.slice(0, 300)));
    page.on('requestfailed', (r) => failed.push(`${r.method()} ${r.url()} — ${r.failure()?.errorText}`));
    page.on('response', (r) => { if (r.status() >= 400) failed.push(`${r.request().method()} ${r.url()} — HTTP ${r.status()}`); });

    await page.route('http://localhost:5228/**', async (route) => {
      const req = route.request(); const u = new URL(req.url());
      if (u.pathname.startsWith('/meetinghub')) return route.abort();
      if (mode.fail) return route.fulfill({ status: 500, body: 'Internal Server Error' });
      let body = null; try { body = req.postDataJSON(); } catch {}
      let data = handle(req.method(), u.pathname, u.searchParams, body);
      if (mode.empty) {
        if (data?.data?.items) data = { ...data, data: { ...data.data, items: [], totalItems: 0 } };
        if (data?.data?.nextMeetings) data = { ...data, data: { upcoming: 0, ongoing: 0, ended: 0, cancelled: 0, nextMeetings: [] } };
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) });
    });
    // Jitsi giả lập: hiển thị khung video tối + bắn videoConferenceJoined để vào trạng thái live
    await page.route('https://meet.invalid/**', (r) => r.fulfill({ contentType: 'application/javascript', body: JITSI_STUB }));

    let actionError = null;
    try {
      await page.goto(BASE + url, { waitUntil: 'networkidle', timeout: 30000 });
      await page.waitForTimeout(800);
      if (action) { await action(page); await page.waitForTimeout(1200); }
    } catch (e) { actionError = e.message.split('\n')[0]; }

    const file = `${vpName}/${name}.png`;
    fs.mkdirSync(path.join(OUT, vpName), { recursive: true });
    await page.screenshot({ path: path.join(OUT, file), fullPage: true }).catch(() => {});

    let axe = [];
    try {
      const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
      axe = r.violations.map((v) => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.length, sample: v.nodes.slice(0, 3).map((n) => n.target.join(' ')) }));
    } catch (e) { axe = [{ id: 'axe-failed', help: e.message }]; }

    const metrics = await page.evaluate(() => ({
      finalUrl: location.pathname,
      docWidth: document.documentElement.scrollWidth,
      docHeight: document.documentElement.scrollHeight,
      fonts: [...new Set([...document.querySelectorAll('body *')].slice(0, 400).map((e) => getComputedStyle(e).fontFamily.split(',')[0]))].slice(0, 6),
    })).catch(() => ({}));

    results.push({ viewport: vpName, name, url, file, actionError, consoleErrors, failed, axe, metrics,
      horizontalOverflow: metrics.docWidth > vp.width });
    console.log(`${vpName.padEnd(7)} ${name.padEnd(30)} axe=${axe.length} console=${consoleErrors.length} overflow=${metrics.docWidth > vp.width}${actionError ? ' ACTION-ERR: ' + actionError : ''}`);
    await ctx.close();
  }
}
await browser.close();
fs.writeFileSync(path.join(OUT, 'results.json'), JSON.stringify(results, null, 2));
