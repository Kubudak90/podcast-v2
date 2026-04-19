import { useState, useEffect, useRef, useCallback } from 'react';
import { getSocket } from '../lib/socket';
import { api } from '../lib/api';
import { Avatar } from './UI';

interface ChatMessage {
  id: string;
  userId: string;
  username: string;
  avatarUrl?: string | null;
  content: string;
  createdAt: string;
}

interface ChatProps {
  roomSlug: string;
  isOpen: boolean;
  onClose: () => void;
}

export function Chat({ roomSlug, isOpen, onClose }: ChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load initial messages
  useEffect(() => {
    if (!isOpen) return;

    const loadMessages = async () => {
      try {
        const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/rooms/${roomSlug}/chat`, {
          headers: {
            Authorization: `Bearer ${api.getToken()}`,
          },
        });
        if (res.ok) {
          const data = await res.json();
          setMessages(data);
        }
      } catch (error) {
        console.error('Failed to load chat messages:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadMessages();
  }, [roomSlug, isOpen]);

  // Listen for new messages
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handleNewMessage = (message: ChatMessage) => {
      setMessages((prev) => [...prev, message]);
    };

    socket.on('chat:message', handleNewMessage);

    return () => {
      socket.off('chat:message', handleNewMessage);
    };
  }, []);

  // Auto scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = useCallback(() => {
    if (!input.trim()) return;

    const socket = getSocket();
    if (!socket) return;

    socket.emit('chat:send', {
      roomSlug,
      content: input.trim(),
    });

    setInput('');
  }, [input, roomSlug]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 w-80 bg-pod-elevated border-l border-pod-border flex flex-col z-40 safe-area-pr">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-pod-border">
        <h3 className="font-semibold text-white">Sohbet</h3>
        <button
          onClick={onClose}
          className="text-pod-text-secondary hover:text-white transition-colors"
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
              clipRule="evenodd"
            />
          </svg>
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {isLoading ? (
          <div className="flex justify-center py-4">
            <div className="animate-spin w-6 h-6 border-2 border-pod-red border-t-transparent rounded-full" />
          </div>
        ) : messages.length === 0 ? (
          <p className="text-pod-text-secondary text-center text-sm py-4">
            Henuz mesaj yok. Sohbete baslayin!
          </p>
        ) : (
          messages.map((msg) => (
            <div key={msg.id} className="flex gap-2">
              <Avatar name={msg.username} size="sm" />
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="font-medium text-sm truncate text-white">
                    {msg.username}
                  </span>
                  <span className="text-xs text-pod-text-secondary">
                    {new Date(msg.createdAt).toLocaleTimeString('tr-TR', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
                <p className="text-sm text-white/80 break-words">{msg.content}</p>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-pod-border">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Mesaj yaz..."
            maxLength={500}
            className="flex-1 px-3 py-2 bg-pod-bg border border-pod-border rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-pod-red"
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim()}
            className="px-4 py-2 bg-pod-red text-white rounded-lg text-sm font-medium hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
