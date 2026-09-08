import type { MeetingStatus, Task, ParticipantRole } from '@/types';

export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return `${parts[parts.length - 2][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }
  return parts[0].slice(0, 2).toUpperCase();
}

export function statusColor(status: MeetingStatus): string {
  switch (status) {
    case 'live':
      return 'bg-error-100 text-error-700';
    case 'scheduled':
      return 'bg-primary-100 text-primary-700';
    case 'completed':
      return 'bg-success-100 text-success-700';
    case 'cancelled':
      return 'bg-ink-100 text-ink-500';
  }
}

export function statusLabel(status: MeetingStatus): string {
  switch (status) {
    case 'live':
      return 'Live Now';
    case 'scheduled':
      return 'Scheduled';
    case 'completed':
      return 'Completed';
    case 'cancelled':
      return 'Cancelled';
  }
}

export function taskStatusColor(status: Task['status']): string {
  switch (status) {
    case 'pending':
      return 'bg-warning-100 text-warning-700';
    case 'in-progress':
      return 'bg-primary-100 text-primary-700';
    case 'completed':
      return 'bg-success-100 text-success-700';
    case 'overdue':
      return 'bg-error-100 text-error-700';
  }
}

export function taskStatusLabel(status: Task['status']): string {
  switch (status) {
    case 'pending':
      return 'Pending';
    case 'in-progress':
      return 'In Progress';
    case 'completed':
      return 'Completed';
    case 'overdue':
      return 'Overdue';
  }
}

export function priorityColor(priority: Task['priority']): string {
  switch (priority) {
    case 'high':
      return 'text-error-600';
    case 'medium':
      return 'text-warning-600';
    case 'low':
      return 'text-success-600';
  }
}

export function roleLabel(role: ParticipantRole): string {
  switch (role) {
    case 'host':
      return 'Host';
    case 'secretary':
      return 'Secretary';
    case 'member':
      return 'Member';
    case 'guest':
      return 'Guest';
  }
}

export function roleBadgeColor(role: ParticipantRole): string {
  switch (role) {
    case 'host':
      return 'bg-primary-100 text-primary-700';
    case 'secretary':
      return 'bg-accent-100 text-accent-700';
    case 'member':
      return 'bg-ink-100 text-ink-600';
    case 'guest':
      return 'bg-warning-100 text-warning-700';
  }
}

export function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

export function formatDateLong(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

export function isToday(dateStr: string): boolean {
  const date = new Date(dateStr);
  const today = new Date();
  return date.toDateString() === today.toDateString();
}

export function isPast(dateStr: string): boolean {
  const date = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date < today;
}

export function daysUntil(dateStr: string): number {
  const date = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.ceil((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

export function formatDuration(startTime: string, endTime: string): string {
  const [sh, sm] = startTime.split(':').map(Number);
  const [eh, em] = endTime.split(':').map(Number);
  const startMin = sh * 60 + sm;
  const endMin = eh * 60 + em;
  const dur = endMin - startMin;
  const h = Math.floor(dur / 60);
  const m = dur % 60;
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}
