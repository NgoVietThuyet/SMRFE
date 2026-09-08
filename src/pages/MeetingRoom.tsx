import { useState, useRef, useEffect } from 'react';
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
  ArrowLeft,
} from 'lucide-react';
import type { Page, Participant, SidePanel, ChatMessage } from '@/types';
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
        timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
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
  const reactions = [
    { emoji: '👍', icon: ThumbsUp, color: 'text-success-600' },
    { emoji: '❤️', icon: Smile, color: 'text-error-600' },
    { emoji: '🎉', icon: Smile, color: 'text-warning-600' },
    { emoji: '👏', icon: Smile, color: 'text-accent-600' },
    { emoji: '😂', icon: Smile, color: 'text-warning-500' },
    { emoji: '🤔', icon: Smile, color: 'text-primary-600' },
  ];

  return (
    <div className="flex h-screen bg-ink-900 animate-fade-in overflow-hidden">
      {/* Main video area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <div className="flex items-center justify-between px-5 py-3 bg-ink-900 shrink-0">
          <div className="flex items-center gap-3">
            {canGoBack && (
              <button
                onClick={onBack}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-white/70 hover:bg-white/10 hover:text-white transition-all active:scale-[0.98]"
              >
                <ArrowLeft size={16} />
                Back
              </button>
            )}
            <div className="h-4 w-px bg-white/20" />
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 bg-error-500 rounded-full animate-pulse" />
              <span className="text-white font-semibold text-sm">REC</span>
            </div>
            <div className="h-4 w-px bg-white/20" />
            <div className="flex items-center gap-2 text-white/80 text-sm">
              <Clock size={14} />
              <span className="font-mono">{formatTime(elapsed)}</span>
            </div>
            <div className="h-4 w-px bg-white/20" />
            <span className="text-white text-sm font-medium">Q3 Financial Review Meeting</span>
            <div className="flex items-center gap-1.5 text-white/60 text-xs">
              <Lock size={12} /> Secure
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowCaptions(!showCaptions)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${
                showCaptions ? 'bg-white/15 text-white' : 'bg-white/5 text-white/50 hover:text-white/80'
              }`}
            >
              <Captions size={14} /> Captions
            </button>
            <button className="p-2 rounded-lg text-white/60 hover:bg-white/10 hover:text-white transition-colors">
              <Settings size={18} />
            </button>
          </div>
        </div>

        {/* Lobby banner */}
        {showLobbyBanner && lobby.length > 0 && (
          <div className="flex items-center justify-between px-5 py-2.5 bg-warning-500/15 border-b border-warning-500/20">
            <div className="flex items-center gap-2 text-warning-200 text-sm">
              <UserPlus size={16} />
              <span>
                {lobby.length} guest{lobby.length !== 1 ? 's' : ''} waiting in the lobby
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setPanel('participants')} className="text-xs font-medium text-white hover:underline">
                Review
              </button>
              <button onClick={() => setShowLobbyBanner(false)} className="p-1 text-white/60 hover:text-white">
                <X size={14} />
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
            <div
              className="grid gap-3 flex-1 min-h-0"
              style={{
                gridTemplateColumns: `repeat(${Math.min(Math.ceil(others.length / Math.ceil(others.length / 2)), 3)}, 1fr)`,
                gridTemplateRows: `repeat(${Math.min(Math.ceil(others.length / 2), 3)}, 1fr)`,
              }}
            >
              {others.map((p) => (
                <VideoTile key={p.id} participant={p} isPinned={false} onPin={() => setPinnedId(p.id)} />
              ))}
            </div>
          )}
        </div>

        {/* Live captions */}
        {showCaptions && (
          <div className="px-5 py-2.5 bg-ink-900/80 backdrop-blur border-t border-white/5">
            <div className="flex items-start gap-3 max-w-4xl mx-auto">
              <span className="badge bg-accent-500/20 text-accent-300 shrink-0 mt-0.5">
                <Captions size={12} /> Live
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-white/50 font-medium">{transcriptSegments[activeCaption]?.speakerName}</p>
                <p className="text-sm text-white mt-0.5">{transcriptSegments[activeCaption]?.text}</p>
              </div>
            </div>
          </div>
        )}

        {/* Control bar */}
        <div className="flex items-center justify-center gap-2 px-5 py-4 bg-ink-900 shrink-0 relative">
          {showReactions && (
            <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 flex gap-1.5 bg-ink-800 rounded-full px-3 py-2 shadow-float border border-white/10 animate-scale-in">
              {reactions.map((r, i) => (
                <button
                  key={i}
                  onClick={() => setShowReactions(false)}
                  className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 transition-colors flex items-center justify-center text-lg"
                >
                  {r.emoji}
                </button>
              ))}
            </div>
          )}

          <button
            onClick={toggleMute}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
              isMuted ? 'bg-error-600 hover:bg-error-700' : 'bg-white/10 hover:bg-white/20'
            } text-white`}
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
          </button>

          <button
            onClick={toggleCamera}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
              !isCameraOn ? 'bg-error-600 hover:bg-error-700' : 'bg-white/10 hover:bg-white/20'
            } text-white`}
            title={isCameraOn ? 'Turn off camera' : 'Turn on camera'}
          >
            {isCameraOn ? <VideoIcon size={20} /> : <VideoOff size={20} />}
          </button>

          <button
            onClick={() => setShowReactions(!showReactions)}
            className="w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-all"
            title="Reactions"
          >
            <Smile size={20} />
          </button>

          <button
            onClick={toggleHand}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
              isHandRaised ? 'bg-warning-500 hover:bg-warning-600' : 'bg-white/10 hover:bg-white/20'
            } text-white`}
            title="Raise hand"
          >
            <Hand size={20} />
          </button>

          <button
            onClick={() => setIsScreenSharing(!isScreenSharing)}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
              isScreenSharing ? 'bg-primary-600 hover:bg-primary-700' : 'bg-white/10 hover:bg-white/20'
            } text-white`}
            title="Share screen"
          >
            <MonitorUp size={20} />
          </button>

          <div className="w-px h-8 bg-white/20 mx-1" />

          <button
            onClick={() => togglePanel('participants')}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-all relative ${
              panel === 'participants' ? 'bg-primary-600' : 'bg-white/10 hover:bg-white/20'
            } text-white`}
            title="Participants"
          >
            <Users size={20} />
            {lobby.length > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-warning-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                {lobby.length}
              </span>
            )}
          </button>

          <button
            onClick={() => togglePanel('chat')}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
              panel === 'chat' ? 'bg-primary-600' : 'bg-white/10 hover:bg-white/20'
            } text-white`}
            title="Chat"
          >
            <MessageSquare size={20} />
          </button>

          <button
            onClick={() => togglePanel('ai')}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
              panel === 'ai' ? 'bg-accent-600' : 'bg-white/10 hover:bg-white/20'
            } text-white`}
            title="AI Assistant"
          >
            <Sparkles size={20} />
          </button>

          <button
            onClick={() => togglePanel('whiteboard')}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
              panel === 'whiteboard' ? 'bg-primary-600' : 'bg-white/10 hover:bg-white/20'
            } text-white`}
            title="Whiteboard"
          >
            <PenTool size={20} />
          </button>

          <div className="w-px h-8 bg-white/20 mx-1" />

          <button
            onClick={onBack}
            className="px-5 h-12 rounded-full bg-error-600 hover:bg-error-700 flex items-center gap-2 text-white font-medium text-sm transition-all"
            title="Leave meeting"
          >
            <PhoneOff size={20} /> Leave
          </button>
        </div>
      </div>

      {/* Side panel */}
      {panel && (
        <div className="w-80 shrink-0 bg-white border-l border-ink-200 flex flex-col animate-slide-in-right">
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
        </div>
      )}
    </div>
  );
}
