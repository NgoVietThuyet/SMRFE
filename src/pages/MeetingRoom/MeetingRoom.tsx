import { useState, useEffect } from 'react';
import {
  Mic,
  MicOff,
  Video as VideoIcon,
  VideoOff,
  MonitorUp,
  Hand,
  PhoneOff,
  Users,
  MessageSquare,
  Sparkles,
  PenTool,
  Smile,
  ThumbsUp,
  Settings,
  Clock,
  Lock,
  X,
  Captions,
  UserPlus,
  ChevronLeft,
} from 'lucide-react';
import type { Page, Participant, SidePanel, ChatMessage } from '@/types';
import { useLanguage } from '@/i18n';
import './MeetingRoom.css';
import {
  participants as initialParticipants,
  lobbyParticipants,
  chatMessages as initialChatMessages,
  transcriptSegments,
  currentUser,
} from '@/data';
import { VideoTile } from '@/components/meeting/VideoTile';
import { ParticipantsPanel } from '@/components/meeting/ParticipantsPanel';
import { ChatPanel } from '@/components/meeting/ChatPanel';
import { AIPanel } from '@/components/meeting/AIPanel';
import { WhiteboardPanel } from '@/components/meeting/WhiteboardPanel';

interface MeetingRoomProps {
  onNavigate: (page: Page) => void;
  onBack: () => void;
  canGoBack: boolean;
}

