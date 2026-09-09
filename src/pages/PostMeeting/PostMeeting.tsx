import { useState } from 'react';
import {
  CheckSquare,
  FileText,
  Download,
  Search,
  Calendar,
  User,
  Flag,
  Clock,
  CheckCircle2,
  Circle,
  FileSpreadsheet,
  ChevronRight,
  Sparkles,
  PenLine,
  ThumbsUp,
  ThumbsDown,
} from 'lucide-react';
import type { Page, Task, MeetingMinutes } from '@/types';
import { tasks as initialTasks, meetingMinutes } from '@/data';
import {
  taskStatusLabel,
  priorityColor,
  formatDate,
  formatDateLong,
  daysUntil,
} from '@/utils';
import { Modal } from '@/components/Modal';
import { useLanguage } from '@/i18n';
import { Button } from '@/components/ui/Button';
import { SearchBar } from '@/components/ui/SearchBar';
import { FilterPanel } from '@/components/ui/FilterPanel';
import { Card } from '@/components/ui/Card';
import { Badge, type BadgeTone } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import './PostMeeting.css';

interface PostMeetingProps {
  onNavigate: (page: Page) => void;
  onBack: () => void;
  canGoBack: boolean;
}

type Tab = 'tasks' | 'minutes' | 'reports' | 'search';

const taskTone: Record<string, BadgeTone> = {
  pending: 'warning',
  'in-progress': 'info',
  completed: 'success',
  overdue: 'error',
};

const taskFilterChipIds = ['all', 'pending', 'in-progress', 'completed', 'overdue'] as const;

