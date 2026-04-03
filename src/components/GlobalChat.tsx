import React, { useState, useEffect, useRef } from 'react';
import { User } from 'firebase/auth';
import { io, Socket } from 'socket.io-client';
import { Send, MessageSquare, Users, Zap, Smile, Volume2, Copy, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { db } from '../firebase';
import { collection, query, orderBy, limit, onSnapshot, getDocs } from 'firebase/firestore';
import { ChatMessage, Presence } from '../types';
import { toast } from 'sonner';
import { playSound } from '../lib/sounds';

export default function GlobalChat({ 
  user, 
  profile, 
  socket, 
  onlineCount, 
  onlineUsers 
}: { 
  user: User; 
  profile: any; 
  socket: Socket | null;
  onlineCount: number;
  onlineUsers: Presence[];
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showUsers, setShowUsers] = useState(false);
  const [showEmojis, setShowEmojis] = useState(false);
  const [showSounds, setShowSounds] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const emojis = ['🔥', '🎮', '🃏', '🚀', '💎', '👑', '💀', '💯', '🍀', '✨', '⚡', '🌈'];
  const sounds = [
    { id: 'click', label: 'CLICK', icon: '🖱️' },
    { id: 'win', label: 'WIN', icon: '🏆' },
    { id: 'lose', label: 'LOSE', icon: '💥' },
    { id: 'call', label: 'CALL', icon: '📢' },
    { id: 'turn', label: 'TURN', icon: '⏳' }
  ];

  // Load history from Firestore
  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'chat'),
      orderBy('createdAt', 'desc'),
      limit(50)
    );

    const unsub = onSnapshot(q, (snapshot) => {
      const history = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })).reverse() as ChatMessage[];
      setMessages(history);
    });

    return () => unsub();
  }, [user]);

  // Handle unread count
  useEffect(() => {
    if (!socket) return;

    const handleMessage = (message: ChatMessage) => {
      if (!isOpen && message.uid !== user.uid) {
        setUnreadCount(c => c + 1);
      }
    };

    socket.on('global_message', handleMessage);
    return () => {
      socket.off('global_message', handleMessage);
    };
  }, [socket, isOpen, user.uid]);

  useEffect(() => {
    if (isOpen) {
      setUnreadCount(0);
      setTimeout(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
      }, 100);
    }
  }, [isOpen, messages]);

  const handleSend = (text: string = input, type: ChatMessage['type'] = 'text', payload?: any) => {
    if (!text.trim() && type === 'text') return;
    if (!socket) return;

    socket.emit('global_message', {
      uid: user.uid,
      displayName: profile?.displayName || user.displayName || 'GUEST',
      photoURL: user.photoURL,
      text,
      type,
      payload,
      createdAt: Date.now()
    });

    if (type === 'text') setInput('');
    setShowEmojis(false);
    setShowSounds(false);
  };

  const copyRoomCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success('ROOM CODE COPIED');
  };

  const renderMessage = (msg: ChatMessage) => {
    const isMe = msg.uid === user.uid;

    switch (msg.type) {
      case 'emoji':
        return <span className="text-3xl">{msg.text}</span>;
      case 'sound':
        return (
          <button 
            onClick={() => playSound(msg.payload?.soundId)}
            className="flex items-center gap-2 px-3 py-1.5 bg-orange-500/10 border border-orange-500/20 rounded-lg text-orange-500 hover:bg-orange-500/20 transition-colors"
          >
            <Volume2 size={14} />
            <span className="font-bold text-[10px] uppercase tracking-widest">{msg.text}</span>
          </button>
        );
      case 'room_code':
        return (
          <div className="flex flex-col gap-2 p-2 bg-blue-500/10 border border-blue-500/20 rounded-lg">
            <div className="flex items-center justify-between gap-4">
              <span className="font-mono font-bold text-blue-500">{msg.text}</span>
              <button 
                onClick={() => copyRoomCode(msg.text)}
                className="p-1 hover:bg-blue-500/20 rounded transition-colors"
              >
                <Copy size={14} className="text-blue-500" />
              </button>
            </div>
            <span className="text-[8px] uppercase tracking-widest opacity-50">CLICK TO COPY ROOM CODE</span>
          </div>
        );
      default:
        return <span>{msg.text}</span>;
    }
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
            <header className="p-4 border-b border-ink/10 bg-ink/5 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <MessageSquare size={18} className="text-orange-500" />
                <h3 className="font-bold uppercase tracking-widest text-xs font-mono">GLOBAL COMMS</h3>
              </div>
              <button 
                onClick={() => setShowUsers(!showUsers)}
                className={cn(
                  "flex items-center gap-2 px-2 py-1 rounded-full text-[10px] font-mono transition-all",
                  showUsers ? "bg-orange-500 text-white" : "bg-ink/5 opacity-50 hover:opacity-100"
                )}
              >
                <Users size={12} />
                <span>{onlineCount} ONLINE</span>
              </button>
            </header>

            <div className="flex-1 relative overflow-hidden flex flex-col">
              {/* Online Users List Overlay */}
              <AnimatePresence>
                {showUsers && (
                  <motion.div 
                    initial={{ x: '100%' }}
                    animate={{ x: 0 }}
                    exit={{ x: '100%' }}
                    className="absolute inset-0 z-10 bg-bg border-l border-ink/10 p-4 overflow-y-auto no-scrollbar"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-[10px] font-bold uppercase tracking-widest">ONLINE OPERATIVES</h4>
                      <button onClick={() => setShowUsers(false)} className="p-1 hover:bg-ink/5 rounded-full">
                        <X size={14} />
                      </button>
                    </div>
                    <div className="space-y-2">
                      {onlineUsers.map(u => (
                        <div key={u.uid} className="flex items-center gap-3 p-2 rounded-lg border border-ink/5 bg-ink/5">
                          <div className="w-8 h-8 rounded-full bg-ink/10 flex items-center justify-center overflow-hidden border border-ink/10">
                            {u.photoURL ? (
                              <img src={u.photoURL} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                            ) : (
                              <Users size={14} className="opacity-30" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold truncate uppercase tracking-tight">{u.displayName}</p>
                            <div className="flex items-center gap-1">
                              <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                              <span className="text-[8px] opacity-50 uppercase tracking-widest">ACTIVE</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Messages Area */}
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
                        msg.uid === user.uid ? "items-end" : "items-start"
                      )}
                    >
                      <div className="flex items-center gap-2 text-[9px] font-mono opacity-50 uppercase tracking-tighter">
                        <span>{msg.displayName}</span>
                        <span>•</span>
                        <span>{new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      <div className={cn(
                        "px-3 py-2 rounded-2xl text-xs max-w-[85%] break-words border shadow-sm",
                        msg.uid === user.uid 
                          ? "bg-ink text-bg border-ink rounded-tr-none" 
                          : "bg-bg border-ink/10 rounded-tl-none"
                      )}>
                        {renderMessage(msg)}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Input Area */}
              <div className="p-4 border-t border-ink/10 bg-ink/5 space-y-3 shrink-0">
                {/* Quick Actions */}
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => setShowEmojis(!showEmojis)}
                    className={cn("p-1.5 rounded-lg border transition-all", showEmojis ? "bg-orange-500 border-orange-500 text-white" : "bg-bg border-ink/10 opacity-50 hover:opacity-100")}
                  >
                    <Smile size={16} />
                  </button>
                  <button 
                    onClick={() => setShowSounds(!showSounds)}
                    className={cn("p-1.5 rounded-lg border transition-all", showSounds ? "bg-orange-500 border-orange-500 text-white" : "bg-bg border-ink/10 opacity-50 hover:opacity-100")}
                  >
                    <Volume2 size={16} />
                  </button>
                  <button 
                    onClick={() => {
                      const code = prompt('ENTER ROOM CODE TO SHARE:');
                      if (code) handleSend(code, 'room_code');
                    }}
                    className="p-1.5 rounded-lg border bg-bg border-ink/10 opacity-50 hover:opacity-100 transition-all"
                  >
                    <Copy size={16} />
                  </button>
                </div>

                {/* Emoji Picker */}
                <AnimatePresence>
                  {showEmojis && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      className="flex flex-wrap gap-2 p-2 bg-bg border border-ink/10 rounded-lg shadow-inner"
                    >
                      {emojis.map(e => (
                        <button 
                          key={e} 
                          onClick={() => handleSend(e, 'emoji')}
                          className="text-xl hover:scale-125 transition-transform"
                        >
                          {e}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Sound Picker */}
                <AnimatePresence>
                  {showSounds && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      className="grid grid-cols-2 gap-2 p-2 bg-bg border border-ink/10 rounded-lg shadow-inner"
                    >
                      {sounds.map(s => (
                        <button 
                          key={s.id} 
                          onClick={() => handleSend(s.label, 'sound', { soundId: s.id })}
                          className="flex items-center gap-2 px-2 py-1.5 rounded border border-ink/5 hover:bg-ink/5 transition-colors text-[10px] font-bold uppercase tracking-widest"
                        >
                          <span>{s.icon}</span>
                          <span>{s.label}</span>
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>

                <form 
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSend();
                  }} 
                  className="flex gap-2"
                >
                  <input 
                    type="text" 
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="TYPE MESSAGE..."
                    className="flex-1 bg-bg border border-ink/10 rounded-full px-4 py-2 text-xs font-mono focus:outline-none focus:border-orange-500/50 transition-colors"
                    maxLength={500}
                  />
                  <button 
                    type="submit"
                    disabled={!input.trim()}
                    className="p-2 bg-ink text-bg rounded-full hover:scale-110 active:scale-95 transition-all disabled:opacity-50 disabled:hover:scale-100"
                  >
                    <Send size={16} />
                  </button>
                </form>
              </div>
            </div>
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
