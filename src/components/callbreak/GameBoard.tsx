import React, { useState, useEffect, useRef } from 'react';
import { User } from 'firebase/auth';
import { io, Socket } from 'socket.io-client';
import { motion, AnimatePresence } from 'motion/react';
import { Users, LogOut, Settings, Trophy, Play, Copy, Check, Shield, Spade, Heart, Club, Diamond, MessageSquare, X, Bot, Volume2, VolumeX, Sun, Moon, ArrowLeft, Send, RefreshCw, Plus, Minus } from 'lucide-react';
import SoundControl from '../SoundControl';
import { CallBreakGame, CallBreakPlayer, Card, CardSuit, Sound } from '../../types';
import { playSound } from '../../lib/sounds';
import { REACTION_SOUNDS } from '../../constants';
import { cn } from '../../lib/utils';
import { toast } from 'sonner';

interface GameBoardProps {
  user: User;
  roomId: string;
  isCreating: boolean;
  onLeave: () => void;
  isDark: boolean;
  toggleTheme: () => void;
  customSounds: Sound[];
}

const SOCKET_URL = window.location.origin;

export default function GameBoard({ user, roomId, isCreating, onLeave, isDark, toggleTheme, customSounds }: GameBoardProps) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [gameState, setGameState] = useState<CallBreakGame | null>(null);
  const gameRef = useRef<CallBreakGame | null>(null);
  const [copied, setCopied] = useState(false);
  const [selectedCall, setSelectedCall] = useState<number>(1);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [localSettings, setLocalSettings] = useState({ rounds: 5, turnTimer: 30 });
  
  const [showCommMenu, setShowCommMenu] = useState(false);
  const [showScoreboard, setShowScoreboard] = useState(false);
  const [commTab, setCommTab] = useState<'emojis' | 'sounds'>('emojis');
  const [showTopBar, setShowTopBar] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);
  const [activeEmojis, setActiveEmojis] = useState<Record<string, { emoji: string; timestamp: number }>>({});
  const [activeAudio, setActiveAudio] = useState<Record<string, number>>({});
  
  const emojis = [
    { char: '🔥', gif: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f525/512.gif' },
    { char: '😂', gif: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f602/512.gif' },
    { char: '😲', gif: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f632/512.gif' },
    { char: '👏', gif: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f44f/512.gif' },
    { char: '💩', gif: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f4a9/512.gif' },
    { char: '❤️', gif: 'https://fonts.gstatic.com/s/e/notoemoji/latest/2764_fe0f/512.gif' },
    { char: '🤡', gif: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f921/512.gif' },
    { char: '👍', gif: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f44d/512.gif' },
    { char: '🚀', gif: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f680/512.gif' },
    { char: '💎', gif: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f48e/512.gif' },
    { char: '🌈', gif: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f308/512.gif' },
    { char: '🍕', gif: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f355/512.gif' },
    { char: '🍦', gif: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f366/512.gif' },
    { char: '🎸', gif: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f3b8/512.gif' },
    { char: '🎮', gif: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f3ae/512.gif' },
    { char: '👑', gif: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f451/512.gif' },
    { char: '🦄', gif: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f984/512.gif' },
    { char: '👽', gif: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f47d/512.gif' },
    { char: '👻', gif: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f47b/512.gif' },
    { char: '🤖', gif: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f916/512.gif' },
    { char: '🎉', gif: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f389/512.gif' },
    { char: '💰', gif: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f4b0/512.gif' },
    { char: '⚡', gif: 'https://fonts.gstatic.com/s/e/notoemoji/latest/26a1/512.gif' },
    { char: '🌟', gif: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f31f/512.gif' },
    { char: '💀', gif: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f480/512.gif' },
    { char: '🤨', gif: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f928/512.gif' },
    { char: '🤫', gif: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f92b/512.gif' },
    { char: '🤯', gif: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f92f/512.gif' },
    { char: '🥳', gif: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f973/512.gif' },
    { char: '🫠', gif: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1fae0/512.gif' },
    { char: '🫡', gif: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1fae1/512.gif' },
    { char: '🫣', gif: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1fae3/512.gif' },
  ];

  useEffect(() => {
    gameRef.current = gameState;
  }, [gameState]);

  useEffect(() => {
    const newSocket = io(SOCKET_URL, {
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    setSocket(newSocket);

    newSocket.on('connect', () => {
      newSocket.emit('cb_joinRoom', {
        roomId,
        user: {
          uid: user.uid,
          displayName: user.displayName,
          photoURL: user.photoURL,
        },
        isCreating,
      });
    });

    newSocket.on('cb_gameState', (state: CallBreakGame) => {
      setGameState(state);
      setLocalSettings({ rounds: state.config.rounds, turnTimer: state.config.turnTimer || 30 });
    });

    newSocket.on('emojiUpdate', ({ userId, emoji }: { userId: string; emoji: string }) => {
      setActiveEmojis(prev => ({
        ...prev,
        [userId]: { emoji, timestamp: Date.now() }
      }));
    });

    newSocket.on('reactionSoundUpdate', ({ userId, sound }: { userId: string; sound: any }) => {
      playSound(sound);
      setActiveAudio(prev => ({
        ...prev,
        [userId]: Date.now()
      }));
      const player = gameRef.current?.players.find(p => p.uid === userId);
      if (player) {
        toast(`${player.displayName} played a sound`, {
          icon: '🔊',
          duration: 2000,
          position: 'top-center',
        });
      }
    });

    newSocket.on('error', (msg: string) => {
      toast.error(msg);
      if (msg === 'Room is full' || msg === 'Game already in progress' || msg === 'Room not found') {
        onLeave();
      }
    });

    return () => {
      newSocket.emit('cb_leaveRoom', { roomId, user: { uid: user.uid, displayName: user.displayName } });
      newSocket.disconnect();
    };
  }, [roomId, user.uid, user.displayName, user.photoURL, isCreating, onLeave]);

  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setActiveEmojis(prev => {
        const next = { ...prev };
        let changed = false;
        for (const uid in next) {
          if (now - next[uid].timestamp > 3000) {
            delete next[uid];
            changed = true;
          }
        }
        return changed ? next : prev;
      });
      setActiveAudio(prev => {
        const next = { ...prev };
        let changed = false;
        for (const uid in next) {
          if (now - next[uid] > 3000) {
            delete next[uid];
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const [timeLeft, setTimeLeft] = useState(30);
  const [recapTimeLeft, setRecapTimeLeft] = useState(10);

  useEffect(() => {
    if (!gameState || (gameState.status !== 'playing' && gameState.status !== 'bidding')) return;
    
    const interval = setInterval(() => {
      const elapsed = (Date.now() - gameState.turnStartedAt) / 1000;
      const remaining = Math.max(0, (gameState.config.turnTimer || 30) - elapsed);
      setTimeLeft(remaining);
    }, 100);

    return () => clearInterval(interval);
  }, [gameState?.turnStartedAt, gameState?.status, gameState?.config.turnTimer]);

  const sendEmoji = (emoji: string) => {
    socket?.emit('sendEmoji', { emoji });
    setShowCommMenu(false);
  };

  const sendReactionSound = (sound: string) => {
    socket?.emit('sendReactionSound', { sound });
    setShowCommMenu(false);
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(roomId);
    setCopied(true);
    toast.success('Room code copied!');
    setTimeout(() => setCopied(false), 2000);
  };

  const startGame = () => {
    if (socket) socket.emit('cb_startGame', { roomId });
  };

  const makeCall = () => {
    if (socket) socket.emit('cb_makeCall', { roomId, call: selectedCall });
  };

  const playCard = () => {
    if (socket && selectedCardId) {
      playSound('draw');
      socket.emit('cb_playCard', { roomId, cardId: selectedCardId });
      setSelectedCardId(null);
    }
  };

  const handleCardClick = (cardId: string) => {
    setSelectedCardId(prev => prev === cardId ? null : cardId);
  };

  const nextRound = () => {
    if (socket) socket.emit('cb_nextRound', { roomId });
  };

  const updateSettings = () => {
    if (socket && isHost) {
      socket.emit('cb_updateSettings', { roomId, settings: localSettings });
      setShowSettings(false);
      toast.success('Settings updated');
    }
  };

  const me = gameState?.players.find(p => p.uid === user.uid);
  const isHost = gameState?.hostId === user.uid;
  const isMyTurn = gameState?.players[gameState?.turnIndex || 0]?.uid === user.uid;

  useEffect(() => {
    if (!isMyTurn) {
      setSelectedCardId(null);
    }
  }, [isMyTurn]);

  useEffect(() => {
    if (!gameState || gameState.status !== 'roundEnd') {
      setRecapTimeLeft(10);
      return;
    }
    
    const startTime = Date.now();
    const interval = setInterval(() => {
      const elapsed = (Date.now() - startTime) / 1000;
      const remaining = Math.max(0, 10 - elapsed);
      setRecapTimeLeft(remaining);
      
      if (remaining <= 0 && isHost) {
        nextRound();
        clearInterval(interval);
      }
    }, 100);

    return () => clearInterval(interval);
  }, [gameState?.status, isHost]);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      if (currentScrollY < lastScrollY || currentScrollY < 50) {
        setShowTopBar(true);
      } else {
        setShowTopBar(false);
      }
      setLastScrollY(currentScrollY);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [lastScrollY]);

  if (!gameState) {
    return (
      <div className="min-h-screen bg-bg text-ink flex items-center justify-center font-mono uppercase tracking-widest text-sm opacity-50">
        <div className="flex items-center gap-3">
          <div className="w-4 h-4 rounded-full border-2 border-ink border-t-transparent animate-spin" />
          Connecting to server...
        </div>
      </div>
    );
  }

  const renderSuitIcon = (suit?: CardSuit) => {
    switch (suit) {
      case 'spades': return <Spade size={16} className="text-ink" />;
      case 'hearts': return <Heart size={16} className="text-red-500" />;
      case 'clubs': return <Club size={16} className="text-ink" />;
      case 'diamonds': return <Diamond size={16} className="text-red-500" />;
      default: return null;
    }
  };

  const getCardValueCB = (card: Card): number => {
    return card.value;
  };

  const isValidPlayCB = (card: Card, hand: Card[], leadSuit: CardSuit | null, currentTrick: { playerUid: string; card: Card }[]): boolean => {
    if (!leadSuit) return true;

    const hasLeadSuit = hand.some(c => c.suit === leadSuit);
    if (hasLeadSuit) {
      if (card.suit !== leadSuit) return false;

      const spadePlayed = currentTrick.some(c => c.card.suit === 'spades');
      if (!spadePlayed || leadSuit === 'spades') {
        const leadSuitCardsInTrick = currentTrick.filter(c => c.card.suit === leadSuit);
        const highestLeadCardValue = leadSuitCardsInTrick.length > 0 ? Math.max(...leadSuitCardsInTrick.map(c => getCardValueCB(c.card))) : 0;
        const hasHigherLeadCard = hand.some(c => c.suit === leadSuit && getCardValueCB(c) > highestLeadCardValue);

        if (hasHigherLeadCard && getCardValueCB(card) <= highestLeadCardValue) {
          return false;
        }
      }
      return true;
    }

    const hasSpade = hand.some(c => c.suit === 'spades');
    if (hasSpade) {
      if (card.suit !== 'spades') return false;

      const spadesInTrick = currentTrick.filter(c => c.card.suit === 'spades');
      const highestSpadeValue = spadesInTrick.length > 0 ? Math.max(...spadesInTrick.map(c => getCardValueCB(c.card))) : 0;
      const hasHigherSpade = hand.some(c => c.suit === 'spades' && getCardValueCB(c) > highestSpadeValue);
      
      if (hasHigherSpade && getCardValueCB(card) <= highestSpadeValue) {
        return false;
      }
      return true;
    }

    return true;
  };

  const renderCard = (card: Card, onClick?: () => void, disabled?: boolean, isTrickArea?: boolean, isInvalid?: boolean) => {
    const isRed = card.suit === 'hearts' || card.suit === 'diamonds';
    const isSpade = card.suit === 'spades';
    
    return (
      <motion.button
        whileHover={onClick && !disabled ? { y: -20, scale: 1.05, zIndex: 50 } : {}}
        onClick={onClick}
        disabled={disabled || !onClick}
        className={cn(
          "relative bg-white rounded-xl shadow-2xl flex flex-col p-2 md:p-3 border-2 transition-all shrink-0 group overflow-hidden w-full h-full",
          isInvalid && !isTrickArea ? 'opacity-40 grayscale cursor-not-allowed border-gray-200' : 
          !onClick ? 'cursor-default border-gray-200' :
          'cursor-pointer border-transparent hover:border-orange-500 shadow-orange-500/20 active:scale-95'
        )}
      >
        {/* Card Background Pattern */}
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none">
          <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(circle, #000 1px, transparent 1px)', backgroundSize: '10px 10px' }} />
        </div>

        <div className="flex justify-between items-start w-full relative z-10">
          <div className={cn(
            "text-sm md:text-2xl font-black leading-none font-mono tracking-tighter",
            isRed ? "text-red-600" : "text-black"
          )}>
            {card.rank}
          </div>
          <div className={cn(
            "text-[10px] md:text-lg",
            isRed ? "text-red-600" : "text-black"
          )}>
            {card.suit === 'hearts' && '♥'}
            {card.suit === 'diamonds' && '♦'}
            {card.suit === 'clubs' && '♣'}
            {card.suit === 'spades' && '♠'}
          </div>
        </div>
        
        <div className={cn(
          "flex-1 flex items-center justify-center text-2xl md:text-7xl relative z-10",
          isRed ? "text-red-600" : "text-black",
          isSpade && "drop-shadow-[0_0_15px_rgba(59,130,246,0.3)]"
        )}>
          {card.suit === 'hearts' && '♥'}
          {card.suit === 'diamonds' && '♦'}
          {card.suit === 'clubs' && '♣'}
          {card.suit === 'spades' && '♠'}
        </div>

        <div className="flex justify-between items-end w-full rotate-180 relative z-10">
          <div className={cn(
            "text-sm md:text-2xl font-black leading-none font-mono tracking-tighter",
            isRed ? "text-red-600" : "text-black"
          )}>
            {card.rank}
          </div>
          <div className={cn(
            "text-[10px] md:text-lg",
            isRed ? "text-red-600" : "text-black"
          )}>
            {card.suit === 'hearts' && '♥'}
            {card.suit === 'diamonds' && '♦'}
            {card.suit === 'clubs' && '♣'}
            {card.suit === 'spades' && '♠'}
          </div>
        </div>

        {isSpade && (
          <div className="absolute top-1 right-1 md:top-2 md:right-2 z-20">
            <div className="w-1 h-1 md:w-2 md:h-2 rounded-full bg-blue-500 animate-pulse shadow-[0_0_10px_rgba(59,130,246,0.8)]" />
          </div>
        )}
      </motion.button>
    );
  };

  // Organize players for table layout (bottom: me, left, top, right)
  const getOrderedPlayers = () => {
    const myIndex = gameState.players.findIndex(p => p.uid === user.uid);
    if (myIndex === -1) return gameState.players;
    
    const ordered = [];
    for (let i = 0; i < 4; i++) {
      const idx = (myIndex + i) % 4;
      if (gameState.players[idx]) {
        ordered.push(gameState.players[idx]);
      }
    }
    return ordered;
  };

  const orderedPlayers = getOrderedPlayers();

  const getLeaders = () => {
    if (!gameState || gameState.currentRound <= 1) return [];
    const maxScore = Math.max(...gameState.players.map(p => p.totalScore));
    if (maxScore <= 0) return [];
    return gameState.players.filter(p => p.totalScore === maxScore).map(p => p.uid);
  };

  const leaders = getLeaders();

  const renderPlayerAvatar = (player: CallBreakPlayer, position: 'top' | 'left' | 'right' | 'bottom') => {
    const isTurn = gameState.players[gameState.turnIndex]?.uid === player.uid;
    const isMe = player.uid === user.uid;
    const isLeader = leaders.includes(player.uid);
    
    return (
      <div className={cn(
        "flex flex-col items-center transition-all duration-500 shrink-0 relative",
        isTurn && "scale-105 md:scale-110"
      )}>
        <div 
          className={cn(
            "w-12 h-12 sm:w-16 sm:h-16 md:w-20 md:h-20 rounded-full flex items-center justify-center relative border-2",
            isTurn ? "border-orange-500 text-orange-500 shadow-[0_0_20px_rgba(249,115,22,0.4)]" : "border-ink/10 text-ink",
            player.isAway && "opacity-30 grayscale"
          )}
        >
          {isLeader && (
            <motion.div 
              initial={{ scale: 0, rotate: -20 }}
              animate={{ scale: 1, rotate: 0 }}
              className="absolute -top-2 -right-2 bg-yellow-500 text-white p-1 rounded-full z-30 shadow-lg border-2 border-bg"
            >
              <Trophy size={12} fill="currentColor" />
            </motion.div>
          )}
          <div className="absolute flex items-center justify-center overflow-hidden rounded-full inset-0.5 sm:inset-1 bg-ink/5">
            {player.isBot ? <Bot size={24} className="sm:size-8 md:size-[40px]" /> : <Users size={24} className="sm:size-8 md:size-[40px]" />}
            {player.isAway && (
              <div className="absolute inset-0 bg-red-500/60 flex items-center justify-center">
                <div className="text-[6px] sm:text-[8px] md:text-[10px] font-black text-white uppercase tracking-tighter drop-shadow-md">AWAY</div>
              </div>
            )}
          </div>

          {/* Active Emoji */}
          <AnimatePresence mode="popLayout">
            {activeEmojis[player.uid] && (
              <motion.div
                key={`emoji-${player.uid}-${activeEmojis[player.uid].timestamp}`}
                initial={{ opacity: 0, scale: 0.5, y: 0 }}
                animate={{ opacity: 1, scale: 1.5, y: -40 }}
                exit={{ opacity: 0, scale: 0.5, y: -80 }}
                className="absolute top-0 left-1/2 -translate-x-1/2 text-2xl sm:text-3xl z-50 pointer-events-none drop-shadow-2xl"
              >
                {activeEmojis[player.uid].emoji.startsWith('http') ? (
                  <img src={activeEmojis[player.uid].emoji} alt="emoji" className="w-10 h-10 sm:w-16 sm:h-16 object-contain" referrerPolicy="no-referrer" />
                ) : (
                  activeEmojis[player.uid].emoji
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Audio Indicator */}
          <AnimatePresence>
            {activeAudio[player.uid] && (
              <motion.div
                key={`audio-${player.uid}-${activeAudio[player.uid]}`}
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.5 }}
                className="absolute -bottom-1 -right-1 bg-orange-500 text-white p-1 rounded-full z-30 shadow-lg border-2 border-bg"
              >
                <Volume2 size={10} className="animate-pulse" />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Badges - Refined and Responsive */}
          {!isMe && (
            <div className={cn(
              "absolute flex flex-col gap-1 items-center z-20",
              position === 'left' ? "-right-4 sm:-right-6" : 
              position === 'right' ? "-left-4 sm:-left-6" : 
              "-right-4 sm:-right-6"
            )}>
              <div className={cn(
                "w-6 h-6 sm:w-8 sm:h-8 flex items-center justify-center text-[8px] sm:text-[10px] font-black rounded-full border-2 border-bg shadow-lg",
                isTurn ? "bg-orange-500 text-white" : "bg-ink text-bg"
              )} title="Call">
                {player.call || '?'}
              </div>
              <div className="w-6 h-6 sm:w-8 sm:h-8 flex items-center justify-center text-[8px] sm:text-[10px] font-black rounded-full border-2 border-bg shadow-lg bg-green-500 text-white" title="Won">
                {player.tricksWon}
              </div>
            </div>
          )}
        </div>
        
        <div className={cn(
          "text-[8px] sm:text-[10px] md:text-xs uppercase font-black tracking-tighter truncate max-w-[60px] sm:max-w-[80px] md:max-w-[120px] mt-1 sm:mt-2",
          isTurn ? "text-orange-500" : "opacity-60"
        )}>
          {player.displayName} {isMe && '(YOU)'}
        </div>
        
        {isTurn && !player.isAway && (
          <div className="w-12 sm:w-16 md:w-24 h-1 bg-ink/10 rounded-full overflow-hidden mt-1 shadow-inner">
            <div 
              className={cn(
                "h-full origin-left transition-transform duration-100",
                timeLeft < 5 ? "bg-red-500" : "bg-orange-500"
              )}
              style={{ transform: `scaleX(${timeLeft / (gameState.config.turnTimer || 30)})` }} 
            />
          </div>
        )}
      </div>
    );
  };

  const renderCommMenu = () => {
    return (
      <AnimatePresence>
        {showCommMenu && (
          <>
            {/* Backdrop for mobile */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowCommMenu(false)}
              className="fixed inset-0 bg-bg/40 backdrop-blur-sm z-[90] md:hidden"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="fixed bottom-0 left-0 right-0 md:bottom-32 md:left-12 md:right-auto z-[100] w-full md:w-[360px] hardware-card p-6 bg-bg/95 backdrop-blur-xl border-t-2 md:border-2 border-orange-500/30 shadow-2xl rounded-t-3xl md:rounded-2xl"
            >
              <div className="w-12 h-1.5 bg-ink/10 rounded-full mx-auto mb-6 md:hidden" />
              
              <div className="flex items-center justify-between mb-6">
                <div className="flex p-1 bg-ink/5 rounded-xl">
                  <button 
                    onClick={() => setCommTab('emojis')}
                    className={cn(
                      "px-4 py-2 text-[10px] font-mono uppercase tracking-widest font-bold rounded-lg transition-all",
                      commTab === 'emojis' ? "bg-bg text-orange-500 shadow-sm" : "opacity-40 hover:opacity-60"
                    )}
                  >
                    Emojis
                  </button>
                  <button 
                    onClick={() => setCommTab('sounds')}
                    className={cn(
                      "px-4 py-2 text-[10px] font-mono uppercase tracking-widest font-bold rounded-lg transition-all",
                      commTab === 'sounds' ? "bg-bg text-orange-500 shadow-sm" : "opacity-40 hover:opacity-60"
                    )}
                  >
                    Sounds
                  </button>
                </div>
                <button onClick={() => setShowCommMenu(false)} className="p-2 hover:bg-ink/10 rounded-full transition-colors">
                  <X size={18} />
                </button>
              </div>

              <div className="max-h-[300px] overflow-y-auto no-scrollbar pb-4">
                {commTab === 'emojis' ? (
                  <div className="grid grid-cols-5 sm:grid-cols-6 gap-3">
                    {emojis.map((e) => (
                      <button
                        key={e.char}
                        onClick={() => {
                          sendEmoji(e.gif);
                          if (window.innerWidth < 768) setShowCommMenu(false);
                        }}
                        className="text-3xl p-3 hover:bg-orange-500/10 rounded-2xl transition-all active:scale-75 flex items-center justify-center border border-transparent hover:border-orange-500/20"
                      >
                        {e.char}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {REACTION_SOUNDS.map((sound) => (
                      <button
                        key={sound.id}
                        onClick={() => {
                          sendReactionSound(sound.id);
                          if (window.innerWidth < 768) setShowCommMenu(false);
                        }}
                        className="flex items-center gap-3 p-3 rounded-xl border border-ink/10 hover:border-orange-500/50 hover:bg-orange-500/5 transition-all group"
                      >
                        <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center group-hover:bg-orange-500 group-hover:text-white transition-colors">
                          <Volume2 size={14} />
                        </div>
                        <span className="text-[10px] font-mono uppercase tracking-tighter truncate font-bold">{sound.label}</span>
                      </button>
                    ))}
                    {customSounds.map((sound) => (
                      <button
                        key={sound.id}
                        onClick={() => {
                          sendReactionSound(sound.id);
                          if (window.innerWidth < 768) setShowCommMenu(false);
                        }}
                        className="flex items-center gap-3 p-3 rounded-xl border border-ink/10 hover:border-orange-500/50 hover:bg-orange-500/5 transition-all group"
                      >
                        <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center group-hover:bg-orange-500 group-hover:text-white transition-colors">
                          <Volume2 size={14} />
                        </div>
                        <span className="text-[10px] font-mono uppercase tracking-tighter truncate font-bold">{sound.label}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    );
  };

  const renderScoreboard = () => {
    return (
      <AnimatePresence>
        {showScoreboard && (
          <div className="absolute inset-0 bg-bg/90 backdrop-blur-md flex items-center justify-center z-[70] p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="hardware-card p-6 sm:p-10 max-w-3xl w-full max-h-[85vh] flex flex-col space-y-6 relative"
            >
              <button 
                onClick={() => setShowScoreboard(false)}
                className="absolute top-4 right-4 p-2 hover:bg-ink/10 rounded-full transition-colors"
              >
                <X size={24} />
              </button>

              <div className="text-center space-y-2">
                <h2 className="text-2xl sm:text-4xl font-display font-black uppercase tracking-tight">Scoreboard</h2>
                <p className="font-mono text-[10px] opacity-50 uppercase tracking-[0.4em]">Round-by-Round Performance</p>
              </div>
              
              <div className="flex-1 overflow-auto no-scrollbar border-2 border-ink/5 rounded-2xl bg-ink/[0.02]">
                <table className="w-full text-left border-collapse min-w-[500px] font-mono text-xs">
                  <thead>
                    <tr className="border-b-2 border-ink/10 bg-ink/5">
                      <th className="p-4 sticky left-0 bg-bg/95 z-10 border-r border-ink/10 uppercase tracking-widest opacity-40">Round</th>
                      {gameState.players.map(p => (
                        <th key={p.uid} className="p-4 text-center">
                          <div className="flex flex-col items-center gap-2">
                            <div className="w-10 h-10 rounded-full bg-bg border-2 border-ink/10 flex items-center justify-center overflow-hidden shadow-sm">
                              {p.isBot ? <Bot size={20} /> : <Users size={20} />}
                            </div>
                            <span className="font-black tracking-tighter truncate max-w-[80px]">{p.displayName.toUpperCase()}</span>
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from({ length: gameState.currentRound }, (_, i) => i + 1).map(roundNum => (
                      <tr key={roundNum} className="border-b border-ink/5 hover:bg-ink/[0.02] transition-colors">
                        <td className="p-4 font-black sticky left-0 bg-bg/95 z-10 border-r border-ink/10 text-center">{roundNum}</td>
                        {gameState.players.map(p => {
                          const roundScore = p.roundScores[roundNum - 1];
                          const isPositive = roundScore > 0;
                          return (
                            <td key={p.uid} className="p-4 text-center">
                              <div className="flex flex-col items-center">
                                <span className={cn(
                                  "text-lg font-black",
                                  isPositive ? "text-green-500" : "text-red-500"
                                )}>
                                  {roundScore !== undefined ? roundScore.toFixed(1) : '-'}
                                </span>
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                    <tr className="bg-ink/5 font-black border-t-2 border-ink/10">
                      <td className="p-4 sticky left-0 bg-ink/5 z-10 border-r border-ink/10 uppercase tracking-widest opacity-40 text-center">Total</td>
                      {gameState.players.map(p => (
                        <td key={p.uid} className="p-4 text-center text-xl text-orange-500">
                          {p.totalScore.toFixed(1)}
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    );
  };

  return (
    <div className="h-screen h-[100dvh] bg-bg text-ink flex flex-col overflow-hidden">
      {/* Header - Responsive and Auto-hiding on Mobile Landscape */}
      <header className={cn(
        "px-4 border-b border-ink/10 flex justify-between items-center bg-bg/80 backdrop-blur-md z-50 transition-all duration-300 shrink-0",
        !showTopBar ? "landscape:max-sm:h-0 landscape:max-sm:py-0 landscape:max-sm:opacity-0 landscape:max-sm:overflow-hidden landscape:max-sm:border-transparent" : "sticky top-0 py-2 md:py-3"
      )}>
        <div className="flex items-center gap-4">
          <button onClick={onLeave} className="p-2 hover:bg-ink/5 rounded-full transition-colors">
            <ArrowLeft size={18} />
          </button>
          <div className="font-mono text-sm uppercase tracking-widest font-bold flex items-center gap-2">
            <Spade size={16} className="text-blue-500" />
            <span className="hidden sm:inline">Call Break</span>
            <span className="opacity-30 mx-2">/</span>
            <span className="opacity-60">Room: {roomId}</span>
          </div>
        </div>
        <div className="flex items-center gap-4 font-mono text-xs uppercase tracking-widest">
          <div className="hidden sm:flex items-center gap-2 opacity-60">
            <Trophy size={14} />
            Round {gameState.currentRound}/{gameState.config.rounds}
          </div>
          <button 
            onClick={toggleTheme}
            className="p-2 hover:bg-ink/10 rounded-full transition-colors text-ink/60 hover:text-orange-500"
          >
            {isDark ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <SoundControl />
          {isHost && gameState.status === 'waiting' && (
            <button onClick={() => setShowSettings(true)} className="p-2 hover:bg-ink/5 rounded-full transition-colors">
              <Settings size={18} />
            </button>
          )}
        </div>
      </header>

      {/* Main Game Area */}
      <main className="flex-1 relative flex flex-col overflow-hidden min-h-0">
        {renderCommMenu()}
        {renderScoreboard()}
        {gameState.status === 'waiting' && (
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <div className="hardware-card p-8 max-w-md w-full text-center">
              <h2 className="text-3xl font-display font-bold uppercase tracking-tight mb-2">Waiting for Players</h2>
              <p className="font-mono text-sm opacity-60 mb-8">
                {gameState.players.length} / {gameState.config.maxPlayers} players joined
              </p>

              <div className="flex items-center justify-center gap-2 mb-8 p-4 bg-ink/5 rounded-xl border border-ink/10">
                <span className="font-mono text-2xl tracking-[0.2em] font-bold">{roomId}</span>
                <button 
                  onClick={handleCopyCode}
                  className="p-2 hover:bg-ink/10 rounded-lg transition-colors"
                >
                  {copied ? <Check size={20} className="text-green-500" /> : <Copy size={20} />}
                </button>
              </div>

              <div className="space-y-3 mb-8 text-left">
                {gameState.players.map((p, i) => (
                  <div key={p.uid} className="flex items-center gap-3 p-3 rounded-lg border border-ink/10 bg-bg">
                    <div className="w-8 h-8 rounded-full bg-ink/10 flex items-center justify-center font-bold text-xs">
                      {i + 1}
                    </div>
                    <span className="font-bold flex-1">{p.displayName} {p.isBot && '(Bot)'}</span>
                    {p.uid === gameState.hostId && <Shield size={14} className="text-blue-500" />}
                  </div>
                ))}
                {Array.from({ length: gameState.config.maxPlayers - gameState.players.length }).map((_, i) => (
                  <div key={`empty-${i}`} className="flex items-center gap-3 p-3 rounded-lg border border-ink/10 border-dashed opacity-50">
                    <div className="w-8 h-8 rounded-full border border-ink/20 border-dashed flex items-center justify-center">
                      <Users size={14} />
                    </div>
                    <span className="font-mono text-sm uppercase tracking-widest">Waiting...</span>
                  </div>
                ))}
              </div>

              {isHost && (
                <div className="space-y-3">
                  {gameState.players.length < 4 && (
                    <button
                      onClick={() => socket?.emit('cb_addBot', { roomId })}
                      className="w-full py-3 border-2 border-ink/20 font-bold uppercase tracking-widest rounded-xl hover:bg-ink/5 transition-colors flex items-center justify-center gap-2"
                    >
                      Add Bot
                    </button>
                  )}
                  <button
                    onClick={startGame}
                    disabled={gameState.players.length !== 4}
                    className="w-full py-4 bg-ink text-bg font-bold uppercase tracking-widest rounded-xl hover:bg-ink/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    <Play size={18} />
                    Start Game
                  </button>
                </div>
              )}
              {!isHost && (
                <p className="font-mono text-sm opacity-60 uppercase tracking-widest">
                  Waiting for host to start...
                </p>
              )}
            </div>
          </div>
        )}

        {/* Settings Modal */}
        <AnimatePresence>
          {showSettings && isHost && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-bg/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            >
              <motion.div 
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.9, y: 20 }}
                className="hardware-card p-6 max-w-sm w-full"
              >
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold uppercase tracking-tight">Game Settings</h2>
                  <button onClick={() => setShowSettings(false)} className="p-2 hover:bg-ink/5 rounded-full">
                    <LogOut size={18} className="rotate-180" />
                  </button>
                </div>

                <div className="space-y-6">
                  <div>
                    <label className="block text-xs font-mono uppercase tracking-widest opacity-60 mb-2">
                      Number of Rounds
                    </label>
                    <div className="flex gap-2">
                      {[3, 5, 7].map(rounds => (
                        <button
                          key={rounds}
                          onClick={() => setLocalSettings(s => ({ ...s, rounds }))}
                          className={`flex-1 py-2 font-mono text-sm font-bold rounded-lg border-2 transition-colors ${
                            localSettings.rounds === rounds 
                              ? 'border-ink bg-ink text-bg' 
                              : 'border-ink/20 hover:border-ink/40'
                          }`}
                        >
                          {rounds}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-mono uppercase tracking-widest opacity-60 mb-2">
                      Turn Timer (Seconds)
                    </label>
                    <div className="flex gap-2">
                      {[15, 30, 60].map(timer => (
                        <button
                          key={timer}
                          onClick={() => setLocalSettings(s => ({ ...s, turnTimer: timer }))}
                          className={`flex-1 py-2 font-mono text-sm font-bold rounded-lg border-2 transition-colors ${
                            localSettings.turnTimer === timer 
                              ? 'border-ink bg-ink text-bg' 
                              : 'border-ink/20 hover:border-ink/40'
                          }`}
                        >
                          {timer}s
                        </button>
                      ))}
                    </div>
                  </div>

                  <button
                    onClick={updateSettings}
                    className="w-full py-3 bg-ink text-bg font-bold uppercase tracking-widest rounded-xl hover:bg-ink/90 transition-colors"
                  >
                    Save Settings
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {(gameState.status === 'bidding' || gameState.status === 'playing' || gameState.status === 'trickEnd') && (
          <div className="flex-1 relative flex flex-col p-1 sm:p-4 overflow-hidden min-h-0">
            {/* Table Layout */}
            <div className="flex-1 relative max-w-5xl w-full mx-auto flex flex-col min-h-0">
              
              <div className="flex-1 relative min-h-0">
                {/* Top Player */}
                {orderedPlayers[2] && (
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 z-10">
                    {renderPlayerAvatar(orderedPlayers[2], 'top')}
                  </div>
                )}

                {/* Left Player */}
                {orderedPlayers[1] && (
                  <div className="absolute left-2 top-1/2 -translate-y-1/2 z-10">
                    {renderPlayerAvatar(orderedPlayers[1], 'left')}
                  </div>
                )}

                {/* Right Player */}
                {orderedPlayers[3] && (
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 z-10">
                    {renderPlayerAvatar(orderedPlayers[3], 'right')}
                  </div>
                )}

                {/* Center Trick Area */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="relative w-32 h-32 sm:w-48 sm:h-48 md:w-64 md:h-64">
                    <AnimatePresence>
                      {gameState.currentTrick.map((play, i) => {
                        const playerIdx = orderedPlayers.findIndex(p => p.uid === play.playerUid);
                        let transform = '';
                        const offset = window.innerWidth < 640 ? 10 : 20;
                        const sideOffset = window.innerWidth < 640 ? 30 : 60;

                        if (playerIdx === 0) transform = `translateY(${offset}px)`; // Bottom
                        if (playerIdx === 1) transform = `translateX(-${sideOffset}px) rotate(-15deg)`; // Left
                        if (playerIdx === 2) transform = `translateY(-${offset}px)`; // Top
                        if (playerIdx === 3) transform = `translateX(${sideOffset}px) rotate(15deg)`; // Right

                        const winnerIdx = gameState.lastTrickWinnerId ? orderedPlayers.findIndex(p => p.uid === gameState.lastTrickWinnerId) : -1;
                        let exitX = 0;
                        let exitY = 0;
                        if (winnerIdx === 0) exitY = 400;
                        if (winnerIdx === 1) exitX = -400;
                        if (winnerIdx === 2) exitY = -400;
                        if (winnerIdx === 3) exitX = 400;

                        return (
                          <motion.div
                            key={play.card.id}
                            initial={{ opacity: 0, scale: 0.5, y: 100 }}
                            animate={{ opacity: 1, scale: 1, transform }}
                            exit={{ 
                              opacity: 0, 
                              scale: 0.2, 
                              x: exitX, 
                              y: exitY,
                              transition: { duration: 0.5, ease: "easeIn" }
                            }}
                            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
                          >
                            <div className="w-14 h-20 sm:w-20 sm:h-28 md:w-24 md:h-36">
                              {renderCard(play.card, undefined, true, true)}
                            </div>
                          </motion.div>
                        );
                      })}
                    </AnimatePresence>
                  </div>
                </div>
              </div>
            </div>

              {/* Bottom Area - Player Info and Hand */}
              <div className="mt-auto pt-1 sm:pt-2 flex flex-col items-center gap-1 sm:gap-4 shrink-0">
                {/* My Info Bar & Timer */}
                <div className="flex items-center gap-2 sm:gap-4 bg-ink/5 backdrop-blur-sm px-3 py-1 sm:px-6 sm:py-2 rounded-full border border-ink/10 shadow-lg relative">
                  {/* Avatar */}
                  {orderedPlayers[0] && (
                    <div className="scale-[0.6] sm:scale-90 origin-left relative z-10">
                      {renderPlayerAvatar(orderedPlayers[0], 'bottom')}
                    </div>
                  )}

                  {/* Timer Progress Bar Background */}
                  {isMyTurn && !me?.isAway && (
                    <div className="absolute inset-0 opacity-10 pointer-events-none overflow-hidden rounded-full">
                      <motion.div 
                        initial={{ scaleX: 1 }}
                        animate={{ scaleX: 0 }}
                        transition={{ duration: timeLeft, ease: "linear" }}
                        className={cn(
                          "h-full w-full origin-left",
                          timeLeft < 5 ? "bg-red-500" : "bg-orange-500"
                        )}
                      />
                    </div>
                  )}

                  <div className="flex flex-col items-center relative z-10">
                    <span className="text-[7px] sm:text-[10px] font-mono uppercase tracking-widest opacity-60">Call</span>
                    <span className="text-sm sm:text-xl font-black text-orange-500">{me?.call || '?'}</span>
                  </div>
                  <div className="w-px h-4 sm:h-8 bg-ink/10 relative z-10" />
                  <div className="flex flex-col items-center relative z-10">
                    <span className="text-[7px] sm:text-[10px] font-mono uppercase tracking-widest opacity-60">Won</span>
                    <span className="text-sm sm:text-xl font-black text-green-500">{me?.tricksWon}</span>
                  </div>
                  {isMyTurn && !me?.isAway && (
                    <>
                      <div className="w-px h-4 sm:h-8 bg-ink/10 relative z-10" />
                      <div className="flex flex-col items-center min-w-[30px] sm:min-w-[40px] relative z-10">
                        <span className="text-[7px] sm:text-[10px] font-mono uppercase tracking-widest opacity-60">Time</span>
                        <div className="flex items-center gap-1 sm:gap-1.5">
                          <div className="w-8 sm:w-12 h-1 sm:h-1.5 bg-ink/10 rounded-full overflow-hidden">
                            <motion.div 
                              initial={{ width: "100%" }}
                              animate={{ width: `${(timeLeft / (gameState.config.turnTimer || 30)) * 100}%` }}
                              className={cn(
                                "h-full transition-all duration-1000 ease-linear",
                                timeLeft < 5 ? "bg-red-500" : "bg-orange-500"
                              )}
                            />
                          </div>
                          <span className={cn(
                            "text-[10px] sm:text-xs font-black font-mono",
                            timeLeft < 5 ? "text-red-500 animate-pulse" : "text-ink"
                          )}>{timeLeft.toFixed(1)}s</span>
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {/* Control Buttons */}
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => setShowCommMenu(true)}
                    className="flex items-center gap-1.5 sm:gap-2 px-3 py-1.5 sm:px-4 sm:py-2 bg-ink/5 hover:bg-ink/10 rounded-xl border border-ink/10 transition-all active:scale-95 group"
                  >
                    <MessageSquare size={14} className="group-hover:text-orange-500 transition-colors sm:w-4 sm:h-4" />
                    <span className="text-[8px] sm:text-[10px] font-mono font-bold uppercase tracking-widest">Comm</span>
                  </button>
                  <button 
                    onClick={() => setShowScoreboard(true)}
                    className="flex items-center gap-1.5 sm:gap-2 px-3 py-1.5 sm:px-4 sm:py-2 bg-ink/5 hover:bg-ink/10 rounded-xl border border-ink/10 transition-all active:scale-95 group"
                  >
                    <Trophy size={14} className="group-hover:text-yellow-500 transition-colors sm:w-4 sm:h-4" />
                    <span className="text-[8px] sm:text-[10px] font-mono font-bold uppercase tracking-widest">Score</span>
                  </button>
                </div>

                {/* Player Hand */}
                <div className="w-full max-w-4xl px-2 pb-1 sm:pb-4 relative">
                  {/* Discard Button */}
                  <AnimatePresence>
                    {isMyTurn && selectedCardId && (
                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 20 }}
                        className="absolute -top-10 sm:-top-16 left-1/2 -translate-x-1/2 z-50"
                      >
                        <button
                          onClick={playCard}
                          className="px-6 py-2 sm:px-8 sm:py-3 bg-blue-500 text-white text-sm sm:text-base font-black uppercase tracking-widest rounded-full shadow-xl hover:bg-blue-600 hover:scale-105 active:scale-95 transition-all"
                        >
                          Discard
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div className="w-full overflow-x-auto no-scrollbar">
                    <div className="flex justify-center min-w-max px-4 mt-4 sm:mt-6">
                      {me?.hand.map((card, i) => {
                        const isValid = isValidPlayCB(card, me.hand, gameState.leadSuit, gameState.currentTrick);
                        const disabled = gameState.status !== 'playing' || !isMyTurn || !isValid;
                        const isInvalid = gameState.status === 'playing' && isMyTurn && !isValid;
                        const isSelected = selectedCardId === card.id;

                        return (
                          <motion.div
                            key={card.id}
                            initial={{ y: 50, opacity: 0 }}
                            animate={{ 
                              y: isSelected ? -15 : 0, 
                              opacity: 1 
                            }}
                            transition={{ delay: i * 0.05 }}
                            className="relative group"
                            style={{
                              zIndex: isSelected ? 50 : i,
                              marginLeft: i > 0 ? (window.innerWidth < 640 ? '-1.5rem' : '-3.5rem') : 0
                            }}
                          >
                            <div className={`w-12 h-18 sm:w-24 sm:h-36 md:w-28 md:h-40 transition-transform ${isSelected ? 'scale-110 shadow-2xl' : ''}`}>
                              {renderCard(
                                card, 
                                disabled ? undefined : () => handleCardClick(card.id), 
                                disabled,
                                window.innerWidth < 640,
                                isInvalid
                              )}
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </div>
        )}

        {/* Bidding Overlay - Clear and Visible Background */}
        {gameState.status === 'bidding' && isMyTurn && me?.call === 0 && (
          <div className="absolute inset-0 bg-bg/5 backdrop-blur-[0.5px] flex items-start pt-20 sm:items-center sm:pt-0 justify-center z-[60] p-4 pointer-events-none">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              className="bg-bg/90 backdrop-blur-md p-3 sm:p-4 rounded-xl border border-line/10 shadow-2xl max-w-[240px] sm:max-w-[280px] w-full pointer-events-auto"
            >
              <div className="text-center mb-3">
                <h3 className="text-base sm:text-lg font-black uppercase tracking-tighter">Place Your Bid</h3>
                <p className="text-[9px] sm:text-[10px] opacity-50 font-mono">How many tricks will you win?</p>
              </div>
              
              <div className="grid grid-cols-4 gap-1.5">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13].map((num) => (
                  <button
                    key={num}
                    onClick={() => {
                      if (socket) socket.emit('cb_makeCall', { roomId, call: num });
                    }}
                    className="h-8 sm:h-10 hardware-card flex items-center justify-center text-xs sm:text-sm font-bold hover:bg-orange-500 hover:text-white transition-all active:scale-95"
                  >
                    {num}
                  </button>
                ))}
              </div>
            </motion.div>
          </div>
        )}

        {/* Round End Overlay */}
        {gameState.status === 'roundEnd' && (
          <div className="absolute inset-0 bg-bg/90 backdrop-blur-md flex items-center justify-center z-[70] p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="hardware-card p-4 sm:p-10 max-w-3xl w-full max-h-[90vh] flex flex-col space-y-8 relative"
            >
              <div className="absolute top-4 right-4 flex items-center gap-2">
                <div className="w-10 h-10 rounded-full border-2 border-ink/10 flex items-center justify-center relative">
                  <div className="absolute inset-0 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
                  <span className="text-xs font-black font-mono">{Math.ceil(recapTimeLeft)}</span>
                </div>
              </div>

              <div className="text-center space-y-2">
                <h2 className="text-3xl sm:text-5xl font-display font-black uppercase tracking-tight">Round {gameState.currentRound} Recap</h2>
                <p className="font-mono text-[10px] opacity-50 uppercase tracking-[0.4em]">Session Performance Analysis</p>
              </div>
              
              <div className="flex-1 overflow-auto no-scrollbar border-2 border-ink/5 rounded-2xl bg-ink/[0.02]">
                <table className="w-full text-left border-collapse min-w-[500px] font-mono text-xs">
                  <thead>
                    <tr className="border-b-2 border-ink/10 bg-ink/5">
                      <th className="p-4 sticky left-0 bg-bg/95 z-10 border-r border-ink/10 uppercase tracking-widest opacity-40">Round</th>
                      {gameState.players.map(p => (
                        <th key={p.uid} className="p-4 text-center">
                          <div className="flex flex-col items-center gap-2">
                            <div className="w-10 h-10 rounded-full bg-bg border-2 border-ink/10 flex items-center justify-center overflow-hidden shadow-sm">
                              {p.isBot ? <Bot size={20} /> : <Users size={20} />}
                            </div>
                            <span className="font-black tracking-tighter truncate max-w-[80px]">{p.displayName.toUpperCase()}</span>
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from({ length: gameState.currentRound }).map((_, rIdx) => (
                      <tr key={rIdx} className="border-b border-ink/5 hover:bg-ink/[0.03] transition-colors">
                        <td className="p-4 font-black opacity-40 sticky left-0 bg-bg/95 z-10 border-r border-ink/10">R{rIdx + 1}</td>
                        {gameState.players.map(p => {
                          const score = p.roundScores[rIdx];
                          return (
                            <td key={p.uid} className="p-4 text-center">
                              <span className={cn(
                                "font-black text-base",
                                score < 0 ? "text-red-500" : "text-ink"
                              )}>
                                {score !== undefined ? (score > 0 ? `+${score.toFixed(1)}` : score.toFixed(1)) : '-'}
                              </span>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                    {/* Total Row */}
                    <tr className="bg-ink/5 font-black border-t-4 border-ink/10">
                      <td className="p-6 uppercase tracking-widest sticky left-0 bg-ink/5 z-10 border-r border-ink/10">TOTAL</td>
                      {gameState.players.map(p => (
                        <td key={p.uid} className="p-6 text-center text-2xl text-orange-500 font-display italic">
                          {p.totalScore.toFixed(1)}
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>

              {isHost ? (
                <button
                  onClick={nextRound}
                  className="w-full py-5 bg-ink text-bg font-black uppercase tracking-[0.2em] rounded-xl hover:bg-ink/90 transition-all shadow-xl active:translate-y-1 flex items-center justify-center gap-3"
                >
                  <RefreshCw size={20} />
                  {gameState.currentRound >= gameState.config.rounds ? 'Final Standings' : 'Initialize Next Round'}
                </button>
              ) : (
                <div className="p-5 bg-ink/5 rounded-xl text-center border border-dashed border-ink/20">
                  <p className="font-mono text-sm uppercase tracking-widest opacity-60 animate-pulse">
                    Waiting for Operator to proceed...
                  </p>
                </div>
              )}
            </motion.div>
          </div>
        )}

        {/* Game End Overlay */}
        {gameState.status === 'ended' && (
          <div className="absolute inset-0 bg-bg/95 backdrop-blur-xl flex items-center justify-center z-50 p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="text-center max-w-lg w-full"
            >
              <div className="w-24 h-24 mx-auto mb-8 bg-yellow-500/20 text-yellow-500 rounded-full flex items-center justify-center">
                <Trophy size={48} />
              </div>
              <h2 className="text-5xl font-display font-bold uppercase tracking-tight mb-4">Game Over</h2>
              
              <div className="hardware-card p-6 mb-8 text-left">
                <h3 className="font-mono text-sm uppercase tracking-widest opacity-60 mb-4">Final Standings</h3>
                <div className="space-y-3">
                  {[...gameState.players].sort((a, b) => b.totalScore - a.totalScore).map((p, i) => (
                    <div key={p.uid} className={`flex items-center justify-between p-4 rounded-xl border ${i === 0 ? 'border-yellow-500 bg-yellow-500/5' : 'border-ink/10'}`}>
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${i === 0 ? 'bg-yellow-500 text-white' : 'bg-ink/10'}`}>
                          {i + 1}
                        </div>
                        <span className="font-bold">{p.displayName} {p.uid === user.uid && '(You)'}</span>
                      </div>
                      <span className="font-display text-2xl font-bold">{p.totalScore}</span>
                    </div>
                  ))}
                </div>
              </div>

              <button
                onClick={onLeave}
                className="w-full py-4 bg-ink text-bg font-bold uppercase tracking-widest rounded-xl hover:bg-ink/90 transition-colors"
              >
                Back to Lobby
              </button>
            </motion.div>
          </div>
        )}
      </main>
    </div>
  );
}
