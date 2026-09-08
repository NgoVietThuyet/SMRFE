import {
  CalendarClock,
  CheckCircle2,
  Clock,
  TrendingUp,
  Video,
  Plus,
  ArrowRight,
  AlertTriangle,
  Users,
  Mic,
  FileText,
  CalendarDays,
} from 'lucide-react';
import type { Page } from '@/types';
import { meetings, tasks, weeklyMeetingData, currentUser } from '@/data';
import {
  statusColor,
  statusLabel,
  taskStatusColor,
  taskStatusLabel,
  priorityColor,
  formatDate,
  isToday,
  daysUntil,
  formatDuration,
} from '@/utils';
import { Avatar } from '@/components/Avatar';

interface DashboardProps {
  onNavigate: (page: Page) => void;
}

export function Dashboard({ onNavigate }: DashboardProps) {
  const todaysMeetings = meetings.filter((m) => isToday(m.date));
  const upcomingMeetings = meetings
    .filter((m) => m.status === 'scheduled')
    .sort((a, b) => a.date.localeCompare(b.date));
  const myTasks = tasks.filter((t) => t.assigneeId === currentUser.id || t.assigneeId === 'u3');
  const overdueTasks = tasks.filter((t) => t.status === 'overdue');
  const completedMeetings = meetings.filter((m) => m.status === 'completed');
  const maxWeekly = Math.max(...weeklyMeetingData.map((d) => d.count));

  const stats = [
    { label: 'Meetings This Week', value: '12', change: '+3', icon: CalendarClock, color: 'bg-primary-50 text-primary-600' },
    { label: 'Hours in Meetings', value: '8.5h', change: '+1.2h', icon: Clock, color: 'bg-accent-50 text-accent-600' },
    { label: 'Tasks Assigned', value: String(myTasks.length), change: '2 due', icon: CheckCircle2, color: 'bg-success-50 text-success-600' },
    { label: 'AI Minutes Generated', value: '8', change: '+2', icon: FileText, color: 'bg-warning-50 text-warning-600' },
  ];

  return (
    <div className="p-8 space-y-6 animate-fade-in">
      {/* Welcome banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary-600 via-primary-600 to-accent-600 p-6 text-white">
        <div className="absolute -top-16 -right-16 w-64 h-64 bg-white/10 rounded-full blur-2xl" />
        <div className="absolute -bottom-20 -left-10 w-48 h-48 bg-accent-300/20 rounded-full blur-2xl" />
        <div className="relative flex items-center justify-between gap-6 flex-wrap">
          <div>
            <p className="text-white/70 text-sm">Good morning,</p>
            <h2 className="text-2xl font-bold mt-1">{currentUser.name}</h2>
            <p className="text-white/80 text-sm mt-2">
              You have {todaysMeetings.length} meeting{todaysMeetings.length !== 1 ? 's' : ''} today and {myTasks.filter(t => t.status !== 'completed').length} pending tasks.
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => onNavigate('meeting')}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-white/15 backdrop-blur rounded-lg text-sm font-medium hover:bg-white/25 transition-colors"
            >
              <Video size={18} />
              Join Meeting
            </button>
            <button
              onClick={() => onNavigate('planner')}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-white text-primary-700 rounded-lg text-sm font-medium hover:bg-primary-50 transition-colors"
            >
              <Plus size={18} />
              Schedule
            </button>
          </div>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => (
          <div key={s.label} className="card p-5">
            <div className="flex items-start justify-between">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${s.color}`}>
                <s.icon size={20} />
              </div>
              <span className="text-xs font-medium text-success-600 flex items-center gap-0.5">
                <TrendingUp size={12} />
                {s.change}
              </span>
            </div>
            <p className="text-2xl font-bold text-ink-900 mt-3">{s.value}</p>
            <p className="text-sm text-ink-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Today's schedule + upcoming */}
        <div className="lg:col-span-2 space-y-6">
          {/* Today's meetings */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <CalendarDays size={18} className="text-primary-600" />
                <h3 className="font-semibold text-ink-900">Today's Schedule</h3>
              </div>
              <button onClick={() => onNavigate('planner')} className="text-sm text-primary-600 hover:text-primary-700 font-medium flex items-center gap-1">
                View all <ArrowRight size={14} />
              </button>
            </div>
            <div className="space-y-2">
              {todaysMeetings.length === 0 ? (
                <p className="text-sm text-ink-400 text-center py-8">No meetings scheduled for today</p>
              ) : (
                todaysMeetings.map((m) => (
                  <div
                    key={m.id}
                    onClick={() => onNavigate('meeting')}
                    className="flex items-center gap-4 p-3 rounded-xl border border-ink-100 hover:border-primary-200 hover:bg-primary-50/30 transition-all cursor-pointer group"
                  >
                    <div className="flex flex-col items-center justify-center w-14 shrink-0">
                      <span className="text-xs text-ink-400">{m.startTime}</span>
                      <span className="text-xs text-ink-300">{m.endTime}</span>
                    </div>
                    <div className="w-px h-10 bg-ink-200" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-ink-900 text-sm truncate">{m.title}</p>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-xs text-ink-400 flex items-center gap-1">
                          <Users size={12} /> {m.participantIds.length}
                        </span>
                        <span className="text-xs text-ink-400 flex items-center gap-1">
                          <Clock size={12} /> {formatDuration(m.startTime, m.endTime)}
                        </span>
                        {m.aiEnabled && (
                          <span className="text-xs text-accent-600 flex items-center gap-1">
                            <Mic size={12} /> AI
                          </span>
                        )}
                      </div>
                    </div>
                    <span className={`badge ${statusColor(m.status)}`}>{statusLabel(m.status)}</span>
                    {m.status === 'live' && (
                      <button
                        onClick={(e) => { e.stopPropagation(); onNavigate('meeting'); }}
                        className="btn-primary py-1.5 px-3 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        Join
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Weekly chart */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <TrendingUp size={18} className="text-primary-600" />
                <h3 className="font-semibold text-ink-900">Weekly Meeting Activity</h3>
              </div>
              <span className="text-xs text-ink-400">This week</span>
            </div>
            <div className="flex items-end justify-between gap-3 h-40 px-2">
              {weeklyMeetingData.map((d) => (
                <div key={d.day} className="flex flex-col items-center gap-2 flex-1">
                  <div className="w-full flex-1 flex items-end">
                    <div
                      className="w-full rounded-t-lg bg-gradient-to-t from-primary-500 to-accent-400 transition-all duration-500 hover:from-primary-600 hover:to-accent-500 relative group"
                      style={{ height: `${(d.count / maxWeekly) * 100}%`, minHeight: d.count > 0 ? '8px' : '2px' }}
                    >
                      <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-xs font-semibold text-ink-700 opacity-0 group-hover:opacity-100 transition-opacity">
                        {d.count}
                      </span>
                    </div>
                  </div>
                  <span className="text-xs text-ink-400 font-medium">{d.day}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-6">
          {/* Urgent tasks */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <AlertTriangle size={18} className="text-warning-600" />
                <h3 className="font-semibold text-ink-900">Tasks Due Soon</h3>
              </div>
              <button onClick={() => onNavigate('post-meeting')} className="text-sm text-primary-600 hover:text-primary-700 font-medium">
                All tasks
              </button>
            </div>
            <div className="space-y-3">
              {tasks.slice(0, 4).map((t) => (
                <div key={t.id} className="flex items-start gap-3 group">
                  <div className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${priorityColor(t.priority).replace('text-', 'bg-')}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-ink-900 truncate">{t.title}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`badge ${taskStatusColor(t.status)}`}>{taskStatusLabel(t.status)}</span>
                      <span className="text-xs text-ink-400">
                        {t.status === 'overdue' ? `${Math.abs(daysUntil(t.deadline))}d overdue` : `${daysUntil(t.deadline)}d left`}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Upcoming meetings */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <CalendarClock size={18} className="text-accent-600" />
                <h3 className="font-semibold text-ink-900">Upcoming</h3>
              </div>
            </div>
            <div className="space-y-3">
              {upcomingMeetings.slice(0, 3).map((m) => (
                <div key={m.id} className="p-3 rounded-lg bg-ink-50 hover:bg-primary-50/40 transition-colors cursor-pointer" onClick={() => onNavigate('planner')}>
                  <p className="text-sm font-medium text-ink-900 truncate">{m.title}</p>
                  <p className="text-xs text-ink-400 mt-0.5">{formatDate(m.date)} · {m.startTime}</p>
                  <div className="flex items-center gap-1.5 mt-2">
                    <div className="flex -space-x-2">
                      {m.participantIds.slice(0, 3).map((pid) => {
                        const p = participantsById[pid];
                        return p ? <Avatar key={pid} name={p.name} color={p.avatarColor} size="xs" ring /> : null;
                      })}
                    </div>
                    {m.participantIds.length > 3 && (
                      <span className="text-xs text-ink-400">+{m.participantIds.length - 3}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Quick stats */}
          <div className="card p-5">
            <h3 className="font-semibold text-ink-900 mb-3">Quick Stats</h3>
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-sm text-ink-500">Completed meetings</span>
                <span className="text-sm font-semibold text-ink-900">{completedMeetings.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-ink-500">Overdue tasks</span>
                <span className="text-sm font-semibold text-error-600">{overdueTasks.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-ink-500">Avg meeting length</span>
                <span className="text-sm font-semibold text-ink-900">1h 12m</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-ink-500">AI accuracy</span>
                <span className="text-sm font-semibold text-success-600">94.2%</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const participantsById: Record<string, { name: string; avatarColor: string }> = {
  u1: { name: 'Nguyen Van An', avatarColor: 'bg-primary-600' },
  u2: { name: 'Tran Thi Bich', avatarColor: 'bg-accent-600' },
  u3: { name: 'Le Minh Cuong', avatarColor: 'bg-success-600' },
  u4: { name: 'Pham Thi Dung', avatarColor: 'bg-warning-600' },
  u5: { name: 'Hoang Van Em', avatarColor: 'bg-error-600' },
  u6: { name: 'Vu Thi Phuong', avatarColor: 'bg-primary-500' },
};
