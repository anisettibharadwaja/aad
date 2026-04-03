import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { User } from 'firebase/auth';
import { io, Socket } from 'socket.io-client';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Users, 
  ArrowLeft, 
  Settings, 
  MessageSquare, 
  Volume2, 
  VolumeX,
  Trophy,
  RotateCcw,
  SkipForward,
  PlusCircle,
  Palette,
  Copy,
  Check,
  UserPlus,
  Play,
  LogOut,
  Sun,
  Moon,
  Zap,
  Clock,
  Send,
  X,
  Crown,
  BookOpen,
  Plus,
  Minus
} from 'lucide-react';
import SoundControl from '../SoundControl';
import { UnoGame, UnoCard, UnoPlayer, UnoColor, UnoValue, Sound } from '../../types';
import { cn } from '../../lib/utils';
import { toast } from 'sonner';
import { playSound, setGlobalVolume } from '../../lib/sounds';

interface UnoGameBoardProps {
  user: User;
  roomId: string;
  isCreating: boolean;
  onLeave: () => void;
  isDark: boolean;
  toggleTheme: () => void;
  customSounds: Sound[];
}

const SOCKET_URL = window.location.origin;

const COLOR_MAP: Record<UnoColor, string> = {
  red: 'bg-red-600',
  blue: 'bg-blue-600',
  green: 'bg-green-600',
  yellow: 'bg-yellow-500',
  wild: 'bg-zinc-900'
};

const COLOR_BORDER_MAP: Record<UnoColor, string> = {
  red: 'border-red-400/50',
  blue: 'border-blue-400/50',
  green: 'border-green-400/50',
  yellow: 'border-yellow-300/50',
  wild: 'border-zinc-700/50'
};

const EMOJIS = [
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
  { char: '⭐', gif: 'https://fonts.gstatic.com/s/e/notoemoji/latest/2b50/512.gif' },
];

const SOUND_EFFECTS = [
  { id: 'lol', label: 'Laugh', icon: '😂' },
  { id: 'wow', label: 'Wow', icon: '😲' },
  { id: 'clap', label: 'Clap', icon: '👏' },
  { id: 'fahh', label: 'Fart', icon: '💩' },
  { id: 'tada', label: 'Tada', icon: '🎉' },
  { id: 'win', label: 'Win', icon: '🏆' },
  { id: 'lose', label: 'Lose', icon: '💀' },
  { id: 'bruh', label: 'Bruh', icon: '😜' },
  { id: 'vine_boom', label: 'Boom', icon: '💥' },
  { id: 'emotional_damage', label: 'Emotional', icon: '😭' },
];

const UnoCardComponent: React.FC<{ 
  card: UnoCard; 
  onClick?: () => void; 
  disabled?: boolean;
  className?: string;
  isSmall?: boolean;
  isBack?: boolean;
  isPlayable?: boolean;
  overrideColor?: UnoColor;
}> = ({ card, onClick, disabled, className, isSmall, isBack, isPlayable, overrideColor }) => {
  const getUnoValueLabel = (value: UnoValue) => {
    const iconSize = isSmall ? 12 : 28;
    switch (value) {
      case 'skip': return <SkipForward size={iconSize} strokeWidth={3} />;
      case 'reverse': return <RotateCcw size={iconSize} strokeWidth={3} />;
      case 'draw2': return <span className={cn("font-black", isSmall ? "text-[10px]" : "text-2xl")}>+2</span>;
      case 'draw4': return <span className={cn("font-black", isSmall ? "text-[10px]" : "text-2xl")}>+4</span>;
      case 'wild': return <Palette size={iconSize} strokeWidth={3} />;
      default: return <span className={cn("font-black tracking-tighter", isSmall ? "text-sm" : "text-5xl")}>{card.value}</span>;
    }
  };

  if (isBack) {
    return (
      <div className={cn(
        "relative rounded-xl border-4 border-ink bg-zinc-900 shadow-[6px_6px_0px_rgba(0,0,0,1)] flex items-center justify-center shrink-0 overflow-hidden",
        isSmall ? "w-10 h-14 border-2 shadow-[2px_2px_0px_rgba(0,0,0,1)]" : "w-24 h-36",
        className
      )}>
        <div className="absolute inset-0 opacity-20 bg-[repeating-linear-gradient(45deg,transparent,transparent_5px,rgba(255,255,255,0.1)_5px,rgba(255,255,255,0.1)_10px)]" />
        <div className="w-full h-full border-2 border-dashed border-white/10 rounded-lg flex items-center justify-center">
          <span className="text-red-600 font-black italic text-sm tracking-tighter z-10 rotate-[-45deg]">UNO</span>
        </div>
      </div>
    );
  }

  const displayColor = overrideColor || card.color;

  return (
    <motion.div
      whileHover={disabled ? {} : { y: -24, scale: 1.1, rotate: -2 }}
      whileTap={disabled ? {} : { scale: 0.95 }}
      layoutId={card.id}
      onClick={disabled ? undefined : onClick}
      className={cn(
        "relative rounded-xl border-4 border-ink shadow-[6px_6px_0px_rgba(0,0,0,1)] flex items-center justify-center cursor-pointer transition-all shrink-0 overflow-hidden group",
        isSmall ? "w-10 h-14 border-2 shadow-[2px_2px_0px_rgba(0,0,0,1)]" : "w-24 h-36",
        COLOR_MAP[displayColor],
        disabled && !isPlayable && "opacity-60 grayscale-[0.4] cursor-not-allowed",
        isPlayable && "ring-8 ring-white/30 ring-offset-4 ring-offset-transparent",
        className
      )}
    >
      {/* Hardware Texture */}
      <div className="absolute inset-0 opacity-10 bg-[repeating-linear-gradient(0deg,transparent,transparent_2px,rgba(0,0,0,0.1)_2px,rgba(0,0,0,0.1)_4px)]" />
      <div className="absolute inset-2 border-2 border-dashed border-white/20 rounded-lg pointer-events-none" />
      
      {/* Corner Values */}
      <div className="absolute top-2 left-2 text-white font-black text-[10px] italic leading-none opacity-60">
        {card.value === 'wild' || card.value === 'draw4' ? '' : card.value.toUpperCase()}
      </div>
      
      <div className="text-white drop-shadow-[4px_4px_0px_rgba(0,0,0,0.4)] z-10 flex flex-col items-center justify-center">
        {getUnoValueLabel(card.value)}
      </div>
      
      <div className="absolute bottom-2 right-2 text-white font-black text-[10px] italic leading-none rotate-180 opacity-60">
        {card.value === 'wild' || card.value === 'draw4' ? '' : card.value.toUpperCase()}
      </div>

      {/* Glossy Overlay */}
      <div className="absolute inset-0 bg-gradient-to-tr from-white/10 to-transparent pointer-events-none" />
    </motion.div>
  );
};

