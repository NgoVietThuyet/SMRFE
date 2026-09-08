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
import { statusColor, statusLabel, formatDateLong, formatDuration, roleLabel, roleBadgeColor } from '@/utils';
import { Avatar } from '@/components/Avatar';
import { Modal } from '@/components/Modal';

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
          <button onClick={onClose} className="btn-secondary">Close</button>
          {isEditing ? (
            <button onClick={handleSave} className="btn-primary">
              <Save size={16} /> Save Changes
            </button>
          ) : (
            <>
              <button onClick={() => setIsEditing(true)} className="btn-secondary">
                <Pencil size={16} /> Edit
              </button>
              {meeting.status !== 'completed' && (
                <button onClick={onJoin} className="btn-primary">
                  <Video size={16} /> {isLive ? 'Join Now' : 'Start Meeting'}
                </button>
              )}
            </>
          )}
        </>
      }
    >
      {/* Tab bar */}
      <div className="flex items-center gap-1 bg-ink-50 rounded-lg p-1 w-fit mb-5">
        {([
          { id: 'overview' as const, label: 'Tổng quan', icon: FileText },
          { id: 'members' as const, label: 'Thành viên', icon: Users },
          { id: 'documents' as const, label: 'Tài liệu', icon: FileSpreadsheet },
        ]).map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
              tab === t.id ? 'bg-white text-primary-700 shadow-sm' : 'text-ink-500 hover:text-ink-700'
            }`}
          >
            <t.icon size={16} /> {t.label}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {tab === 'overview' && (
        <div className="space-y-5">
          {/* Basic info grid */}
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 rounded-lg bg-ink-50">
              <p className="text-xs text-ink-400 mb-1">Date</p>
              {isEditing ? (
                <input
                  type="date"
                  value={editedMeeting.date}
                  onChange={(e) => setEditedMeeting({ ...editedMeeting, date: e.target.value })}
                  className="input-field text-sm py-1.5"
                />
              ) : (
                <p className="text-sm font-medium text-ink-900 flex items-center gap-2">
                  <Calendar size={14} className="text-primary-600" /> {formatDateLong(editedMeeting.date)}
                </p>
              )}
            </div>
            <div className="p-3 rounded-lg bg-ink-50">
              <p className="text-xs text-ink-400 mb-1">Time</p>
              {isEditing ? (
                <div className="flex items-center gap-2">
                  <input
                    type="time"
                    value={editedMeeting.startTime}
                    onChange={(e) => setEditedMeeting({ ...editedMeeting, startTime: e.target.value })}
                    className="input-field text-sm py-1.5 flex-1"
                  />
                  <span className="text-ink-400">–</span>
                  <input
                    type="time"
                    value={editedMeeting.endTime}
                    onChange={(e) => setEditedMeeting({ ...editedMeeting, endTime: e.target.value })}
                    className="input-field text-sm py-1.5 flex-1"
                  />
                </div>
              ) : (
                <p className="text-sm font-medium text-ink-900 flex items-center gap-2">
                  <Clock size={14} className="text-primary-600" /> {editedMeeting.startTime} – {editedMeeting.endTime}
                  <span className="text-xs text-ink-400">({formatDuration(editedMeeting.startTime, editedMeeting.endTime)})</span>
                </p>
              )}
            </div>
            <div className="p-3 rounded-lg bg-ink-50">
              <p className="text-xs text-ink-400 mb-1">Room</p>
              {isEditing ? (
                <select
                  value={editedMeeting.room}
                  onChange={(e) => setEditedMeeting({ ...editedMeeting, room: e.target.value })}
                  className="input-field text-sm py-1.5"
                >
                  <option>Conference Room A</option>
                  <option>Conference Room B</option>
                  <option>Conference Room C</option>
                  <option>Board Room</option>
                  <option>Huddle Space 1</option>
                </select>
              ) : (
                <p className="text-sm font-medium text-ink-900 flex items-center gap-2">
                  <MapPin size={14} className="text-primary-600" /> {editedMeeting.room}
                </p>
              )}
            </div>
            <div className="p-3 rounded-lg bg-ink-50">
              <p className="text-xs text-ink-400 mb-1">Status</p>
              <p className="flex items-center gap-2">
                <span className={`badge ${statusColor(editedMeeting.status)}`}>{statusLabel(editedMeeting.status)}</span>
              </p>
            </div>
          </div>

          {/* Meeting link + QR */}
          <div className="flex items-start gap-4 p-4 rounded-xl border border-ink-100 bg-gradient-to-br from-primary-50/50 to-accent-50/30">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-ink-900 mb-2">Meeting Link</p>
              <div className="flex items-center gap-2">
                <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-lg bg-white border border-ink-200">
                  <Link2 size={14} className="text-ink-400 shrink-0" />
                  <span className="text-sm text-ink-700 font-mono truncate">{meetingLink}</span>
                </div>
                <button
                  onClick={handleCopyLink}
                  className={`btn-secondary px-3 py-2 shrink-0 ${copied ? 'text-success-600' : ''}`}
                >
                  {copied ? <CheckCircle2 size={16} /> : <Copy size={16} />}
                </button>
              </div>
              <div className="flex items-center gap-3 mt-3">
                <span className="flex items-center gap-1.5 text-sm text-ink-600">
                  <Lock size={14} /> {editedMeeting.isSecure ? 'Secure meeting' : 'Open meeting'}
                </span>
                <span className="flex items-center gap-1.5 text-sm text-ink-600">
                  <Mic size={14} /> {editedMeeting.aiEnabled ? 'AI enabled' : 'AI disabled'}
                </span>
                <span className="flex items-center gap-1.5 text-sm text-ink-600">
                  <Video size={14} /> {editedMeeting.recordingEnabled ? 'Recording on' : 'No recording'}
                </span>
              </div>
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
                <QrCode size={10} /> QR Code
              </p>
            </div>
          </div>

          {/* Agenda */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-ink-900">Agenda ({agenda.length} items)</p>
              {isEditing && (
                <button onClick={addAgendaItem} className="text-sm text-primary-600 hover:text-primary-700 font-medium flex items-center gap-1">
                  <Plus size={14} /> Add item
                </button>
              )}
            </div>
            <div className="space-y-2">
              {agenda.map((item, idx) => (
                <div key={item.id} className="flex items-center gap-3 p-2.5 rounded-lg border border-ink-100">
                  {isEditing ? (
                    <>
                      <input
                        value={item.title}
                        onChange={(e) => setAgenda(agenda.map((a) => a.id === item.id ? { ...a, title: e.target.value } : a))}
                        placeholder="Agenda item title"
                        className="input-field flex-1 text-sm py-1.5"
                      />
                      <input
                        type="number"
                        value={item.duration}
                        onChange={(e) => setAgenda(agenda.map((a) => a.id === item.id ? { ...a, duration: Number(e.target.value) } : a))}
                        className="input-field w-16 text-sm py-1.5"
                      />
                      <span className="text-xs text-ink-400">min</span>
                      <input
                        value={item.presenter}
                        onChange={(e) => setAgenda(agenda.map((a) => a.id === item.id ? { ...a, presenter: e.target.value } : a))}
                        placeholder="Presenter"
                        className="input-field w-32 text-sm py-1.5"
                      />
                      <button onClick={() => removeAgendaItem(item.id)} className="p-1.5 text-ink-400 hover:text-error-600 hover:bg-error-50 rounded-lg transition-colors">
                        <X size={16} />
                      </button>
                    </>
                  ) : (
                    <>
                      {item.completed ? (
                        <CheckCircle2 size={18} className="text-success-600 shrink-0" />
                      ) : (
                        <Circle size={18} className="text-ink-300 shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium ${item.completed ? 'text-ink-400 line-through' : 'text-ink-900'}`}>
                          {item.title}
                        </p>
                        <p className="text-xs text-ink-400">{item.presenter} · {item.duration} min</p>
                      </div>
                      <span className="text-xs text-ink-400 font-mono">#{idx + 1}</span>
                    </>
                  )}
                </div>
              ))}
              {agenda.length === 0 && (
                <p className="text-sm text-ink-400 text-center py-4">No agenda items yet</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Members Tab */}
      {tab === 'members' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-ink-500">{meetingParticipants.length} participants</p>
            {isEditing && (
              <button onClick={() => setShowAddMember(!showAddMember)} className="btn-secondary text-sm py-1.5">
                <UserPlus size={14} /> Add Member
              </button>
            )}
          </div>

          {showAddMember && availableContacts.length > 0 && (
            <div className="p-3 rounded-lg border border-primary-200 bg-primary-50/30 space-y-1">
              <p className="text-xs font-semibold text-ink-500 uppercase tracking-wider mb-2">Available Contacts</p>
              {availableContacts.map((c) => (
                <button
                  key={c.id}
                  onClick={() => addParticipant(c.id)}
                  className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-white transition-colors"
                >
                  <Avatar name={c.name} color={c.avatarColor} size="sm" />
                  <div className="flex-1 text-left min-w-0">
                    <p className="text-sm font-medium text-ink-900 truncate">{c.name}</p>
                    <p className="text-xs text-ink-400 truncate">{c.department}</p>
                  </div>
                  <Plus size={16} className="text-primary-600" />
                </button>
              ))}
            </div>
          )}

          <div className="space-y-2">
            {meetingParticipants.map((p) => (
              <div key={p.id} className="flex items-center gap-3 p-2.5 rounded-lg border border-ink-100 hover:border-primary-200 transition-colors group">
                <Avatar name={p.name} color={p.avatarColor} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-ink-900 truncate">{p.name}</p>
                  <p className="text-xs text-ink-400 truncate">{p.email}</p>
                </div>
                <span className={`badge ${roleBadgeColor(p.role)}`}>{roleLabel(p.role)}</span>
                <span className="text-xs text-ink-400 hidden sm:block">{p.department}</span>
                {isEditing && (
                  <button
                    onClick={() => removeParticipant(p.id)}
                    className="p-1.5 text-ink-400 hover:text-error-600 hover:bg-error-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                    title="Remove"
                  >
                    <UserMinus size={16} />
                  </button>
                )}
              </div>
            ))}
            {meetingParticipants.length === 0 && (
              <p className="text-sm text-ink-400 text-center py-4">No participants yet</p>
            )}
          </div>
        </div>
      )}

      {/* Documents Tab */}
      {tab === 'documents' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-ink-500">{docs.length} documents</p>
            {isEditing && (
              <button className="btn-secondary text-sm py-1.5">
                <Upload size={14} /> Upload
              </button>
            )}
          </div>

          {docs.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-14 h-14 mx-auto bg-ink-100 rounded-full flex items-center justify-center text-ink-400">
                <FileSpreadsheet size={28} />
              </div>
              <p className="mt-3 text-ink-500 font-medium">No documents uploaded</p>
              <p className="text-sm text-ink-400 mt-1">
                {isEditing ? 'Click Upload to add documents' : 'Documents will appear here once uploaded'}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {docs.map((doc) => {
                const Icon = docIcons[doc.type];
                return (
                  <div key={doc.id} className="flex items-center gap-3 p-3 rounded-lg border border-ink-100 hover:border-primary-200 hover:shadow-soft transition-all group">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${docColors[doc.type]}`}>
                      <Icon size={20} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-ink-900 truncate">{doc.name}</p>
                      <div className="flex items-center gap-3 mt-0.5 text-xs text-ink-400">
                        <span>{doc.size}</span>
                        <span>·</span>
                        <span>{doc.uploadedBy}</span>
                        <span>·</span>
                        <span>{doc.uploadedAt}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button className="p-2 text-ink-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors" title="Download">
                        <Download size={16} />
                      </button>
                      {isEditing && (
                        <button
                          onClick={() => removeDoc(doc.id)}
                          className="p-2 text-ink-400 hover:text-error-600 hover:bg-error-50 rounded-lg transition-colors"
                          title="Delete"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
