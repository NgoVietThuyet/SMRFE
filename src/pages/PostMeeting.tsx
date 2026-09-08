import { useState } from 'react';
import {
  CheckSquare,
  FileText,
  Download,
  Search,
  Filter,
  Calendar,
  User,
  Flag,
  Clock,
  CheckCircle2,
  Circle,
  AlertTriangle,
  FileSpreadsheet,
  ChevronRight,
  Sparkles,
  PenLine,
  ThumbsUp,
  ThumbsDown,
  ArrowLeft,
} from 'lucide-react';
import type { Page, Task, MeetingMinutes } from '@/types';
import { tasks as initialTasks, meetingMinutes, meetings } from '@/data';
import {
  taskStatusColor,
  taskStatusLabel,
  priorityColor,
  formatDate,
  formatDateLong,
  daysUntil,
} from '@/utils';
import { Avatar } from '@/components/Avatar';
import { Modal } from '@/components/Modal';

interface PostMeetingProps {
  onNavigate: (page: Page) => void;
  onBack: () => void;
  canGoBack: boolean;
}

type Tab = 'tasks' | 'minutes' | 'reports' | 'search';

export function PostMeeting({ onNavigate }: PostMeetingProps) {
  const [tab, setTab] = useState<Tab>('tasks');
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [taskFilter, setTaskFilter] = useState<'all' | 'pending' | 'in-progress' | 'completed' | 'overdue'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMinutes, setSelectedMinutes] = useState<MeetingMinutes | null>(null);

  const toggleTaskStatus = (id: string) => {
    setTasks((prev) => prev.map((t) => {
      if (t.id === id) {
        if (t.status === 'completed') return { ...t, status: 'pending' };
        return { ...t, status: 'completed' };
      }
      return t;
    }));
  };

  const filteredTasks = tasks.filter((t) => {
    if (taskFilter !== 'all' && t.status !== taskFilter) return false;
    if (searchQuery && !t.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const taskStats = {
    total: tasks.length,
    pending: tasks.filter((t) => t.status === 'pending').length,
    inProgress: tasks.filter((t) => t.status === 'in-progress').length,
    completed: tasks.filter((t) => t.status === 'completed').length,
    overdue: tasks.filter((t) => t.status === 'overdue').length,
  };

  const tabs: { id: Tab; label: string; icon: typeof CheckSquare }[] = [
    { id: 'tasks', label: 'Action Items', icon: CheckSquare },
    { id: 'minutes', label: 'Meeting Minutes', icon: FileText },
    { id: 'reports', label: 'Reports', icon: FileSpreadsheet },
    { id: 'search', label: 'Full-Text Search', icon: Search },
  ];

  return (
    <div className="p-8 space-y-6 animate-fade-in">
      {/* Tabs */}
      <div className="flex items-center gap-1 bg-white border border-ink-200 rounded-xl p-1 w-fit">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === t.id ? 'bg-primary-600 text-white shadow-sm' : 'text-ink-500 hover:bg-ink-100'
            }`}
          >
            <t.icon size={16} /> {t.label}
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
  return (
    <div className="space-y-5">
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { label: 'Total', value: stats.total, color: 'bg-ink-100 text-ink-700' },
          { label: 'Pending', value: stats.pending, color: 'bg-warning-100 text-warning-700' },
          { label: 'In Progress', value: stats.inProgress, color: 'bg-primary-100 text-primary-700' },
          { label: 'Completed', value: stats.completed, color: 'bg-success-100 text-success-700' },
          { label: 'Overdue', value: stats.overdue, color: 'bg-error-100 text-error-700' },
        ].map((s) => (
          <div key={s.label} className="card p-4">
            <div className="flex items-center justify-between">
              <span className={`badge ${s.color}`}>{s.label}</span>
            </div>
            <p className="text-2xl font-bold text-ink-900 mt-2">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filters + search */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-1 bg-white border border-ink-200 rounded-lg p-1">
          {(['all', 'pending', 'in-progress', 'completed', 'overdue'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors capitalize ${
                filter === f ? 'bg-primary-600 text-white' : 'text-ink-500 hover:bg-ink-100'
              }`}
            >
              {f.replace('-', ' ')}
            </button>
          ))}
        </div>
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tasks..."
            className="w-64 pl-9 pr-3 py-2 text-sm rounded-lg bg-white border border-ink-200 focus:border-primary-400 focus:ring-2 focus:ring-primary-500/10 transition-all"
          />
        </div>
      </div>

      {/* Task list */}
      <div className="space-y-3">
        {tasks.map((task) => (
          <div key={task.id} className="card p-4 hover:shadow-soft transition-all group">
            <div className="flex items-start gap-3">
              <button
                onClick={() => onToggle(task.id)}
                className="mt-0.5 shrink-0 transition-colors"
              >
                {task.status === 'completed' ? (
                  <CheckCircle2 size={20} className="text-success-600" />
                ) : (
                  <Circle size={20} className="text-ink-300 hover:text-primary-500" />
                )}
              </button>

              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className={`font-medium text-ink-900 ${task.status === 'completed' ? 'line-through text-ink-400' : ''}`}>
                      {task.title}
                    </p>
                    <p className="text-sm text-ink-500 mt-1">{task.description}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`badge ${taskStatusColor(task.status)}`}>{taskStatusLabel(task.status)}</span>
                    <Flag size={14} className={`${priorityColor(task.priority)}`} />
                  </div>
                </div>

                <div className="flex items-center gap-4 mt-3 text-xs text-ink-400">
                  <span className="flex items-center gap-1.5">
                    <User size={12} /> {task.assigneeName}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Calendar size={12} /> {formatDate(task.deadline)}
                  </span>
                  <span className={`flex items-center gap-1.5 ${task.status === 'overdue' ? 'text-error-600 font-medium' : ''}`}>
                    <Clock size={12} />
                    {task.status === 'overdue' ? `${Math.abs(daysUntil(task.deadline))}d overdue` :
                     task.status === 'completed' ? 'Done' : `${daysUntil(task.deadline)}d left`}
                  </span>
                  <span className="flex items-center gap-1.5 text-ink-300">
                    <FileText size={12} /> {task.meetingTitle}
                  </span>
                </div>
              </div>
            </div>
          </div>
        ))}

        {tasks.length === 0 && (
          <div className="card p-12 text-center">
            <CheckSquare size={32} className="mx-auto text-ink-300" />
            <p className="mt-3 text-ink-500 font-medium">No tasks found</p>
            <p className="text-sm text-ink-400">Try adjusting your filters</p>
          </div>
        )}
      </div>
    </div>
  );
}

