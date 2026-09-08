import {
  MicOff,
  MonitorUp,
  Hand,
  Crown,
  Shield,
  Pin,
  Volume2,
} from 'lucide-react';
import type { Participant } from '@/types';
import { getInitials } from '@/utils';

interface VideoTileProps {
  participant: Participant;
  isPinned: boolean;
  onPin?: () => void;
  onUnpin?: () => void;
  large?: boolean;
  compact?: boolean;
}

export function VideoTile({ participant, isPinned, onPin, onUnpin, large = false, compact = false }: VideoTileProps) {
  if (compact) {
    return (
      <div
        className={`relative rounded-lg overflow-hidden bg-gradient-to-br from-ink-700 to-ink-800 group shrink-0 w-32 h-20 ${participant.isSpeaking ? 'ring-2 ring-success-500' : ''}`}
        onClick={onUnpin}
      >
        <div className="w-full h-full flex items-center justify-center">
          <div className={`rounded-full ${participant.avatarColor} flex items-center justify-center text-white font-bold w-8 h-8 text-xs`}>
            {getInitials(participant.name)}
          </div>
        </div>
        {participant.isHandRaised && (
          <div className="absolute top-1 right-1 w-5 h-5 bg-warning-500 rounded-full flex items-center justify-center text-white">
            <Hand size={10} />
          </div>
        )}
        {participant.isMuted && <MicOff size={12} className="absolute bottom-1 right-1 text-error-400" />}
        <div className="absolute bottom-0 left-0 right-0 px-1.5 py-1 bg-gradient-to-t from-ink-900/80 to-transparent">
          <span className="text-white text-[10px] font-medium truncate block">{participant.name.split(' ').slice(-1)[0]}</span>
        </div>
        {isPinned && (
          <div className="absolute top-1 left-1">
            <Pin size={10} className="text-white fill-white" />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`relative rounded-xl overflow-hidden bg-gradient-to-br from-ink-700 to-ink-800 group ${participant.isSpeaking ? 'ring-2 ring-success-500' : ''}`}>
      {participant.isCameraOn ? (
        <div className={`w-full h-full flex items-center justify-center ${large ? 'min-h-[300px]' : 'min-h-[120px]'}`}>
          <div className={`rounded-full ${participant.avatarColor} flex items-center justify-center text-white font-bold ${large ? 'w-32 h-32 text-4xl' : 'w-14 h-14 text-xl'}`}>
            {getInitials(participant.name)}
          </div>
        </div>
      ) : (
        <div className={`w-full h-full flex items-center justify-center ${large ? 'min-h-[300px]' : 'min-h-[120px]'}`}>
          <div className={`rounded-full ${participant.avatarColor} flex items-center justify-center text-white font-bold ${large ? 'w-32 h-32 text-4xl' : 'w-12 h-12 text-base'}`}>
            {getInitials(participant.name)}
          </div>
        </div>
      )}

      {participant.isScreenSharing && (
        <div className="absolute inset-0 bg-primary-900/40 flex items-center justify-center">
          <div className="text-white text-sm font-medium flex items-center gap-2 bg-primary-600 px-3 py-1.5 rounded-lg">
            <MonitorUp size={16} /> Sharing screen
          </div>
        </div>
      )}

      {participant.isHandRaised && (
        <div className="absolute top-2 right-2 w-7 h-7 bg-warning-500 rounded-full flex items-center justify-center text-white animate-pulse-soft">
          <Hand size={14} />
        </div>
      )}

      {participant.reaction && (
        <div className="absolute top-2 right-2 text-2xl animate-scale-in">{participant.reaction}</div>
      )}

      {participant.isSpeaking && (
        <div className="absolute top-2 left-2 flex items-center gap-1 px-2 py-0.5 rounded-full bg-success-500/20 backdrop-blur text-success-300 text-xs font-medium">
          <Volume2 size={10} /> Speaking
        </div>
      )}

      <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between px-3 py-2 bg-gradient-to-t from-ink-900/80 to-transparent">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-white text-xs font-medium truncate">{participant.name}</span>
          {participant.role === 'host' && <Crown size={12} className="text-warning-400 shrink-0" />}
          {participant.role === 'secretary' && <Shield size={12} className="text-accent-400 shrink-0" />}
        </div>
        <div className="flex items-center gap-1">
          {participant.isMuted && <MicOff size={12} className="text-error-400" />}
          {!isPinned && onPin && (
            <button onClick={onPin} className="p-1 text-white/60 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity">
              <Pin size={12} />
            </button>
          )}
          {isPinned && onUnpin && (
            <button onClick={onUnpin} className="p-1 text-white/60 hover:text-white">
              <Pin size={12} className="fill-white text-white" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
