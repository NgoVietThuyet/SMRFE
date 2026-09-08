export type Page =
  | 'dashboard'
  | 'planner'
  | 'meeting'
  | 'post-meeting'
  | 'admin';

export type MeetingStatus = 'scheduled' | 'live' | 'completed' | 'cancelled';

export type ParticipantRole = 'host' | 'secretary' | 'member' | 'guest';

export interface Participant {
  id: string;
  name: string;
  email: string;
  avatarColor: string;
  role: ParticipantRole;
  department: string;
  isMuted: boolean;
  isCameraOn: boolean;
  isHandRaised: boolean;
  isScreenSharing: boolean;
  isSpeaking: boolean;
  hasLeft: boolean;
  joinedAt: string;
  reaction?: string;
}

export interface Meeting {
  id: string;
  title: string;
  description: string;
  date: string;
  startTime: string;
  endTime: string;
  room: string;
  status: MeetingStatus;
  hostId: string;
  hostName: string;
  participantIds: string[];
  agenda: AgendaItem[];
  isSecure: boolean;
  hasPassword: boolean;
  recordingEnabled: boolean;
  aiEnabled: boolean;
}

export interface AgendaItem {
  id: string;
  title: string;
  duration: number;
  presenter: string;
  completed: boolean;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderAvatarColor: string;
  content: string;
  timestamp: string;
  isDirect: boolean;
  recipientName?: string;
}

export interface TranscriptSegment {
  id: string;
  speakerId: string;
  speakerName: string;
  text: string;
  startTime: string;
  endTime: string;
  isDraft: boolean;
  language: string;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  assigneeId: string;
  assigneeName: string;
  assigneeDepartment: string;
  deadline: string;
  status: 'pending' | 'in-progress' | 'completed' | 'overdue';
  priority: 'low' | 'medium' | 'high';
  meetingId: string;
  meetingTitle: string;
}

export interface MeetingMinutes {
  id: string;
  meetingId: string;
  meetingTitle: string;
  date: string;
  summary: string;
  keyDecisions: string[];
  actionItems: string[];
  attendees: string[];
  status: 'draft' | 'approved' | 'rejected';
  generatedAt: string;
  approvedBy?: string;
}

export interface Notification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
}

export interface MeetingDocument {
  id: string;
  meetingId: string;
  name: string;
  type: 'pdf' | 'docx' | 'xlsx' | 'pptx' | 'image' | 'other';
  size: string;
  uploadedBy: string;
  uploadedAt: string;
}

export type ChatTab = 'general' | 'direct';
export type SidePanel = 'participants' | 'chat' | 'ai' | 'whiteboard' | null;
