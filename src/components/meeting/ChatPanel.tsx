import { useRef, useEffect } from 'react';
import { MessageSquare, Send } from 'lucide-react';
import type { ChatMessage } from '@/types';
import { Avatar } from '@/components/Avatar';
import { currentUser } from '@/data';
import { PanelHeader } from '@/components/meeting/PanelHeader';

interface ChatPanelProps {
  messages: ChatMessage[];
  chatTab: 'general' | 'direct';
  setChatTab: (t: 'general' | 'direct') => void;
  chatInput: string;
  setChatInput: (s: string) => void;
  onSend: () => void;
  onClose: () => void;
}

export function ChatPanel({ messages, chatTab, setChatTab, chatInput, setChatInput, onSend, onClose }: ChatPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const filteredMessages = messages.filter((m) => (chatTab === 'general' ? !m.isDirect : m.isDirect));

  return (
    <>
      <PanelHeader title="Chat" icon={MessageSquare} onClose={onClose} />
      <div className="flex border-b border-ink-100">
        <button
          onClick={() => setChatTab('general')}
          className={`flex-1 py-2.5 text-xs font-medium transition-colors ${chatTab === 'general' ? 'text-primary-600 border-b-2 border-primary-600' : 'text-ink-400 hover:text-ink-600'}`}
        >
          General
        </button>
        <button
          onClick={() => setChatTab('direct')}
          className={`flex-1 py-2.5 text-xs font-medium transition-colors ${chatTab === 'direct' ? 'text-primary-600 border-b-2 border-primary-600' : 'text-ink-400 hover:text-ink-600'}`}
        >
          Direct
        </button>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {filteredMessages.map((msg) => {
          const isMe = msg.senderId === currentUser.id;
          return (
            <div key={msg.id} className={`flex gap-2.5 ${isMe ? 'flex-row-reverse' : ''}`}>
              <Avatar name={msg.senderName} color={msg.senderAvatarColor} size="sm" />
              <div className={`flex-1 min-w-0 ${isMe ? 'text-right' : ''}`}>
                <div className={`flex items-center gap-2 ${isMe ? 'flex-row-reverse' : ''}`}>
                  <span className="text-sm font-medium text-ink-900">{isMe ? 'You' : msg.senderName}</span>
                  <span className="text-xs text-ink-400">{msg.timestamp}</span>
                </div>
                <div className={`mt-1 inline-block px-3 py-2 rounded-xl text-sm text-left ${isMe ? 'bg-primary-600 text-white' : 'bg-ink-100 text-ink-800'}`}>
                  {msg.content}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="px-4 py-3 border-t border-ink-100">
        <div className="flex items-center gap-2">
          <input
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && onSend()}
            placeholder="Type a message..."
            className="input-field flex-1 text-sm"
          />
          <button onClick={onSend} disabled={!chatInput.trim()} className="btn-primary px-3 py-2.5">
            <Send size={16} />
          </button>
        </div>
      </div>
    </>
  );
}
