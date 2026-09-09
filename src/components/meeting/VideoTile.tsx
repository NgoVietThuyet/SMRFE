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
import { useLanguage } from '@/i18n';

interface VideoTileProps {
  participant: Participant;
  isPinned: boolean;
  onPin?: () => void;
  onUnpin?: () => void;
  large?: boolean;
  compact?: boolean;
}

export function VideoTile({ participant, isPinned, onPin, onUnpin, large = false, compact = false }: VideoTileProps) {
  const { t } = useLanguage();
  if (compact) {
    return (
      <button
        type="button"
        onClick={onUnpin}
        aria-label={t('tile.expand', { name: participant.name })}
        className={`relative rounded-lg overflow-hidden bg-gradient-to-br from-ink-700 to-ink-800 group shrink-0 w-32 h-20 text-left focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-cta-500/60 ${participant.isSpeaking ? 'ring-2 ring-success-500' : ''}`}
      >
        <span className="w-full h-full flex items-center justify-center">
          <span aria-hidden="true" className={`rounded-full ${participant.avatarColor} flex items-center justify-center text-white font-bold w-8 h-8 text-xs`}>
            {getInitials(participant.name)}
          </span>
        </span>
        {participant.isHandRaised && (
          <span className="absolute top-1 right-1 w-5 h-5 bg-warning-500 rounded-full flex items-center justify-center text-white">
            <Hand size={10} aria-hidden="true" />
            <span className="sr-only">{t('panel.raisedHand', { name: participant.name })}</span>
          </span>
        )}
        {participant.isMuted && <MicOff size={12} aria-hidden="true" className="absolute bottom-1 right-1 text-error-400" />}
        <span className="absolute bottom-0 left-0 right-0 px-1.5 py-1 bg-gradient-to-t from-ink-900/80 to-transparent">
          <span className="text-white text-[10px] font-medium truncate block">{participant.name.split(' ').slice(-1)[0]}</span>
        </span>
        {isPinned && (
          <span className="absolute top-1 left-1">
            <Pin size={10} aria-hidden="true" className="text-white fill-white" />
          </span>
        )}
      </button>
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
            <MonitorUp size={16} aria-hidden="true" /> {t('tile.sharing')}
          </div>
        </div>
      )}

      {participant.isHandRaised && (
        <div className="absolute top-2 right-2 w-7 h-7 bg-warning-500 rounded-full flex items-center justify-center text-white animate-pulse-soft">
          <Hand size={14} aria-hidden="true" />
          <span className="sr-only">{t('panel.raisedHand', { name: participant.name })}</span>
        </div>
      )}

      {participant.reaction && (
        <div aria-hidden="true" className="absolute top-2 right-2 text-2xl animate-scale-in">{participant.reaction}</div>
      )}

      {participant.isSpeaking && (
        <div className="absolute top-2 left-2 flex items-center gap-1 px-2 py-0.5 rounded-full bg-success-500/20 backdrop-blur text-success-300 text-xs font-medium">
          <Volume2 size={10} aria-hidden="true" /> <span className="sr-only">{participant.name} is </span>{t('tile.speaking')}
        </div>
      )}

      <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between px-3 py-2 bg-gradient-to-t from-ink-900/80 to-transparent">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-white text-xs font-medium truncate">{participant.name}</span>
          {participant.role === 'host' && <Crown size={12} aria-hidden="true" className="text-warning-400 shrink-0" />}
          {participant.role === 'secretary' && <Shield size={12} aria-hidden="true" className="text-accent-400 shrink-0" />}
        </div>
        <div className="flex items-center gap-1">
          {participant.isMuted && <MicOff size={12} aria-hidden="true" className="text-error-400" />}
          {!isPinned && onPin && (
            <button type="button" onClick={onPin} aria-label={t('tile.pin', { name: participant.name })} className="min-w-[32px] min-h-[32px] inline-flex items-center justify-center p-1 text-white/60 hover:text-white opacity-0 group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-white/60 rounded transition-opacity">
              <Pin size={12} aria-hidden="true" />
            </button>
          )}
          {isPinned && onUnpin && (
            <button type="button" onClick={onUnpin} aria-label={t('tile.unpin', { name: participant.name })} className="min-w-[32px] min-h-[32px] inline-flex items-center justify-center p-1 text-white/60 hover:text-white focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-white/60 rounded">
              <Pin size={12} aria-hidden="true" className="fill-white text-white" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
