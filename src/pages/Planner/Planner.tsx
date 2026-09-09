import { useMemo, useState, useEffect } from 'react';
import {
  Plus,
  Video,
  Calendar,
  Clock,
  Lock,
  Mic,
  MapPin,
  CheckCircle2,
  Copy,
  X,
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  CalendarDays,
} from 'lucide-react';
import type { Page, Meeting, AgendaItem } from '@/types';
import { orgContacts, participants } from '@/data';
import { statusLabel, formatDate, formatDuration } from '@/utils';
import { Avatar } from '@/components/Avatar';
import { Modal } from '@/components/Modal';
import { Toggle } from '@/components/Toggle';
import { MeetingDetailModal } from '@/components/MeetingDetailModal';
import { Button } from '@/components/ui/Button';
import { useLanguage } from '@/i18n';
import { SearchBar } from '@/components/ui/SearchBar';
import { FilterPanel, ActiveFilterChips } from '@/components/ui/FilterPanel';
import { Select } from '@/components/ui/Select';
import { EmptyState } from '@/components/ui/EmptyState';
import { Badge, type BadgeTone } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import './Planner.css';

interface PlannerProps {
  onNavigate: (page: Page) => void;
  onBack: () => void;
  canGoBack: boolean;
}

type ViewMode = 'list' | 'calendar';
type StatusFilter = 'all' | 'scheduled' | 'live' | 'completed';
type SortId = 'date-asc' | 'date-desc' | 'title-asc';

const statusTone: Record<number, BadgeTone> = {
  0: 'neutral',
  1: 'info',
  2: 'error',
  3: 'success',
  4: 'neutral',
  5: 'neutral',
};

const statusChipIds = ['all', 'scheduled', 'live', 'completed'] as const;

