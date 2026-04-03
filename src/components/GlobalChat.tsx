import React, { useState, useEffect, useRef } from 'react';
import { User } from 'firebase/auth';
import { io, Socket } from 'socket.io-client';
import { Send, MessageSquare, Users, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

interface ChatMessage {
  id: string;
  user: {
    uid: string;
    displayName: string;
    photoURL?: string;
    level?: number;
  };
  text: string;
  timestamp: number;
}

export default function GlobalChat({ user, profile }: { user: User; profile: any }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const newSocket = io();
    setSocket(newSocket);

    newSocket.on('global_message', (message: ChatMessage) => {
      setMessages(prev => [...prev.slice(-49), message]);
      if (!isOpen) setUnreadCount(c => c + 1);
    });

    return () => {
      newSocket.disconnect();
    };
  }, []);

  useEffect(() => {
    if (isOpen) {
      setUnreadCount(0);
      setTimeout(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
      }, 100);
    }
  }, [isOpen, messages]);

  const handleSend = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || !socket) return;

    socket.emit('global_message', {
      user: {
        uid: user.uid,
        displayName: profile?.displayName || user.displayName || 'OPERATOR',
        photoURL: user.photoURL,
        level: profile?.level || 1
      },
      text: input
    });
    setInput('');
  };

  return (
    <div className="fixed bottom-6 right-6 z-[100] flex flex-col items-end gap-4">
      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="w-80 md:w-96 h-[500px] hardware-card flex flex-col overflow-hidden shadow-2xl border-2 border-ink/20"
          >
            <header className="p-4 border-b border-ink/10 bg-ink/5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageSquare size={18} className="text-orange-500" />
                <h3 className="font-bold uppercase tracking-widest text-xs font-mono">GLOBAL COMMS</h3>
              </div>
              <div className="flex items-center gap-2 text-[10px] font-mono opacity-50">
                <Users size={12} />
                <span>LIVE</span>
              </div>
            </header>

            <div 
              ref={scrollRef}
              className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar bg-bg/50"
            >
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center space-y-2 opacity-30">
                  <Zap size={32} />
                  <p className="text-[10px] font-mono uppercase tracking-widest">NO ACTIVE TRANSMISSIONS</p>
                </div>
              ) : (
                messages.map((msg) => (
                  <div 
                    key={msg.id} 
                    className={cn(
                      "flex flex-col gap-1",
                      msg.user.uid === user.uid ? "items-end" : "items-start"
                    )}
                  >
                    <div className="flex items-center gap-2 text-[9px] font-mono opacity-50 uppercase tracking-tighter">
                      <span className="text-orange-500 font-bold">LVL {msg.user.level}</span>
                      <span>{msg.user.displayName}</span>
                    </div>
                    <div className={cn(
                      "px-3 py-2 rounded-2xl text-xs max-w-[85%] break-words border shadow-sm",
                      msg.user.uid === user.uid 
                        ? "bg-ink text-bg border-ink rounded-tr-none" 
                        : "bg-bg border-ink/10 rounded-tl-none"
                    )}>
                      {msg.text}
                    </div>
                  </div>
                ))
              )}
            </div>

            <form onSubmit={handleSend} className="p-4 border-t border-ink/10 bg-ink/5 flex gap-2">
              <input 
                type="text" 
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="TYPE MESSAGE..."
                className="flex-1 bg-bg border border-ink/10 rounded-full px-4 py-2 text-xs font-mono focus:outline-none focus:border-orange-500/50 transition-colors"
                maxLength={200}
              />
              <button 
                type="submit"
                disabled={!input.trim()}
                className="p-2 bg-ink text-bg rounded-full hover:scale-110 active:scale-95 transition-all disabled:opacity-50 disabled:hover:scale-100"
              >
                <Send size={16} />
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      <button 
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "w-14 h-14 rounded-full flex items-center justify-center shadow-2xl transition-all hover:scale-110 active:scale-95 relative group",
          isOpen ? "bg-ink text-bg" : "bg-orange-500 text-white"
        )}
      >
        {isOpen ? (
          <motion.div initial={{ rotate: -90 }} animate={{ rotate: 0 }}>
            <Zap size={24} />
          </motion.div>
        ) : (
          <MessageSquare size={24} />
        )}
        
        {!isOpen && unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center border-2 border-bg animate-bounce">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}

        <div className="absolute -left-32 top-1/2 -translate-y-1/2 bg-ink text-bg px-3 py-1.5 rounded-lg text-[10px] font-mono uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap border border-white/10">
          {isOpen ? 'CLOSE COMMS' : 'GLOBAL CHAT'}
        </div>
      </button>
    </div>
  );
}
