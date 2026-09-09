import { useState } from 'react';
import {
  Calendar,
  Clock,
  MapPin,
  Users,
  Lock,
  Mic,
  Video,
  CheckCircle2,
  Circle,
  Link2,
  Copy,
  QrCode,
  FileText,
  FileType2,
  FileSpreadsheet,
  Presentation,
  Image as ImageIcon,
  Download,
  Trash2,
  Upload,
  Plus,
  X,
  Pencil,
  Save,
  UserMinus,
  UserPlus,
} from 'lucide-react';
import type { Meeting, AgendaItem, Participant, MeetingDocument } from '@/types';
import { participants, orgContacts, meetingDocuments } from '@/data';
import { statusLabel, formatDateLong, formatDuration, roleLabel } from '@/utils';
import { Avatar } from '@/components/Avatar';
import { Modal } from '@/components/Modal';
import { Button } from '@/components/ui/Button';
import { Badge, type BadgeTone } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { useLanguage } from '@/i18n';

const meetingTone: Record<string, BadgeTone> = {
  live: 'error',
  scheduled: 'info',
  completed: 'success',
  cancelled: 'neutral',
};

const roleTone: Record<string, BadgeTone> = {
  host: 'warning',
  'co-host': 'info',
  secretary: 'accent',
  member: 'neutral',
  guest: 'neutral',
};

type DetailTab = 'overview' | 'members' | 'documents';

interface MeetingDetailModalProps {
  meeting: Meeting;
  onClose: () => void;
  onJoin: () => void;
}

const docIcons: Record<MeetingDocument['type'], typeof FileText> = {
  pdf: FileText,
  docx: FileType2,
  xlsx: FileSpreadsheet,
  pptx: Presentation,
  image: ImageIcon,
  other: FileText,
};

const docColors: Record<MeetingDocument['type'], string> = {
  pdf: 'bg-error-50 text-error-600',
  docx: 'bg-primary-50 text-primary-600',
  xlsx: 'bg-success-50 text-success-600',
  pptx: 'bg-warning-50 text-warning-600',
  image: 'bg-accent-50 text-accent-600',
  other: 'bg-ink-100 text-ink-600',
};

function generateMeetingLink(meeting: Meeting): string {
  return `https://smr.app/meet/${meeting.id}`;
}