function MinutesTab({ minutes, onSelect }: { minutes: MeetingMinutes[]; onSelect: (m: MeetingMinutes) => void }) {
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-ink-500">{minutes.length} meeting minutes generated by AI</p>
        <button className="btn-secondary">
          <Download size={16} /> Export All
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {minutes.map((mom) => (
          <div
            key={mom.id}
            onClick={() => onSelect(mom)}
            className="card p-5 hover:shadow-float hover:border-primary-200 transition-all cursor-pointer group"
          >
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 bg-gradient-to-br from-accent-500 to-primary-600 rounded-lg flex items-center justify-center text-white">
                  <FileText size={20} />
                </div>
                <div className="min-w-0">
                  <h3 className="font-semibold text-ink-900 text-sm truncate group-hover:text-primary-700 transition-colors">
                    {mom.meetingTitle}
                  </h3>
                  <p className="text-xs text-ink-400">{formatDateLong(mom.date)}</p>
                </div>
              </div>
              <span className={`badge shrink-0 ${
                mom.status === 'approved' ? 'bg-success-100 text-success-700' :
                mom.status === 'rejected' ? 'bg-error-100 text-error-700' :
                'bg-warning-100 text-warning-700'
              }`}>
                {mom.status === 'approved' && <CheckCircle2 size={12} />}
                {mom.status === 'draft' && <PenLine size={12} />}
                {mom.status.charAt(0).toUpperCase() + mom.status.slice(1)}
              </span>
            </div>

            <p className="text-sm text-ink-600 line-clamp-3 leading-relaxed">{mom.summary}</p>

            <div className="flex items-center gap-4 mt-4 pt-3 border-t border-ink-100 text-xs text-ink-400">
              <span className="flex items-center gap-1"><User size={12} /> {mom.attendees.length} attendees</span>
              <span className="flex items-center gap-1"><CheckSquare size={12} /> {mom.actionItems.length} actions</span>
              <span className="flex items-center gap-1"><Sparkles size={12} /> AI generated</span>
            </div>

            <div className="flex items-center justify-between mt-3">
              <span className="text-xs text-ink-400">Generated {mom.generatedAt}</span>
              <ChevronRight size={16} className="text-ink-300 group-hover:text-primary-600 group-hover:translate-x-0.5 transition-all" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MinutesDetailModal({ minutes, onClose }: { minutes: MeetingMinutes; onClose: () => void }) {
  return (
    <Modal
      open={true}
      onClose={onClose}
      title={minutes.meetingTitle}
      subtitle={`Meeting Minutes · ${formatDateLong(minutes.date)}`}
      size="lg"
      footer={
        <>
          <button onClick={onClose} className="btn-secondary">Close</button>
          <button className="btn-secondary">
            <Download size={16} /> Download DOCX
          </button>
          {minutes.status === 'draft' && (
            <>
              <button className="btn-danger">
                <ThumbsDown size={16} /> Reject
              </button>
              <button className="btn-primary">
                <ThumbsUp size={16} /> Approve
              </button>
            </>
          )}
        </>
      }
    >
      <div className="space-y-5">
        <div className="flex items-center gap-2">
          <span className={`badge ${minutes.status === 'approved' ? 'bg-success-100 text-success-700' : 'bg-warning-100 text-warning-700'}`}>
            {minutes.status === 'approved' ? 'Approved' : 'Draft — Pending Approval'}
          </span>
          {minutes.approvedBy && (
            <span className="text-xs text-ink-400">Approved by {minutes.approvedBy}</span>
          )}
        </div>

        <div>
          <h4 className="text-sm font-semibold text-ink-900 mb-2 flex items-center gap-2">
            <FileText size={16} className="text-primary-600" /> Summary
          </h4>
          <p className="text-sm text-ink-600 leading-relaxed">{minutes.summary}</p>
        </div>

        <div>
          <h4 className="text-sm font-semibold text-ink-900 mb-2 flex items-center gap-2">
            <CheckCircle2 size={16} className="text-success-600" /> Key Decisions
          </h4>
          <ul className="space-y-2">
            {minutes.keyDecisions.map((d, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-ink-600">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-success-500 shrink-0" />
                {d}
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h4 className="text-sm font-semibold text-ink-900 mb-2 flex items-center gap-2">
            <CheckSquare size={16} className="text-accent-600" /> Action Items
          </h4>
          <ul className="space-y-2">
            {minutes.actionItems.map((a, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-ink-600">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-accent-500 shrink-0" />
                {a}
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h4 className="text-sm font-semibold text-ink-900 mb-2">Attendees</h4>
          <div className="flex flex-wrap gap-2">
            {minutes.attendees.map((a) => (
              <span key={a} className="badge bg-ink-100 text-ink-700">
                <User size={12} /> {a}
              </span>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}

function ReportsTab() {
  const reports = [
    { title: 'Meeting Attendance Report', desc: 'Check-in/out times for all participants', icon: User, format: 'XLSX', date: 'Aug 25, 2026' },
    { title: 'Task Completion Summary', desc: 'Status of all action items across meetings', icon: CheckSquare, format: 'XLSX', date: 'Aug 25, 2026' },
    { title: 'AI Transcription Accuracy', desc: 'STT accuracy metrics and language coverage', icon: Sparkles, format: 'PDF', date: 'Aug 24, 2026' },
    { title: 'Meeting Duration Analytics', desc: 'Time spent in meetings by department', icon: Clock, format: 'XLSX', date: 'Aug 24, 2026' },
    { title: 'Monthly Meeting Overview', desc: 'All meetings held in August 2026', icon: Calendar, format: 'XLSX', date: 'Aug 23, 2026' },
  ];

  return (
    <div className="space-y-5">
      <div className="card p-5 bg-gradient-to-br from-primary-50 to-accent-50 border-primary-100">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-primary-600 rounded-xl flex items-center justify-center text-white">
            <FileSpreadsheet size={24} />
          </div>
          <div>
            <h3 className="font-semibold text-ink-900">Export Reports</h3>
            <p className="text-sm text-ink-500">Generate and download meeting analytics reports in XLSX/PDF format</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {reports.map((r) => (
          <div key={r.title} className="card p-5 hover:shadow-soft transition-all group">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-ink-100 rounded-lg flex items-center justify-center text-ink-600">
                  <r.icon size={20} />
                </div>
                <div>
                  <h4 className="font-semibold text-ink-900 text-sm">{r.title}</h4>
                  <p className="text-xs text-ink-500 mt-0.5">{r.desc}</p>
                </div>
              </div>
              <span className={`badge ${r.format === 'XLSX' ? 'bg-success-100 text-success-700' : 'bg-error-100 text-error-700'}`}>
                {r.format}
              </span>
            </div>
            <div className="flex items-center justify-between mt-4 pt-3 border-t border-ink-100">
              <span className="text-xs text-ink-400 flex items-center gap-1">
                <Calendar size={12} /> {r.date}
              </span>
              <button className="btn-secondary py-1.5 px-3 text-xs group-hover:bg-primary-50 group-hover:border-primary-200 group-hover:text-primary-700 transition-colors">
                <Download size={14} /> Download
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SearchTab() {
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
      <div className="card p-6">
        <h3 className="font-semibold text-ink-900 mb-1">Full-Text Search</h3>
        <p className="text-sm text-ink-500 mb-4">Search across transcripts, chat messages, documents, and meeting minutes</p>
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && setSearched(true)}
              placeholder="Search for keywords, topics, decisions..."
              className="w-full pl-11 pr-4 py-3 text-sm rounded-lg bg-white border border-ink-200 focus:border-primary-400 focus:ring-2 focus:ring-primary-500/10 transition-all"
            />
          </div>
          <button onClick={() => setSearched(true)} className="btn-primary py-3">
            <Search size={16} /> Search
          </button>
        </div>
      </div>

      {searched && (
        <div className="space-y-3">
          <p className="text-sm text-ink-500">{mockResults.length} results found</p>
          {mockResults.map((r, i) => (
            <div key={i} className="card p-4 hover:shadow-soft transition-all cursor-pointer group">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 bg-ink-100 rounded-lg flex items-center justify-center text-ink-500 shrink-0">
                  {r.type === 'Transcript' && <Sparkles size={16} />}
                  {r.type === 'Chat' && <FileText size={16} />}
                  {r.type === 'Document' && <FileText size={16} />}
                  {r.type === 'Minutes' && <FileText size={16} />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="badge bg-primary-100 text-primary-700">{r.type}</span>
                    <span className="text-sm font-medium text-ink-900">{r.meeting}</span>
                    <span className="text-xs text-ink-400">{r.date}</span>
                  </div>
                  <p className="text-sm text-ink-600 leading-relaxed">{r.snippet}</p>
                  <p className="text-xs text-ink-400 mt-1">Source: {r.source}</p>
                </div>
                <ChevronRight size={16} className="text-ink-300 group-hover:text-primary-600 transition-colors shrink-0" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
