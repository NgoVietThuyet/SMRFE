import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve('dist/smr-fe/browser');
const now = new Date();
const at = (hour, minute = 0, offset = 0) => new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset, hour, minute).toISOString();
const people = ['Quang Vũ', 'Ngọc Hà', 'Linh Trần', 'Phương Anh', 'Duy Nam', 'Thanh Huy', 'Minh Anh'];
const meeting = (id, name, start, end, status, count = 6) => ({ id, name, expectedStartTime: start, expectedEndTime: end, status, participantCount: count, description: 'Kiểm thử UAT · Kế hoạch bàn giao', hostName: people[0], isHost: true, roomCode: 'SMR' + id.toUpperCase(), joinUrl: '/meet/' + id, visibility: 0 });
const meetings = [meeting('m1', 'Họp triển khai mô hình học máy', at(14,30), at(15,30),1,7), meeting('m2', 'Rà soát tiến độ dự án',at(16),at(17),1,5),meeting('m3','Thống nhất kế hoạch tuần tới',at(17),at(18),1,7),meeting('live','Họp đồng bộ nhóm phát triển',at(9,30),at(10,30),2,4),meeting('r1','Cuộc họp tháng 9',at(10,0,-1),at(11,0,-1),3),meeting('r2','Họp đánh giá kết quả UAT',at(14,0,-2),at(14,45,-2),3)];
const titles = ['Duyệt biên bản cuộc họp tháng 9', 'Kiểm tra kết quả UAT', 'Hoàn thiện tài liệu bàn giao', 'Gửi kế hoạch cho nhóm', 'Rà soát tài liệu dự án'];
const tasks = titles.map((title, i) => ({ id: 't' + i, title, description: 'Kiểm tra nội dung và cập nhật kết quả cho nhóm.', meetingId: i === 0 ? 'r1' : 'm1', meetingName: i === 0 ? 'Cuộc họp tháng 9' : meetings[0].name, dueDate: at(17,0,i < 2 ? 0 : i - 1), assigneeUserName: 'preview', assigneeFullName: people[i], status: i % 2, priority: 1, canEdit: true, isCreator: true, isPublic: false, parentId: null, level: 0, childrenCount: 0, completedChildrenCount: 0, progress: 0, createBy: 'preview', createDate: at(8), shares: [], children: [] }));
const paged = (items, body) => ({ items: items.slice(((body.page || 1)-1)*(body.pageSize || 10), (body.page || 1)*(body.pageSize || 10)), totalItems: items.length, totalPages: 1, page: body.page || 1, pageSize: body.pageSize || 10, summary: {total:items.length,mine:items.length,today:2,overdue:0} });
const server = http.createServer(async (req,res) => {
 try {
 const url = new URL(req.url, 'http://127.0.0.1:4301');
 let raw = ''; for await (const chunk of req) raw += chunk;
 const body = raw ? JSON.parse(raw) : {};
 const mode = fs.existsSync('.preview-mode') ? fs.readFileSync('.preview-mode','utf8').trim() : 'normal';
 const active = mode === 'empty' ? [] : meetings;
 const activeTasks = mode === 'empty' ? [] : tasks;
 const send = data => {res.setHeader('Content-Type','application/json');res.end(JSON.stringify({status:true,message:'Dữ liệu mẫu kiểm tra giao diện',data}));};
 if (url.pathname.startsWith('/api/')) {
  if (mode === 'error' || (mode === 'partial' && url.pathname.includes('/Task/'))) {res.statusCode=503; return send(null);}
  if (url.pathname === '/api/Meeting/dashboard') return send({upcoming: active.filter(m=>m.status===1).length,ongoing:active.filter(m=>m.status===2).length,ended:2,cancelled:0,nextMeetings:active.filter(m=>m.status<3)});
  if (url.pathname === '/api/Meeting/query') {
   let result = active.filter(m=>body.tab==='ended'?m.status===3:body.keyword?m.roomCode.includes(body.keyword):body.startDate?m.status<3:true);
   return send(paged(result,body));
  }
  if (url.pathname === '/api/Task/query') return send(paged(activeTasks.filter(t=>body.status==null||t.status===body.status),body));
  if (url.pathname.startsWith('/api/Task/')) {const task=tasks.find(t=>url.pathname.split('/')[3]===t.id); if(req.method==='PATCH'&&task) task.status=body.status;return send(task);}
  if (url.pathname.startsWith('/api/User/Search')) return send(people.map((fullName,i)=>({fullName,userName:'user'+i,email:'preview'+i+'@example.test'})));
  if (url.pathname.startsWith('/api/Meeting/')) {const m=active.find(m=>m.id===url.pathname.split('/')[3]);return send(m?{...m,agenda:m.description,timeZone:'Asia/Bangkok',participants:people.slice(0,m.participantCount).map((fullName,i)=>({fullName,userName:'user'+i,email:'',role:i===0?1:4,isJoined:m.status===2,organizationId:'',titleCode:''})),activity:[],settings:{},rowVersion:'',canManage:true}:null);}
  return send([]);
 }
 let file=path.resolve(root,'.'+decodeURIComponent(url.pathname));
 if (!file.startsWith(root+path.sep)) file=path.join(root,'index.html');
 if (!fs.existsSync(file)||fs.statSync(file).isDirectory()) file=path.join(root,'index.html');
 const ext=path.extname(file); let content=fs.readFileSync(file);
 if(ext==='.js') content=Buffer.from(content.toString().replaceAll('http://localhost:5228','http://127.0.0.1:4301'));
 if(ext==='.html') content=Buffer.from(content.toString().replace('<head>','<head><script>localStorage.setItem("smr.access_token","local-preview-only");localStorage.setItem("smr.user",JSON.stringify({userName:"preview",fullName:"Quang Vũ",email:"preview@example.test"}));</script>').replace('<title>SmartMeeting</title>','<title>SmartMeeting — dữ liệu mẫu UI</title>'));
 res.setHeader('Content-Type', ({'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.otf':'font/otf'})[ext] || 'application/octet-stream');res.end(content);
 } catch(e) {res.statusCode=500;res.end(String(e));}
});
server.listen(4301,'127.0.0.1',()=>console.log('Isolated UI fixture: http://127.0.0.1:4301 (no real backend)'));