export function Planner({ onNavigate }: PlannerProps) {
  const { t, lang, locale } = useLanguage();
  void locale;
  const statusChips = statusChipIds.map((id) => ({
    id,
    label: id === 'all' ? t('post.all') : statusLabel(id, lang),
  }));
  const [view, setView] = useState<ViewMode>('list');
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortId>('date-asc');
  const [showCreate, setShowCreate] = useState(false);
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);
  const [showQuickMeet, setShowQuickMeet] = useState(false);
  const [quickMeetLink, setQuickMeetLink] = useState('');

  // Same data source + filter semantics as before, extended to search
  // description/room/host and to sort without touching fetch logic.
  const [meetingsData, setMeetingsData] = useState<any[]>([]);
  const [reloadTicks, setReloadTicks] = useState(0);

  const fetchMeetings = () => setReloadTicks(t => t + 1);

  useEffect(() => {
    import('@/utils/apiClient').then(({ apiClient }) => {
      apiClient('/Meeting/query', {
        data: {
          keyword: search,
          page: 1,
          pageSize: 50,
          tab: filter === 'all' ? 'all' : filter
        }
      }).then((res) => {
        setMeetingsData(res.items || []);
      }).catch(console.error);
    });
  }, [search, filter, reloadTicks]);

  // Same data source + filter semantics as before, extended to sort without touching fetch logic.
  const filteredMeetings = useMemo(() => {
    return [...meetingsData].sort((a, b) => {
      if (sort === 'title-asc') return (a.name || '').localeCompare(b.name || '');
      const byDate = (a.expectedStartTime || '').localeCompare(b.expectedStartTime || '');
      return sort === 'date-desc' ? -byDate : byDate;
    });
  }, [meetingsData, sort]);

  const hasActiveFilters = filter !== 'all' || search.trim() !== '';

  const handleQuickMeet = () => {
    const id = Math.random().toString(36).substring(2, 10);
    setQuickMeetLink(`https://smr.app/meet/${id}`);
    setShowQuickMeet(true);
  };

  const clearFilters = () => {
    setFilter('all');
    setSearch('');
  };

  return (
    <div className="page-gutter space-y-6 animate-fade-in mx-auto max-w-[1440px] w-full plan-root">
      {/* Catalog toolbar: search + category nav + view + actions */}
      <div className="plan-toolbar">
        <div className="plan-toolbar__filters">
          <SearchBar
            value={search}
            onChange={setSearch}
            label={t('planner.search.label')}
            placeholder={t('planner.search.placeholder')}
            className="w-full sm:w-64"
          />
          <FilterPanel
            chips={[...statusChips]}
            selectedId={filter}
            onSelect={(id) => setFilter(id as StatusFilter)}
            ariaLabel={t('planner.filter.label')}
          />
        </div>

        <div className="plan-toolbar__actions">
          <div role="group" aria-label={t('planner.view.label')} className="plan-view">
            <Button
              size="sm"
              variant={view === 'list' ? 'primary' : 'ghost'}
              onClick={() => setView('list')}
              aria-pressed={view === 'list'}
            >
              <LayoutGrid size={14} aria-hidden="true" /> {t('planner.list')}
            </Button>
            <Button
              size="sm"
              variant={view === 'calendar' ? 'primary' : 'ghost'}
              onClick={() => setView('calendar')}
              aria-pressed={view === 'calendar'}
            >
              <CalendarDays size={14} aria-hidden="true" /> {t('planner.calendar')}
            </Button>
          </div>
          <Button variant="secondary" onClick={handleQuickMeet}>
            <Video size={16} aria-hidden="true" /> {t('planner.quick')}
          </Button>
          <Button variant="primary" onClick={() => setShowCreate(true)}>
            <Plus size={16} aria-hidden="true" /> {t('planner.schedule')}
          </Button>
        </div>
      </div>

      {/* Result meta: active filters + count + sorting */}
      <div className="plan-meta">
        <div className="plan-meta__left">
          <p aria-live="polite" className="plan-count tnum">
            {filteredMeetings.length} {filteredMeetings.length === 1 ? t('planner.meeting.one') : t('planner.meeting.many')}
            {filter !== 'all' && ` · ${statusLabel(filter, lang)}`}
            {search.trim() && ` · “${search.trim()}”`}
          </p>
          <ActiveFilterChips
            active={[
              ...(filter !== 'all'
                ? [{ id: 'status', label: statusLabel(filter, lang) }]
                : []),
              ...(search.trim() ? [{ id: 'q', label: `${t('planner.search.label')}: ${search.trim()}` }] : []),
            ]}
            onRemove={(id) => {
              if (id === 'status') setFilter('all');
              if (id === 'q') setSearch('');
            }}
            onClearAll={hasActiveFilters ? clearFilters : undefined}
          />
        </div>
        {view === 'list' && (
          <Select
            label={t('planner.sort.label')}
            hideLabel
            value={sort}
            onChange={(e) => setSort(e.target.value as SortId)}
            className="w-44"
            aria-label={t('planner.sort.label')}
          >
            <option value="date-asc">{t('planner.sort.dateAsc')}</option>
            <option value="date-desc">{t('planner.sort.dateDesc')}</option>
            <option value="title-asc">{t('planner.sort.titleAsc')}</option>
          </Select>
        )}
      </div>

      {/* Catalog grid */}
      {view === 'list' ? (
        filteredMeetings.length > 0 ? (
          <div className="plan-grid sm:grid-cols-2 xl:grid-cols-3">
            {filteredMeetings.map((m) => (
              <MeetingCard key={m.id} meeting={m} onClick={() => setSelectedMeeting(m)} onJoin={() => onNavigate('meeting')} />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={<Calendar size={28} aria-hidden="true" />}
            title={t('planner.empty.title')}
            description={t('planner.empty.desc')}
            action={
              <>
                {hasActiveFilters && (
                  <Button variant="secondary" size="sm" onClick={clearFilters}>
                    {t('planner.clear')}
                  </Button>
                )}
                <Button variant="primary" size="sm" onClick={() => setShowCreate(true)}>
                  <Plus size={14} aria-hidden="true" /> {t('planner.schedule')}
                </Button>
              </>
            }
          />
        )
      ) : (
        <CalendarView meetings={filteredMeetings} onSelect={(m) => setSelectedMeeting(m)} />
      )}

      {/* Meeting detail modal */}
      {selectedMeeting && (
        <MeetingDetailModal
          meeting={selectedMeeting}
          onClose={() => { setSelectedMeeting(null); fetchMeetings(); }}
          onJoin={() => { setSelectedMeeting(null); onNavigate('meeting'); }}
        />
      )}

      {/* Create meeting modal */}
      {showCreate && (
        <CreateMeetingModal onSuccess={() => { fetchMeetings(); setShowCreate(false); }} onClose={() => setShowCreate(false)} />
      )}

      {/* Quick meet modal */}
      {showQuickMeet && (
        <Modal
          open={showQuickMeet}
          onClose={() => setShowQuickMeet(false)}
          title={t('planner.quick.title')}
          subtitle={t('planner.quick.sub')}
          footer={
            <>
              <Button variant="secondary" onClick={() => setShowQuickMeet(false)}>{t('planner.quick.close')}</Button>
              <Button variant="primary" onClick={() => { setShowQuickMeet(false); onNavigate('meeting'); }}>
                <Video size={16} aria-hidden="true" /> {t('planner.quick.join')}
              </Button>
            </>
          }
        >
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-4 rounded-xl bg-primary-50 border border-primary-100">
              <div className="w-12 h-12 bg-primary-600 rounded-xl flex items-center justify-center text-white">
                <Video size={24} aria-hidden="true" />
              </div>
              <div>
                <p className="font-semibold text-ink-900">{t('planner.quick.instant')}</p>
                <p className="text-sm text-ink-500">{t('planner.quick.ready')}</p>
              </div>
            </div>
            <div>
              <label className="field-label" htmlFor="quick-meet-link">{t('planner.quick.link')}</label>
              <div className="flex items-center gap-2">
                <input id="quick-meet-link" readOnly value={quickMeetLink} className="input-field flex-1 font-mono text-xs" />
                <Button
                  variant="secondary"
                  onClick={() => navigator.clipboard?.writeText(quickMeetLink)}
                  aria-label={t('planner.quick.copy')}
                  className="px-3"
                >
                  <Copy size={16} aria-hidden="true" />
                </Button>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function MeetingCard({ meeting, onClick, onJoin }: { meeting: any; onClick: () => void; onJoin: () => void }) {
  const { t, lang, locale } = useLanguage();
  return (
    <Card className="hover:shadow-float hover:border-primary-200 transition-all group flex flex-col">
      <div
        onClick={onClick}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onClick();
          }
        }}
        role="button"
        tabIndex={0}
        aria-label={t('planner.card.view', { title: meeting.name })}
        className="flex-1 cursor-pointer rounded-t-xl focus-visible:outline-none"
      >
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <h3 className="font-heading font-semibold text-ink-900 line-clamp-2 group-hover:text-primary-700 transition-colors">
              {meeting.name}
            </h3>
            <p className="text-sm text-ink-500 mt-0.5 line-clamp-2">{meeting.description || 'Chưa cung cấp mô tả'}</p>
          </div>
          <Badge tone={statusTone[meeting.status] ?? 'neutral'} className="shrink-0">
            {statusLabel(meeting.status, lang)}
          </Badge>
        </div>

        {/* Specs block: date / time / room with tabular figures */}
        <ul className="space-y-2 text-sm text-ink-500">
          <li className="flex items-center gap-2">
            <Calendar size={14} aria-hidden="true" className="text-ink-400 shrink-0" />
            {formatDate(meeting.expectedStartTime, locale)}
          </li>
          <li className="flex items-center gap-2">
            <Clock size={14} aria-hidden="true" className="text-ink-400 shrink-0" />
            <span className="tnum">
              {formatDuration(meeting.expectedStartTime, meeting.expectedEndTime || meeting.expectedStartTime)}
            </span>
          </li>
          <li className="flex items-center gap-2">
            <MapPin size={14} aria-hidden="true" className="text-ink-400 shrink-0" />
            <span className="truncate">{meeting.roomCode || 'Meet Room'}</span>
          </li>
        </ul>

        {/* Stock-equivalent: participants + feature flags */}
        <div className="flex items-center justify-between mt-4 pt-4 border-t border-ink-100">
          <div className="flex items-center gap-2">
            <span className="text-xs text-ink-500 tnum">
              {meeting.participantCount} người tham gia
            </span>
          </div>
          <div className="flex items-center gap-1.5" aria-label="Meeting features">
            {(meeting.visibility === 0 || meeting.visibility === 1) && <Lock size={14} aria-hidden="true" className="text-ink-400" />}
          </div>
        </div>
      </div>

      {meeting.status === 2 && (
        <Button
          variant="primary"
          onClick={(e) => { e.stopPropagation(); onJoin(); }}
          className="w-full mt-3"
        >
          <Video size={16} aria-hidden="true" /> {t('planner.card.join')}
        </Button>
      )}
    </Card>
  );
}

function CalendarView({ meetings, onSelect }: { meetings: Meeting[]; onSelect: (m: Meeting) => void }) {
  const { t, lang, locale } = useLanguage();
  void lang;
  const [currentDate, setCurrentDate] = useState(new Date(2026, 7, 1));

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const days: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) days.push(null);
  for (let d = 1; d <= daysInMonth; d++) days.push(d);

  const meetingsByDay: Record<number, any[]> = {};
  meetings.forEach((m: any) => {
    if (!m.expectedStartTime) return;
    const d = new Date(m.expectedStartTime).getDate();
    const mMonth = new Date(m.expectedStartTime).getMonth();
    if (mMonth === month) {
      if (!meetingsByDay[d]) meetingsByDay[d] = [];
      meetingsByDay[d].push(m);
    }
  });

  const weekdayHeaders = [t('cal.sun'), t('cal.mon'), t('cal.tue'), t('cal.wed'), t('cal.thu'), t('cal.fri'), t('cal.sat')];

  return (
    <Card padding="lg">
      <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
        <h3 className="font-heading font-semibold text-ink-900 text-lg">
          {currentDate.toLocaleDateString(locale, { month: 'long', year: 'numeric' })}
        </h3>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={() => setCurrentDate(new Date(year, month - 1, 1))} aria-label={t('planner.cal.prev')} className="px-2">
            <ChevronLeft size={18} aria-hidden="true" />
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setCurrentDate(new Date())}>{t('planner.cal.today')}</Button>
          <Button variant="ghost" size="sm" onClick={() => setCurrentDate(new Date(year, month + 1, 1))} aria-label={t('planner.cal.next')} className="px-2">
            <ChevronRight size={18} aria-hidden="true" />
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1">
        {weekdayHeaders.map((d) => (
          <div key={d} className="text-center text-xs font-semibold text-ink-400 py-2">{d}</div>
        ))}
        {days.map((day, i) => (
          <div
            key={i}
            className={`min-h-[80px] rounded-lg p-1.5 border ${day === new Date().getDate() && month === new Date().getMonth() ? 'bg-primary-50 border-primary-200' : 'border-ink-100'
              } ${day === null ? 'bg-ink-50/50' : 'hover:bg-ink-50'}`}
          >
            {day && (
              <>
                <p className={`text-xs font-medium mb-1 tnum ${day === new Date().getDate() && month === new Date().getMonth() ? 'text-primary-700' : 'text-ink-600'}`}>{day}</p>
                <div className="space-y-1">
                  {(meetingsByDay[day] || []).map((m: any) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => onSelect(m)}
                      className={`block w-full text-left px-1.5 py-1 rounded text-[10px] font-medium transition-colors truncate ${m.status === 2 ? 'bg-error-100 text-error-800 hover:bg-error-200' :
                        m.status === 3 ? 'bg-success-100 text-success-800 hover:bg-success-200' :
                          'bg-primary-100 text-primary-800 hover:bg-primary-200'
                        }`}
                    >
                      <span className="tnum">{new Date(m.expectedStartTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span> {m.name}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}

function CreateMeetingModal({ onClose, onSuccess }: { onClose: () => void; onSuccess?: () => void }) {
  const { t, lang, locale } = useLanguage();
  void lang;
  void locale;
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [room, setRoom] = useState('Conference Room A');
  const [description, setDescription] = useState('');
  const [isSecure, setIsSecure] = useState(true);
  const [hasPassword, setHasPassword] = useState(false);
  const [recordingEnabled, setRecordingEnabled] = useState(true);
  const [aiEnabled, setAiEnabled] = useState(true);
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
  const [agenda, setAgenda] = useState<AgendaItem[]>([
    { id: '1', title: '', duration: 15, presenter: '', completed: false },
  ]);

  const toggleContact = (id: string) => {
    setSelectedContacts((prev) => prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]);
  };

  const addAgendaItem = () => {
    setAgenda([...agenda, { id: String(Date.now()), title: '', duration: 15, presenter: '', completed: false }]);
  };

  const removeAgendaItem = (id: string) => {
    setAgenda(agenda.filter((a) => a.id !== id));
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      alert('Vui lòng nhập tên cuộc họp.');
      return;
    }
    setLoading(true);
    try {
      const { apiClient } = await import('@/utils/apiClient');
      const payload = {
        name: title,
        description,
        expectedStartTime: new Date(`${date}T${startTime}:00`).toISOString(),
        expectedEndTime: new Date(`${date}T${endTime}:00`).toISOString(),
        timeZone: 'Asia/Bangkok',
        visibility: isSecure ? 0 : 1, // InvitedOnly = 0, Internal = 1
        settings: {
          schemaVersion: 1,
          recordingEnabled,
          aiMinutesEnabled: aiEnabled,
          hasPassword // Just an indicator, setting password requires backend hash logic
        },
        participantUserNames: selectedContacts, // assuming selectedContacts hold UserNames
      };
      await apiClient('/Meeting', { data: payload });
      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      alert(err.message || 'Lỗi khi tạo cuộc họp');
      setLoading(false);
    }
  };

  return (
    <Modal
      open={true}
      onClose={onClose}
      title={t('planner.create.title')}
      subtitle={t('planner.create.sub')}
      size="xl"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>{t('planner.create.cancel')}</Button>
          <Button variant="primary" onClick={handleSubmit} loading={loading}>
            <Calendar size={16} aria-hidden="true" /> {t('planner.create.submit')}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <div>
          <label className="field-label" htmlFor="new-meeting-title">{t('planner.create.name')}</label>
          <input id="new-meeting-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t('planner.create.namePh')} className="input-field" disabled={loading} />
        </div>

        <div>
          <label className="field-label" htmlFor="new-meeting-desc">{t('planner.create.desc')}</label>
          <textarea id="new-meeting-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder={t('planner.create.descPh')} className="input-field resize-none" disabled={loading} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="field-label" htmlFor="new-meeting-date">{t('planner.create.date')}</label>
            <input id="new-meeting-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input-field" disabled={loading} />
          </div>
          <div>
            <label className="field-label" htmlFor="new-meeting-start">{t('planner.create.start')}</label>
            <input id="new-meeting-start" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="input-field" disabled={loading} />
          </div>
          <div>
            <label className="field-label" htmlFor="new-meeting-end">{t('planner.create.end')}</label>
            <input id="new-meeting-end" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="input-field" disabled={loading} />
          </div>
        </div>

        <div>
          <span className="field-label" id="invite-label">{t('planner.create.invite')} (Tính năng chọn người dùng đang phát triển)</span>
          <div role="group" aria-labelledby="invite-label" className="max-h-48 overflow-y-auto border border-ink-200 rounded-lg p-2 space-y-1">
            <p className="text-xs text-ink-500">Người tham gia sẽ được chọn từ danh bạ công ty (API: /User/Search).</p>
          </div>
        </div>

        <div className="space-y-3 p-4 rounded-xl bg-ink-50 border border-ink-100">
          <p className="text-sm font-semibold text-ink-900">{t('planner.create.options')}</p>
          <div className="flex items-center justify-between">
            <span className="text-sm text-ink-600 flex items-center gap-2"><Lock size={14} aria-hidden="true" /> {t('planner.create.secure')}</span>
            <Toggle checked={isSecure} onChange={setIsSecure} />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-ink-600 flex items-center gap-2"><Lock size={14} aria-hidden="true" /> {t('planner.create.password')}</span>
            <Toggle checked={hasPassword} onChange={setHasPassword} />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-ink-600 flex items-center gap-2"><Video size={16} aria-hidden="true" /> {t('planner.create.rec')}</span>
            <Toggle checked={recordingEnabled} onChange={setRecordingEnabled} />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-ink-600 flex items-center gap-2"><Mic size={14} aria-hidden="true" /> {t('planner.create.ai')}</span>
            <Toggle checked={aiEnabled} onChange={setAiEnabled} />
          </div>
        </div>
      </div>
    </Modal>
  );
}
