import { useState } from 'react';
import {
  Users,
  Search,
  Check,
  X,
  Clock,
  Copy,
  MicOff,
  Mic,
  Video as VideoIcon,
  VideoOff,
  MoreVertical,
  Hand,
} from 'lucide-react';
import type { Participant } from '@/types';
import { Avatar } from '@/components/Avatar';
import { Button } from '@/components/ui/Button';
import { Badge, type BadgeTone } from '@/components/ui/Badge';
import { roleLabel } from '@/utils';
import { PanelHeader } from '@/components/meeting/PanelHeader';
import { useLanguage } from '@/i18n';

const roleTone: Record<string, BadgeTone> = {
  host: 'warning',
  'co-host': 'info',
  secretary: 'accent',
  member: 'neutral',
  guest: 'neutral',
};

interface ParticipantsPanelProps {
  participants: Participant[];
  lobby: Participant[];
  onAdmit: (id: string) => void;
  onDeny: (id: string) => void;
  onMuteAll: () => void;
  onClose: () => void;
}

export function ParticipantsPanel({ participants, lobby, onAdmit, onDeny, onMuteAll, onClose }: ParticipantsPanelProps) {
  const { t, lang } = useLanguage();
  const [search, setSearch] = useState('');
  const filtered = participants.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <>
      <PanelHeader
        title={t('panel.participants', { n: participants.length })}
        icon={Users}
        onClose={onClose}
        action={
          <button type="button" onClick={onMuteAll} className="text-xs font-medium text-cta-700 hover:text-cta-800 px-2 min-h-[32px] rounded hover:bg-primary-50 transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-cta-500/40">
            {t('panel.muteAll')}
          </button>
        }
      />
      <div className="px-4 py-2.5 border-b border-ink-100" role="search">
        <div className="relative">
          <label htmlFor="participants-search" className="sr-only">{t('panel.searchParticipants')}</label>
          <Search size={14} aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
          <input
            id="participants-search"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('panel.searchPh')}
            className="input-field w-full pl-9 pr-3 py-2 text-sm !min-h-[40px] !bg-ink-100 !border-transparent focus:!bg-white focus:!border-primary-300"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {lobby.length > 0 && (
          <section aria-label={t('panel.lobby', { n: lobby.length })} className="px-4 py-3 border-b border-ink-100">
            <p className="text-xs font-semibold text-warning-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Clock size={12} aria-hidden="true" /> {t('panel.lobby', { n: lobby.length })}
            </p>
            <ul className="space-y-1">
            {lobby.map((p) => (
              <li key={p.id} className="flex items-center gap-2.5 py-2">
                <Avatar name={p.name} color={p.avatarColor} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-ink-900 truncate">{p.name}</p>
                  <p className="text-xs text-ink-500">{t('panel.guestWaiting')}</p>
                </div>
                <button type="button" onClick={() => onAdmit(p.id)} aria-label={t('panel.admit', { name: p.name })} className="min-w-[36px] min-h-[36px] inline-flex items-center justify-center p-1.5 rounded-lg bg-success-50 text-success-700 hover:bg-success-100 transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-cta-500/40">
                  <Check size={16} aria-hidden="true" />
                </button>
                <button type="button" onClick={() => onDeny(p.id)} aria-label={t('panel.deny', { name: p.name })} className="min-w-[36px] min-h-[36px] inline-flex items-center justify-center p-1.5 rounded-lg bg-error-50 text-error-700 hover:bg-error-100 transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-cta-500/40">
                  <X size={16} aria-hidden="true" />
                </button>
              </li>
            ))}
            </ul>
          </section>
        )}

        <section aria-label={t('panel.inMeeting', { n: filtered.length })} className="px-4 py-3">
          <p aria-live="polite" className="text-xs font-semibold text-ink-500 uppercase tracking-wider mb-2 tnum">{t('panel.inMeeting', { n: filtered.length })}</p>
          <ul>
          {filtered.map((p) => (
            <li key={p.id} className="flex items-center gap-2.5 py-2 group">
              <div className="relative">
                <Avatar name={p.name} color={p.avatarColor} size="sm" />
                {p.isHandRaised && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-warning-500 rounded-full flex items-center justify-center">
                    <Hand size={10} aria-hidden="true" className="text-white" />
                    <span className="sr-only">{t('panel.raisedHand', { name: p.name })}</span>
                  </span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-ink-900 truncate">{p.name}</p>
                <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                  <Badge tone={roleTone[p.role] ?? 'neutral'}>{roleLabel(p.role, lang)}</Badge>
                  <span className="text-xs text-ink-500 tnum">{t('panel.joined', { time: p.joinedAt })}</span>
                </div>
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                {p.isMuted
                  ? <MicOff size={14} aria-hidden="true" className="text-ink-400" />
                  : <span className="sr-only">{t('panel.unmuted', { name: p.name })}</span>}
                {p.isMuted ? null : <Mic size={14} aria-hidden="true" className="text-success-600" />}
                {p.isCameraOn
                  ? <VideoIcon size={14} aria-hidden="true" className="text-success-600" />
                  : <VideoOff size={14} aria-hidden="true" className="text-ink-400" />}
                <button type="button" aria-label={t('panel.moreOptions', { name: p.name })} className="min-w-[32px] min-h-[32px] inline-flex items-center justify-center p-1 text-ink-500 hover:text-ink-700 rounded focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-cta-500/40"><MoreVertical size={14} aria-hidden="true" /></button>
              </div>
            </li>
          ))}
          </ul>
        </section>
      </div>

      <div className="px-4 py-3 border-t border-ink-100">
        <Button variant="secondary" size="sm" className="w-full">
          <Copy size={14} aria-hidden="true" /> {t('panel.copyInvite')}
        </Button>
      </div>
    </>
  );
}