export function MeetingDetailModal({ meeting, onClose, onJoin }: MeetingDetailModalProps) {
  const { t, lang, locale } = useLanguage();
  const [tab, setTab] = useState<DetailTab>('overview');
  const [isEditing, setIsEditing] = useState(false);
  const [editedMeeting, setEditedMeeting] = useState<Meeting>(meeting);
  const [agenda, setAgenda] = useState<AgendaItem[]>(meeting.agenda);
  const [docs, setDocs] = useState<MeetingDocument[]>(meetingDocuments.filter((d) => d.meetingId === meeting.id));
  const [meetingParticipants, setMeetingParticipants] = useState<Participant[]>(
    meeting.participantIds.map((pid) => participants.find((p) => p.id === pid)).filter(Boolean) as Participant[]
  );
  const [copied, setCopied] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);

  const meetingLink = generateMeetingLink(editedMeeting);
  const isLive = meeting.status === 'live';

  const handleCopyLink = () => {
    navigator.clipboard?.writeText(meetingLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSave = () => {
    setEditedMeeting({ ...editedMeeting, agenda });
    setIsEditing(false);
  };

  const addAgendaItem = () => {
    setAgenda([...agenda, { id: String(Date.now()), title: '', duration: 15, presenter: '', completed: false }]);
  };

  const removeAgendaItem = (id: string) => {
    setAgenda(agenda.filter((a) => a.id !== id));
  };

  const removeDoc = (id: string) => {
    setDocs(docs.filter((d) => d.id !== id));
  };

  const removeParticipant = (id: string) => {
    setMeetingParticipants(meetingParticipants.filter((p) => p.id !== id));
  };

  const addParticipant = (contactId: string) => {
    const contact = orgContacts.find((c) => c.id === contactId);
    const existing = participants.find((p) => p.id === contactId);
    if (existing && !meetingParticipants.find((p) => p.id === contactId)) {
      setMeetingParticipants([...meetingParticipants, existing]);
    } else if (contact && !meetingParticipants.find((p) => p.id === contactId)) {
      setMeetingParticipants([
        ...meetingParticipants,
        {
          id: contact.id,
          name: contact.name,
          email: contact.email,
          avatarColor: contact.avatarColor,
          role: 'member',
          department: contact.department,
          isMuted: false,
          isCameraOn: false,
          isHandRaised: false,
          isScreenSharing: false,
          isSpeaking: false,
          hasLeft: false,
          joinedAt: '',
        },
      ]);
    }
    setShowAddMember(false);
  };

  const availableContacts = orgContacts.filter(
    (c) => !meetingParticipants.find((p) => p.id === c.id)
  );

  return (
    <Modal
      open={true}
      onClose={onClose}
      title={editedMeeting.title}
      subtitle={editedMeeting.description}
      size="xl"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>{t('mdm.close')}</Button>
          {isEditing ? (
            <Button onClick={handleSave}>
              <Save size={16} aria-hidden="true" /> {t('mdm.save')}
            </Button>
          ) : (
            <>
              <Button variant="secondary" onClick={() => setIsEditing(true)}>
                <Pencil size={16} aria-hidden="true" /> {t('mdm.edit')}
              </Button>
              {meeting.status !== 'completed' && (
                <Button onClick={onJoin}>
                  <Video size={16} aria-hidden="true" /> {isLive ? t('mdm.join') : t('mdm.start')}
                </Button>
              )}
            </>
          )}
        </>
      }
    >
      {/* Tab bar */}
      <div role="tablist" aria-label={t('mdm.details')} className="flex items-center gap-1 bg-ink-50 rounded-lg p-1 w-fit max-w-full overflow-x-auto mb-5">
        {([
          { id: 'overview' as const, label: t('mdm.overview'), icon: FileText },
          { id: 'members' as const, label: t('mdm.members'), icon: Users },
          { id: 'documents' as const, label: t('mdm.documents'), icon: FileSpreadsheet },
        ]).map((tabItem) => (
          <button
            key={tabItem.id}
            type="button"
            role="tab"
            aria-selected={tab === tabItem.id}
            onClick={() => setTab(tabItem.id)}
            className={`flex items-center gap-2 px-4 min-h-[40px] rounded-md text-sm font-medium transition-all whitespace-nowrap ${
              tab === tabItem.id ? 'bg-white text-primary-700 shadow-sm' : 'text-ink-500 hover:text-ink-700'
            }`}
          >
            <tabItem.icon size={16} aria-hidden="true" /> {tabItem.label}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {tab === 'overview' && (
        <div className="space-y-5">
          {/* Basic info grid */}
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-3 rounded-lg bg-ink-50">
              <dt className="text-xs text-ink-500 mb-1">{t('mdm.date')}</dt>
              {isEditing ? (
                <dd><label htmlFor="mdm-date" className="sr-only">{t('mdm.dateLabel')}</label>
                <input
                  id="mdm-date"
                  type="date"
                  value={editedMeeting.date}
                  onChange={(e) => setEditedMeeting({ ...editedMeeting, date: e.target.value })}
                  className="input-field text-sm py-1.5"
                /></dd>
              ) : (
                <dd className="text-sm font-medium text-ink-900 flex items-center gap-2 tnum">
                  <Calendar size={14} aria-hidden="true" className="text-primary-600" /> {formatDateLong(editedMeeting.date, locale)}
                </dd>
              )}
            </div>
            <div className="p-3 rounded-lg bg-ink-50">
              <dt className="text-xs text-ink-500 mb-1">{t('mdm.time')}</dt>
              {isEditing ? (
                <dd className="flex items-center gap-2">
                  <label htmlFor="mdm-start" className="sr-only">{t('mdm.startLabel')}</label>
                  <input
                    id="mdm-start"
                    type="time"
                    value={editedMeeting.startTime}
                    onChange={(e) => setEditedMeeting({ ...editedMeeting, startTime: e.target.value })}
                    className="input-field text-sm py-1.5 flex-1"
                  />
                  <span aria-hidden="true" className="text-ink-400">–</span>
                  <label htmlFor="mdm-end" className="sr-only">{t('mdm.endLabel')}</label>
                  <input
                    id="mdm-end"
                    type="time"
                    value={editedMeeting.endTime}
                    onChange={(e) => setEditedMeeting({ ...editedMeeting, endTime: e.target.value })}
                    className="input-field text-sm py-1.5 flex-1"
                  />
                </dd>
              ) : (
                <dd className="text-sm font-medium text-ink-900 flex items-center gap-2 tnum">
                  <Clock size={14} aria-hidden="true" className="text-primary-600" /> {editedMeeting.startTime} – {editedMeeting.endTime}
                  <span className="text-xs text-ink-500">({formatDuration(editedMeeting.startTime, editedMeeting.endTime)})</span>
                </dd>
              )}
            </div>
            <div className="p-3 rounded-lg bg-ink-50">
              <dt className="text-xs text-ink-500 mb-1">{t('mdm.room')}</dt>
              {isEditing ? (
                <dd><label htmlFor="mdm-room" className="sr-only">{t('mdm.roomLabel')}</label>
                <select
                  id="mdm-room"
                  value={editedMeeting.room}
                  onChange={(e) => setEditedMeeting({ ...editedMeeting, room: e.target.value })}
                  className="input-field text-sm py-1.5"
                >
                  <option>Conference Room A</option>
                  <option>Conference Room B</option>
                  <option>Conference Room C</option>
                  <option>Board Room</option>
                  <option>Huddle Space 1</option>
                </select></dd>
              ) : (
                <dd className="text-sm font-medium text-ink-900 flex items-center gap-2">
                  <MapPin size={14} aria-hidden="true" className="text-primary-600" /> {editedMeeting.room}
                </dd>
              )}
            </div>
            <div className="p-3 rounded-lg bg-ink-50">
              <dt className="text-xs text-ink-500 mb-1">{t('mdm.status')}</dt>
              <dd className="flex items-center gap-2">
                <Badge tone={meetingTone[editedMeeting.status] ?? 'neutral'}>{statusLabel(editedMeeting.status, lang)}</Badge>
              </dd>
            </div>
          </dl>

          {/* Meeting link + QR */}
          <div className="flex flex-col sm:flex-row items-start gap-4 p-4 rounded-xl border border-ink-100 bg-gradient-to-br from-primary-50/50 to-accent-50/30">
            <div className="flex-1 min-w-0 w-full">
              <p className="text-sm font-semibold text-ink-900 mb-2">{t('mdm.link')}</p>
              <div className="flex items-center gap-2">
                <div className="flex-1 flex items-center gap-2 px-3 py-2 min-h-[40px] rounded-lg bg-white border border-ink-200 min-w-0">
                  <Link2 size={14} aria-hidden="true" className="text-ink-400 shrink-0" />
                  <span className="text-sm text-ink-700 font-mono truncate overflow-wrap-anywhere">{meetingLink}</span>
                </div>
                <Button
                  variant="secondary"
                  onClick={handleCopyLink}
                  aria-label={copied ? t('mdm.copied') : t('mdm.copyLink')}
                  className={`px-3 py-2 shrink-0 ${copied ? '!text-success-700' : ''}`}
                >
                  {copied ? <CheckCircle2 size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}
                </Button>
              </div>
              <ul className="flex items-center gap-3 mt-3 flex-wrap">
                <li className="flex items-center gap-1.5 text-sm text-ink-600">
                  <Lock size={14} aria-hidden="true" /> {editedMeeting.isSecure ? t('mdm.secure') : t('mdm.open')}
                </li>
                <li className="flex items-center gap-1.5 text-sm text-ink-600">
                  <Mic size={14} aria-hidden="true" /> {editedMeeting.aiEnabled ? t('mdm.aiOn') : t('mdm.aiOff')}
                </li>
                <li className="flex items-center gap-1.5 text-sm text-ink-600">
                  <Video size={14} aria-hidden="true" /> {editedMeeting.recordingEnabled ? t('mdm.recOn') : t('mdm.recOff')}
                </li>
              </ul>
            </div>
            {/* QR code visual */}
            <div className="shrink-0">
              <div className="w-24 h-24 bg-white rounded-lg border border-ink-200 p-2 flex items-center justify-center">
                <div className="w-full h-full grid grid-cols-7 grid-rows-7 gap-px">
                  {Array.from({ length: 49 }).map((_, i) => {
                    const corners = [0, 6, 42, 48];
                    const cornerArea = (i < 7 && i % 7 < 3) || (i < 7 && i % 7 > 3) || (i >= 42 && i < 49 && i % 7 < 3);
                    const hash = (i * 37 + editedMeeting.id.charCodeAt(0)) % 3;
                    return (
                      <div
                        key={i}
                        className={`rounded-[1px] ${cornerArea || (corners.includes(i) ? true : hash === 0) ? 'bg-ink-900' : 'bg-transparent'}`}
                      />
                    );
                  })}
                </div>
              </div>
              <p className="text-center text-xs text-ink-400 mt-1 flex items-center justify-center gap-1">
                <QrCode size={10} /> {t('mdm.qr')}
              </p>
            </div>
          </div>

          {/* Agenda */}
          <div>
            <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
              <p aria-live="polite" className="text-sm font-semibold text-ink-900 tnum">{t('mdm.agenda', { n: agenda.length })}</p>
              {isEditing && (
                <Button variant="ghost" size="sm" onClick={addAgendaItem}>
                  <Plus size={14} aria-hidden="true" /> {t('mdm.addItem')}
                </Button>
              )}
            </div>
            <ol className="space-y-2">
              {agenda.map((item, idx) => (
                <li key={item.id} className="flex items-center gap-3 p-2.5 rounded-lg border border-ink-100">
                  {isEditing ? (
                    <>
                      <label htmlFor={`agenda-title-${item.id}`} className="sr-only">{t('mdm.agendaTitle', { n: idx + 1 })}</label>
                      <input
                        id={`agenda-title-${item.id}`}
                        value={item.title}
                        onChange={(e) => setAgenda(agenda.map((a) => a.id === item.id ? { ...a, title: e.target.value } : a))}
                        placeholder={t('mdm.agendaTitle', { n: idx + 1 })}
                        className="input-field flex-1 text-sm py-1.5"
                      />
                      <label htmlFor={`agenda-dur-${item.id}`} className="sr-only">{t('planner.create.agendaDur')}</label>
                      <input
                        id={`agenda-dur-${item.id}`}
                        type="number"
                        min={1}
                        value={item.duration}
                        onChange={(e) => setAgenda(agenda.map((a) => a.id === item.id ? { ...a, duration: Number(e.target.value) } : a))}
                        className="input-field w-16 text-sm py-1.5 tnum"
                      />
                      <span aria-hidden="true" className="text-xs text-ink-500">min</span>
                      <label htmlFor={`agenda-presenter-${item.id}`} className="sr-only">Presenter</label>
                      <input
                        id={`agenda-presenter-${item.id}`}
                        value={item.presenter}
                        onChange={(e) => setAgenda(agenda.map((a) => a.id === item.id ? { ...a, presenter: e.target.value } : a))}
                        placeholder="Presenter"
                        className="input-field w-32 text-sm py-1.5"
                      />
                      <button type="button" onClick={() => removeAgendaItem(item.id)} aria-label={t('mdm.removeItem', { n: idx + 1 })} className="min-w-[36px] min-h-[36px] inline-flex items-center justify-center p-1.5 text-ink-500 hover:text-error-700 hover:bg-error-50 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-cta-500/40">
                        <X size={16} aria-hidden="true" />
                      </button>
                    </>
                  ) : (
                    <>
                      {item.completed ? (
                        <CheckCircle2 size={18} aria-hidden="true" className="text-success-600 shrink-0" />
                      ) : (
                        <Circle size={18} aria-hidden="true" className="text-ink-300 shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium ${item.completed ? 'text-ink-500 line-through' : 'text-ink-900'}`}>
                          {item.title}
                        </p>
                        <p className="text-xs text-ink-500 tnum">{item.presenter} · {item.duration} min</p>
                      </div>
                      <span aria-hidden="true" className="text-xs text-ink-500 font-mono tnum">#{idx + 1}</span>
                    </>
                  )}
                </li>
              ))}
              {agenda.length === 0 && (
                <li><EmptyState title={t('mdm.noAgenda')} description={isEditing ? t('mdm.noAgendaEdit') : t('mdm.noAgendaView')} /></li>
              )}
            </ol>
          </div>
        </div>
      )}

      {/* Members Tab */}
      {tab === 'members' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <p aria-live="polite" className="text-sm text-ink-500 tnum">{t('mdm.participants', { n: meetingParticipants.length })}</p>
            {isEditing && (
              <Button variant="secondary" size="sm" onClick={() => setShowAddMember(!showAddMember)} aria-expanded={showAddMember}>
                <UserPlus size={14} aria-hidden="true" /> {t('mdm.addMember')}
              </Button>
            )}
          </div>

          {showAddMember && availableContacts.length > 0 && (
            <div className="p-3 rounded-lg border border-primary-200 bg-primary-50/30 space-y-1">
              <p className="text-xs font-semibold text-ink-500 uppercase tracking-wider mb-2">{t('mdm.available')}</p>
              <ul className="space-y-1">
              {availableContacts.map((c) => (
                <li key={c.id}>
                <button
                  type="button"
                  onClick={() => addParticipant(c.id)}
                  aria-label={t('mdm.add', { name: c.name })}
                  className="w-full flex items-center gap-3 p-2 min-h-[44px] rounded-lg hover:bg-white transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-cta-500/40"
                >
                  <Avatar name={c.name} color={c.avatarColor} size="sm" />
                  <span className="flex-1 text-left min-w-0">
                    <span className="block text-sm font-medium text-ink-900 truncate">{c.name}</span>
                    <span className="block text-xs text-ink-500 truncate">{c.department}</span>
                  </span>
                  <Plus size={16} aria-hidden="true" className="text-primary-600" />
                </button>
                </li>
              ))}
              </ul>
            </div>
          )}

          <ul className="space-y-2">
            {meetingParticipants.map((p) => (
              <li key={p.id} className="flex items-center gap-3 p-2.5 rounded-lg border border-ink-100 hover:border-primary-200 transition-colors group">
                <Avatar name={p.name} color={p.avatarColor} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-ink-900 truncate">{p.name}</p>
                  <p className="text-xs text-ink-500 truncate overflow-wrap-anywhere">{p.email}</p>
                </div>
                <Badge tone={roleTone[p.role] ?? 'neutral'}>{roleLabel(p.role, lang)}</Badge>
                <span className="text-xs text-ink-500 hidden sm:block">{p.department}</span>
                {isEditing && (
                  <button
                    type="button"
                    onClick={() => removeParticipant(p.id)}
                    aria-label={t('mdm.remove', { name: p.name })}
                    className="min-w-[36px] min-h-[36px] inline-flex items-center justify-center p-1.5 text-ink-500 hover:text-error-700 hover:bg-error-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-cta-500/40"
                  >
                    <UserMinus size={16} aria-hidden="true" />
                  </button>
                )}
              </li>
            ))}
            {meetingParticipants.length === 0 && (
              <li><EmptyState title={t('mdm.noMembers')} description={t('mdm.noMembersDesc')} /></li>
            )}
          </ul>
        </div>
      )}

      {/* Documents Tab */}
      {tab === 'documents' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <p aria-live="polite" className="text-sm text-ink-500 tnum">{t('mdm.docs', { n: docs.length })}</p>
            {isEditing && (
              <Button variant="secondary" size="sm">
                <Upload size={14} aria-hidden="true" /> {t('mdm.upload')}
              </Button>
            )}
          </div>

          {docs.length === 0 ? (
            <EmptyState
              icon={<FileSpreadsheet size={28} aria-hidden="true" />}
              title={t('mdm.noDocs')}
              description={isEditing ? t('mdm.noDocsEdit') : t('mdm.noDocsView')}
            />
          ) : (
            <ul className="space-y-2">
              {docs.map((doc) => {
                const Icon = docIcons[doc.type];
                return (
                  <li key={doc.id} className="flex items-center gap-3 p-3 rounded-lg border border-ink-100 hover:border-primary-200 hover:shadow-soft transition-all group">
                    <div aria-hidden="true" className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${docColors[doc.type]}`}>
                      <Icon size={20} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-ink-900 truncate">{doc.name}</p>
                      <p className="mt-0.5 text-xs text-ink-500 tnum">{doc.size} · {doc.uploadedBy} · {doc.uploadedAt}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button type="button" aria-label={t('mdm.download', { name: doc.name })} className="min-w-[36px] min-h-[36px] inline-flex items-center justify-center p-2 text-ink-500 hover:text-primary-700 hover:bg-primary-50 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-cta-500/40">
                        <Download size={16} aria-hidden="true" />
                      </button>
                      {isEditing && (
                        <button
                          type="button"
                          onClick={() => removeDoc(doc.id)}
                          aria-label={t('mdm.delete', { name: doc.name })}
                          className="min-w-[36px] min-h-[36px] inline-flex items-center justify-center p-2 text-ink-500 hover:text-error-700 hover:bg-error-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-cta-500/40"
                        >
                          <Trash2 size={16} aria-hidden="true" />
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </Modal>
  );
}