export function MeetingRoom({ onBack, canGoBack }: MeetingRoomProps) {
  const { t, locale } = useLanguage();
  const [participants, setParticipants] = useState<Participant[]>(initialParticipants);
  const [lobby, setLobby] = useState<Participant[]>(lobbyParticipants);
  const [panel, setPanel] = useState<SidePanel>('participants');
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [isHandRaised, setIsHandRaised] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [pinnedId, setPinnedId] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(3245);
  const [showReactions, setShowReactions] = useState(false);
  const [showLobbyBanner, setShowLobbyBanner] = useState(true);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(initialChatMessages);
  const [chatInput, setChatInput] = useState('');
  const [chatTab, setChatTab] = useState<'general' | 'direct'>('general');
  const [showCaptions, setShowCaptions] = useState(true);
  const [activeCaption, setActiveCaption] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const t = setInterval(() => {
      setActiveCaption((c) => (c + 1) % transcriptSegments.length);
    }, 5000);
    return () => clearInterval(t);
  }, []);

  const formatTime = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
    setParticipants((prev) => prev.map((p) => (p.id === currentUser.id ? { ...p, isMuted: !p.isMuted } : p)));
  };

  const toggleCamera = () => {
    setIsCameraOn(!isCameraOn);
    setParticipants((prev) => prev.map((p) => (p.id === currentUser.id ? { ...p, isCameraOn: !p.isCameraOn } : p)));
  };

  const toggleHand = () => {
    setIsHandRaised(!isHandRaised);
    setParticipants((prev) => prev.map((p) => (p.id === currentUser.id ? { ...p, isHandRaised: !p.isHandRaised } : p)));
  };

  const admitParticipant = (id: string) => {
    const p = lobby.find((pp) => pp.id === id);
    if (p) {
      setParticipants([
        ...participants,
        { ...p, joinedAt: String(new Date().getHours()) + ':' + String(new Date().getMinutes()).padStart(2, '0') },
      ]);
      setLobby(lobby.filter((pp) => pp.id !== id));
    }
  };

  const denyParticipant = (id: string) => {
    setLobby(lobby.filter((pp) => pp.id !== id));
  };

  const sendMessage = () => {
    if (!chatInput.trim()) return;
    setChatMessages([
      ...chatMessages,
      {
        id: String(Date.now()),
        senderId: currentUser.id,
        senderName: currentUser.name,
        senderAvatarColor: currentUser.avatarColor,
        content: chatInput,
        timestamp: new Date().toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', hour12: false }),
        isDirect: false,
      },
    ]);
    setChatInput('');
  };

  const mutedAll = () => {
    setParticipants((prev) => prev.map((p) => (p.id !== currentUser.id ? { ...p, isMuted: true } : p)));
  };

  const togglePanel = (p: SidePanel) => setPanel(panel === p ? null : p);

  const pinnedParticipant = pinnedId ? participants.find((p) => p.id === pinnedId) : null;
  const others = pinnedId ? participants.filter((p) => p.id !== pinnedId) : participants;
  // Grid level đặt tên sẵn để CSS quyết số cột (không style inline gridTemplate).
  const meetGridLevel = others.length === 0 ? 0 : others.length <= 2 ? 1 : others.length <= 4 ? 2 : 3;
  const reactions = [
    { emoji: '👍', icon: ThumbsUp, color: 'text-success-600' },
    { emoji: '❤️', icon: Smile, color: 'text-error-600' },
    { emoji: '🎉', icon: Smile, color: 'text-warning-600' },
    { emoji: '👏', icon: Smile, color: 'text-accent-600' },
    { emoji: '😂', icon: Smile, color: 'text-warning-500' },
    { emoji: '🤔', icon: Smile, color: 'text-primary-600' },
  ];

  return (
    <div className="meet-shell animate-fade-in overflow-hidden">
      {/* Main video area */}
      <div className="meet-main">
        {/* Top bar */}
        <div className="meet-topbar">
          <div className="meet-topbar__left min-w-0">
            {canGoBack && (
              <button
                type="button"
                onClick={onBack}
                aria-label={t('meet.leaveBack')}
                title={t('meet.back')}
                className="back-btn back-btn-dark"
              >
                <ChevronLeft size={18} aria-hidden="true" />
              </button>
            )}
            <div aria-hidden="true" className="h-4 w-px bg-white/20" />
            <div className="flex items-center gap-2">
              <span aria-hidden="true" className="w-2.5 h-2.5 bg-error-500 rounded-full animate-pulse" />
              <span className="text-white font-semibold text-sm">{t('meet.rec')}</span>
              <span className="sr-only">{t('meet.rec.sub')}</span>
            </div>
            <div aria-hidden="true" className="h-4 w-px bg-white/20" />
            <div className="flex items-center gap-2 text-white/80 text-sm">
              <Clock size={14} aria-hidden="true" />
              <time className="font-mono tnum">{formatTime(elapsed)}</time>
            </div>
            <div aria-hidden="true" className="h-4 w-px bg-white/20" />
            <span className="text-white text-sm font-medium truncate">Q3 Financial Review Meeting</span>
            <div className="flex items-center gap-1.5 text-white/70 text-xs">
              <Lock size={12} aria-hidden="true" /> {t('meet.secure')}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setShowCaptions(!showCaptions)}
              aria-pressed={showCaptions}
              className={`px-3 min-h-[36px] rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-white/60 ${
                showCaptions ? 'bg-white/15 text-white' : 'bg-white/5 text-white/70 hover:text-white'
              }`}
            >
              <Captions size={14} aria-hidden="true" /> {t('meet.captions')}
            </button>
            <button
              type="button"
              aria-label={t('meet.settings')}
              className="min-w-[40px] min-h-[40px] inline-flex items-center justify-center p-2 rounded-lg text-white/70 hover:bg-white/10 hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-white/60"
            >
              <Settings size={18} aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Lobby banner */}
        {showLobbyBanner && lobby.length > 0 && (
          <div role="status" className="flex items-center justify-between gap-3 px-5 py-2.5 bg-warning-500/15 border-b border-warning-500/20">
            <div className="flex items-center gap-2 text-warning-200 text-sm min-w-0">
              <UserPlus size={16} aria-hidden="true" className="shrink-0" />
              <span className="tnum">
                {t('meet.lobby', { n: lobby.length, plural: lobby.length !== 1 ? 's' : '' })}
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setPanel('participants')}
                className="text-xs font-medium text-white hover:underline min-h-[36px] px-2 rounded focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-white/60"
              >
                {t('meet.review')}
              </button>
              <button
                type="button"
                onClick={() => setShowLobbyBanner(false)}
                aria-label={t('meet.dismissLobby')}
                className="min-w-[36px] min-h-[36px] inline-flex items-center justify-center p-1 text-white/70 hover:text-white rounded focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-white/60"
              >
                <X size={14} aria-hidden="true" />
              </button>
            </div>
          </div>
        )}

        {/* Video area — pinned expands large, others shrink to filmstrip */}
        <div className="flex-1 p-4 overflow-hidden flex flex-col gap-3 min-h-0">
          {pinnedParticipant ? (
            <>
              {/* Large pinned speaker */}
              <div className="flex-1 min-h-0 relative rounded-xl overflow-hidden bg-ink-800 transition-all duration-300 ease-in-out">
                <VideoTile participant={pinnedParticipant} isPinned onUnpin={() => setPinnedId(null)} large />
              </div>

              {/* Filmstrip of other participants */}
              <div className="shrink-0 flex gap-2 overflow-x-auto pb-1">
                {others.map((p) => (
                  <VideoTile key={p.id} participant={p} isPinned={false} onPin={() => setPinnedId(p.id)} compact />
                ))}
              </div>
            </>
          ) : (
            <div className={`meet-grid meet-grid--l${meetGridLevel} flex-1 min-h-0`}>
              {others.map((p) => (
                <VideoTile key={p.id} participant={p} isPinned={false} onPin={() => setPinnedId(p.id)} />
              ))}
            </div>
          )}
        </div>

        {/* Live captions */}
        {showCaptions && (
          <div aria-live="polite" className="px-5 py-2.5 bg-ink-900/80 backdrop-blur border-t border-white/5">
            <div className="flex items-start gap-3 max-w-4xl mx-auto">
              <span className="badge bg-accent-500/20 !text-accent-200 shrink-0 mt-0.5">
                <Captions size={12} aria-hidden="true" /> {t('meet.live')}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-white/70 font-medium">{transcriptSegments[activeCaption]?.speakerName}</p>
                <p className="text-sm text-white mt-0.5">{transcriptSegments[activeCaption]?.text}</p>
              </div>
            </div>
          </div>
        )}

        {/* Control bar */}
        <div role="toolbar" aria-label="Meeting controls" className="flex items-center justify-center gap-2 px-5 py-4 bg-ink-900 shrink-0 relative overflow-x-auto">
          {showReactions && (
            <div role="group" aria-label={t('meet.reactions')} className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 flex gap-1.5 bg-ink-800 rounded-full px-3 py-2 shadow-float border border-white/10 animate-scale-in">
              {reactions.map((r, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setShowReactions(false)}
                  aria-label={t('meet.sendReaction', { emoji: r.emoji })}
                  className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 transition-colors flex items-center justify-center text-lg focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-white/60"
                >
                  <span aria-hidden="true">{r.emoji}</span>
                </button>
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={toggleMute}
            aria-pressed={isMuted}
            aria-label={isMuted ? t('meet.unmute') : t('meet.mute')}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-all focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-white/60 ${
              isMuted ? 'bg-error-600 hover:bg-error-700' : 'bg-white/10 hover:bg-white/20'
            } text-white`}
          >
            {isMuted ? <MicOff size={20} aria-hidden="true" /> : <Mic size={20} aria-hidden="true" />}
          </button>

          <button
            type="button"
            onClick={toggleCamera}
            aria-pressed={!isCameraOn}
            aria-label={isCameraOn ? t('meet.camOff') : t('meet.camOn')}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-all focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-white/60 ${
              !isCameraOn ? 'bg-error-600 hover:bg-error-700' : 'bg-white/10 hover:bg-white/20'
            } text-white`}
          >
            {isCameraOn ? <VideoIcon size={20} aria-hidden="true" /> : <VideoOff size={20} aria-hidden="true" />}
          </button>

          <button
            type="button"
            onClick={() => setShowReactions(!showReactions)}
            aria-expanded={showReactions}
            aria-label={t('meet.reactions')}
            className="w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-all focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-white/60"
          >
            <Smile size={20} aria-hidden="true" />
          </button>

          <button
            type="button"
            onClick={toggleHand}
            aria-pressed={isHandRaised}
            aria-label={isHandRaised ? t('meet.lowerHand') : t('meet.raiseHand')}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-all focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-white/60 ${
              isHandRaised ? 'bg-warning-500 hover:bg-warning-600' : 'bg-white/10 hover:bg-white/20'
            } text-white`}
          >
            <Hand size={20} aria-hidden="true" />
          </button>

          <button
            type="button"
            onClick={() => setIsScreenSharing(!isScreenSharing)}
            aria-pressed={isScreenSharing}
            aria-label={isScreenSharing ? t('meet.stopShare') : t('meet.share')}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-all focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-white/60 ${
              isScreenSharing ? 'bg-primary-600 hover:bg-primary-700' : 'bg-white/10 hover:bg-white/20'
            } text-white`}
          >
            <MonitorUp size={20} aria-hidden="true" />
          </button>

          <div aria-hidden="true" className="w-px h-8 bg-white/20 mx-1 shrink-0" />

          <button
            type="button"
            onClick={() => togglePanel('participants')}
            aria-pressed={panel === 'participants'}
            aria-label={lobby.length > 0 ? t('meet.participants.lobby', { n: lobby.length }) : t('meet.participants')}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-all relative focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-white/60 ${
              panel === 'participants' ? 'bg-primary-600' : 'bg-white/10 hover:bg-white/20'
            } text-white`}
          >
            <Users size={20} aria-hidden="true" />
            {lobby.length > 0 && (
              <span aria-hidden="true" className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-0.5 bg-warning-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center tnum">
                {lobby.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => togglePanel('chat')}
            aria-pressed={panel === 'chat'}
            aria-label={t('meet.chat')}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-all focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-white/60 ${
              panel === 'chat' ? 'bg-primary-600' : 'bg-white/10 hover:bg-white/20'
            } text-white`}
          >
            <MessageSquare size={20} aria-hidden="true" />
          </button>

          <button
            type="button"
            onClick={() => togglePanel('ai')}
            aria-pressed={panel === 'ai'}
            aria-label={t('meet.ai')}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-all focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-white/60 ${
              panel === 'ai' ? 'bg-accent-600' : 'bg-white/10 hover:bg-white/20'
            } text-white`}
          >
            <Sparkles size={20} aria-hidden="true" />
          </button>

          <button
            type="button"
            onClick={() => togglePanel('whiteboard')}
            aria-pressed={panel === 'whiteboard'}
            aria-label={t('meet.whiteboard')}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-all focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-white/60 ${
              panel === 'whiteboard' ? 'bg-primary-600' : 'bg-white/10 hover:bg-white/20'
            } text-white`}
          >
            <PenTool size={20} aria-hidden="true" />
          </button>

          <div aria-hidden="true" className="w-px h-8 bg-white/20 mx-1 shrink-0" />

          <button
            type="button"
            onClick={onBack}
            aria-label={t('meet.leave')}
            className="px-5 h-12 rounded-full bg-error-600 hover:bg-error-700 flex items-center gap-2 text-white font-medium text-sm transition-all focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-white/60 shrink-0"
          >
            <PhoneOff size={20} aria-hidden="true" /> {t('meet.leave')}
          </button>
        </div>
      </div>

      {/* Side panel */}
      {panel && (
        <aside aria-label="Meeting side panel" className="meet-side animate-slide-in-right">
          {panel === 'participants' && (
            <ParticipantsPanel
              participants={participants}
              lobby={lobby}
              onAdmit={admitParticipant}
              onDeny={denyParticipant}
              onMuteAll={mutedAll}
              onClose={() => setPanel(null)}
            />
          )}
          {panel === 'chat' && (
            <ChatPanel
              messages={chatMessages}
              chatTab={chatTab}
              setChatTab={setChatTab}
              chatInput={chatInput}
              setChatInput={setChatInput}
              onSend={sendMessage}
              onClose={() => setPanel(null)}
            />
          )}
          {panel === 'ai' && <AIPanel onClose={() => setPanel(null)} />}
          {panel === 'whiteboard' && <WhiteboardPanel onClose={() => setPanel(null)} />}
        </aside>
      )}
    </div>
  );
}
