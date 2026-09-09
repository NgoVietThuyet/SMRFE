import { useState, useEffect } from 'react';
import {
  CalendarClock,
  Clock,
  TrendingUp,
  Video,
  Plus,
  ArrowRight,
  AlertTriangle,
  Users,
  Mic,
  CalendarDays,
} from 'lucide-react';
import type { Page } from '@/types';
import {
  statusLabel,
  taskStatusLabel,
  formatDate,
  isToday,
  daysUntil,
  formatDuration,
} from '@/utils';
import { Avatar } from '@/components/Avatar';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge, type BadgeTone } from '@/components/ui/Badge';
import { useLanguage } from '@/i18n';
import './Dashboard.css';

interface DashboardProps {
  onNavigate: (page: Page) => void;
}

const meetingTone: Record<string, BadgeTone> = {
  live: 'error',
  scheduled: 'info',
  completed: 'success',
  cancelled: 'neutral',
};

const taskTone: Record<string, BadgeTone> = {
  pending: 'warning',
  'in-progress': 'info',
  completed: 'success',
  overdue: 'error',
};

function ChartBar({ count, total, value }: { count: number; total: number; value: number }) {
  const level = total <= 0 || count <= 0 ? 0 : Math.max(1, Math.min(10, Math.round((count / total) * 10)));
  return (
    <div aria-hidden="true" className={`dash-chart__bar dash-chart__bar--l${level} group`}>
      <span className="dash-chart__tip tnum">{value}</span>
    </div>
  );
}

function TaskDot({ priority }: { priority: string }) {
  return (
    <span
      aria-hidden="true"
      className={`dash-task__dot ${priority === 'high' ? 'dash-task__dot--high' : priority === 'medium' ? 'dash-task__dot--mid' : 'dash-task__dot--low'}`}
    />
  );
}

const dayKey: Record<string, 'day.mon' | 'day.tue' | 'day.wed' | 'day.thu' | 'day.fri' | 'day.sat' | 'day.sun'> = {
  Mon: 'day.mon',
  Tue: 'day.tue',
  Wed: 'day.wed',
  Thu: 'day.thu',
  Fri: 'day.fri',
  Sat: 'day.sat',
  Sun: 'day.sun',
};

