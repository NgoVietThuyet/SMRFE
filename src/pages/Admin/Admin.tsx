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
  MoreVertical,
  Check,
  Cpu,
  Database,
  Cloud,
  Globe,
  Lock,
  Bell,
  Save,
} from 'lucide-react';
import { Avatar } from '@/components/Avatar';
import { Toggle } from '@/components/Toggle';
import { useLanguage } from '@/i18n';
import { roleLabel } from '@/utils';
import { orgContacts, participants } from '@/data';
import type { ParticipantRole } from '@/types';
import { Button } from '@/components/ui/Button';
import { SearchBar } from '@/components/ui/SearchBar';
import { Select } from '@/components/ui/Select';
import { Card } from '@/components/ui/Card';
import { Badge, type BadgeTone } from '@/components/ui/Badge';
import { TableWrapper, TableHead, TableRow, Th, Td, TableEmpty } from '@/components/ui/Table';
import './Admin.css';

const roleTone: Record<ParticipantRole, BadgeTone> = {
  host: 'info',
  secretary: 'accent',
  member: 'neutral',
  guest: 'warning',
};

type AdminTab = 'organization' | 'ai' | 'security' | 'integrations' | 'system';

interface AdminProps {
  onBack: () => void;
  canGoBack: boolean;
}

export function Admin(props: AdminProps) {
  void props;
  const { t } = useLanguage();
  const [tab, setTab] = useState<AdminTab>('organization');

  const tabs: { id: AdminTab; label: string; icon: typeof SettingsIcon }[] = [
    { id: 'organization', label: t('admin.org'), icon: Users },
    { id: 'ai', label: t('admin.ai'), icon: Mic },
    { id: 'security', label: t('admin.sec'), icon: Shield },
    { id: 'integrations', label: t('admin.int'), icon: Cloud },
    { id: 'system', label: t('admin.sys'), icon: Activity },
  ];

  return (
    <div className="page-gutter space-y-6 animate-fade-in mx-auto max-w-[1440px] w-full">
      <div role="tablist" aria-label={t('admin.sections')} className="flex items-center gap-1 bg-white border border-ink-200 rounded-xl p-1 w-fit max-w-full overflow-x-auto">
        {tabs.map((tabItem) => (
          <button
            key={tabItem.id}
            role="tab"
            aria-selected={tab === tabItem.id}
            onClick={() => setTab(tabItem.id)}
            className={`flex items-center gap-2 px-4 min-h-[40px] rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
              tab === tabItem.id ? 'bg-primary-600 text-white shadow-sm' : 'text-ink-500 hover:bg-ink-100 hover:text-ink-900'
            }`}
          >
            <tabItem.icon size={16} aria-hidden="true" /> {tabItem.label}
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
  const { t, lang } = useLanguage();
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
          { id: 'totalUsers', label: t('admin.totalUsers'), value: '61', icon: Users, color: 'bg-primary-50 text-primary-700' },
          { id: 'depts', label: t('admin.depts'), value: '6', icon: Server, color: 'bg-accent-50 text-accent-700' },
          { id: 'activeToday', label: t('admin.activeToday'), value: '34', icon: Activity, color: 'bg-success-50 text-success-700' },
          { id: 'storage', label: t('admin.storage'), value: '847 GB', icon: HardDrive, color: 'bg-warning-50 text-warning-700' },
        ].map((s) => (
          <Card key={s.id}>
            <div aria-hidden="true" className={`w-10 h-10 rounded-lg flex items-center justify-center ${s.color}`}>
              <s.icon size={20} />
            </div>
            <p className="text-2xl font-bold text-ink-900 mt-3 tnum">{s.value}</p>
            <p className="text-sm text-ink-500">{s.label}</p>
          </Card>
        ))}
      </div>

      {/* Departments */}
      <Card>
        <h3 className="font-heading font-semibold text-ink-900 mb-4">{t('admin.deptH')}</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {departments.map((d) => (
            <div key={d.name} className="p-3 rounded-lg border border-ink-100 hover:border-primary-200 transition-colors">
              <div className="flex items-center gap-2">
                <div aria-hidden="true" className={`w-8 h-8 rounded-lg ${d.color} flex items-center justify-center text-white text-xs font-bold shrink-0`}>
                  {d.name.slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ink-900 truncate">{d.name}</p>
                  <p className="text-xs text-ink-500 tnum">{t('admin.members', { n: d.members })}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* User management */}
      <Card>
        <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
          <h3 className="font-heading font-semibold text-ink-900">{t('admin.userMgmt')}</h3>
          <div className="flex items-center gap-3 flex-wrap">
            <SearchBar
              value={search}
              onChange={setSearch}
              label={t('admin.searchUsers')}
              placeholder={t('admin.searchUsersPh')}
              className="w-full sm:w-56"
            />
            <Button>
              <Plus size={16} aria-hidden="true" /> {t('admin.addUser')}
            </Button>
          </div>
        </div>

        {(() => {
          const rows = allUsers.filter((u) => u.name.toLowerCase().includes(search.trim().toLowerCase()));
          return (
            <>
              <p aria-live="polite" className="text-sm text-ink-500 mb-3 tnum">
                {t('admin.userCount', { n: rows.length, unit: rows.length === 1 ? t('admin.user.one') : t('admin.user.many') })}
              </p>
              <TableWrapper>
                <TableHead>
                  <TableRow>
                    <Th>{t('admin.th.name')}</Th>
                    <Th>{t('admin.th.dept')}</Th>
                    <Th>{t('admin.th.role')}</Th>
                    <Th>{t('admin.th.status')}</Th>
                    <Th className="text-right">{t('admin.th.actions')}</Th>
                  </TableRow>
                </TableHead>
                <tbody>
                  {rows.map((u) => (
                    <TableRow key={u.id}>
                      <Td>
                        <div className="flex items-center gap-2.5">
                          <Avatar name={u.name} color={u.avatarColor} size="sm" />
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-ink-900 truncate">{u.name}</p>
                            <p className="text-xs text-ink-500 truncate">{u.email}</p>
                          </div>
                        </div>
                      </Td>
                      <Td>{u.department}</Td>
                      <Td>
                        {'role' in u && typeof u.role === 'string' ? (
                          <Badge tone={roleTone[u.role as ParticipantRole] ?? 'neutral'}>{roleLabel(u.role as ParticipantRole, lang)}</Badge>
                        ) : (
                          <Badge tone="neutral">{roleLabel('member', lang)}</Badge>
                        )}
                      </Td>
                      <Td>
                        <Badge tone="success">
                          <span aria-hidden="true" className="w-1.5 h-1.5 rounded-full bg-success-600" /> {t('admin.active')}
                        </Badge>
                      </Td>
                      <Td className="text-right">
                        <button
                          type="button"
                          aria-label={t('admin.moreActions', { name: u.name })}
                          className="p-1.5 rounded-lg text-ink-500 hover:bg-ink-100 hover:text-ink-900 transition-colors min-w-[32px] min-h-[32px] items-center justify-center inline-flex"
                        >
                          <MoreVertical size={16} aria-hidden="true" />
                        </button>
                      </Td>
                    </TableRow>
                  ))}
                  {rows.length === 0 && <TableEmpty message={t('admin.noUsers')} />}
                </tbody>
              </TableWrapper>
            </>
          );
        })()}
      </Card>
    </div>
  );
}

function AITab() {
  const { t } = useLanguage();
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
      <Card>
        <div className="flex items-center gap-3 mb-4">
          <div aria-hidden="true" className="w-10 h-10 bg-gradient-to-br from-accent-500 to-primary-600 rounded-lg flex items-center justify-center text-white shrink-0">
            <Mic size={20} />
          </div>
          <div>
            <h3 className="font-heading font-semibold text-ink-900">{t('admin.stt')}</h3>
            <p className="text-sm text-ink-500">{t('admin.sttSub')}</p>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3 p-3 rounded-lg bg-ink-50">
            <div>
              <p className="text-sm font-medium text-ink-900">{t('admin.sttOn')}</p>
              <p className="text-xs text-ink-500">{t('admin.sttOnDesc')}</p>
            </div>
            <Toggle checked={sttEnabled} onChange={setSttEnabled} label={t('admin.sttOn')} />
          </div>
          <div className="flex items-center justify-between gap-3 p-3 rounded-lg bg-ink-50">
            <div>
              <p className="text-sm font-medium text-ink-900">{t('admin.liveSub')}</p>
              <p className="text-xs text-ink-500">{t('admin.liveSubDesc')}</p>
            </div>
            <Toggle checked={subtitleEnabled} onChange={setSubtitleEnabled} label={t('admin.liveSub')} />
          </div>
          <Select label={t('admin.sttModel')} value={sttModel} onChange={(e) => setSttModel(e.target.value)}>
            <option value="whisper-large-v3">Whisper Large v3 (Recommended)</option>
            <option value="whisper-medium">Whisper Medium</option>
            <option value="google-stt">Google Speech-to-Text</option>
            <option value="azure-stt">Azure Speech Service</option>
          </Select>
          <Select label={t('admin.lang')} value={language} onChange={(e) => setLanguage(e.target.value)}>
            <option value="en">{t('admin.lang.en')}</option>
            <option value="vi">{t('admin.lang.vi')}</option>
            <option value="multi">{t('admin.lang.multi')}</option>
          </Select>
        </div>
      </Card>

      <Card>
        <div className="flex items-center gap-3 mb-4">
          <div aria-hidden="true" className="w-10 h-10 bg-gradient-to-br from-primary-500 to-accent-600 rounded-lg flex items-center justify-center text-white shrink-0">
            <Cpu size={20} />
          </div>
          <div>
            <h3 className="font-heading font-semibold text-ink-900">{t('admin.llm')}</h3>
            <p className="text-sm text-ink-500">{t('admin.llmSub')}</p>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3 p-3 rounded-lg bg-ink-50">
            <div>
              <p className="text-sm font-medium text-ink-900">{t('admin.mom')}</p>
              <p className="text-xs text-ink-500">{t('admin.momDesc')}</p>
            </div>
            <Toggle checked={momEnabled} onChange={setMomEnabled} label={t('admin.mom')} />
          </div>
          <div className="flex items-center justify-between gap-3 p-3 rounded-lg bg-ink-50">
            <div>
              <p className="text-sm font-medium text-ink-900">{t('admin.extract')}</p>
              <p className="text-xs text-ink-500">{t('admin.extractDesc')}</p>
            </div>
            <Toggle checked={actionItemsEnabled} onChange={setActionItemsEnabled} label={t('admin.extract')} />
          </div>
          <div className="flex items-center justify-between gap-3 p-3 rounded-lg bg-ink-50">
            <div>
              <p className="text-sm font-medium text-ink-900">{t('admin.autoApprove')}</p>
              <p className="text-xs text-ink-500">{t('admin.autoApproveDesc')}</p>
            </div>
            <Toggle checked={autoApprove} onChange={setAutoApprove} label={t('admin.autoApprove')} />
          </div>
          <Select label={t('admin.llmModel')} value={llmModel} onChange={(e) => setLlmModel(e.target.value)}>
            <option value="gpt-4">GPT-4 (Recommended)</option>
            <option value="gpt-3.5">GPT-3.5 Turbo</option>
            <option value="claude-3">Claude 3 Opus</option>
            <option value="gemini-pro">Gemini Pro</option>
          </Select>
        </div>
      </Card>

      <div className="flex justify-end">
        <Button>
          <Save size={16} aria-hidden="true" /> {t('admin.save')}
        </Button>
      </div>
    </div>
  );
}

function SecurityTab() {
  const { t } = useLanguage();
  const [enforceTLS, setEnforceTLS] = useState(true);
  const [lobbyMode, setLobbyMode] = useState(true);
  const [xssFilter, setXssFilter] = useState(true);
  const [malwareScan, setMalwareScan] = useState(true);
  const [tokenAuth, setTokenAuth] = useState(true);

  return (
    <div className="space-y-5">
      <Card>
        <h3 className="font-heading font-semibold text-ink-900 mb-4 flex items-center gap-2">
          <Lock size={18} aria-hidden="true" className="text-primary-600" /> {t('admin.access')}
        </h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3 p-3 rounded-lg bg-ink-50">
            <div>
              <p className="text-sm font-medium text-ink-900">{t('admin.token')}</p>
              <p className="text-xs text-ink-500">{t('admin.tokenDesc')}</p>
            </div>
            <Toggle checked={tokenAuth} onChange={setTokenAuth} label={t('admin.token')} />
          </div>
          <div className="flex items-center justify-between gap-3 p-3 rounded-lg bg-ink-50">
            <div>
              <p className="text-sm font-medium text-ink-900">{t('admin.lobby')}</p>
              <p className="text-xs text-ink-500">{t('admin.lobbyDesc')}</p>
            </div>
            <Toggle checked={lobbyMode} onChange={setLobbyMode} label={t('admin.lobby')} />
          </div>
          <div className="flex items-center justify-between gap-3 p-3 rounded-lg bg-ink-50">
            <div>
              <p className="text-sm font-medium text-ink-900">{t('admin.tls')}</p>
              <p className="text-xs text-ink-500">{t('admin.tlsDesc')}</p>
            </div>
            <Toggle checked={enforceTLS} onChange={setEnforceTLS} label={t('admin.tls')} />
          </div>
        </div>
      </Card>

      <Card>
        <h3 className="font-heading font-semibold text-ink-900 mb-4 flex items-center gap-2">
          <Shield size={18} aria-hidden="true" className="text-success-600" /> {t('admin.content')}
        </h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3 p-3 rounded-lg bg-ink-50">
            <div>
              <p className="text-sm font-medium text-ink-900">{t('admin.xss')}</p>
              <p className="text-xs text-ink-500">{t('admin.xssDesc')}</p>
            </div>
            <Toggle checked={xssFilter} onChange={setXssFilter} label={t('admin.xss')} />
          </div>
          <div className="flex items-center justify-between gap-3 p-3 rounded-lg bg-ink-50">
            <div>
              <p className="text-sm font-medium text-ink-900">{t('admin.malware')}</p>
              <p className="text-xs text-ink-500">{t('admin.malwareDesc')}</p>
            </div>
            <Toggle checked={malwareScan} onChange={setMalwareScan} label={t('admin.malware')} />
          </div>
        </div>
      </Card>

      <Card>
        <h3 className="font-heading font-semibold text-ink-900 mb-4">{t('admin.audit')}</h3>
        <ul className="space-y-2">
          {[
            { event: 'Guest denied access', user: 'System', time: '2 min ago', level: 'warning' },
            { event: 'Host kicked participant', user: 'Nguyen Van An', time: '15 min ago', level: 'info' },
            { event: 'Failed login attempt blocked', user: 'System', time: '1 hour ago', level: 'error' },
            { event: 'Meeting recording started', user: 'Nguyen Van An', time: '3 hours ago', level: 'success' },
          ].map((log) => (
            <li key={log.event} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-ink-50 transition-colors">
              <span aria-hidden="true" className={`w-2 h-2 rounded-full shrink-0 ${
                log.level === 'error' ? 'bg-error-500' :
                log.level === 'warning' ? 'bg-warning-500' :
                log.level === 'success' ? 'bg-success-500' : 'bg-primary-500'
              }`} />
              <p className="text-sm text-ink-700 flex-1">{log.event}</p>
              <span className="text-xs text-ink-500">{log.user}</span>
              <span className="text-xs text-ink-500 w-20 text-right tnum">{log.time}</span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

function IntegrationsTab() {
  const { t } = useLanguage();
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
          <Card key={int.name}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 min-w-0">
                <div aria-hidden="true" className={`w-10 h-10 ${int.color} rounded-lg flex items-center justify-center text-white shrink-0`}>
                  <int.icon size={20} />
                </div>
                <div className="min-w-0">
                  <h4 className="font-semibold text-ink-900 text-sm">{int.name}</h4>
                  <p className="text-xs text-ink-500 mt-0.5">{int.desc}</p>
                </div>
              </div>
              <Badge
                tone={int.connected ? 'success' : 'neutral'}
                icon={int.connected ? <Check size={12} aria-hidden="true" /> : undefined}
              >
                {int.connected ? t('admin.connected') : t('admin.notConnected')}
              </Badge>
            </div>
            <div className="mt-4 pt-3 border-t border-ink-100 flex justify-end">
              <Button variant="ghost" size="sm" className={int.connected ? 'hover:!text-error-700' : ''}>
                {int.connected ? t('admin.disconnect') : t('admin.connect')}
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function SystemTab() {
  const { t } = useLanguage();
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
          <Card key={m.label}>
            <div className="flex items-center justify-between mb-3">
              <div aria-hidden="true" className="w-9 h-9 bg-ink-100 rounded-lg flex items-center justify-center text-ink-600">
                <m.icon size={18} />
              </div>
              <span className="text-2xl font-bold text-ink-900 tnum">{m.value}<span className="text-sm text-ink-500">{m.unit}</span></span>
            </div>
            <p className="text-sm text-ink-500">{m.label}</p>
            <div className="mt-2 h-1.5 bg-ink-100 rounded-full overflow-hidden" role="progressbar" aria-valuenow={m.value} aria-valuemin={0} aria-valuemax={100} aria-label={m.label}>
              <div aria-hidden="true" className={`h-full ${m.color} rounded-full transition-all`} style={{ width: `${m.value}%` }} />
            </div>
          </Card>
        ))}
      </div>

      <Card>
        <h3 className="font-heading font-semibold text-ink-900 mb-4">{t('admin.svcStatus')}</h3>
        <ul className="space-y-2">
          {services.map((s) => (
            <li key={s.name} className="flex items-center justify-between gap-3 flex-wrap p-3 rounded-lg border border-ink-100 hover:bg-ink-50/50 transition-colors">
              <div className="flex items-center gap-2.5">
                <span aria-hidden="true" className="w-2 h-2 rounded-full bg-success-500 animate-pulse-soft" />
                <span className="text-sm font-medium text-ink-900">{s.name}</span>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-xs text-ink-500">{t('admin.latency')} <span className="font-mono text-ink-600 tnum">{s.latency}</span></span>
                <Badge tone="success" className="capitalize">{s.status}</Badge>
              </div>
            </li>
          ))}
        </ul>
      </Card>

      <Card>
        <h3 className="font-heading font-semibold text-ink-900 mb-4">{t('admin.sysInfo')}</h3>
        <dl className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {[
            { label: 'Version', value: 'SMR v1.0.0' },
            { label: 'Uptime', value: '14d 7h 32m' },
            { label: 'Region', value: 'Asia-Pacific' },
            { label: 'Total Meetings', value: '1,247' },
            { label: 'Total Users', value: '61' },
            { label: 'Last Backup', value: '2 hours ago' },
          ].map((info) => (
            <div key={info.label} className="p-3 rounded-lg bg-ink-50">
              <dt className="text-xs text-ink-500">{info.label}</dt>
              <dd className="text-sm font-semibold text-ink-900 mt-0.5 tnum">{info.value}</dd>
            </div>
          ))}
        </dl>
      </Card>
    </div>
  );
}
