import { useState } from 'react';
import {
  Plus,
  Video,
  Calendar,
  Clock,
  Users,
  Lock,
  Mic,
  MapPin,
  Search,
  Filter,
  CheckCircle2,
  Circle,
  Link2,
  Copy,
  X,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import type { Page, Meeting, AgendaItem } from '@/types';
import { meetings, orgContacts, participants } from '@/data';
import {
  statusColor,
  statusLabel,
  formatDate,
  formatDateLong,
  formatDuration,
  roleLabel,
  roleBadgeColor,
} from '@/utils';
import { Avatar } from '@/components/Avatar';
import { Modal } from '@/components/Modal';
import { Toggle } from '@/components/Toggle';
import { MeetingDetailModal } from '@/components/MeetingDetailModal';

interface PlannerProps {
  onNavigate: (page: Page) => void;
  onBack: () => void;
  canGoBack: boolean;
}

type ViewMode = 'list' | 'calendar';

export function Planner({ onNavigate }: PlannerProps) {
  const [view, setView] = useState<ViewMode>('list');
  const [filter, setFilter] = useState<'all' | 'scheduled' | 'live' | 'completed'>('all');
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);
  const [showQuickMeet, setShowQuickMeet] = useState(false);
  const [quickMeetLink, setQuickMeetLink] = useState('');

  const filteredMeetings = meetings.filter((m) => {
    if (filter !== 'all' && m.status !== filter) return false;
    if (search && !m.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const handleQuickMeet = () => {
    const id = Math.random().toString(36).substring(2, 10);
    setQuickMeetLink(`https://smr.app/meet/${id}`);
    setShowQuickMeet(true);
  };

  return (
    <div className="p-8 space-y-6 animate-fade-in">
      {/* Action bar */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search meetings..."
              className="w-64 pl-9 pr-3 py-2 text-sm rounded-lg bg-white border border-ink-200 focus:border-primary-400 focus:ring-2 focus:ring-primary-500/10 transition-all"
            />
          </div>
          <div className="flex items-center gap-1 bg-white border border-ink-200 rounded-lg p-1">
            {(['all', 'scheduled', 'live', 'completed'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors capitalize ${
                  filter === f ? 'bg-primary-600 text-white' : 'text-ink-500 hover:bg-ink-100'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 bg-white border border-ink-200 rounded-lg p-1">
            <button
              onClick={() => setView('list')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${view === 'list' ? 'bg-ink-100 text-ink-900' : 'text-ink-500'}`}
            >
              List
            </button>
            <button
              onClick={() => setView('calendar')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${view === 'calendar' ? 'bg-ink-100 text-ink-900' : 'text-ink-500'}`}
            >
              Calendar
            </button>
          </div>
          <button onClick={handleQuickMeet} className="btn-secondary">
            <Video size={16} /> Quick Meet
          </button>
          <button onClick={() => setShowCreate(true)} className="btn-primary">
            <Plus size={16} /> Schedule Meeting
          </button>
        </div>
      </div>

      {/* Meeting list */}
      {view === 'list' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredMeetings.map((m) => (
            <MeetingCard key={m.id} meeting={m} onClick={() => setSelectedMeeting(m)} onJoin={() => onNavigate('meeting')} />
          ))}
          {filteredMeetings.length === 0 && (
            <div className="col-span-full card p-12 text-center">
              <div className="w-14 h-14 mx-auto bg-ink-100 rounded-full flex items-center justify-center text-ink-400">
                <Calendar size={28} />
              </div>
              <p className="mt-4 text-ink-500 font-medium">No meetings found</p>
              <p className="text-sm text-ink-400 mt-1">Try adjusting your filters or schedule a new meeting</p>
            </div>
          )}
        </div>
      ) : (
        <CalendarView meetings={filteredMeetings} onSelect={(m) => setSelectedMeeting(m)} />
      )}

      {/* Meeting detail modal */}
      {selectedMeeting && (
        <MeetingDetailModal
          meeting={selectedMeeting}
          onClose={() => setSelectedMeeting(null)}
          onJoin={() => { setSelectedMeeting(null); onNavigate('meeting'); }}
        />
      )}

      {/* Create meeting modal */}
      {showCreate && (
        <CreateMeetingModal onClose={() => setShowCreate(false)} />
      )}

      {/* Quick meet modal */}
      {showQuickMeet && (
        <Modal
          open={showQuickMeet}
          onClose={() => setShowQuickMeet(false)}
          title="Quick Meeting Ready"
          subtitle="Share this link with your participants"
          footer={
            <>
              <button onClick={() => setShowQuickMeet(false)} className="btn-secondary">Close</button>
              <button onClick={() => { setShowQuickMeet(false); onNavigate('meeting'); }} className="btn-primary">
                <Video size={16} /> Join Now
              </button>
            </>
          }
        >
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-4 rounded-xl bg-primary-50 border border-primary-100">
              <div className="w-12 h-12 bg-primary-600 rounded-xl flex items-center justify-center text-white">
                <Video size={24} />
              </div>
              <div>
                <p className="font-semibold text-ink-900">Instant Meeting</p>
                <p className="text-sm text-ink-500">Room created — ready to join</p>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-ink-700 mb-1.5">Meeting Link</label>
              <div className="flex items-center gap-2">
                <input readOnly value={quickMeetLink} className="input-field flex-1 font-mono text-xs" />
                <button
                  onClick={() => navigator.clipboard?.writeText(quickMeetLink)}
                  className="btn-secondary px-3"
                >
                  <Copy size={16} />
                </button>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function MeetingCard({ meeting, onClick, onJoin }: { meeting: Meeting; onClick: () => void; onJoin: () => void }) {
  return (
    <div onClick={onClick} className="card p-5 hover:shadow-float hover:border-primary-200 transition-all cursor-pointer group">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-ink-900 truncate group-hover:text-primary-700 transition-colors">{meeting.title}</h3>
          <p className="text-sm text-ink-500 mt-0.5 line-clamp-2">{meeting.description}</p>
        </div>
        <span className={`badge ${statusColor(meeting.status)} shrink-0`}>{statusLabel(meeting.status)}</span>
      </div>

      <div className="space-y-2 text-sm">
        <div className="flex items-center gap-2 text-ink-500">
          <Calendar size={14} className="text-ink-400" />
          {formatDate(meeting.date)}
        </div>
        <div className="flex items-center gap-2 text-ink-500">
          <Clock size={14} className="text-ink-400" />
          {meeting.startTime} – {meeting.endTime} ({formatDuration(meeting.startTime, meeting.endTime)})
        </div>
        <div className="flex items-center gap-2 text-ink-500">
          <MapPin size={14} className="text-ink-400" />
          {meeting.room}
        </div>
      </div>

      <div className="flex items-center justify-between mt-4 pt-4 border-t border-ink-100">
        <div className="flex items-center gap-2">
          <div className="flex -space-x-2">
            {meeting.participantIds.slice(0, 4).map((pid) => {
              const p = participants.find((pp) => pp.id === pid);
              return p ? <Avatar key={pid} name={p.name} color={p.avatarColor} size="xs" ring /> : null;
            })}
          </div>
          {meeting.participantIds.length > 4 && (
            <span className="text-xs text-ink-400">+{meeting.participantIds.length - 4}</span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {meeting.isSecure && <Lock size={14} className="text-ink-400" />}
          {meeting.aiEnabled && <Mic size={14} className="text-accent-500" />}
        </div>
      </div>

      {meeting.status === 'live' && (
        <button onClick={(e) => { e.stopPropagation(); onJoin(); }} className="btn-primary w-full mt-3 py-2">
          <Video size={16} /> Join Meeting
        </button>
      )}
    </div>
  );
}

function CalendarView({ meetings, onSelect }: { meetings: Meeting[]; onSelect: (m: Meeting) => void }) {
  const [currentDate, setCurrentDate] = useState(new Date(2026, 7, 1));

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const days: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) days.push(null);
  for (let d = 1; d <= daysInMonth; d++) days.push(d);

  const meetingsByDay: Record<number, Meeting[]> = {};
  meetings.forEach((m) => {
    const d = new Date(m.date).getDate();
    const mMonth = new Date(m.date).getMonth();
    if (mMonth === month) {
      if (!meetingsByDay[d]) meetingsByDay[d] = [];
      meetingsByDay[d].push(m);
    }
  });

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-ink-900 text-lg">
          {currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </h3>
        <div className="flex items-center gap-1">
          <button onClick={() => setCurrentDate(new Date(year, month - 1, 1))} className="btn-ghost p-2">
            <ChevronLeft size={18} />
          </button>
          <button onClick={() => setCurrentDate(new Date(2026, 7, 25))} className="btn-secondary py-1.5 px-3 text-xs">Today</button>
          <button onClick={() => setCurrentDate(new Date(year, month + 1, 1))} className="btn-ghost p-2">
            <ChevronRight size={18} />
          </button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
          <div key={d} className="text-center text-xs font-semibold text-ink-400 py-2">{d}</div>
        ))}
        {days.map((day, i) => (
          <div
            key={i}
            className={`min-h-[80px] rounded-lg p-1.5 border ${
              day === 25 ? 'bg-primary-50 border-primary-200' : 'border-ink-100'
            } ${day === null ? 'bg-ink-50/50' : 'hover:bg-ink-50'}`}
          >
            {day && (
              <>
                <p className={`text-xs font-medium mb-1 ${day === 25 ? 'text-primary-700' : 'text-ink-600'}`}>{day}</p>
                <div className="space-y-1">
                  {(meetingsByDay[day] || []).map((m) => (
                    <div
                      key={m.id}
                      onClick={() => onSelect(m)}
                      className={`px-1.5 py-1 rounded text-[10px] font-medium cursor-pointer transition-colors truncate ${
                        m.status === 'live' ? 'bg-error-100 text-error-700 hover:bg-error-200' :
                        m.status === 'completed' ? 'bg-success-100 text-success-700 hover:bg-success-200' :
                        'bg-primary-100 text-primary-700 hover:bg-primary-200'
                      }`}
                    >
                      {m.startTime} {m.title}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function CreateMeetingModal({ onClose }: { onClose: () => void }) {
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('2026-08-26');
  const [startTime, setStartTime] = useState('10:00');
  const [endTime, setEndTime] = useState('11:00');
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

  return (
    <Modal
      open={true}
      onClose={onClose}
      title="Schedule New Meeting"
      subtitle="Create a meeting and invite participants"
      size="xl"
      footer={
        <>
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button onClick={onClose} className="btn-primary">
            <Calendar size={16} /> Create Meeting
          </button>
        </>
      }
    >
      <div className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-ink-700 mb-1.5">Meeting Title</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Q4 Strategy Planning" className="input-field" />
        </div>

        <div>
          <label className="block text-sm font-medium text-ink-700 mb-1.5">Description</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="Brief description of the meeting purpose" className="input-field resize-none" />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-ink-700 mb-1.5">Date</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input-field" />
          </div>
          <div>
            <label className="block text-sm font-medium text-ink-700 mb-1.5">Start Time</label>
            <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="input-field" />
          </div>
          <div>
            <label className="block text-sm font-medium text-ink-700 mb-1.5">End Time</label>
            <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="input-field" />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-ink-700 mb-1.5">Room</label>
          <select value={room} onChange={(e) => setRoom(e.target.value)} className="input-field">
            <option>Conference Room A</option>
            <option>Conference Room B</option>
            <option>Conference Room C</option>
            <option>Board Room</option>
            <option>Huddle Space 1</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-ink-700 mb-2">Invite Participants</label>
          <div className="max-h-48 overflow-y-auto border border-ink-200 rounded-lg p-2 space-y-1">
            {orgContacts.map((c) => (
              <button
                key={c.id}
                onClick={() => toggleContact(c.id)}
                className={`w-full flex items-center gap-3 p-2 rounded-lg transition-colors ${
                  selectedContacts.includes(c.id) ? 'bg-primary-50' : 'hover:bg-ink-50'
                }`}
              >
                <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                  selectedContacts.includes(c.id) ? 'bg-primary-600 border-primary-600' : 'border-ink-300'
                }`}>
                  {selectedContacts.includes(c.id) && <CheckCircle2 size={14} className="text-white" />}
                </div>
                <Avatar name={c.name} color={c.avatarColor} size="sm" />
                <div className="flex-1 text-left min-w-0">
                  <p className="text-sm font-medium text-ink-900 truncate">{c.name}</p>
                  <p className="text-xs text-ink-400 truncate">{c.department}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-ink-700">Agenda</label>
            <button onClick={addAgendaItem} className="text-sm text-primary-600 hover:text-primary-700 font-medium flex items-center gap-1">
              <Plus size={14} /> Add item
            </button>
          </div>
          <div className="space-y-2">
            {agenda.map((item) => (
              <div key={item.id} className="flex items-center gap-2">
                <input
                  value={item.title}
                  onChange={(e) => setAgenda(agenda.map((a) => a.id === item.id ? { ...a, title: e.target.value } : a))}
                  placeholder="Agenda item title"
                  className="input-field flex-1"
                />
                <input
                  type="number"
                  value={item.duration}
                  onChange={(e) => setAgenda(agenda.map((a) => a.id === item.id ? { ...a, duration: Number(e.target.value) } : a))}
                  className="input-field w-20"
                />
                <span className="text-xs text-ink-400 w-8">min</span>
                <button onClick={() => removeAgendaItem(item.id)} className="p-2 text-ink-400 hover:text-error-600 hover:bg-error-50 rounded-lg transition-colors">
                  <X size={16} />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-3 p-4 rounded-xl bg-ink-50 border border-ink-100">
          <p className="text-sm font-semibold text-ink-900">Meeting Options</p>
          <div className="flex items-center justify-between">
            <span className="text-sm text-ink-600 flex items-center gap-2"><Lock size={14} /> Secure meeting (lobby enabled)</span>
            <Toggle checked={isSecure} onChange={setIsSecure} />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-ink-600 flex items-center gap-2"><Lock size={14} /> Require password</span>
            <Toggle checked={hasPassword} onChange={setHasPassword} />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-ink-600 flex items-center gap-2"><Video size={14} /> Enable recording</span>
            <Toggle checked={recordingEnabled} onChange={setRecordingEnabled} />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-ink-600 flex items-center gap-2"><Mic size={14} /> AI transcription & minutes</span>
            <Toggle checked={aiEnabled} onChange={setAiEnabled} />
          </div>
        </div>
      </div>
    </Modal>
  );
}