export function Dashboard({ onNavigate }: DashboardProps) {
  const { t, lang, locale } = useLanguage();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    import('@/utils/apiClient').then(({ apiClient }) => {
      apiClient('/Meeting/dashboard')
        .then((res) => {
          setData(res);
          setLoading(false);
        })
        .catch(() => {
          // fallback to mock for now if backend is not running or unauthenticated
          setLoading(false);
        });
    });
  }, []);

  const todaysMeetings = (data?.nextMeetings || []).filter((m: any) => isToday(m.expectedStartTime));
  const upcomingMeetings = (data?.nextMeetings || []).filter((m: any) => m.status === 1).slice(0, 3);

  // Real data usage
  const pendingCount = 0; // Replace with real tasks count if BE supports it later
  const completedMeetings = (data?.ended || 0);

  const currentFullName = typeof window !== 'undefined' ? localStorage.getItem('fullName') || 'User' : 'User';

  return (
    <div className="page-gutter space-y-6 animate-fade-in mx-auto max-w-[1440px] w-full dash-root">
      {/* Welcome banner */}
      <div className="dash-banner">
        <div aria-hidden="true" className="dash-banner__glow dash-banner__glow--top" />
        <div aria-hidden="true" className="dash-banner__glow dash-banner__glow--bottom" />
        <div className="dash-banner__inner">
          <div>
            <p className="dash-banner__hello">{t('dash.goodMorning')}</p>
            <h2 className="dash-banner__name">{currentFullName}</h2>
            <p className="dash-banner__summary">
              {loading ? 'Đang tải dữ liệu...' : t('dash.summary', { meetings: todaysMeetings.length, tasks: 0, pluralM: todaysMeetings.length !== 1 ? 's' : '' })}
            </p>
          </div>
          <div className="dash-banner__actions">
            <button
              type="button"
              onClick={() => onNavigate('meeting')}
              className="dash-banner__btn dash-banner__btn--join"
            >
              <Video size={18} aria-hidden="true" />
              {t('dash.join')}
            </button>
            <button
              type="button"
              onClick={() => onNavigate('planner')}
              className="dash-banner__btn dash-banner__btn--schedule"
            >
              <Plus size={18} aria-hidden="true" />
              {t('dash.schedule')}
            </button>
          </div>
        </div>
      </div>



      <div className="dash-main">
        {/* Today's schedule + upcoming */}
        <div className="dash-main__left">
          {/* Today's meetings */}
          <Card>
            <div className="dash-card__head">
              <div className="dash-card__title">
                <CalendarDays size={18} aria-hidden="true" className="text-primary-600" />
                <h3 className="font-heading font-semibold">{t('dash.today')}</h3>
              </div>
              <Button variant="ghost" size="sm" onClick={() => onNavigate('planner')}>
                {t('dash.viewAll')} <ArrowRight size={14} aria-hidden="true" />
              </Button>
            </div>
            <div className="space-y-2">
              {todaysMeetings.length === 0 ? (
                <p className="dash-empty">{t('dash.noToday')}</p>
              ) : (
                todaysMeetings.map((m: any) => (
                  <div
                    key={m.id}
                    onClick={() => onNavigate('meeting')}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onNavigate('meeting');
                      }
                    }}
                    role="button"
                    tabIndex={0}
                    aria-label={t('dash.open', { title: m.title })}
                    className="dash-row group"
                  >
                    <div className="dash-row__time tnum">
                      <span className="text-xs text-ink-500">{m.startTime}</span>
                      <span className="text-xs text-ink-500">{m.endTime}</span>
                    </div>
                    <div aria-hidden="true" className="dash-row__divider" />
                    <div className="dash-row__body">
                      <p className="dash-row__title">{m.name}</p>
                      <div className="dash-row__meta">
                        <span className="flex items-center gap-1 tnum">
                          <Users size={12} aria-hidden="true" /> {m.participantCount || 0}
                        </span>
                        <span className="flex items-center gap-1 tnum">
                          <Clock size={12} aria-hidden="true" /> {formatDuration(m.expectedStartTime, m.expectedEndTime || m.expectedStartTime)}
                        </span>
                      </div>
                    </div>
                    <Badge tone={meetingTone[m.status] ?? 'neutral'}>{statusLabel(m.status, lang)}</Badge>
                    {m.status === 2 && (
                      <Button
                        size="sm"
                        onClick={(e) => { e.stopPropagation(); onNavigate('meeting'); }}
                        className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity"
                      >
                        {t('dash.joinBtn')}
                      </Button>
                    )}
                  </div>
                ))
              )}
            </div>
          </Card>

          {/* Weekly chart (TODO: Replace with real Weekly BE integration) */}
          <Card>
            <div className="dash-card__head">
              <div className="dash-card__title">
                <TrendingUp size={18} aria-hidden="true" className="text-primary-600" />
                <h3 className="font-heading font-semibold">{t('dash.weekly')}</h3>
              </div>
            </div>
            <div className="p-4 text-center text-sm text-ink-500">
              Tính năng biểu đồ thống kê trong tuần đang được xây dựng...
            </div>
          </Card>
        </div>

        {/* Right column */}
        <div className="dash-main__right">
          {/* Urgent tasks */}
          <Card>
            <div className="dash-card__head">
              <div className="dash-card__title">
                <AlertTriangle size={18} aria-hidden="true" className="text-warning-600" />
                <h3 className="font-heading font-semibold">{t('dash.tasksDue')}</h3>
              </div>
              <Button variant="ghost" size="sm" onClick={() => onNavigate('post-meeting')}>
                {t('dash.allTasks')}
              </Button>
            </div>
            <ul className="space-y-3">
              {/* No tasks from backend yet */}
              <li className="text-sm text-ink-500 py-2">Bạn không có công việc nào tới hạn.</li>
            </ul>
          </Card>

          {/* Upcoming meetings */}
          <Card>
            <div className="dash-card__head">
              <div className="dash-card__title">
                <CalendarClock size={18} aria-hidden="true" className="text-accent-600" />
                <h3 className="font-heading font-semibold">{t('dash.upcoming')}</h3>
              </div>
            </div>
            <div className="space-y-3">
              {upcomingMeetings.length === 0 ? (
                <p className="text-sm text-ink-500 py-2">Không có cuộc họp sắp tới.</p>
              ) : upcomingMeetings.map((m: any) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => onNavigate('planner')}
                  className="dash-upcoming"
                >
                  <span className="block text-sm font-medium text-ink-900 truncate">{m.name}</span>
                  <span className="block text-xs text-ink-500 mt-0.5 tnum">{formatDate(m.expectedStartTime, locale)}</span>
                  <span className="flex items-center gap-1.5 mt-2">
                    <span className="text-xs text-ink-500">{m.participantCount} người tham gia</span>
                  </span>
                </button>
              ))}
            </div>
          </Card>

          {/* Quick stats */}
          <Card>
            <h3 className="font-heading font-semibold text-ink-900 mb-3">{t('dash.quick')}</h3>
            <dl className="dash-dl">
              <div className="dash-dl__row">
                <dt className="text-sm text-ink-500">{t('dash.q.completed')}</dt>
                <dd className="text-sm font-semibold text-ink-900 tnum">{completedMeetings}</dd>
              </div>
              <div className="dash-dl__row">
                <dt className="text-sm text-ink-500">{t('dash.q.overdue')}</dt>
                <dd className="text-sm font-semibold text-error-700 tnum">0</dd>
              </div>
              <div className="dash-dl__row">
                <dt className="text-sm text-ink-500">{t('dash.q.avg')}</dt>
                <dd className="text-sm font-semibold text-ink-900 tnum">1h 12m</dd>
              </div>
              <div className="dash-dl__row">
                <dt className="text-sm text-ink-500">{t('dash.q.acc')}</dt>
                <dd className="text-sm font-semibold text-success-700 tnum">94.2%</dd>
              </div>
            </dl>
          </Card>
        </div>
      </div>
    </div>
  );
}