export function PostMeeting(props: PostMeetingProps) {
  void props;
  const { t } = useLanguage();
  const [tab, setTab] = useState<Tab>('tasks');
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [taskFilter, setTaskFilter] = useState<'all' | 'pending' | 'in-progress' | 'completed' | 'overdue'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMinutes, setSelectedMinutes] = useState<MeetingMinutes | null>(null);

  const toggleTaskStatus = (id: string) => {
    setTasks((prev) => prev.map((task) => {
      if (task.id === id) {
        if (task.status === 'completed') return { ...task, status: 'pending' };
        return { ...task, status: 'completed' };
      }
      return task;
    }));
  };

  const filteredTasks = tasks.filter((task) => {
    if (taskFilter !== 'all' && task.status !== taskFilter) return false;
    if (searchQuery && !task.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const taskStats = {
    total: tasks.length,
    pending: tasks.filter((task) => task.status === 'pending').length,
    inProgress: tasks.filter((task) => task.status === 'in-progress').length,
    completed: tasks.filter((task) => task.status === 'completed').length,
    overdue: tasks.filter((task) => task.status === 'overdue').length,
  };

  const tabs: { id: Tab; label: string; icon: typeof CheckSquare }[] = [
    { id: 'tasks', label: t('post.tasks'), icon: CheckSquare },
    { id: 'minutes', label: t('post.minutes'), icon: FileText },
    { id: 'reports', label: t('post.reports'), icon: FileSpreadsheet },
    { id: 'search', label: t('post.search'), icon: Search },
  ];

  return (
    <div className="page-gutter space-y-6 animate-fade-in mx-auto max-w-[1440px] w-full">
      {/* Tabs */}
      <div role="tablist" aria-label={t('post.sections')} className="flex items-center gap-1 bg-white border border-ink-200 rounded-xl p-1 w-fit max-w-full overflow-x-auto">
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

      {tab === 'tasks' && (
        <TasksTab
          tasks={filteredTasks}
          stats={taskStats}
          filter={taskFilter}
          setFilter={setTaskFilter}
          search={searchQuery}
          setSearch={setSearchQuery}
          onToggle={toggleTaskStatus}
        />
      )}

      {tab === 'minutes' && (
        <MinutesTab minutes={meetingMinutes} onSelect={setSelectedMinutes} />
      )}

      {tab === 'reports' && <ReportsTab />}

      {tab === 'search' && <SearchTab />}

      {selectedMinutes && (
        <MinutesDetailModal minutes={selectedMinutes} onClose={() => setSelectedMinutes(null)} />
      )}
    </div>
  );
}

function TasksTab({ tasks, stats, filter, setFilter, search, setSearch, onToggle }: {
  tasks: Task[];
  stats: { total: number; pending: number; inProgress: number; completed: number; overdue: number };
  filter: string;
  setFilter: (f: 'all' | 'pending' | 'in-progress' | 'completed' | 'overdue') => void;
  search: string;
  setSearch: (s: string) => void;
  onToggle: (id: string) => void;
}) {
  const { t, lang, locale } = useLanguage();
  const chips = taskFilterChipIds.map((id) => ({
    id,
    label:
      id === 'all'
        ? t('post.all')
        : id === 'pending'
          ? t('post.pending')
          : id === 'in-progress'
            ? t('post.inProgress')
            : id === 'completed'
              ? t('post.completed')
              : t('post.overdue'),
  }));
  return (
    <div className="space-y-5">
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { id: 'total', label: t('post.total'), value: stats.total, tone: 'neutral' as BadgeTone },
          { id: 'pending', label: t('post.pending'), value: stats.pending, tone: 'warning' as BadgeTone },
          { id: 'inProgress', label: t('post.inProgress'), value: stats.inProgress, tone: 'info' as BadgeTone },
          { id: 'completed', label: t('post.completed'), value: stats.completed, tone: 'success' as BadgeTone },
          { id: 'overdue', label: t('post.overdue'), value: stats.overdue, tone: 'error' as BadgeTone },
        ].map((s) => (
          <Card key={s.id} padding="sm">
            <Badge tone={s.tone}>{s.label}</Badge>
            <p className="text-2xl font-bold text-ink-900 mt-2 tnum">{s.value}</p>
          </Card>
        ))}
      </div>

      {/* Filters + search */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <FilterPanel
          chips={chips}
          selectedId={filter}
          onSelect={(id) => setFilter(id as 'all' | 'pending' | 'in-progress' | 'completed' | 'overdue')}
          ariaLabel={t('post.filterTasks')}
        />
        <SearchBar
          value={search}
          onChange={setSearch}
          label={t('post.searchTasks')}
          placeholder={t('post.searchTasksPh')}
          className="w-full sm:w-64"
        />
      </div>

      <p aria-live="polite" className="text-sm text-ink-500 tnum">
        {t('post.taskCount', { n: tasks.length, unit: tasks.length === 1 ? t('post.task.one') : t('post.task.many') })}
      </p>

      {/* Task list */}
      <div className="space-y-3">
        {tasks.map((task) => (
          <Card key={task.id} padding="sm" className="hover:shadow-soft transition-all">
            <div className="flex items-start gap-3">
              <button
                type="button"
                onClick={() => onToggle(task.id)}
                aria-pressed={task.status === 'completed'}
                aria-label={task.status === 'completed' ? t('post.markUndone', { title: task.title }) : t('post.markDone', { title: task.title })}
                className="mt-0.5 shrink-0 transition-colors min-w-[32px] min-h-[32px] flex items-center justify-center rounded-lg hover:bg-ink-100"
              >
                {task.status === 'completed' ? (
                  <CheckCircle2 size={20} aria-hidden="true" className="text-success-600" />
                ) : (
                  <Circle size={20} aria-hidden="true" className="text-ink-300 hover:text-primary-500" />
                )}
              </button>

              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className={`font-medium text-ink-900 ${task.status === 'completed' ? 'line-through text-ink-500' : ''}`}>
                      {task.title}
                    </p>
                    <p className="text-sm text-ink-500 mt-1">{task.description}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge tone={taskTone[task.status] ?? 'neutral'}>{taskStatusLabel(task.status, lang)}</Badge>
                    <Flag size={14} aria-hidden="true" className={`${priorityColor(task.priority)}`} />
                  </div>
                </div>

                <div className="flex items-center gap-4 mt-3 text-xs text-ink-500 flex-wrap">
                  <span className="flex items-center gap-1.5">
                    <User size={12} aria-hidden="true" /> {task.assigneeName}
                  </span>
                  <span className="flex items-center gap-1.5 tnum">
                    <Calendar size={12} aria-hidden="true" /> {formatDate(task.deadline, locale)}
                  </span>
                  <span className={`flex items-center gap-1.5 tnum ${task.status === 'overdue' ? 'text-error-700 font-medium' : ''}`}>
                    <Clock size={12} aria-hidden="true" />
                    {task.status === 'overdue' ? t('dash.dueOver', { n: Math.abs(daysUntil(task.deadline)) }) :
                     task.status === 'completed' ? t('post.done') : t('dash.dueLeft', { n: daysUntil(task.deadline) })}
                  </span>
                  <span className="flex items-center gap-1.5 text-ink-500">
                    <FileText size={12} aria-hidden="true" /> {task.meetingTitle}
                  </span>
                </div>
              </div>
            </div>
          </Card>
        ))}

        {tasks.length === 0 && (
          <EmptyState
            icon={<CheckSquare size={32} aria-hidden="true" />}
            title={t('post.noTasks')}
            description={t('post.noTasksDesc')}
          />
        )}
      </div>
    </div>
  );
}

function MinutesTab({ minutes, onSelect }: { minutes: MeetingMinutes[]; onSelect: (m: MeetingMinutes) => void }) {
  const { t, locale } = useLanguage();
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm text-ink-500 tnum">{t('post.minutesCount', { n: minutes.length })}</p>
        <Button variant="secondary" size="sm">
          <Download size={16} aria-hidden="true" /> {t('post.exportAll')}
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {minutes.map((mom) => (
          <Card
            key={mom.id}
            className="hover:shadow-float hover:border-primary-200 transition-all group"
          >
            <button
              type="button"
              onClick={() => onSelect(mom)}
              aria-label={t('post.viewMinutes', { title: mom.meetingTitle })}
              className="block w-full text-left focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-cta-500/40 rounded-xl"
            >
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div aria-hidden="true" className="w-10 h-10 bg-gradient-to-br from-accent-500 to-primary-600 rounded-lg flex items-center justify-center text-white shrink-0">
                    <FileText size={20} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-heading font-semibold text-ink-900 text-sm truncate group-hover:text-primary-700 transition-colors">
                      {mom.meetingTitle}
                    </h3>
                    <p className="text-xs text-ink-500">{formatDateLong(mom.date, locale)}</p>
                  </div>
                </div>
                <Badge
                  tone={mom.status === 'approved' ? 'success' : mom.status === 'rejected' ? 'error' : 'warning'}
                  className="shrink-0"
                  icon={mom.status === 'approved' ? <CheckCircle2 size={12} aria-hidden="true" /> : mom.status === 'draft' ? <PenLine size={12} aria-hidden="true" /> : undefined}
                >
                  {mom.status === 'approved' ? t('post.approved') : mom.status === 'draft' ? t('post.draftPending') : mom.status.charAt(0).toUpperCase() + mom.status.slice(1)}
                </Badge>
              </div>

              <p className="text-sm text-ink-600 line-clamp-3 leading-relaxed">{mom.summary}</p>

              <div className="flex items-center gap-4 mt-4 pt-3 border-t border-ink-100 text-xs text-ink-500 flex-wrap">
                <span className="flex items-center gap-1 tnum"><User size={12} aria-hidden="true" /> {t('post.attendees', { n: mom.attendees.length })}</span>
                <span className="flex items-center gap-1 tnum"><CheckSquare size={12} aria-hidden="true" /> {t('post.actions', { n: mom.actionItems.length })}</span>
                <span className="flex items-center gap-1"><Sparkles size={12} aria-hidden="true" /> {t('post.aiGen')}</span>
              </div>

              <div className="flex items-center justify-between mt-3">
                <span className="text-xs text-ink-500">{t('post.generated', { at: mom.generatedAt })}</span>
                <ChevronRight size={16} aria-hidden="true" className="text-ink-300 group-hover:text-primary-600 group-hover:translate-x-0.5 transition-all" />
              </div>
            </button>
          </Card>
        ))}
      </div>
    </div>
  );
}