export default function GameBoard({
  user,
  roomId,
  isCreating,
  onLeave,
  isDark,
  toggleTheme,
  customSounds
}: UnoGameBoardProps) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [game, setGame] = useState<UnoGame | null>(null);
  const [showColorPicker, setShowColorPicker] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showCommMenu, setShowCommMenu] = useState(false);
  const [commTab, setCommTab] = useState<'emojis' | 'sounds'>('emojis');
  const [activeEmojis, setActiveEmojis] = useState<Record<string, { emoji: string; timestamp: number }>>({});
  const [activeSounds, setActiveSounds] = useState<Record<string, { soundId: string; timestamp: number }>>({});
  const [showRules, setShowRules] = useState(false);
  const [timeLeft, setTimeLeft] = useState(30);
  const [activeEffect, setActiveEffect] = useState<{ type: string; timestamp: number } | null>(null);
  const prevTopCardId = useRef<string | null>(null);

  useEffect(() => {
    if (!game || game.status !== 'playing') return;
    const topCard = game.discardPile[game.discardPile.length - 1];
    
    if (topCard && topCard.id !== prevTopCardId.current) {
      prevTopCardId.current = topCard.id;
      
      // Trigger power card effects
      if (['skip', 'reverse', 'draw2', 'draw4'].includes(topCard.value)) {
        setActiveEffect({ type: topCard.value, timestamp: Date.now() });
        setTimeout(() => setActiveEffect(null), 2000);
      }
    }
  }, [game?.discardPile]);

  useEffect(() => {
    const newSocket = io(SOCKET_URL);
    setSocket(newSocket);

    newSocket.on("connect", () => {
      newSocket.emit("uno_joinRoom", { roomId, user: { uid: user.uid, displayName: user.displayName, photoURL: user.photoURL }, isCreating });
    });

    newSocket.on("uno_gameUpdate", (updatedGame: UnoGame) => {
      // Play sounds based on changes
      if (game) {
        const prevTurn = game.turnIndex;
        const newTurn = updatedGame.turnIndex;
        const prevDiscardCount = game.discardPile.length;
        const newDiscardCount = updatedGame.discardPile.length;
        const prevHandCount = game.players.find(p => p.uid === user.uid)?.unoHand.length || 0;
        const newHandCount = updatedGame.players.find(p => p.uid === user.uid)?.unoHand.length || 0;

        if (newDiscardCount > prevDiscardCount) {
          playSound('discard');
        } else if (newHandCount > prevHandCount) {
          playSound('draw');
        } else if (newTurn !== prevTurn) {
          playSound('turn');
        }

        // Check for UNO calls
        updatedGame.players.forEach(p => {
          const prevPlayer = game.players.find(oldP => oldP.uid === p.uid);
          if (p.hasSaidUno && !prevPlayer?.hasSaidUno) {
            playSound('call');
          }
        });

        // Check for game end
        if (updatedGame.status === 'ended' && game.status !== 'ended') {
          if (updatedGame.winnerId === user.uid) {
            playSound('win');
          } else {
            playSound('lose');
          }
        }
      }
      setGame(updatedGame);
    });

    newSocket.on("uno_reaction", ({ uid, emoji }) => {
      setActiveEmojis(prev => ({
        ...prev,
        [uid]: { emoji, timestamp: Date.now() }
      }));
      
      // Auto-remove emoji after 3 seconds
      setTimeout(() => {
        setActiveEmojis(prev => {
          const newState = { ...prev };
          if (newState[uid]?.timestamp && Date.now() - newState[uid].timestamp >= 2900) {
            delete newState[uid];
          }
          return newState;
        });
      }, 3000);
    });

    newSocket.on("uno_sound", ({ uid, soundId }) => {
      playSound(soundId);
      setActiveSounds(prev => ({
        ...prev,
        [uid]: { soundId, timestamp: Date.now() }
      }));
      setTimeout(() => {
        setActiveSounds(prev => {
          const newState = { ...prev };
          if (newState[uid]?.timestamp && Date.now() - newState[uid].timestamp >= 1900) {
            delete newState[uid];
          }
          return newState;
        });
      }, 2000);
    });

    newSocket.on("error", (msg: string) => {
      toast.error(msg);
    });

    return () => {
      newSocket.disconnect();
    };
  }, [roomId, user, isCreating]);

  // Timer logic
  useEffect(() => {
    if (!game || game.status !== 'playing') return;

    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - game.turnStartedAt) / 1000);
      const remaining = Math.max(0, game.config.turnTimer - elapsed);
      setTimeLeft(remaining);
    }, 1000);

    return () => clearInterval(interval);
  }, [game?.turnStartedAt, game?.status]);

  const handleStartGame = () => {
    socket?.emit("uno_startGame", { roomId });
  };

  const handlePlayCard = (cardId: string, chosenColor?: UnoColor) => {
    socket?.emit("uno_playCard", { roomId, cardId, chosenColor });
  };

  const handleDrawCard = () => {
    socket?.emit("uno_drawCard", { roomId });
  };

  const handleSayUno = () => {
    socket?.emit("uno_sayUno", { roomId });
  };

  const handleSendReaction = (emoji: string) => {
    socket?.emit("uno_sendReaction", { roomId, emoji });
    setShowCommMenu(false);
  };

  const handleSendSound = (soundId: string) => {
    socket?.emit("uno_sendSound", { roomId, soundId });
    playSound(soundId as any);
    setShowCommMenu(false);
  };

  const handleAddBot = () => {
    socket?.emit("uno_addBot", { roomId });
  };

  const handleLeaveRoom = () => {
    socket?.emit("uno_leaveRoom", { roomId, user: { uid: user.uid, displayName: user.displayName } });
    onLeave();
  };

  const copyRoomId = () => {
    navigator.clipboard.writeText(roomId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success("Room ID copied!");
  };

  const me = useMemo(() => game?.players.find(p => p.uid === user.uid), [game?.players, user.uid]);
  const isMyTurn = useMemo(() => game?.status === 'playing' && game.players[game.turnIndex]?.uid === user.uid, [game?.status, game?.players, game?.turnIndex, user.uid]);

  const otherPlayers = useMemo(() => {
    if (!game) return [];
    const myIndex = game.players.findIndex(p => p.uid === user.uid);
    if (myIndex === -1) return game.players;
    const others = [];
    for (let i = 1; i < game.players.length; i++) {
      others.push(game.players[(myIndex + i) % game.players.length]);
    }
    return others;
  }, [game, user.uid]);

  const topCard = game?.discardPile[game.discardPile.length - 1];

  const handleCardClick = (card: UnoCard) => {
    if (!isMyTurn) return;

    const isPlayable = card.color === 'wild' || card.color === game?.currentColor || card.value === game?.currentValue;
    if (!isPlayable) {
      toast.error("You can't play this card!");
      return;
    }

    if (card.color === 'wild') {
      setShowColorPicker(card.id);
    } else {
      handlePlayCard(card.id);
    }
  };

  const handleColorSelect = (color: UnoColor) => {
    if (showColorPicker) {
      handlePlayCard(showColorPicker, color);
      setShowColorPicker(null);
    }
  };

  if (!game) {
    return (
      <div className="min-h-screen bg-bg text-ink flex flex-col items-center justify-center p-8 font-sans">
        <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-10">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-red-600 rounded-full blur-[120px]" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-600 rounded-full blur-[120px]" />
        </div>
        
        <div className="relative z-10 text-center space-y-8 max-w-md w-full">
          <div className="space-y-4">
            <div className="w-24 h-24 bg-ink/5 rounded-3xl flex items-center justify-center mx-auto border-2 border-ink/10 relative overflow-hidden group">
              <div className="absolute inset-0 bg-red-600/20 animate-pulse" />
              <div className="w-12 h-12 border-4 border-red-600 border-t-transparent rounded-full animate-spin relative z-10" />
            </div>
            <h2 className="text-4xl font-black italic tracking-tighter text-red-600 uppercase">INITIALIZING</h2>
            <p className="text-xs font-mono opacity-50 uppercase tracking-[0.3em]">Connecting to Arcade Grid...</p>
          </div>

          <div className="hardware-card p-6 space-y-4 border-ink/10">
            <div className="flex items-center justify-between text-[10px] font-mono opacity-40 uppercase tracking-widest">
              <span>Status</span>
              <span className="text-green-500">Active</span>
            </div>
            <div className="h-1.5 w-full bg-ink/5 rounded-full overflow-hidden">
              <motion.div 
                initial={{ width: "0%" }}
                animate={{ width: "100%" }}
                transition={{ duration: 2, repeat: Infinity }}
                className="h-full bg-red-600"
              />
            </div>
            <p className="text-[10px] font-mono opacity-30 uppercase">Syncing game state with central command</p>
          </div>

          <button 
            onClick={onLeave}
            className="w-full py-4 text-xs font-bold uppercase tracking-widest opacity-40 hover:opacity-100 hover:text-red-500 transition-all"
          >
            Cancel & Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (game.status === 'waiting') {
    return (
      <div className="min-h-screen bg-bg text-ink flex flex-col font-sans relative overflow-hidden">
        {/* Background Grid */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]" />

        <header className="relative z-10 p-6 flex items-center justify-between border-b border-ink/10 bg-bg/40 backdrop-blur-md">
          <div className="flex items-center gap-4">
            <button onClick={handleLeaveRoom} className="p-2 hover:bg-ink/5 rounded-full transition-colors">
              <ArrowLeft size={20} />
            </button>
            <div>
              <h2 className="font-black italic text-red-600 tracking-tighter text-xl">UNO ARCADE</h2>
              <p className="text-[10px] opacity-40 font-mono uppercase tracking-[0.2em]">LOBBY // READY FOR DEPLOYMENT</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={toggleTheme}
              className="p-3 hover:bg-ink/5 rounded-2xl border border-ink/10 transition-colors"
            >
              {isDark ? <Sun size={20} /> : <Moon size={20} />}
            </button>
          </div>
        </header>

        <main className="flex-1 relative z-10 p-6 max-w-6xl mx-auto w-full grid grid-cols-1 lg:grid-cols-12 gap-8 items-start pt-12">
          {/* Left Column: Room Info */}
          <div className="lg:col-span-4 space-y-8">
            <div className="hardware-card p-8 space-y-8">
              <div className="space-y-2">
                <p className="text-[10px] font-black opacity-30 uppercase tracking-[0.3em]">Tactical ID</p>
                <div className="flex items-center justify-between bg-ink/5 p-4 rounded-2xl border border-ink/5 group">
                  <span className="font-mono font-bold text-lg tracking-widest">{roomId}</span>
                  <button 
                    onClick={copyRoomId}
                    className="p-2 hover:bg-ink/10 rounded-xl transition-all active:scale-90"
                  >
                    {copied ? <Check size={18} className="text-green-500" /> : <Copy size={18} className="opacity-40" />}
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                <p className="text-[10px] font-black opacity-30 uppercase tracking-[0.3em]">Deployment Status</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-ink/5 p-4 rounded-2xl border border-ink/5">
                    <p className="text-[10px] opacity-40 uppercase mb-1">Operators</p>
                    <p className="text-2xl font-black italic">{game.players.length}<span className="text-sm opacity-20 not-italic">/{game.config.maxPlayers}</span></p>
                  </div>
                  <div className="bg-ink/5 p-4 rounded-2xl border border-ink/5">
                    <p className="text-[10px] opacity-40 uppercase mb-1">Bots</p>
                    <p className="text-2xl font-black italic">{game.players.filter(p => p.isBot).length}</p>
                  </div>
                </div>
              </div>

              {game.hostId === user.uid ? (
                <div className="space-y-3 pt-4">
                  <button 
                    onClick={handleStartGame}
                    disabled={game.players.length < 2}
                    className="hardware-btn w-full py-5 text-xl bg-red-600 text-white hover:bg-red-500 disabled:opacity-30 disabled:grayscale"
                  >
                    START MISSION
                  </button>
                  <button 
                    onClick={handleAddBot}
                    disabled={game.players.length >= game.config.maxPlayers}
                    className="hardware-btn w-full py-4 text-sm bg-ink/5 border border-ink/10 hover:bg-ink/10"
                  >
                    ADD AI OPERATOR
                  </button>
                  {game.players.length < 2 && (
                    <p className="text-[10px] text-center font-mono opacity-40 uppercase animate-pulse">Minimum 2 operators required</p>
                  )}
                </div>
              ) : (
                <div className="pt-4 text-center space-y-4">
                  <div className="flex flex-col items-center gap-3 p-6 bg-ink/5 rounded-3xl border border-dashed border-ink/20">
                    <div className="w-8 h-8 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
                    <p className="text-xs font-bold uppercase tracking-widest">Waiting for Host...</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Players List */}
          <div className="lg:col-span-8 space-y-6">
            <div className="flex items-center justify-between px-2">
              <h3 className="font-black italic text-2xl tracking-tighter uppercase">OPERATORS IN LOBBY</h3>
              <div className="h-px flex-1 mx-6 bg-ink/10" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <AnimatePresence mode="popLayout">
                {game.players.map((player, idx) => (
                  <motion.div
                    key={player.uid}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ delay: idx * 0.1 }}
                    className="hardware-card p-4 flex items-center justify-between group hover:border-red-500/30 transition-all"
                  >
                    <div className="flex items-center gap-4">
                      <div className="relative">
                        <div className="w-14 h-14 rounded-2xl bg-ink/5 flex items-center justify-center border-2 border-ink/10 overflow-hidden">
                          {player.photoURL ? (
                            <img src={player.photoURL} alt={player.displayName} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          ) : (
                            <span className="text-xl font-bold">{player.displayName[0]}</span>
                          )}
                        </div>
                        {game.hostId === player.uid && (
                          <div className="absolute -top-2 -left-2 bg-red-600 text-white p-1 rounded-lg shadow-lg">
                            <Crown size={12} />
                          </div>
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-bold uppercase tracking-tight">{player.displayName}</p>
                          {player.uid === user.uid && (
                            <span className="text-[8px] font-mono bg-ink text-bg px-1.5 py-0.5 rounded uppercase">YOU</span>
                          )}
                        </div>
                        <p className="text-[10px] font-mono opacity-40 uppercase tracking-widest">
                          {player.isBot ? "AI_OPERATOR_v1.0" : "HUMAN_OPERATOR"}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <div className="flex flex-col items-end">
                        <div className="flex items-center gap-1.5">
                          <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                          <span className="text-[10px] font-black uppercase tracking-widest">READY</span>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
              
              {/* Empty Slots */}
              {Array.from({ length: Math.max(0, 4 - game.players.length) }).map((_, i) => (
                <div key={`empty-${i}`} className="border-2 border-dashed border-ink/5 rounded-3xl p-4 flex items-center gap-4 opacity-20">
                  <div className="w-14 h-14 rounded-2xl bg-ink/5 border-2 border-ink/10" />
                  <div className="space-y-2">
                    <div className="h-3 w-24 bg-ink/10 rounded" />
                    <div className="h-2 w-16 bg-ink/10 rounded" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </main>

        <footer className="relative z-10 p-8 border-t border-ink/5 bg-bg/40 backdrop-blur-md mt-auto">
          <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-6">
              <div className="flex -space-x-3">
                {game.players.slice(0, 5).map((p) => (
                  <div key={p.uid} className="w-10 h-10 rounded-full border-4 border-bg bg-ink/10 overflow-hidden">
                    {p.photoURL ? <img src={p.photoURL} className="w-full h-full object-cover" referrerPolicy="no-referrer" /> : <div className="w-full h-full flex items-center justify-center font-bold text-xs">{p.displayName[0]}</div>}
                  </div>
                ))}
              </div>
              <p className="text-xs font-medium opacity-60">
                {game.players.length} operators connected to the grid
              </p>
            </div>
            <p className="text-[10px] font-mono opacity-20 uppercase tracking-[0.5em]">Arcade OS v2.4.0 // UNO_MODULE</p>
          </div>
        </footer>
      </div>
    );
  }

  return (
    <div className="h-screen h-[100dvh] bg-bg text-ink overflow-hidden flex flex-col relative font-sans">
      {/* Background Effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-20">
        <div className={cn("absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full blur-[120px] transition-colors duration-1000", COLOR_MAP[game.currentColor])} />
        <div className={cn("absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full blur-[120px] transition-colors duration-1000", COLOR_MAP[game.currentColor])} />
      </div>

      {/* Header: Back, Room ID, Theme Toggle */}
      <header className="relative z-50 p-3 md:p-6 flex items-center justify-between border-b border-ink/5 bg-bg/40 backdrop-blur-md shrink-0">
        <div className="flex items-center gap-3 md:gap-4">
          <button 
            onClick={handleLeaveRoom} 
            className="hardware-card p-2 hover:bg-red-600 hover:text-white transition-all border-2 border-ink shadow-[4px_4px_0px_rgba(0,0,0,1)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
            title="Leave Game"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h2 className="font-black italic text-red-600 tracking-tighter text-lg leading-none">UNO ARCADE</h2>
            <p className="text-[10px] opacity-40 font-mono uppercase tracking-[0.2em]">MISSION // {game.status.toUpperCase()}</p>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="hidden sm:flex flex-col items-end">
            <p className="text-[9px] opacity-40 font-mono uppercase tracking-[0.3em]">Arcade Grid ID</p>
            <div className="flex items-center gap-2">
              <p className="text-xs font-bold font-mono tracking-widest">{roomId}</p>
              <button 
                onClick={copyRoomId}
                className="p-1 hover:bg-ink/5 rounded transition-all active:scale-90"
              >
                {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} className="opacity-40" />}
              </button>
            </div>
          </div>
          
          <div className="h-8 w-px bg-ink/10 hidden sm:block" />

          <div className="flex items-center gap-4">
            <SoundControl />
            <button 
              onClick={toggleTheme}
              className="p-2 hover:bg-ink/5 rounded-xl border-2 border-ink shadow-[4px_4px_0px_rgba(0,0,0,1)] transition-all active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
            >
              {isDark ? <Sun size={20} /> : <Moon size={20} />}
            </button>
          </div>
        </div>
      </header>

      {/* Main Game Area */}
      <main className="flex-1 relative flex flex-col items-center justify-between p-2 md:p-4 overflow-hidden min-h-0">
        {/* Power Card Effects Overlay - Subtle trail splash */}
        <AnimatePresence>
          {activeEffect && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-[100] flex items-center justify-center pointer-events-none"
            >
              <div className="relative w-full h-full flex items-center justify-center">
                {/* Trail Splash Effect */}
                <motion.div 
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: [1, 2], opacity: [0.4, 0] }}
                  transition={{ duration: 1.5, ease: "easeOut" }}
                  className={cn(
                    "absolute w-[600px] h-[600px] rounded-full blur-[120px]",
                    activeEffect.type === 'skip' ? "bg-red-500" : 
                    activeEffect.type === 'reverse' ? "bg-blue-500" : 
                    activeEffect.type === 'draw2' ? "bg-green-500" : 
                    "bg-yellow-500"
                  )}
                />
                
                <motion.div
                  initial={{ y: 50, opacity: 0, scale: 0.8 }}
                  animate={{ y: 0, opacity: 1, scale: 1 }}
                  exit={{ y: -50, opacity: 0, scale: 1.2 }}
                  className="bg-ink/90 text-bg px-12 py-6 rounded-[40px] border-4 border-ink shadow-[20px_20px_0px_rgba(0,0,0,0.5)] flex flex-col items-center gap-4 z-10"
                >
                  <div className="flex items-center gap-6">
                    <div className="p-4 bg-bg rounded-2xl border-2 border-ink/20">
                      {activeEffect.type === 'skip' && <SkipForward size={64} className="text-red-500" />}
                      {activeEffect.type === 'reverse' && <RotateCcw size={64} className="text-blue-500" />}
                      {activeEffect.type === 'draw2' && <PlusCircle size={64} className="text-green-500" />}
                      {activeEffect.type === 'draw4' && <Zap size={64} className="text-yellow-500" />}
                    </div>
                    <div className="text-left">
                      <h2 className="text-6xl font-black italic tracking-tighter uppercase leading-none">
                        {activeEffect.type === 'draw2' ? '+2' : 
                         activeEffect.type === 'draw4' ? '+4' : 
                         activeEffect.type}
                      </h2>
                      <p className="text-xs font-mono opacity-40 uppercase tracking-[0.3em] mt-2">Tactical Effect Active</p>
                    </div>
                  </div>
                </motion.div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Other Players - Now in normal flow to avoid overlap */}
        <div className="w-full flex justify-center gap-2 sm:gap-12 px-2 sm:px-4 flex-wrap z-10 pt-1 sm:pt-2">
          {otherPlayers.map((player) => {
            const isTurn = game.players[game.turnIndex].uid === player.uid;
            const reaction = activeEmojis[player.uid];
            
            return (
              <div key={player.uid} className="flex flex-col items-center gap-1 sm:gap-2 relative">
                <AnimatePresence>
                  {reaction && (
                    <motion.div 
                      key={`${player.uid}-${reaction.timestamp}`}
                      initial={{ scale: 0, y: 0, opacity: 0 }}
                      animate={{ scale: 1.2, y: -60, opacity: 1 }}
                      exit={{ scale: 0, opacity: 0 }}
                      className="absolute z-[100] pointer-events-none"
                    >
                      <img src={reaction.emoji} alt="reaction" className="w-12 h-12 sm:w-16 sm:h-16 drop-shadow-2xl object-contain" />
                    </motion.div>
                  )}
                </AnimatePresence>

                <AnimatePresence>
                  {activeSounds[player.uid] && (
                    <motion.div 
                      initial={{ scale: 0, x: 20, opacity: 0 }}
                      animate={{ scale: 1, x: 30, opacity: 1 }}
                      exit={{ scale: 0, opacity: 0 }}
                      className="absolute z-50 pointer-events-none bg-blue-500 p-1.5 rounded-full border-2 border-ink shadow-lg"
                    >
                      <Volume2 size={12} className="text-white animate-bounce" />
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className={cn(
                  "relative p-1 rounded-lg sm:p-1.5 sm:rounded-xl transition-all duration-500 hardware-card border-2",
                  isTurn ? "border-red-500 scale-105 shadow-[0_0_15px_rgba(239,68,68,0.3)] bg-red-500/5" : "border-ink/10 opacity-60"
                )}>
                  <div className="w-10 h-10 sm:w-16 sm:h-16 rounded-lg bg-ink/5 flex items-center justify-center border-2 border-ink/10 overflow-hidden relative">
                    {player.photoURL ? (
                      <img src={player.photoURL} alt={player.displayName} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <span className="text-lg sm:text-xl font-black italic">{player.displayName[0]}</span>
                    )}
                    {isTurn && (
                      <div className="absolute inset-0 border-2 border-red-500/30 rounded-lg animate-pulse" />
                    )}
                  </div>
                  
                  {/* Card Count Badge */}
                  <div className="absolute -bottom-1 -right-1 bg-red-600 text-white text-[7px] sm:text-[8px] font-black px-1.5 py-0.5 rounded-md border-2 border-ink shadow-lg flex items-center gap-1">
                    <Copy size={6} className="sm:w-2 sm:h-2" />
                    {player.unoHand.length}
                  </div>

                  {player.hasSaidUno && (
                    <motion.div 
                      initial={{ scale: 0, rotate: -10 }}
                      animate={{ scale: 1, rotate: 0 }}
                      className="absolute -top-2 -right-2 bg-yellow-500 text-black text-[8px] font-black px-2 py-1 rounded-lg border-2 border-ink shadow-xl z-20 italic"
                    >
                      UNO!
                    </motion.div>
                  )}
                </div>
                <div className="text-center">
                  <p className="text-[9px] font-black uppercase tracking-widest max-w-[80px] truncate">{player.displayName}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Direction Indicator */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden">
          <motion.div 
            animate={{ rotate: game.direction === 1 ? 360 : -360 }}
            transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
            className="w-[120vh] h-[120vh] border-[1px] border-dashed border-ink/5 rounded-full flex items-center justify-center"
          >
            <div className="w-[80vh] h-[80vh] border-[1px] border-dashed border-ink/5 rounded-full" />
            <div className="w-[40vh] h-[40vh] border-[1px] border-dashed border-ink/5 rounded-full" />
          </motion.div>
        </div>

        {/* Center: Discard Pile & Draw Pile - Wrapped in flex-1 to take available space */}
        <div className="flex-1 flex flex-row items-center justify-center gap-8 sm:gap-24 relative z-10">
          {/* Pending Draw Count Indicator */}
          {game.pendingDrawCount > 0 && (
            <motion.div 
              initial={{ scale: 0, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="absolute -top-16 left-1/2 -translate-x-1/2 bg-red-600 text-white px-4 py-2 rounded-xl border-2 border-ink shadow-xl z-30 flex items-center gap-2"
            >
              <PlusCircle size={20} />
              <span className="text-xl font-black italic">+{game.pendingDrawCount}</span>
              <span className="text-[10px] font-mono uppercase tracking-widest ml-2">STACKED</span>
            </motion.div>
          )}

          {/* Draw Pile */}
          <div className="relative group">
            <div className="absolute -inset-1 bg-ink/10 rounded-xl blur-sm group-hover:bg-red-600/20 transition-all" />
            <div 
              onClick={isMyTurn ? handleDrawCard : undefined}
              className={cn(
                "relative w-16 h-24 sm:w-24 sm:h-36 rounded-lg border-2 border-ink bg-zinc-900 flex items-center justify-center cursor-pointer transition-all active:scale-95 shadow-[4px_4px_0px_rgba(0,0,0,0.3)] overflow-hidden",
                isMyTurn ? "hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_rgba(0,0,0,0.4)]" : "opacity-40 cursor-not-allowed grayscale"
              )}
            >
              {/* Stack Effect */}
              <div className="absolute top-1 left-1 w-full h-full bg-zinc-800 border border-white/10 rounded-lg -z-10 translate-x-1 translate-y-1" />
              
              <div className="w-full h-full border-2 border-dashed border-white/10 rounded-lg flex items-center justify-center">
                <span className="text-red-600 font-black italic text-sm sm:text-xl tracking-tighter rotate-[-45deg]">UNO</span>
              </div>
            </div>
            <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-[7px] font-mono opacity-40 uppercase tracking-[0.3em] whitespace-nowrap">DECK_STACK</div>
          </div>

          {/* Discard Pile */}
          <div className="relative w-16 h-24 sm:w-24 sm:h-36 group">
            <div className="absolute -inset-1 bg-ink/10 rounded-xl blur-sm group-hover:bg-ink/20 transition-all" />
            <AnimatePresence mode="popLayout">
              {topCard && (
                <UnoCardComponent 
                  key={topCard.id}
                  card={topCard} 
                  className="absolute inset-0 shadow-xl"
                  disabled
                  isSmall={window.innerWidth < 640}
                  overrideColor={topCard.color === 'wild' ? game.currentColor : undefined}
                />
              )}
            </AnimatePresence>
            
            {/* Current Color Indicator */}
            <motion.div 
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
              className={cn(
                "absolute -top-10 left-1/2 -translate-x-1/2 px-3 py-1 rounded-lg text-[8px] sm:text-[10px] font-black border-2 shadow-lg whitespace-nowrap transition-all duration-500 z-20 uppercase tracking-widest",
                COLOR_MAP[game.currentColor],
                "border-ink text-white"
              )}
            >
              {game.currentColor}
            </motion.div>
            
            <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-[7px] font-mono opacity-40 uppercase tracking-[0.3em] whitespace-nowrap">DISCARD_PILE</div>
          </div>
        </div>
      </main>

      {/* Player Hand & Controls */}
      <footer className="relative z-30 p-2 md:p-4 shrink-0 bg-bg/80 backdrop-blur-md border-t border-ink/5">
        <div className="max-w-6xl mx-auto space-y-2 md:space-y-4">
          {/* Timer Bar - Moved here */}
          <div className="relative w-full h-2 md:h-3 bg-ink/10 rounded-full overflow-hidden border-2 border-ink shadow-[inset_0_2px_4px_rgba(0,0,0,0.1)]">
            <motion.div 
              initial={false}
              animate={{ width: `${(timeLeft / game.config.turnTimer) * 100}%` }}
              className={cn(
                "h-full transition-colors",
                timeLeft < 10 ? "bg-red-500" : "bg-orange-500"
              )}
            />
            {timeLeft < 10 && (
              <div className="absolute inset-0 bg-red-500/20 animate-pulse pointer-events-none" />
            )}
          </div>

          <div className="flex flex-col items-center gap-2 md:gap-6">
            {/* Info Boxes & Buttons Row */}
            <div className="flex flex-wrap items-center justify-center gap-2 md:gap-6">
              {/* Hand Value Box */}
              <div className="hardware-card bg-bg p-2 md:p-4 min-w-[80px] md:min-w-[140px] shadow-[4px_4px_0px_rgba(0,0,0,1)] md:shadow-[6px_6px_0px_rgba(0,0,0,1)] border-2 border-ink">
                <p className="text-[7px] md:text-[11px] font-black uppercase opacity-40 tracking-[0.2em] mb-0.5 md:mb-1">CARDS</p>
                <p className="text-xl md:text-3xl font-black text-orange-500 leading-none">{me?.unoHand.length || 0}</p>
              </div>
              
              {/* Player Profile Box (Replaces Total Score) */}
              <div className="hardware-card bg-bg p-2 md:p-4 min-w-[120px] md:min-w-[180px] shadow-[4px_4px_0px_rgba(0,0,0,1)] md:shadow-[6px_6px_0px_rgba(0,0,0,1)] border-2 border-ink flex items-center gap-2 md:gap-3 relative">
                <AnimatePresence>
                  {activeEmojis[user.uid] && (
                    <motion.div 
                      key={`me-${activeEmojis[user.uid].timestamp}`}
                      initial={{ scale: 0, y: 0, opacity: 0 }}
                      animate={{ scale: 1.2, y: -80, opacity: 1 }}
                      exit={{ scale: 0, opacity: 0 }}
                      className="absolute left-1/2 -translate-x-1/2 z-[100] pointer-events-none"
                    >
                      <img src={activeEmojis[user.uid].emoji} alt="reaction" className="w-16 h-16 drop-shadow-2xl object-contain" />
                    </motion.div>
                  )}
                </AnimatePresence>

                <AnimatePresence>
                  {activeSounds[user.uid] && (
                    <motion.div 
                      initial={{ scale: 0, x: 20, opacity: 0 }}
                      animate={{ scale: 1, x: 30, opacity: 1 }}
                      exit={{ scale: 0, opacity: 0 }}
                      className="absolute right-0 top-0 z-50 pointer-events-none bg-blue-500 p-1.5 rounded-full border-2 border-ink shadow-lg"
                    >
                      <Volume2 size={12} className="text-white animate-bounce" />
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="w-8 h-8 md:w-12 md:h-12 rounded-lg md:rounded-xl bg-ink/5 border-2 border-ink/10 overflow-hidden shrink-0">
                  {me?.photoURL ? (
                    <img src={me.photoURL} alt="Me" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center font-black text-sm md:text-lg italic">{me?.displayName[0]}</div>
                  )}
                </div>
                <div className="text-left overflow-hidden">
                  <p className="text-[7px] md:text-[11px] font-black uppercase opacity-40 tracking-[0.2em] mb-0.5">OPERATOR</p>
                  <p className="text-xs md:text-base font-black truncate uppercase tracking-tight">{me?.displayName}</p>
                </div>
              </div>

              {/* Comm Box */}
              <button 
                onClick={() => setShowCommMenu(!showCommMenu)}
                className={cn(
                  "hardware-card bg-bg p-2 md:p-4 min-w-[80px] md:min-w-[140px] shadow-[4px_4px_0px_rgba(0,0,0,1)] md:shadow-[6px_6px_0px_rgba(0,0,0,1)] border-2 border-ink transition-all active:translate-x-[2px] active:translate-y-[2px] active:shadow-none",
                  showCommMenu ? "bg-orange-500/10 border-orange-500" : "hover:bg-ink/5"
                )}
              >
                <p className="text-[7px] md:text-[11px] font-black uppercase opacity-40 tracking-[0.2em] mb-0.5 md:mb-1">COMM</p>
                <div className="flex justify-center">
                  <MessageSquare size={18} className="text-orange-500 md:w-6 md:h-6" />
                </div>
              </button>

              {/* UNO Button - Moved beside Comm */}
              <button 
                onClick={handleSayUno}
                disabled={!me || me.unoHand.length > 2 || me.hasSaidUno}
                className={cn(
                  "hardware-btn h-12 md:h-20 px-6 md:px-12 text-lg md:text-2xl font-black italic tracking-tighter transition-all rounded-xl md:rounded-2xl flex items-center justify-center shadow-[4px_4px_0px_rgba(0,0,0,1)] md:shadow-[6px_6px_0px_rgba(0,0,0,1)] border-2 md:border-4 border-ink active:translate-x-[3px] active:translate-y-[3px] active:shadow-none",
                  me?.hasSaidUno 
                    ? "bg-green-600/20 border-green-500/30 text-green-500 cursor-not-allowed opacity-100" 
                    : "bg-red-600 hover:bg-red-500 text-white"
                )}
              >
                UNO!
              </button>

              {/* Rules Button */}
              <button 
                onClick={() => setShowRules(true)}
                className="hardware-card bg-bg p-2 md:p-4 min-w-[80px] md:min-w-[140px] shadow-[4px_4px_0px_rgba(0,0,0,1)] md:shadow-[6px_6px_0px_rgba(0,0,0,1)] border-2 border-ink hover:bg-ink/5 transition-all active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
              >
                <p className="text-[7px] md:text-[11px] font-black uppercase opacity-40 tracking-[0.2em] mb-0.5 md:mb-1">RULES</p>
                <div className="flex justify-center">
                  <BookOpen size={18} className="text-blue-500 md:w-6 md:h-6" />
                </div>
              </button>
            </div>

            <div className="text-center">
              <p className={cn(
                "text-[9px] md:text-[11px] font-black uppercase tracking-[0.5em] mb-1 md:mb-2",
                isMyTurn ? "text-red-600" : "opacity-40"
              )}>
                {isMyTurn ? "YOUR TURN // ACTION REQUIRED" : "STANDBY // WAITING FOR TURN"}
              </p>
            </div>
          </div>

          {/* Cards Container - Improved accessibility with better overflow handling */}
          <div className="relative group hardware-card bg-ink/5 border-2 md:border-4 border-ink/10 rounded-[20px] md:rounded-[40px] p-2 md:p-8 min-h-[140px] md:min-h-[240px] flex items-center overflow-hidden shadow-2xl">
            <div className="flex justify-start sm:justify-center gap-2 md:gap-8 pb-2 pt-1 md:pb-4 md:pt-2 overflow-x-auto no-scrollbar px-2 md:px-8 items-center w-full scroll-smooth">
              {me?.unoHand.map((card, idx) => {
                let isPlayable = false;
                if (isMyTurn) {
                  if (game.pendingDrawCount > 0) {
                    if (game.currentValue === 'draw2') {
                      isPlayable = card.value === 'draw2' || card.value === 'draw4';
                    } else if (game.currentValue === 'draw4') {
                      isPlayable = card.value === 'draw4';
                    }
                  } else {
                    isPlayable = card.color === 'wild' || card.color === game.currentColor || card.value === game.currentValue;
                  }
                }
                return (
                  <UnoCardComponent 
                    key={card.id} 
                    card={card} 
                    onClick={() => handleCardClick(card)}
                    disabled={!isMyTurn}
                    isPlayable={isPlayable}
                    isSmall={window.innerWidth < 640}
                    className={cn(
                      "transition-all duration-300 hover:-translate-y-6 hover:scale-110",
                      !isPlayable && isMyTurn && "opacity-80 grayscale-[0.5]",
                      !isMyTurn && "opacity-60 grayscale"
                    )}
                  />
                );
              })}
            </div>
            
            {/* Hand Scroll Indicators */}
            <div className="absolute left-0 top-0 bottom-0 w-12 sm:w-24 bg-gradient-to-r from-bg/60 to-transparent pointer-events-none z-10" />
            <div className="absolute right-0 top-0 bottom-0 w-12 sm:w-24 bg-gradient-to-l from-bg/60 to-transparent pointer-events-none z-10" />
          </div>
        </div>
      </footer>

      {/* Communication Menu */}
      <AnimatePresence>
        {showCommMenu && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowCommMenu(false)}
              className="fixed inset-0 z-[60]"
            />
            <motion.div 
              initial={{ x: 100, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 100, opacity: 0 }}
              className="fixed bottom-24 right-4 sm:bottom-32 sm:right-8 z-[70] hardware-card p-4 sm:p-8 w-[90vw] max-w-[400px] space-y-4 sm:space-y-8 shadow-[8px_8px_0px_rgba(0,0,0,1)] sm:shadow-[12px_12px_0px_rgba(0,0,0,1)] border-2 sm:border-4 border-ink rounded-[20px] sm:rounded-[40px] bg-bg/95"
            >
              <div className="flex items-center justify-between">
                <div className="flex bg-ink/5 p-1 rounded-xl sm:p-1.5 sm:rounded-2xl border-2 border-ink shadow-[4px_4px_0px_rgba(0,0,0,0.1)]">
                  <button 
                    onClick={() => setCommTab('emojis')}
                    className={cn(
                      "px-3 py-1.5 sm:px-6 sm:py-2 rounded-lg sm:rounded-xl text-[8px] sm:text-[10px] font-black uppercase tracking-widest transition-all",
                      commTab === 'emojis' ? "bg-bg text-orange-500 shadow-lg border-2 border-ink/10" : "opacity-40 hover:opacity-100"
                    )}
                  >
                    EMOJIS
                  </button>
                  <button 
                    onClick={() => setCommTab('sounds')}
                    className={cn(
                      "px-3 py-1.5 sm:px-6 sm:py-2 rounded-lg sm:rounded-xl text-[8px] sm:text-[10px] font-black uppercase tracking-widest transition-all",
                      commTab === 'sounds' ? "bg-bg text-orange-500 shadow-lg border-2 border-ink/10" : "opacity-40 hover:opacity-100"
                    )}
                  >
                    SOUNDS
                  </button>
                </div>
                <button 
                  onClick={() => setShowCommMenu(false)} 
                  className="p-1.5 sm:p-2 hover:bg-ink/5 rounded-lg sm:rounded-xl transition-all active:scale-90"
                >
                  <X size={18} className="sm:w-5 sm:h-5" />
                </button>
              </div>
              
              <div className="min-h-[200px] sm:min-h-[320px] max-h-[40vh] overflow-y-auto no-scrollbar">
                {commTab === 'emojis' ? (
                  <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 sm:gap-4">
                    {EMOJIS.map((emoji) => (
                      <button
                        key={emoji.char}
                        onClick={() => handleSendReaction(emoji.gif)}
                        className="w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center hover:bg-ink/5 rounded-xl sm:rounded-2xl transition-all hover:scale-125 active:scale-90 text-2xl"
                      >
                        <img src={emoji.gif} alt={emoji.char} className="w-full h-full object-contain" />
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2 sm:gap-4">
                    {SOUND_EFFECTS.map((sound) => (
                      <button
                        key={sound.id}
                        onClick={() => handleSendSound(sound.id)}
                        className="flex items-center gap-2 sm:gap-3 p-2 sm:p-4 bg-ink/5 hover:bg-orange-500/10 border-2 border-ink/5 hover:border-orange-500/30 rounded-xl sm:rounded-2xl transition-all group"
                      >
                        <span className="text-xl sm:text-2xl group-hover:scale-125 transition-transform">{sound.icon}</span>
                        <span className="text-[8px] sm:text-[10px] font-black uppercase tracking-widest opacity-60 group-hover:opacity-100">{sound.label}</span>
                      </button>
                    ))}
                    {customSounds.map((sound) => (
                      <button
                        key={sound.id}
                        onClick={() => handleSendSound(sound.id)}
                        className="flex items-center gap-2 sm:gap-3 p-2 sm:p-4 bg-ink/5 hover:bg-orange-500/10 border-2 border-ink/5 hover:border-orange-500/30 rounded-xl sm:rounded-2xl transition-all group"
                      >
                        <span className="text-xl sm:text-2xl group-hover:scale-125 transition-transform">{sound.icon}</span>
                        <span className="text-[8px] sm:text-[10px] font-black uppercase tracking-widest opacity-60 group-hover:opacity-100">{sound.label}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              
              <p className="text-[9px] font-mono opacity-30 text-center uppercase tracking-[0.2em]">Broadcast to all operators</p>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Color Picker Modal */}
      <AnimatePresence>
        {showColorPicker && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-bg/90 backdrop-blur-md p-4"
          >
            <div className="hardware-card p-8 max-w-sm w-full space-y-8 shadow-2xl border-ink/20">
              <div className="text-center space-y-2">
                <div className="w-12 h-12 bg-ink text-bg rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Palette size={24} />
                </div>
                <h3 className="text-3xl font-black italic tracking-tighter uppercase">CHOOSE COLOR</h3>
                <p className="text-xs font-mono opacity-50 uppercase tracking-widest">Select the next tactical color</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {(['red', 'blue', 'green', 'yellow'] as UnoColor[]).map((color) => (
                  <button
                    key={color}
                    onClick={() => handleColorSelect(color)}
                    className={cn(
                      "h-24 rounded-2xl border-4 border-white/20 transition-all hover:scale-105 active:scale-95 shadow-xl",
                      COLOR_MAP[color]
                    )}
                  />
                ))}
              </div>
              <button 
                onClick={() => setShowColorPicker(null)}
                className="w-full py-4 text-xs font-bold uppercase tracking-widest opacity-40 hover:opacity-100 transition-all"
              >
                Cancel Selection
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Game End Modal */}
      <AnimatePresence>
        {game.status === 'ended' && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-bg/95 backdrop-blur-xl p-4"
          >
            <div className="hardware-card p-12 max-w-lg w-full space-y-12 text-center relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-red-600 animate-pulse" />
              
              <div className="space-y-4">
                <div className="w-24 h-24 bg-ink/5 rounded-full flex items-center justify-center mx-auto border-4 border-ink/10 relative">
                  <Trophy size={48} className="text-yellow-500" />
                  <div className="absolute -bottom-2 bg-ink text-bg px-4 py-1 text-[10px] font-black uppercase tracking-widest rounded-full">
                    MISSION END
                  </div>
                </div>
                <h2 className="text-5xl font-black italic tracking-tighter uppercase">
                  {game.winnerId === user.uid ? "VICTORY ACHIEVED" : "MISSION FAILED"}
                </h2>
                <p className="text-xs font-mono opacity-50 uppercase tracking-[0.3em]">
                  OPERATOR {game.players.find(p => p.uid === game.winnerId)?.displayName.toUpperCase()} HAS CLEARED ALL ASSETS
                </p>
              </div>

              <div className="space-y-4">
                <h4 className="text-[10px] font-black opacity-30 uppercase tracking-[0.4em]">Final Debriefing</h4>
                <div className="space-y-2 max-h-[30vh] overflow-y-auto pr-2 no-scrollbar">
                  {game.players.sort((a, b) => a.unoHand.length - b.unoHand.length).map((player, idx) => (
                    <div key={player.uid} className="flex items-center justify-between p-4 bg-ink/5 border border-ink/5 rounded-2xl">
                      <div className="flex items-center gap-4">
                        <span className="text-ink/20 font-mono text-xs">#{idx + 1}</span>
                        <span className="font-bold uppercase text-sm tracking-tight">{player.displayName}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold">{player.unoHand.length}</span>
                        <span className="text-[8px] font-mono opacity-40 uppercase">Assets Remaining</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <button 
                onClick={handleLeaveRoom}
                className="hardware-btn w-full py-5 text-xl bg-ink text-bg hover:bg-ink/90"
              >
                RETURN TO CENTRAL COMMAND
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Rules Modal */}
      <AnimatePresence>
        {showRules && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-bg/90 backdrop-blur-md p-4"
          >
            <div className="hardware-card p-8 max-w-2xl w-full space-y-8 shadow-[20px_20px_0px_rgba(0,0,0,1)] border-4 border-ink rounded-[40px] relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-2 bg-blue-600" />
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-blue-600 text-white rounded-2xl flex items-center justify-center border-2 border-ink shadow-lg">
                    <BookOpen size={24} />
                  </div>
                  <div>
                    <h3 className="text-3xl font-black italic tracking-tighter uppercase">TACTICAL RULES</h3>
                    <p className="text-[10px] font-mono opacity-40 uppercase tracking-widest">Uno Arcade Operation Manual</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowRules(false)}
                  className="p-2 hover:bg-ink/5 rounded-xl border-2 border-ink/10 transition-all active:scale-90"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="space-y-6 max-h-[50vh] overflow-y-auto pr-4 no-scrollbar">
                <section className="space-y-3">
                  <h4 className="text-sm font-black uppercase tracking-widest text-blue-600">Objective</h4>
                  <p className="text-sm opacity-70 leading-relaxed">
                    Be the first operator to clear all tactical assets (cards) from your hand. When you have only one asset remaining, you MUST broadcast "UNO!".
                  </p>
                </section>

                <section className="space-y-3">
                  <h4 className="text-sm font-black uppercase tracking-widest text-blue-600">Gameplay</h4>
                  <ul className="space-y-2 text-sm opacity-70">
                    <li className="flex gap-3">
                      <span className="text-blue-600 font-bold">•</span>
                      <span>Match the top card of the discard pile by color or value.</span>
                    </li>
                    <li className="flex gap-3">
                      <span className="text-blue-600 font-bold">•</span>
                      <span>Wild cards can be played on any card and allow you to change the current color.</span>
                    </li>
                    <li className="flex gap-3">
                      <span className="text-blue-600 font-bold">•</span>
                      <span>If you cannot play, you must draw a card from the deck.</span>
                    </li>
                  </ul>
                </section>

                <section className="space-y-3">
                  <h4 className="text-sm font-black uppercase tracking-widest text-blue-600">Power Cards</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-3 bg-ink/5 rounded-xl border border-ink/5">
                      <p className="font-bold text-xs uppercase mb-1 flex items-center gap-2">
                        <SkipForward size={14} className="text-red-500" /> Skip
                      </p>
                      <p className="text-[10px] opacity-60">The next operator loses their turn.</p>
                    </div>
                    <div className="p-3 bg-ink/5 rounded-xl border border-ink/5">
                      <p className="font-bold text-xs uppercase mb-1 flex items-center gap-2">
                        <RotateCcw size={14} className="text-blue-500" /> Reverse
                      </p>
                      <p className="text-[10px] opacity-60">Reverses the direction of play.</p>
                    </div>
                    <div className="p-3 bg-ink/5 rounded-xl border border-ink/5">
                      <p className="font-bold text-xs uppercase mb-1 flex items-center gap-2">
                        <PlusCircle size={14} className="text-green-500" /> Draw 2
                      </p>
                      <p className="text-[10px] opacity-60">Next operator draws 2 cards and skips turn.</p>
                    </div>
                    <div className="p-3 bg-ink/5 rounded-xl border border-ink/5">
                      <p className="font-bold text-xs uppercase mb-1 flex items-center gap-2">
                        <Zap size={14} className="text-yellow-500" /> Wild Draw 4
                      </p>
                      <p className="text-[10px] opacity-60">Change color + next operator draws 4 cards.</p>
                    </div>
                  </div>
                </section>
              </div>

              <button 
                onClick={() => setShowRules(false)}
                className="hardware-btn w-full py-4 bg-blue-600 text-white hover:bg-blue-500"
              >
                ACKNOWLEDGED
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
