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
import { roleLabel, roleBadgeColor } from '@/utils';
import { PanelHeader } from '@/components/meeting/PanelHeader';

interface ParticipantsPanelProps {
  participants: Participant[];
  lobby: Participant[];
  onAdmit: (id: string) => void;
  onDeny: (id: string) => void;
  onMuteAll: () => void;
  onClose: () => void;
}

export function ParticipantsPanel({ participants, lobby, onAdmit, onDeny, onMuteAll, onClose }: ParticipantsPanelProps) {
  const [search, setSearch] = useState('');
  const filtered = participants.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <>
      <PanelHeader
        title={`Participants (${participants.length})`}
        icon={Users}
        onClose={onClose}
        action={
          <button onClick={onMuteAll} className="text-xs font-medium text-primary-600 hover:text-primary-700 px-2 py-1 rounded hover:bg-primary-50 transition-colors">
            Mute All
          </button>
        }
      />
      <div className="px-4 py-2.5 border-b border-ink-100">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search participants..."
            className="w-full pl-9 pr-3 py-2 text-sm rounded-lg bg-ink-100 border border-transparent focus:bg-white focus:border-primary-300 transition-all"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {lobby.length > 0 && (
          <div className="px-4 py-3 border-b border-ink-100">
            <p className="text-xs font-semibold text-warning-600 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Clock size={12} /> Waiting in Lobby ({lobby.length})
            </p>
            {lobby.map((p) => (
              <div key={p.id} className="flex items-center gap-2.5 py-2">
                <Avatar name={p.name} color={p.avatarColor} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-ink-900 truncate">{p.name}</p>
                  <p className="text-xs text-ink-400">Guest · Waiting</p>
                </div>
                <button onClick={() => onAdmit(p.id)} className="p-1.5 rounded-lg bg-success-50 text-success-600 hover:bg-success-100 transition-colors" title="Admit">
                  <Check size={16} />
                </button>
                <button onClick={() => onDeny(p.id)} className="p-1.5 rounded-lg bg-error-50 text-error-600 hover:bg-error-100 transition-colors" title="Deny">
                  <X size={16} />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="px-4 py-3">
          <p className="text-xs font-semibold text-ink-400 uppercase tracking-wider mb-2">In Meeting ({filtered.length})</p>
          {filtered.map((p) => (
            <div key={p.id} className="flex items-center gap-2.5 py-2 group">
              <div className="relative">
                <Avatar name={p.name} color={p.avatarColor} size="sm" />
                {p.isHandRaised && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-warning-500 rounded-full flex items-center justify-center">
                    <Hand size={10} className="text-white" />
                  </span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-ink-900 truncate">{p.name}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className={`badge ${roleBadgeColor(p.role)} text-[10px]`}>{roleLabel(p.role)}</span>
                  <span className="text-xs text-ink-400">Joined {p.joinedAt}</span>
                </div>
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {p.isMuted ? <MicOff size={14} className="text-ink-400" /> : <Mic size={14} className="text-success-500" />}
                {p.isCameraOn ? <VideoIcon size={14} className="text-success-500" /> : <VideoOff size={14} className="text-ink-400" />}
                <button className="p-1 text-ink-400 hover:text-ink-700"><MoreVertical size={14} /></button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="px-4 py-3 border-t border-ink-100">
        <button className="btn-secondary w-full text-xs py-2">
          <Copy size={14} /> Copy invite link
        </button>
      </div>
    </>
  );
}