function MinutesDetailModal({ minutes, onClose }: { minutes: MeetingMinutes; onClose: () => void }) {
  const { t, locale } = useLanguage();
  return (
    <Modal
      open={true}
      onClose={onClose}
      title={minutes.meetingTitle}
      subtitle={`${t('post.minutesTitle')} · ${formatDateLong(minutes.date, locale)}`}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>{t('post.close')}</Button>
          <Button variant="secondary">
            <Download size={16} aria-hidden="true" /> {t('post.downloadDocx')}
          </Button>
          {minutes.status === 'draft' && (
            <>
              <Button variant="danger">
                <ThumbsDown size={16} aria-hidden="true" /> {t('post.reject')}
              </Button>
              <Button variant="primary">
                <ThumbsUp size={16} aria-hidden="true" /> {t('post.approve')}
              </Button>
            </>
          )}
        </>
      }
    >
      <div className="space-y-5">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge tone={minutes.status === 'approved' ? 'success' : 'warning'}>
            {minutes.status === 'approved' ? t('post.approved') : t('post.draftPending')}
          </Badge>
          {minutes.approvedBy && (
            <span className="text-xs text-ink-500">{t('post.approvedBy', { name: minutes.approvedBy })}</span>
          )}
        </div>

        <div>
          <h4 className="text-sm font-semibold text-ink-900 mb-2 flex items-center gap-2">
            <FileText size={16} aria-hidden="true" className="text-primary-600" /> {t('post.summary')}
          </h4>
          <p className="text-sm text-ink-600 leading-relaxed">{minutes.summary}</p>
        </div>

        <div>
          <h4 className="text-sm font-semibold text-ink-900 mb-2 flex items-center gap-2">
            <CheckCircle2 size={16} aria-hidden="true" className="text-success-600" /> {t('post.keyDecisions')}
          </h4>
          <ul className="space-y-2">
            {minutes.keyDecisions.map((d, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-ink-600">
                <span aria-hidden="true" className="mt-1.5 w-1.5 h-1.5 rounded-full bg-success-500 shrink-0" />
                {d}
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h4 className="text-sm font-semibold text-ink-900 mb-2 flex items-center gap-2">
            <CheckSquare size={16} aria-hidden="true" className="text-accent-600" /> {t('post.actionItems')}
          </h4>
          <ul className="space-y-2">
            {minutes.actionItems.map((a, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-ink-600">
                <span aria-hidden="true" className="mt-1.5 w-1.5 h-1.5 rounded-full bg-accent-500 shrink-0" />
                {a}
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h4 className="text-sm font-semibold text-ink-900 mb-2">{t('post.attendeesH')}</h4>
          <div className="flex flex-wrap gap-2">
            {minutes.attendees.map((a) => (
              <Badge key={a} tone="neutral" icon={<User size={12} aria-hidden="true" />}>
                {a}
              </Badge>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}

function ReportsTab() {
  const { t } = useLanguage();
  const reports = [
    { title: 'Meeting Attendance Report', desc: 'Check-in/out times for all participants', icon: User, format: 'XLSX', date: 'Aug 25, 2026' },
    { title: 'Task Completion Summary', desc: 'Status of all action items across meetings', icon: CheckSquare, format: 'XLSX', date: 'Aug 25, 2026' },
    { title: 'AI Transcription Accuracy', desc: 'STT accuracy metrics and language coverage', icon: Sparkles, format: 'PDF', date: 'Aug 24, 2026' },
    { title: 'Meeting Duration Analytics', desc: 'Time spent in meetings by department', icon: Clock, format: 'XLSX', date: 'Aug 24, 2026' },
    { title: 'Monthly Meeting Overview', desc: 'All meetings held in August 2026', icon: Calendar, format: 'XLSX', date: 'Aug 23, 2026' },
  ];

  return (
    <div className="space-y-5">
      <Card className="bg-gradient-to-br from-primary-50 to-accent-50 border-primary-100">
        <div className="flex items-center gap-3">
          <div aria-hidden="true" className="w-12 h-12 bg-primary-600 rounded-xl flex items-center justify-center text-white shrink-0">
            <FileSpreadsheet size={24} />
          </div>
          <div>
            <h3 className="font-heading font-semibold text-ink-900">{t('post.exportReports')}</h3>
            <p className="text-sm text-ink-500">{t('post.exportReportsDesc')}</p>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {reports.map((r) => (
          <Card key={r.title} className="hover:shadow-soft transition-all group">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 min-w-0">
                <div aria-hidden="true" className="w-10 h-10 bg-ink-100 rounded-lg flex items-center justify-center text-ink-600 shrink-0">
                  <r.icon size={20} />
                </div>
                <div className="min-w-0">
                  <h4 className="font-semibold text-ink-900 text-sm">{r.title}</h4>
                  <p className="text-xs text-ink-500 mt-0.5">{r.desc}</p>
                </div>
              </div>
              <Badge tone={r.format === 'XLSX' ? 'success' : 'error'}>
                {r.format}
              </Badge>
            </div>
            <div className="flex items-center justify-between mt-4 pt-3 border-t border-ink-100">
              <span className="text-xs text-ink-500 flex items-center gap-1">
                <Calendar size={12} aria-hidden="true" /> {r.date}
              </span>
              <Button variant="secondary" size="sm" className="group-hover:bg-primary-50 group-hover:border-primary-200 group-hover:text-primary-700">
                <Download size={14} aria-hidden="true" /> {t('post.download')}
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function SearchTab() {
  const { t } = useLanguage();
  const [query, setQuery] = useState('');
  const [searched, setSearched] = useState(false);

  const mockResults = [
    { type: 'Transcript', meeting: 'Q3 Financial Review Meeting', date: 'Aug 25, 2026', snippet: '...revenue came in at 18.5 billion VND, which is 12% above target...', source: 'AI Transcription' },
    { type: 'Chat', meeting: 'Q3 Financial Review Meeting', date: 'Aug 25, 2026', snippet: 'I have the Q3 revenue slides ready, sharing now.', source: 'Le Minh Cuong' },
    { type: 'Document', meeting: 'Client Onboarding — Acme Corp', date: 'Aug 22, 2026', snippet: 'Q3 Financial Report.pdf — shared in workspace', source: 'Co-edited Document' },
    { type: 'Minutes', meeting: 'HR Policy Update Briefing', date: 'Aug 20, 2026', snippet: 'Remote work policy updated to 3 days/week hybrid model...', source: 'AI Minutes' },
  ];

  return (
    <div className="space-y-5">
      <Card padding="lg">
        <h3 className="font-heading font-semibold text-ink-900 mb-1">{t('post.ftsTitle')}</h3>
        <p className="text-sm text-ink-500 mb-4">{t('post.ftsDesc')}</p>
        <form
          className="flex items-stretch gap-3 flex-col sm:flex-row"
          onSubmit={(e) => { e.preventDefault(); setSearched(true); }}
        >
          <SearchBar
            value={query}
            onChange={setQuery}
            onSearch={() => setSearched(true)}
            label={t('post.ftsLabel')}
            placeholder={t('post.ftsPh')}
            className="flex-1"
          />
          <Button type="submit" className="shrink-0">
            <Search size={16} aria-hidden="true" /> {t('post.ftsBtn')}
          </Button>
        </form>
      </Card>

      {searched && (
        <div className="space-y-3">
          <p aria-live="polite" className="text-sm text-ink-500 tnum">{t('post.results', { n: mockResults.length })}</p>
          {mockResults.map((r, i) => (
            <Card key={i} padding="sm" className="hover:shadow-soft transition-all group">
              <div className="flex items-start gap-3">
                <div aria-hidden="true" className="w-9 h-9 bg-ink-100 rounded-lg flex items-center justify-center text-ink-600 shrink-0">
                  {r.type === 'Transcript' ? <Sparkles size={16} /> : <FileText size={16} />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <Badge tone="info">{r.type}</Badge>
                    <span className="text-sm font-medium text-ink-900">{r.meeting}</span>
                    <span className="text-xs text-ink-500">{r.date}</span>
                  </div>
                  <p className="text-sm text-ink-600 leading-relaxed">{r.snippet}</p>
                  <p className="text-xs text-ink-500 mt-1">{t('post.source', { s: r.source })}</p>
                </div>
                <ChevronRight size={16} aria-hidden="true" className="text-ink-300 group-hover:text-primary-600 transition-colors shrink-0 mt-1" />
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
