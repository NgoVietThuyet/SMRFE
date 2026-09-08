import { useState } from 'react';
import {
  Settings as SettingsIcon,
  Users,
  Shield,
  Mic,
  Video,
  Server,
  HardDrive,
  Activity,
  Plus,
  Search,
  MoreVertical,
  Check,
  X,
  Cpu,
  Database,
  Cloud,
  Globe,
  Lock,
  Bell,
  Palette,
  Save,
} from 'lucide-react';
import { Avatar } from '@/components/Avatar';
import { Toggle } from '@/components/Toggle';
import { roleLabel, roleBadgeColor } from '@/utils';
import { orgContacts, participants } from '@/data';
import type { ParticipantRole } from '@/types';

type AdminTab = 'organization' | 'ai' | 'security' | 'integrations' | 'system';

interface AdminProps {
  onBack: () => void;
  canGoBack: boolean;
}

export function Admin({}: AdminProps) {
  const [tab, setTab] = useState<AdminTab>('organization');

  const tabs: { id: AdminTab; label: string; icon: typeof SettingsIcon }[] = [
    { id: 'organization', label: 'Organization', icon: Users },
    { id: 'ai', label: 'AI Configuration', icon: Mic },
    { id: 'security', label: 'Security', icon: Shield },
    { id: 'integrations', label: 'Integrations', icon: Cloud },
    { id: 'system', label: 'System Health', icon: Activity },
  ];

  return (
    <div className="p-8 space-y-6 animate-fade-in">
      <div className="flex items-center gap-1 bg-white border border-ink-200 rounded-xl p-1 w-fit overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
              tab === t.id ? 'bg-primary-600 text-white shadow-sm' : 'text-ink-500 hover:bg-ink-100'
            }`}
          >
            <t.icon size={16} /> {t.label}
          </button>
        ))}
      </div>

      {tab === 'organization' && <OrganizationTab />}
      {tab === 'ai' && <AITab />}
      {tab === 'security' && <SecurityTab />}
      {tab === 'integrations' && <IntegrationsTab />}
      {tab === 'system' && <SystemTab />}
    </div>
  );
}

function OrganizationTab() {
  const [search, setSearch] = useState('');
  const allUsers = [...participants, ...orgContacts.filter((c) => !participants.find((p) => p.id === c.id))];

  const departments = [
    { name: 'IT Department', members: 12, color: 'bg-primary-600' },
    { name: 'HR Department', members: 8, color: 'bg-accent-600' },
    { name: 'Finance', members: 6, color: 'bg-success-600' },
    { name: 'Marketing', members: 10, color: 'bg-warning-600' },
    { name: 'Engineering', members: 18, color: 'bg-error-600' },
    { name: 'Sales', members: 7, color: 'bg-primary-500' },
  ];

  return (
    <div className="space-y-5">
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Users', value: '61', icon: Users, color: 'bg-primary-50 text-primary-600' },
          { label: 'Departments', value: '6', icon: Server, color: 'bg-accent-50 text-accent-600' },
          { label: 'Active Today', value: '34', icon: Activity, color: 'bg-success-50 text-success-600' },
          { label: 'Storage Used', value: '847 GB', icon: HardDrive, color: 'bg-warning-50 text-warning-600' },
        ].map((s) => (
          <div key={s.label} className="card p-5">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${s.color}`}>
              <s.icon size={20} />
            </div>
            <p className="text-2xl font-bold text-ink-900 mt-3">{s.value}</p>
            <p className="text-sm text-ink-500">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Departments */}
      <div className="card p-5">
        <h3 className="font-semibold text-ink-900 mb-4">Departments</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {departments.map((d) => (
            <div key={d.name} className="p-3 rounded-lg border border-ink-100 hover:border-primary-200 transition-colors">
              <div className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-lg ${d.color} flex items-center justify-center text-white text-xs font-bold`}>
                  {d.name.slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ink-900 truncate">{d.name}</p>
                  <p className="text-xs text-ink-400">{d.members} members</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* User management */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-ink-900">User Management</h3>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search users..."
                className="w-56 pl-9 pr-3 py-2 text-sm rounded-lg bg-ink-100 border border-transparent focus:bg-white focus:border-primary-300 transition-all"
              />
            </div>
            <button className="btn-primary py-2">
              <Plus size={16} /> Add User
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-ink-100">
                <th className="text-left py-2 px-3 text-xs font-semibold text-ink-400 uppercase tracking-wider">Name</th>
                <th className="text-left py-2 px-3 text-xs font-semibold text-ink-400 uppercase tracking-wider">Department</th>
                <th className="text-left py-2 px-3 text-xs font-semibold text-ink-400 uppercase tracking-wider">Role</th>
                <th className="text-left py-2 px-3 text-xs font-semibold text-ink-400 uppercase tracking-wider">Status</th>
                <th className="text-right py-2 px-3 text-xs font-semibold text-ink-400 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody>
              {allUsers.filter((u) => u.name.toLowerCase().includes(search.toLowerCase())).map((u) => (
                <tr key={u.id} className="border-b border-ink-50 hover:bg-ink-50/50 transition-colors">
                  <td className="py-3 px-3">
                    <div className="flex items-center gap-2.5">
                      <Avatar name={u.name} color={u.avatarColor} size="sm" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-ink-900 truncate">{u.name}</p>
                        <p className="text-xs text-ink-400 truncate">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-3 text-sm text-ink-600">{u.department}</td>
                  <td className="py-3 px-3">
                    {'role' in u && typeof u.role === 'string' ? (
                      <span className={`badge ${roleBadgeColor(u.role as ParticipantRole)}`}>{roleLabel(u.role as ParticipantRole)}</span>
                    ) : (
                      <span className="badge bg-ink-100 text-ink-600">Member</span>
                    )}
                  </td>
                  <td className="py-3 px-3">
                    <span className="badge bg-success-100 text-success-700">
                      <span className="w-1.5 h-1.5 rounded-full bg-success-500" /> Active
                    </span>
                  </td>
                  <td className="py-3 px-3 text-right">
                    <button className="p-1.5 rounded-lg text-ink-400 hover:bg-ink-100 hover:text-ink-700 transition-colors">
                      <MoreVertical size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function AITab() {
  const [sttEnabled, setSttEnabled] = useState(true);
  const [subtitleEnabled, setSubtitleEnabled] = useState(true);
  const [momEnabled, setMomEnabled] = useState(true);
  const [actionItemsEnabled, setActionItemsEnabled] = useState(true);
  const [autoApprove, setAutoApprove] = useState(false);
  const [language, setLanguage] = useState('en');
  const [sttModel, setSttModel] = useState('whisper-large-v3');
  const [llmModel, setLlmModel] = useState('gpt-4');

  return (
    <div className="space-y-5">
      <div className="card p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-gradient-to-br from-accent-500 to-primary-600 rounded-lg flex items-center justify-center text-white">
            <Mic size={20} />
          </div>
          <div>
            <h3 className="font-semibold text-ink-900">Speech-to-Text (STT)</h3>
            <p className="text-sm text-ink-500">Real-time transcription and subtitle generation</p>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 rounded-lg bg-ink-50">
            <div>
              <p className="text-sm font-medium text-ink-900">Enable STT</p>
              <p className="text-xs text-ink-400">Transcribe audio in real-time during meetings</p>
            </div>
            <Toggle checked={sttEnabled} onChange={setSttEnabled} />
          </div>
          <div className="flex items-center justify-between p-3 rounded-lg bg-ink-50">
            <div>
              <p className="text-sm font-medium text-ink-900">Live Subtitles</p>
              <p className="text-xs text-ink-400">Display captions on screen during meetings</p>
            </div>
            <Toggle checked={subtitleEnabled} onChange={setSubtitleEnabled} />
          </div>
          <div>
            <label className="block text-sm font-medium text-ink-700 mb-1.5">STT Model</label>
            <select value={sttModel} onChange={(e) => setSttModel(e.target.value)} className="input-field">
              <option value="whisper-large-v3">Whisper Large v3 (Recommended)</option>
              <option value="whisper-medium">Whisper Medium</option>
              <option value="google-stt">Google Speech-to-Text</option>
              <option value="azure-stt">Azure Speech Service</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-ink-700 mb-1.5">Primary Language</label>
            <select value={language} onChange={(e) => setLanguage(e.target.value)} className="input-field">
              <option value="en">English</option>
              <option value="vi">Vietnamese</option>
              <option value="multi">Multi-language (Auto-detect)</option>
            </select>
          </div>
        </div>
      </div>

      <div className="card p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-accent-600 rounded-lg flex items-center justify-center text-white">
            <Cpu size={20} />
          </div>
          <div>
            <h3 className="font-semibold text-ink-900">LLM & Minutes Generation</h3>
            <p className="text-sm text-ink-500">AI-powered meeting summaries and action items</p>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 rounded-lg bg-ink-50">
            <div>
              <p className="text-sm font-medium text-ink-900">Auto-generate Minutes (MOM)</p>
              <p className="text-xs text-ink-400">Create meeting summaries after each session</p>
            </div>
            <Toggle checked={momEnabled} onChange={setMomEnabled} />
          </div>
          <div className="flex items-center justify-between p-3 rounded-lg bg-ink-50">
            <div>
              <p className="text-sm font-medium text-ink-900">Extract Action Items</p>
              <p className="text-xs text-ink-400">Automatically identify tasks and assignees</p>
            </div>
            <Toggle checked={actionItemsEnabled} onChange={setActionItemsEnabled} />
          </div>
          <div className="flex items-center justify-between p-3 rounded-lg bg-ink-50">
            <div>
              <p className="text-sm font-medium text-ink-900">Auto-approve Draft Minutes</p>
              <p className="text-xs text-ink-400">Skip secretary approval (not recommended)</p>
            </div>
            <Toggle checked={autoApprove} onChange={setAutoApprove} />
          </div>
          <div>
            <label className="block text-sm font-medium text-ink-700 mb-1.5">LLM Model</label>
            <select value={llmModel} onChange={(e) => setLlmModel(e.target.value)} className="input-field">
              <option value="gpt-4">GPT-4 (Recommended)</option>
              <option value="gpt-3.5">GPT-3.5 Turbo</option>
              <option value="claude-3">Claude 3 Opus</option>
              <option value="gemini-pro">Gemini Pro</option>
            </select>
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button className="btn-primary">
          <Save size={16} /> Save Configuration
        </button>
      </div>
    </div>
  );
}

function SecurityTab() {
  const [enforceTLS, setEnforceTLS] = useState(true);
  const [lobbyMode, setLobbyMode] = useState(true);
  const [xssFilter, setXssFilter] = useState(true);
  const [malwareScan, setMalwareScan] = useState(true);
  const [tokenAuth, setTokenAuth] = useState(true);

  return (
    <div className="space-y-5">
      <div className="card p-5">
        <h3 className="font-semibold text-ink-900 mb-4 flex items-center gap-2">
          <Lock size={18} className="text-primary-600" /> Access Control
        </h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 rounded-lg bg-ink-50">
            <div>
              <p className="text-sm font-medium text-ink-900">Token-based Authentication</p>
              <p className="text-xs text-ink-400">Verify MeetingID against token and DB authority</p>
            </div>
            <Toggle checked={tokenAuth} onChange={setTokenAuth} />
          </div>
          <div className="flex items-center justify-between p-3 rounded-lg bg-ink-50">
            <div>
              <p className="text-sm font-medium text-ink-900">Lobby Mode for Guests</p>
              <p className="text-xs text-ink-400">Require host approval before guests join</p>
            </div>
            <Toggle checked={lobbyMode} onChange={setLobbyMode} />
          </div>
          <div className="flex items-center justify-between p-3 rounded-lg bg-ink-50">
            <div>
              <p className="text-sm font-medium text-ink-900">Enforce TLS</p>
              <p className="text-xs text-ink-400">Require TLS for all HTTP and socket connections</p>
            </div>
            <Toggle checked={enforceTLS} onChange={setEnforceTLS} />
          </div>
        </div>
      </div>

      <div className="card p-5">
        <h3 className="font-semibold text-ink-900 mb-4 flex items-center gap-2">
          <Shield size={18} className="text-success-600" /> Content Security
        </h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 rounded-lg bg-ink-50">
            <div>
              <p className="text-sm font-medium text-ink-900">XSS Protection</p>
              <p className="text-xs text-ink-400">Sanitize chat and whiteboard content</p>
            </div>
            <Toggle checked={xssFilter} onChange={setXssFilter} />
          </div>
          <div className="flex items-center justify-between p-3 rounded-lg bg-ink-50">
            <div>
              <p className="text-sm font-medium text-ink-900">Malware Scanning on Upload</p>
              <p className="text-xs text-ink-400">Scan uploaded files for malicious code</p>
            </div>
            <Toggle checked={malwareScan} onChange={setMalwareScan} />
          </div>
        </div>
      </div>

      <div className="card p-5">
        <h3 className="font-semibold text-ink-900 mb-4">Security Audit Log</h3>
        <div className="space-y-2">
          {[
            { event: 'Guest denied access', user: 'System', time: '2 min ago', level: 'warning' },
            { event: 'Host kicked participant', user: 'Nguyen Van An', time: '15 min ago', level: 'info' },
            { event: 'Failed login attempt blocked', user: 'System', time: '1 hour ago', level: 'error' },
            { event: 'Meeting recording started', user: 'Nguyen Van An', time: '3 hours ago', level: 'success' },
          ].map((log, i) => (
            <div key={i} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-ink-50 transition-colors">
              <span className={`w-2 h-2 rounded-full shrink-0 ${
                log.level === 'error' ? 'bg-error-500' :
                log.level === 'warning' ? 'bg-warning-500' :
                log.level === 'success' ? 'bg-success-500' : 'bg-primary-500'
              }`} />
              <p className="text-sm text-ink-700 flex-1">{log.event}</p>
              <span className="text-xs text-ink-400">{log.user}</span>
              <span className="text-xs text-ink-400 w-20 text-right">{log.time}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function IntegrationsTab() {
  const integrations = [
    { name: 'Jitsi Videobridge', desc: 'Video conferencing infrastructure', icon: Video, connected: true, color: 'bg-primary-600' },
    { name: 'Object Storage (S3/Minio)', desc: 'File storage with pre-signed URLs', icon: Cloud, connected: true, color: 'bg-accent-600' },
    { name: 'AI / LLM Server', desc: 'GPT-4 / Whisper for STT and summaries', icon: Cpu, connected: true, color: 'bg-success-600' },
    { name: 'SMTP Email Service', desc: 'Meeting invitations and notifications', icon: Bell, connected: true, color: 'bg-warning-600' },
    { name: 'Redis Queue', desc: 'Job queue for async AI processing', icon: Database, connected: true, color: 'bg-error-600' },
    { name: 'Identity Provider (SSO)', desc: 'Single sign-on for enterprise', icon: Globe, connected: false, color: 'bg-ink-500' },
  ];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {integrations.map((int) => (
          <div key={int.name} className="card p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className={`w-10 h-10 ${int.color} rounded-lg flex items-center justify-center text-white shrink-0`}>
                  <int.icon size={20} />
                </div>
                <div>
                  <h4 className="font-semibold text-ink-900 text-sm">{int.name}</h4>
                  <p className="text-xs text-ink-500 mt-0.5">{int.desc}</p>
                </div>
              </div>
              <span className={`badge ${int.connected ? 'bg-success-100 text-success-700' : 'bg-ink-100 text-ink-500'}`}>
                {int.connected ? <><Check size={12} /> Connected</> : 'Not Connected'}
              </span>
            </div>
            <div className="mt-4 pt-3 border-t border-ink-100 flex justify-end">
              <button className={`text-sm font-medium ${int.connected ? 'text-ink-500 hover:text-error-600' : 'text-primary-600 hover:text-primary-700'}`}>
                {int.connected ? 'Disconnect' : 'Connect'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SystemTab() {
  const metrics = [
    { label: 'CPU Usage', value: 42, unit: '%', color: 'bg-primary-500', icon: Cpu },
    { label: 'Memory', value: 68, unit: '%', color: 'bg-accent-500', icon: Server },
    { label: 'Storage', value: 84, unit: '%', color: 'bg-warning-500', icon: HardDrive },
    { label: 'Network I/O', value: 23, unit: '%', color: 'bg-success-500', icon: Activity },
  ];

  const services = [
    { name: 'API Gateway', status: 'healthy', latency: '45ms' },
    { name: 'WebSocket Server', status: 'healthy', latency: '120ms' },
    { name: 'AI Processing Queue', status: 'healthy', latency: '—' },
    { name: 'Database (PostgreSQL)', status: 'healthy', latency: '8ms' },
    { name: 'Object Storage', status: 'healthy', latency: '32ms' },
    { name: 'Jitsi Bridge', status: 'healthy', latency: '85ms' },
  ];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.map((m) => (
          <div key={m.label} className="card p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="w-9 h-9 bg-ink-100 rounded-lg flex items-center justify-center text-ink-600">
                <m.icon size={18} />
              </div>
              <span className="text-2xl font-bold text-ink-900">{m.value}<span className="text-sm text-ink-400">{m.unit}</span></span>
            </div>
            <p className="text-sm text-ink-500">{m.label}</p>
            <div className="mt-2 h-1.5 bg-ink-100 rounded-full overflow-hidden">
              <div className={`h-full ${m.color} rounded-full transition-all`} style={{ width: `${m.value}%` }} />
            </div>
          </div>
        ))}
      </div>

      <div className="card p-5">
        <h3 className="font-semibold text-ink-900 mb-4">Service Status</h3>
        <div className="space-y-2">
          {services.map((s) => (
            <div key={s.name} className="flex items-center justify-between p-3 rounded-lg border border-ink-100 hover:bg-ink-50/50 transition-colors">
              <div className="flex items-center gap-2.5">
                <span className="w-2 h-2 rounded-full bg-success-500 animate-pulse-soft" />
                <span className="text-sm font-medium text-ink-900">{s.name}</span>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-xs text-ink-400">Latency: <span className="font-mono text-ink-600">{s.latency}</span></span>
                <span className="badge bg-success-100 text-success-700 capitalize">{s.status}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="card p-5">
        <h3 className="font-semibold text-ink-900 mb-4">System Information</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {[
            { label: 'Version', value: 'SMR v1.0.0' },
            { label: 'Uptime', value: '14d 7h 32m' },
            { label: 'Region', value: 'Asia-Pacific' },
            { label: 'Total Meetings', value: '1,247' },
            { label: 'Total Users', value: '61' },
            { label: 'Last Backup', value: '2 hours ago' },
          ].map((info) => (
            <div key={info.label} className="p-3 rounded-lg bg-ink-50">
              <p className="text-xs text-ink-400">{info.label}</p>
              <p className="text-sm font-semibold text-ink-900 mt-0.5">{info.value}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
