import { useRef, useEffect } from 'react';
import { MessageSquare, Send } from 'lucide-react';
import type { ChatMessage } from '@/types';
import { Avatar } from '@/components/Avatar';
import { currentUser } from '@/data';
import { PanelHeader } from '@/components/meeting/PanelHeader';
import { useLanguage } from '@/i18n';

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
  const { t } = useLanguage();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const filteredMessages = messages.filter((m) => (chatTab === 'general' ? !m.isDirect : m.isDirect));

  return (
    <>
      <PanelHeader title={t('panel.chat')} icon={MessageSquare} onClose={onClose} />
      <div role="tablist" aria-label={t('panel.chat')} className="flex border-b border-ink-100">
        <button
          type="button"
          role="tab"
          aria-selected={chatTab === 'general'}
          onClick={() => setChatTab('general')}
          className={`flex-1 py-2.5 min-h-[40px] text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-inset focus-visible:ring-cta-500/40 ${chatTab === 'general' ? 'text-primary-700 border-b-2 border-primary-600' : 'text-ink-500 hover:text-ink-600'}`}
        >
          {t('panel.chat.general')}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={chatTab === 'direct'}
          onClick={() => setChatTab('direct')}
          className={`flex-1 py-2.5 min-h-[40px] text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-inset focus-visible:ring-cta-500/40 ${chatTab === 'direct' ? 'text-primary-700 border-b-2 border-primary-600' : 'text-ink-500 hover:text-ink-600'}`}
        >
          {t('panel.chat.direct')}
        </button>
      </div>

      <div ref={scrollRef} role="log" aria-live="polite" aria-label={chatTab === 'general' ? t('panel.chat.generalLog') : t('panel.chat.directLog')} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {filteredMessages.map((msg) => {
          const isMe = msg.senderId === currentUser.id;
          return (
            <div key={msg.id} className={`flex gap-2.5 ${isMe ? 'flex-row-reverse' : ''}`}>
              <Avatar name={msg.senderName} color={msg.senderAvatarColor} size="sm" />
              <div className={`flex-1 min-w-0 ${isMe ? 'text-right' : ''}`}>
                <div className={`flex items-center gap-2 ${isMe ? 'flex-row-reverse' : ''}`}>
                  <span className="text-sm font-medium text-ink-900">{isMe ? t('panel.chat.you') : msg.senderName}</span>
                  <span className="text-xs text-ink-500 tnum">{msg.timestamp}</span>
                </div>
                <div className={`mt-1 inline-block px-3 py-2 rounded-xl text-sm text-left overflow-wrap-anywhere ${isMe ? 'bg-primary-600 text-white' : 'bg-ink-100 text-ink-800'}`}>
                  {msg.content}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="px-4 py-3 border-t border-ink-100">
        <form onSubmit={(e) => { e.preventDefault(); onSend(); }} className="flex items-center gap-2">
          <label htmlFor="chat-input" className="sr-only">{t('panel.chat.type')}</label>
          <input
            id="chat-input"
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            placeholder={t('panel.chat.ph')}
            autoComplete="off"
            className="input-field flex-1 text-sm"
          />
          <button type="submit" disabled={!chatInput.trim()} aria-label={t('panel.chat.send')} className="btn-primary px-3 py-2.5 min-w-[44px] min-h-[44px] inline-flex items-center justify-center">
            <Send size={16} aria-hidden="true" />
          </button>
        </form>
      </div>
    </>
  );
}
