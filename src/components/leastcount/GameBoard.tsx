import React, { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { motion, AnimatePresence } from 'motion/react';
import { Card, GameState, Player, CardRank, CardSuit, Sound } from '../../types';
import { User } from 'firebase/auth';
import { REACTION_SOUNDS } from '../../constants';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { ArrowLeft, Send, Users, Info, Settings, Bot, Play, RefreshCw, MessageSquare, X, ChevronRight, ChevronLeft, Trophy, Volume2, VolumeX, Sun, Moon, Plus, Minus } from 'lucide-react';
import SoundControl from '../SoundControl';
import { cn } from '../../lib/utils';
import { playSound } from '../../lib/sounds';
import { toast } from 'sonner';

interface GameBoardProps {
  user: User;
  roomId: string;
  isCreating: boolean;
  onLeave: () => void;
  isDark: boolean;
  toggleTheme: () => void;
  customSounds?: Sound[];
}

export default function GameBoard({ user, roomId, isCreating, onLeave, isDark, toggleTheme, customSounds = [] }: GameBoardProps) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [game, setGame] = useState<GameState | null>(null);
  const gameRef = useRef<GameState | null>(null);

  useEffect(() => {
    gameRef.current = game;
  }, [game]);
  const [selectedCards, setSelectedCards] = useState<string[]>([]);
  const [logs, setLogs] = useState<string[]>([]);
  const [sortOrder, setSortOrder] = useState<'number' | 'suit' | 'duplication'>('number');
  const [showRules, setShowRules] = useState(false);

  const [showCommMenu, setShowCommMenu] = useState(false);
  const [commTab, setCommTab] = useState<'emojis' | 'sounds'>('emojis');
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
  const reactionSounds = REACTION_SOUNDS;

  const play = (sound: any) => {
    // Allow only turn sound, draw sound, and reaction sounds as requested by user
    const allowedSounds = ['turn', 'draw'];
    const isReaction = REACTION_SOUNDS.some(rs => rs.id === sound) || customSounds.some(cs => cs.id === sound);
    
    if (allowedSounds.includes(sound) || isReaction) {
      console.log(`Playing sound: ${sound}`);
      playSound(sound);
    }
  };

  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const newSocket = io();
    setSocket(newSocket);

    newSocket.on('connect', () => {
      setIsConnected(true);
      console.log(`[CLIENT_DEBUG] Socket connected/reconnected. Joining room ${roomId} as ${user.uid}`);
      newSocket.emit('joinRoom', { roomId, user: { uid: user.uid, displayName: user.displayName, photoURL: user.photoURL }, isCreating });
    });
    newSocket.on('disconnect', () => setIsConnected(false));

    newSocket.on('gameUpdate', async (updatedGame: GameState) => {
      const currentGame = gameRef.current;
      
      // Play sounds based on state changes
      if (updatedGame.status === 'showdown' && currentGame?.status === 'playing') {
        // play('declare');
      }
      
      if (updatedGame.turnIndex !== currentGame?.turnIndex) {
        const isMyTurnNow = updatedGame.players[updatedGame.turnIndex].uid === user.uid;
        if (isMyTurnNow) {
          // play('turn');
        }
      }
      
      // Update profile if game ended
      if (updatedGame.status === 'ended' && currentGame?.status !== 'ended') {
        const isWinner = updatedGame.winnerId === user.uid;
        // play(isWinner ? 'win' : 'lose');
      }

      setGame(updatedGame);
      setLogs(updatedGame.logs);
    });

    newSocket.on('emojiUpdate', ({ userId, emoji }: { userId: string; emoji: string }) => {
      const currentGame = gameRef.current;
      const playerUids = currentGame ? currentGame.players.map(p => p.uid) : [];
      const isMatch = playerUids.includes(userId);
      console.log(`[CLIENT_DEBUG] Received emojiUpdate for ${userId}: ${emoji}. Match in players: ${isMatch}. Players: ${JSON.stringify(playerUids)}`);
      
      setActiveEmojis(prev => ({
        ...prev,
        [userId]: { emoji, timestamp: Date.now() }
      }));
    });

    newSocket.on('reactionSoundUpdate', ({ userId, sound }: { userId: string; sound: any }) => {
      console.log(`[CLIENT_DEBUG] Received reactionSoundUpdate for ${userId}: ${sound}. Current players in gameRef:`, gameRef.current?.players.map(p => p.uid));
      play(sound);
      setActiveAudio(prev => ({
        ...prev,
        [userId]: Date.now()
      }));
    });

    newSocket.on('error', (err: { message: string }) => {
      console.error("Game error:", err.message);
      toast.error(err.message);
      // If the game is already in progress and we're not in it, go back to lobby
      localStorage.removeItem('least_count_room_id');
      onLeave();
    });

    return () => {
      newSocket.disconnect();
    };
  }, [roomId, user.uid]); // Only depend on roomId and user.uid

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

  const sendEmoji = (emoji: string) => {
    socket?.emit('sendEmoji', { emoji });
    setShowCommMenu(false);
  };

  const sendReactionSound = (sound: string) => {
    socket?.emit('sendReactionSound', { sound });
    setShowCommMenu(false);
    // Local play is handled by the socket listener for consistency
  };

  const scoreTableRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (game?.status === 'showdown' && scoreTableRef.current) {
      scoreTableRef.current.scrollLeft = scoreTableRef.current.scrollWidth;
    }
  }, [game?.status, game?.roundScores?.length]);

  const currentPlayer = game?.players.find(p => p.uid === user.uid);
  const myIndex = game?.players.findIndex(p => p.uid === user.uid) ?? -1;
  const isMyTurn = game?.status === 'playing' && game?.players[game?.turnIndex]?.uid === user.uid;

  // Turn feedback effect
  useEffect(() => {
    if (isMyTurn) {
      // play('turn');
      if ('vibrate' in navigator) {
        navigator.vibrate([100, 50, 100]);
      }
    }
  }, [isMyTurn]);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const orderedOpponents = game ? (
    myIndex !== -1 
      ? [...game.players.slice(myIndex + 1), ...game.players.slice(0, myIndex)]
      : game.players
  ).filter(p => p.uid !== user.uid) : [];

  // Distribute opponents for table placement
  const leftOpponents: Player[] = [];
  const topOpponents: Player[] = [];
  const rightOpponents: Player[] = [];

  if (game?.status !== 'waiting') {
    if (orderedOpponents.length === 1) {
      topOpponents.push(orderedOpponents[0]);
    } else if (orderedOpponents.length === 2) {
      // Triangle shape: Left and Right
      leftOpponents.push(orderedOpponents[0]);
      rightOpponents.push(orderedOpponents[1]);
    } else if (orderedOpponents.length === 3) {
      leftOpponents.push(orderedOpponents[0]);
      topOpponents.push(orderedOpponents[1]);
      rightOpponents.push(orderedOpponents[2]);
    } else if (orderedOpponents.length === 4) {
      leftOpponents.push(orderedOpponents[0]);
      topOpponents.push(orderedOpponents[1], orderedOpponents[2]);
      rightOpponents.push(orderedOpponents[3]);
    } else {
      // 5 or more: Distribute around
      const sideCount = Math.max(1, Math.floor(orderedOpponents.length / 3));
      leftOpponents.push(...orderedOpponents.slice(0, sideCount));
      topOpponents.push(...orderedOpponents.slice(sideCount, orderedOpponents.length - sideCount));
      rightOpponents.push(...orderedOpponents.slice(orderedOpponents.length - sideCount));
    }
  }
  
  const [timeLeft, setTimeLeft] = useState(game?.config.turnTimer || 30);
  const [showdownTimeLeft, setShowdownTimeLeft] = useState(10);
  const [lastLog, setLastLog] = useState<string | null>(null);

  useEffect(() => {
    if (logs.length > 0) {
      setLastLog(logs[logs.length - 1]);
      const timer = setTimeout(() => setLastLog(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [logs]);

  useEffect(() => {
    if (game?.status !== 'playing') return;
    
    const interval = setInterval(() => {
      const elapsed = (Date.now() - game.turnStartedAt) / 1000;
      const remaining = Math.max(0, game.config.turnTimer - elapsed);
      setTimeLeft(remaining);
    }, 100);

    return () => clearInterval(interval);
  }, [game?.turnStartedAt, game?.status, game?.config.turnTimer]);

  useEffect(() => {
    if (game?.status !== 'showdown') {
      setShowdownTimeLeft(10);
      return;
    }
    
    const interval = setInterval(() => {
      setShowdownTimeLeft(prev => Math.max(0, prev - 0.1));
    }, 100);

    return () => clearInterval(interval);
  }, [game?.status]);

  const copyRoomId = () => {
    navigator.clipboard.writeText(roomId);
    toast.success('Room ID copied to clipboard!');
  };

  const shareRoom = async () => {
    const shareData = {
      title: 'Least Count Game',
      text: `Join my Least Count game! Room ID: ${roomId}`,
      url: window.location.href
    };
    
    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (err) {
        console.error('Share failed:', err);
      }
    } else {
      copyRoomId();
    }
  };

  const handleSetAway = (isAway: boolean) => {
    socket.emit('setAway', { roomId, isAway });
  };

  if (!game) return <div className="flex items-center justify-center h-screen font-mono text-orange-500 animate-pulse">CONNECTING TO SESSION {roomId}...</div>;

  const needsToDraw = currentPlayer?.hasDiscarded;

  const getHandValue = (hand: Card[], wildRank: CardRank | null = null) => {
    return hand.reduce((total, card) => {
      if (card.rank === 'Joker' || card.rank === (wildRank || game?.wildRank)) return total;
      return total + card.value;
    }, 0);
  };

  const sortHand = (hand: Card[]) => {
    const jokers = hand.filter(c => c.rank === 'Joker' || c.rank === game?.wildRank);
    const others = hand.filter(c => c.rank !== 'Joker' && c.rank !== game?.wildRank);

    const rankOrder: CardRank[] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
    const suitOrder: CardSuit[] = ['spades', 'hearts', 'diamonds', 'clubs'];

    let sortedOthers = [...others];

    if (sortOrder === 'number') {
      sortedOthers.sort((a, b) => rankOrder.indexOf(a.rank) - rankOrder.indexOf(b.rank));
    } else if (sortOrder === 'suit') {
      sortedOthers.sort((a, b) => {
        if (a.suit !== b.suit) {
          return suitOrder.indexOf(a.suit!) - suitOrder.indexOf(b.suit!);
        }
        return rankOrder.indexOf(a.rank) - rankOrder.indexOf(b.rank);
      });
    } else if (sortOrder === 'duplication') {
      const counts: Record<string, number> = {};
      others.forEach(c => counts[c.rank] = (counts[c.rank] || 0) + 1);
      sortedOthers.sort((a, b) => {
        if (counts[a.rank] !== counts[b.rank]) {
          return counts[b.rank] - counts[a.rank];
        }
        return rankOrder.indexOf(a.rank) - rankOrder.indexOf(b.rank);
      });
    }

    return [...jokers, ...sortedOthers];
  };

  const handleDiscard = () => {
    if (!isMyTurn) return;
    if (needsToDraw) {
      toast.error("You have already discarded. Draw a card to end your turn.");
      return;
    }
    if (selectedCards.length === 0) {
      toast.error("Select cards to discard.");
      return;
    }
    // play('discard');
    socket?.emit('discard', { roomId, playerUid: user.uid, cardIds: selectedCards });
    setSelectedCards([]);
  };

  const handleDraw = (source: 'deck' | 'discard') => {
    if (!isMyTurn) return;
    if (!needsToDraw) {
      toast.error("You must discard before drawing.");
      return;
    }
    play('draw');
    socket?.emit('draw', { roomId, playerUid: user.uid, source });
  };

  const handleCall = () => {
    if (!isMyTurn) return;
    
    if (needsToDraw) {
      toast.error("You must draw a card to end your turn.");
      return;
    }
    
    if (currentPlayer?.hand && getHandValue(currentPlayer.hand) > (game?.config.callLimit || 0)) {
      toast.error(`Hand value (${getHandValue(currentPlayer.hand)}) is above limit (${game?.config.callLimit}).`);
      return;
    }

    // play('call');
    socket?.emit('call', { roomId, playerUid: user.uid });
  };

  const handleStart = () => {
    socket?.emit('startGame', { roomId });
  };

  const handleAddBot = () => {
    socket?.emit('addBot', { roomId, difficulty: 'Normal' });
  };

  const handleUpdateConfig = (newConfig: Partial<GameState['config']>) => {
    socket?.emit('updateConfig', { roomId, config: newConfig });
  };

  const handleNextRound = () => {
    socket?.emit('nextRound', { roomId });
  };

  const handleLeave = () => {
    socket?.emit('leaveRoom', { roomId, user: { uid: user.uid, displayName: user.displayName } });
    onLeave();
  };

  const renderOpponent = (player: Player) => {
    if (!game) return null;
    const isTurn = game.turnIndex === game.players.indexOf(player);
    
    if (activeEmojis[player.uid]) {
      console.log(`[CLIENT_DEBUG] Rendering emoji for player ${player.uid}:`, activeEmojis[player.uid]);
    }
    return (
      <div key={player.uid} className={cn(
        "flex flex-col items-center gap-1 transition-all duration-500 shrink-0",
        isTurn && "scale-105 md:scale-110"
      )}>
        <div 
          className={cn(
            "w-14 h-14 md:w-16 md:h-16 rounded-full flex items-center justify-center relative border-2",
            isTurn ? "border-orange-500 text-orange-500 shadow-[0_0_15px_rgba(249,115,22,0.4)]" : "border-line/10 text-ink",
            (player.totalScore >= game.config.eliminationLimit || player.isAway) && "opacity-30 grayscale"
          )}
        >
          <div className="absolute flex items-center justify-center overflow-hidden rounded-full inset-0">
            {player.isBot ? <Bot size={24} className="md:size-[28px]" /> : <Users size={24} className="md:size-[28px]" />}
            {player.isAway && (
              <div className="absolute inset-0 bg-red-500/60 flex items-center justify-center">
                <div className="text-[8px] md:text-[10px] font-black text-white uppercase tracking-tighter drop-shadow-md">AWAY</div>
              </div>
            )}
          </div>

          {/* Active Emoji */}
          <AnimatePresence mode="popLayout">
            {activeEmojis[player.uid] && (
              <motion.div
                key={`emoji-${player.uid}-${activeEmojis[player.uid].timestamp}`}
                initial={{ opacity: 0, scale: 0.5, y: 0 }}
                animate={{ opacity: 1, scale: 1.2, y: 40 }}
                exit={{ opacity: 0, scale: 0.5, y: 60 }}
                className="absolute -bottom-4 left-1/2 -translate-x-1/2 text-2xl z-50 pointer-events-none drop-shadow-lg"
              >
                {activeEmojis[player.uid].emoji.startsWith('http') ? (
                  <img src={activeEmojis[player.uid].emoji} alt="emoji" className="w-12 h-12 object-contain" referrerPolicy="no-referrer" />
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
                <Volume2 size={12} className="animate-pulse" />
              </motion.div>
            )}
          </AnimatePresence>

          <div className={cn(
            "absolute -top-2 -right-2 px-2 py-0.5 text-[9px] md:text-[11px] font-black rounded-full z-20 border-2 border-bg transition-all duration-300",
            isTurn 
              ? "bg-orange-500 text-white shadow-[0_0_10px_rgba(249,115,22,0.3)]" 
              : "bg-ink text-bg shadow-none"
          )}>
            {player.totalScore}
          </div>
        </div>
        
        <div className={cn(
          "text-[8px] md:text-[10px] uppercase font-bold truncate max-w-[56px] md:max-w-[80px] mt-2",
          isTurn ? "text-orange-500" : ""
        )}>
          {player.displayName || 'OPERATOR'}
        </div>
        
        {isTurn && !player.isAway && (
          <div className="w-12 md:w-16 h-1.5 bg-ink/10 rounded-full overflow-hidden mt-0.5">
            <div 
              className={cn(
                "h-full origin-left transition-transform duration-100",
                timeLeft < 5 ? "bg-red-500" : "bg-orange-500"
              )}
              style={{ transform: `scaleX(${timeLeft / game.config.turnTimer})` }} 
            />
          </div>
        )}
        
        <div className="text-[7px] md:text-[9px] font-mono opacity-50 mt-0.5">
          {player.hand.length} CARDS
        </div>
      </div>
    );
  };

  return (
    <div className="h-screen h-[100dvh] flex flex-col bg-bg text-ink font-mono overflow-hidden">
      {/* Header */}
      <header className="p-2 md:p-4 border-b border-line/10 flex justify-between items-center bg-bg/80 backdrop-blur-md z-20 shrink-0">
        <div className="flex items-center gap-2 md:gap-4">
          <button onClick={handleLeave} className="p-2 hover:bg-ink/10 rounded-full transition-colors">
            <ArrowLeft size={18} />
          </button>
          <div className="space-y-0.5">
            <div className="text-[8px] md:text-[10px] opacity-50 uppercase tracking-widest">
              SESSION {game.roundNumber > 0 && `// ROUND ${game.roundNumber}`}
            </div>
            <div className="flex items-center gap-2">
              <div className="text-sm md:text-xl font-bold tracking-[0.2em]">{roomId}</div>
              <div className="flex items-center gap-1">
                <button 
                  onClick={copyRoomId}
                  className="p-1 hover:bg-ink/10 rounded transition-colors"
                  title="Copy Room ID"
                >
                  <RefreshCw size={12} className="opacity-50" />
                </button>
                <button 
                  onClick={shareRoom}
                  className="p-1 hover:bg-ink/10 rounded transition-colors"
                  title="Share Room"
                >
                  <Send size={12} className="opacity-50" />
                </button>
              </div>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-4 md:gap-8">
          <div className="text-right hidden xs:block">
            <div className="text-[8px] md:text-[10px] opacity-50 uppercase tracking-widest">ROUND</div>
            <div className="text-sm md:text-xl font-bold">{game.roundNumber}</div>
          </div>
          <div className="flex gap-1 md:gap-2 items-center">
            <button 
              onClick={toggleTheme}
              className="p-2 hover:bg-ink/10 rounded-full transition-colors text-ink/60 hover:text-orange-500"
              title={isDark ? "Light Mode" : "Dark Mode"}
            >
              {isDark ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <SoundControl />
            <button 
              onClick={() => {
                setShowRules(!showRules);
              }}
              className={cn("p-2 rounded-full transition-colors", showRules ? "bg-orange-500 text-white" : "hover:bg-ink/10")}
              title="Session Config"
            >
              <Settings size={18} />
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 relative flex flex-col md:flex-row overflow-hidden min-h-0">
        {/* Left Side Opponents */}
        {leftOpponents.length > 0 && (
          <div className="hidden md:flex flex-col justify-center gap-4 p-4 border-r border-line/5 bg-ink/[0.02] z-10 min-w-[100px] overflow-y-auto no-scrollbar">
            {leftOpponents.map(renderOpponent)}
          </div>
        )}

        <div className="flex-1 relative flex flex-col overflow-y-auto overflow-x-hidden no-scrollbar">
          <AnimatePresence>
            {showRules && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="absolute inset-0 z-30 flex items-center justify-center p-4"
              >
                <div className="bg-bg/95 backdrop-blur-xl border border-line/20 p-6 md:p-8 rounded-2xl shadow-2xl max-w-lg w-full space-y-4 font-mono relative max-h-[90vh] overflow-y-auto">
                  <button onClick={() => setShowRules(false)} className="absolute top-4 right-4 p-1 hover:bg-ink/10 rounded">
                    <X size={20} />
                  </button>
                  <h3 className="text-xl font-bold text-orange-500 border-b border-line/10 pb-2 uppercase tracking-tighter">Host Protocol Override</h3>
                  <div className="grid grid-cols-2 gap-4 text-[10px] md:text-xs">
                    <div className="p-3 border border-line/10 rounded-lg bg-ink/5">
                      <div className="opacity-50 uppercase mb-1">Room Limit</div>
                      <div className="text-lg font-bold">{game.config.maxPlayers} <span className="text-[8px] opacity-30">OP_COUNT</span></div>
                    </div>
                    <div className="p-3 border border-line/10 rounded-lg bg-ink/5">
                      <div className="opacity-50 uppercase mb-1">Call Limit</div>
                      <div className="text-lg font-bold">{game.config.callLimit} <span className="text-[8px] opacity-30">THRESHOLD</span></div>
                    </div>
                    <div className="p-3 border border-line/10 rounded-lg bg-ink/5">
                      <div className="opacity-50 uppercase mb-1">Elimination</div>
                      <div className="text-lg font-bold">{game.config.eliminationLimit} <span className="text-[8px] opacity-30">TERMINATION</span></div>
                    </div>
                    <div className="p-3 border border-line/10 rounded-lg bg-ink/5">
                      <div className="opacity-50 uppercase mb-1">Penalty</div>
                      <div className="text-lg font-bold">{game.config.penaltyValue} <span className="text-[8px] opacity-30">PEN_VAL</span></div>
                    </div>
                    <div className="p-3 border border-line/10 rounded-lg bg-ink/5 col-span-2">
                      <div className="opacity-50 uppercase mb-1">Turn Timer</div>
                      <div className="text-lg font-bold">{game.config.turnTimer}s <span className="text-[8px] opacity-30">TIMEOUT_SEC</span></div>
                    </div>
                  </div>
                  <div className="text-[9px] opacity-30 text-center uppercase tracking-[0.2em] pt-2">
                    System V1.1.0 // Encryption: AES-256
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Top Opponents */}
          <div className="relative w-full flex justify-center gap-4 md:gap-8 px-2 overflow-x-auto no-scrollbar shrink-0 min-h-[80px] md:min-h-[120px] pt-2 md:pt-4">
            {/* On mobile, show all opponents at top if not enough space for sides */}
            <div className="flex md:hidden gap-4">
              {orderedOpponents.map(renderOpponent)}
            </div>
            {/* On desktop, show only top opponents */}
            <div className="hidden md:flex gap-8">
              {topOpponents.map(renderOpponent)}
            </div>
          </div>

          {/* Center Area (Deck & Discard) */}
          <div className={cn(
            "flex-1 flex flex-col items-center w-full min-h-[200px] overflow-y-auto no-scrollbar py-4",
            game.status === 'waiting' ? "justify-start" : "justify-center"
          )}>
            {game.status === 'waiting' ? (
              <div className="flex flex-col items-center gap-4 md:gap-8 w-full max-w-2xl px-4 pt-4 pb-24">
                <div className="text-center space-y-2 relative">
                  <div className="absolute -top-8 left-1/2 -translate-x-1/2 w-32 h-1 bg-orange-500/20 rounded-full overflow-hidden">
                    <div className="h-full bg-orange-500 animate-[shimmer_2s_infinite]" style={{ width: '30%' }} />
                  </div>
                  <h2 className="text-3xl md:text-5xl font-black italic uppercase tracking-tighter font-mono text-ink drop-shadow-[0_0_10px_rgba(0,0,0,0.05)]">
                    WAITING FOR <span className="text-orange-500">OPERATORS</span>
                  </h2>
                  <div className="flex flex-wrap items-center justify-center gap-2 md:gap-4 text-[8px] md:text-[10px] font-mono">
                    <span className="opacity-50">SESSION ID:</span>
                    <span className="text-orange-500 font-bold">{roomId}</span>
                    <span className="opacity-20 hidden sm:inline">|</span>
                    <span className="opacity-50">STATUS:</span>
                    <span className="text-green-500 font-bold animate-pulse">LISTENING</span>
                    <span className="opacity-20 hidden sm:inline">|</span>
                    <span className="opacity-50">READY:</span>
                    <span className="text-ink font-bold">{game.players.length}/{game.config.maxPlayers}</span>
                  </div>
                </div>

                {game.hostId === user.uid && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6 w-full hardware-card p-4 md:p-8 bg-bg/80 border-orange-500/20">
                    <div className="sm:col-span-2 border-b border-orange-500/30 pb-3 mb-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Settings size={16} className="text-orange-500 animate-spin-slow shrink-0" />
                        <span className="text-[10px] md:text-xs font-bold uppercase tracking-[0.2em] text-orange-500">HOST PROTOCOL OVERRIDE</span>
                      </div>
                      <div className="text-[8px] opacity-30 font-mono">ENCRYPTION: AES-256</div>
                    </div>
                    
                    <div className="space-y-2 group">
                      <div className="flex justify-between items-center">
                        <label className="text-[8px] md:text-[10px] opacity-50 uppercase tracking-widest group-hover:text-orange-500 transition-colors">ROOM LIMIT</label>
                        <span className="text-[8px] opacity-30 font-mono">OP_COUNT</span>
                      </div>
                      <div className="relative">
                        <input 
                          key={`maxPlayers-${game.config.maxPlayers}`}
                          type="number"
                          min="2"
                          max="15"
                          defaultValue={game.config.maxPlayers}
                          onBlur={(e) => handleUpdateConfig({ maxPlayers: parseInt(e.target.value) || 2 })}
                          className="w-full bg-bg/50 border border-line/10 p-2 md:p-3 text-xs md:text-sm font-mono outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500/20 transition-all"
                        />
                        <div className="absolute right-2 top-1/2 -translate-y-1/2 text-[8px] opacity-20 pointer-events-none">MAX: 15</div>
                      </div>
                    </div>

                    <div className="space-y-2 group">
                      <div className="flex justify-between items-center">
                        <label className="text-[8px] md:text-[10px] opacity-50 uppercase tracking-widest group-hover:text-orange-500 transition-colors">CALL LIMIT</label>
                        <span className="text-[8px] opacity-30 font-mono">THRESHOLD</span>
                      </div>
                      <div className="relative">
                        <input 
                          key={`callLimit-${game.config.callLimit}`}
                          type="number"
                          min="1"
                          max="30"
                          defaultValue={game.config.callLimit}
                          onBlur={(e) => handleUpdateConfig({ callLimit: parseInt(e.target.value) || 5 })}
                          className="w-full bg-bg/50 border border-line/10 p-2 md:p-3 text-xs md:text-sm font-mono outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500/20 transition-all"
                        />
                        <div className="absolute right-2 top-1/2 -translate-y-1/2 text-[8px] opacity-20 pointer-events-none">PTS</div>
                      </div>
                    </div>

                    <div className="space-y-2 group">
                      <div className="flex justify-between items-center">
                        <label className="text-[8px] md:text-[10px] opacity-50 uppercase tracking-widest group-hover:text-orange-500 transition-colors">ELIMINATION LIMIT</label>
                        <span className="text-[8px] opacity-30 font-mono">TERMINATION</span>
                      </div>
                      <div className="relative">
                        <input 
                          key={`eliminationLimit-${game.config.eliminationLimit}`}
                          type="number"
                          min="20"
                          max="500"
                          step="10"
                          defaultValue={game.config.eliminationLimit}
                          onBlur={(e) => handleUpdateConfig({ eliminationLimit: parseInt(e.target.value) || 100 })}
                          className="w-full bg-bg/50 border border-line/10 p-2 md:p-3 text-xs md:text-sm font-mono outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500/20 transition-all"
                        />
                        <div className="absolute right-2 top-1/2 -translate-y-1/2 text-[8px] opacity-20 pointer-events-none">TOTAL</div>
                      </div>
                    </div>

                    <div className="space-y-2 group">
                      <div className="flex justify-between items-center">
                        <label className="text-[8px] md:text-[10px] opacity-50 uppercase tracking-widest group-hover:text-orange-500 transition-colors">TURN TIMER</label>
                        <span className="text-[8px] opacity-30 font-mono">TIMEOUT_SEC</span>
                      </div>
                      <div className="relative">
                        <input 
                          key={`turnTimer-${game.config.turnTimer}`}
                          type="number"
                          min="5"
                          max="60"
                          defaultValue={game.config.turnTimer}
                          onBlur={(e) => handleUpdateConfig({ turnTimer: parseInt(e.target.value) || 15 })}
                          className="w-full bg-bg/50 border border-line/10 p-2 md:p-3 text-xs md:text-sm font-mono outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500/20 transition-all"
                        />
                        <div className="absolute right-2 top-1/2 -translate-y-1/2 text-[8px] opacity-20 pointer-events-none">SEC</div>
                      </div>
                    </div>

                    <div className="space-y-2 group">
                      <div className="flex justify-between items-center">
                        <label className="text-[8px] md:text-[10px] opacity-50 uppercase tracking-widest group-hover:text-orange-500 transition-colors">PENALTY VALUE</label>
                        <span className="text-[8px] opacity-30 font-mono">PEN_VAL</span>
                      </div>
                      <div className="relative">
                        <input 
                          key={`penaltyValue-${game.config.penaltyValue}`}
                          type="number"
                          min="10"
                          max="100"
                          step="5"
                          defaultValue={game.config.penaltyValue}
                          onBlur={(e) => handleUpdateConfig({ penaltyValue: parseInt(e.target.value) || 40 })}
                          className="w-full bg-bg/50 border border-line/10 p-2 md:p-3 text-xs md:text-sm font-mono outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500/20 transition-all"
                        />
                        <div className="absolute right-2 top-1/2 -translate-y-1/2 text-[8px] opacity-20 pointer-events-none">PTS</div>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                  {game.hostId === user.uid ? (
                    <>
                      <button onClick={handleStart} className="hardware-btn bg-green-600 border-green-700 flex items-center justify-center gap-2 px-6 py-3 md:px-8 md:py-4 text-sm md:text-lg">
                        <Play size={18} /> INITIATE SESSION
                      </button>
                      <button onClick={handleAddBot} className="hardware-btn flex items-center justify-center gap-2 px-6 py-3 md:px-8 md:py-4 text-sm md:text-lg">
                        <Bot size={18} /> DEPLOY AI AGENT
                      </button>
                    </>
                  ) : (
                    <div className="hardware-card p-4 text-center font-mono text-[10px] md:text-xs animate-pulse w-full">
                      WAITING FOR HOST TO INITIATE...
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-4 w-full">
                {/* Action Log - Simple Plain Text */}
                <div className="h-6 flex items-center justify-center">
                  <AnimatePresence mode="wait">
                    {lastLog && game.status === 'playing' && (
                      <motion.div
                        key={lastLog}
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -5 }}
                        className="text-[10px] md:text-xs font-mono text-orange-500/80 uppercase tracking-widest italic"
                      >
                        {lastLog}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <div className="flex gap-4 md:gap-8 items-center">
                  {/* Joker Card */}
                  {game.jokerCard && (
                    <div className="relative w-16 h-24 md:w-24 md:h-36 bg-orange-100 border-2 border-orange-500 rounded-lg shadow-[0_0_20px_rgba(249,115,22,0.3)] flex flex-col p-1 overflow-hidden shrink-0">
                      <div className="flex items-center gap-1">
                        <div className={cn(
                          "text-[10px] md:text-xs font-black",
                          (game.jokerCard.suit === 'hearts' || game.jokerCard.suit === 'diamonds') ? "text-red-600" : "text-ink"
                        )}>{game.jokerCard.rank}</div>
                        <span className="text-orange-500 text-[8px] md:text-[10px]">🃏</span>
                      </div>
                      <div className="flex-1 flex items-center justify-center text-2xl md:text-4xl">
                        {game.jokerCard.suit === 'hearts' && <span className="text-red-600">♥</span>}
                        {game.jokerCard.suit === 'diamonds' && <span className="text-red-600">♦</span>}
                        {game.jokerCard.suit === 'clubs' && <span>♣</span>}
                        {game.jokerCard.suit === 'spades' && <span>♠</span>}
                        {game.jokerCard.rank === 'Joker' && <span className="text-orange-500">🃏</span>}
                      </div>
                      <div className="absolute bottom-1 left-1/2 -translate-x-1/2 bg-orange-500 text-white text-[6px] md:text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-tighter">
                        WILD
                      </div>
                    </div>
                  )}

                  {/* Deck */}
                  <div className="relative">
                    <div 
                      onClick={() => handleDraw('deck')}
                      className={cn(
                        "relative w-16 h-24 md:w-24 md:h-36 bg-slate-600 border-2 border-slate-500 rounded-lg shadow-2xl flex items-center justify-center cursor-pointer hover:border-orange-500 transition-all group z-10 overflow-hidden",
                        !isMyTurn && "opacity-50 cursor-not-allowed",
                        isMyTurn && needsToDraw && "border-orange-500 animate-pulse shadow-[0_0_30px_rgba(249,115,22,0.4)]"
                      )}
                    >
                      <div className="absolute inset-0 opacity-30 bg-[repeating-linear-gradient(45deg,transparent,transparent_10px,rgba(255,255,255,0.1)_10px,rgba(255,255,255,0.1)_20px)]" />
                      <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white via-transparent to-transparent" />
                      <div className="text-white/40 font-black text-2xl md:text-4xl italic tracking-tighter select-none z-10">LC</div>
                    </div>
                  </div>

                  {/* Discard Pile */}
                  <div className="relative w-16 h-24 md:w-24 md:h-36">
                    <AnimatePresence>
                      {game.discardPile.map((card, idx) => (
                        <motion.div
                          key={card.id}
                          initial={{ scale: 1.5, opacity: 0, y: -100 }}
                          animate={{ scale: 1, opacity: 1, y: 0, rotate: (idx % 3 - 1) * 5 }}
                          className={cn(
                            "absolute inset-0 bg-white text-black rounded-lg shadow-xl flex flex-col p-2 md:p-3 border border-gray-300",
                            idx === game.discardPile.length - 1 && isMyTurn && "cursor-pointer ring-2 ring-orange-500 ring-offset-2 ring-offset-[#151619]",
                            idx === game.discardPile.length - 1 && isMyTurn && needsToDraw && "ring-4 ring-orange-500 animate-pulse"
                          )}
                          onClick={() => idx === game.discardPile.length - 1 && handleDraw('discard')}
                        >
                          <div className={cn("text-xs md:text-lg font-black", (card.suit === 'hearts' || card.suit === 'diamonds') ? "text-red-600" : "text-ink")}>
                            {card.rank}
                          </div>
                          <div className="flex-1 flex items-center justify-center text-2xl md:text-4xl">
                            {card.suit === 'hearts' && <span className="text-red-600">♥</span>}
                            {card.suit === 'diamonds' && <span className="text-red-600">♦</span>}
                            {card.suit === 'clubs' && <span>♣</span>}
                            {card.suit === 'spades' && <span>♠</span>}
                            {card.rank === 'Joker' && <span className="text-orange-500">🃏</span>}
                          </div>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>

                  {/* Temporary Discard Pile (Current Player's Discards) */}
                  {game.tempDiscardPile.length > 0 && (
                    <div className="relative w-16 h-24 md:w-24 md:h-36 ml-4 md:ml-8">
                      <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-[8px] md:text-[10px] uppercase font-black text-orange-500 tracking-widest whitespace-nowrap">JUST DISCARDED</div>
                      <AnimatePresence>
                        {game.tempDiscardPile.map((card, idx) => (
                          <motion.div
                            key={card.id}
                            initial={{ scale: 0.5, opacity: 0, x: -100 }}
                            animate={{ scale: 1, opacity: 1, x: 0, y: 0, rotate: (idx % 3 - 1) * 5 }}
                            className="absolute inset-0 bg-white text-black rounded-lg shadow-2xl flex flex-col p-2 md:p-3 border-2 border-orange-500 z-10"
                          >
                            <div className={cn("text-xs md:text-lg font-black", (card.suit === 'hearts' || card.suit === 'diamonds') ? "text-red-600" : "text-ink")}>
                              {card.rank}
                            </div>
                            <div className="flex-1 flex items-center justify-center text-2xl md:text-4xl">
                              {card.suit === 'hearts' && <span className="text-red-600">♥</span>}
                              {card.suit === 'diamonds' && <span className="text-red-600">♦</span>}
                              {card.suit === 'clubs' && <span>♣</span>}
                              {card.suit === 'spades' && <span>♠</span>}
                              {card.rank === 'Joker' && <span className="text-orange-500">🃏</span>}
                            </div>
                          </motion.div>
                        ))}
                      </AnimatePresence>
                    </div>
                  )}
                </div>

                {/* Floating Action Log removed from here */}
              </div>
            )}
          </div>

          {/* My Hand Area */}
          {game.status !== 'waiting' && (
            <div className={cn(
              "relative w-full flex flex-col items-center gap-4 md:gap-8 px-2 transition-all duration-500 shrink-0 pb-4 md:pb-8",
              isMyTurn && "pt-4"
            )}>
              {/* Active Turn Indicator Glow */}
              {isMyTurn && (
                <div className="absolute inset-x-0 -top-20 -bottom-10 bg-green-500/5 blur-[100px] pointer-events-none animate-pulse" />
              )}

              {/* Player Stats & Controls */}
              <div className="flex flex-col items-center gap-6 w-full max-w-4xl">
                <div className="flex flex-col sm:flex-row justify-between items-center sm:items-end w-full px-2 md:px-8 gap-4">
                  <div className="flex gap-2 sm:gap-4">
                    <div className="hardware-card bg-bg/80 backdrop-blur-sm p-2 px-3 sm:px-4 border-orange-500/30">
                      <div className="text-[8px] opacity-50 uppercase tracking-widest">HAND VALUE</div>
                      <div className="text-sm md:text-lg font-bold text-orange-500">{currentPlayer ? getHandValue(currentPlayer.hand) : 0}</div>
                    </div>
                    
                    <div className="hardware-card bg-bg/80 backdrop-blur-sm p-2 px-3 sm:px-4 border-line/10">
                      <div className="text-[8px] opacity-50 uppercase tracking-widest">TOTAL SCORE</div>
                      <div className="text-sm md:text-lg font-bold">{currentPlayer?.totalScore || 0}</div>
                    </div>

                    <div className="relative">
                      <button 
                        onClick={() => {
                          setShowCommMenu(!showCommMenu);
                        }}
                        className={cn(
                          "hardware-card p-2 px-4 flex flex-col items-center justify-center transition-all active:translate-y-0.5 active:shadow-sm h-full min-w-[60px] sm:min-w-[80px]",
                          showCommMenu ? "bg-orange-500 border-orange-600 text-white" : "bg-bg/80 backdrop-blur-sm border-line/10"
                        )}
                      >
                        <div className={cn(
                          "text-[8px] uppercase tracking-widest font-black mb-1",
                          showCommMenu ? "text-white/70" : "opacity-50"
                        )}>COMM</div>
                        <MessageSquare size={20} className={showCommMenu ? "text-white" : "text-orange-500"} />
                      </button>
                      
                      <AnimatePresence>
                        {showCommMenu && (
                          <>
                            {/* Backdrop for mobile/tablet to close on click outside */}
                            <motion.div 
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              exit={{ opacity: 0 }}
                              onClick={() => setShowCommMenu(false)}
                              className="fixed inset-0 bg-ink/40 backdrop-blur-sm z-[100] md:hidden"
                            />

                            <motion.div 
                              initial={{ opacity: 0, scale: 0.9, y: 20 }}
                              animate={{ opacity: 1, scale: 1, y: 0 }}
                              exit={{ opacity: 0, scale: 0.9, y: 20 }}
                              className={cn(
                                "fixed md:absolute z-[101] md:z-50 bg-bg border-2 border-line/20 rounded-3xl shadow-2xl p-4 flex flex-col gap-4 overflow-hidden",
                                // Mobile: Bottom sheet style
                                "bottom-4 left-4 right-4 md:bottom-full md:mb-4 md:left-auto md:right-0 md:w-[320px] h-auto max-h-[75vh] md:max-h-[400px]"
                              )}
                            >
                              {/* Header with Close for Mobile */}
                              <div className="flex items-center justify-between md:hidden shrink-0">
                                <div className="text-xs font-black tracking-widest opacity-50">COMMUNICATION</div>
                                <button 
                                  onClick={() => setShowCommMenu(false)}
                                  className="p-2 hover:bg-ink/5 rounded-full transition-colors"
                                >
                                  <X size={20} />
                                </button>
                              </div>

                              {/* Tabs */}
                              <div className="flex bg-ink/5 p-1 rounded-2xl shrink-0">
                                <button 
                                  onClick={() => setCommTab('emojis')}
                                  className={cn(
                                    "flex-1 py-3 text-[10px] font-black tracking-widest rounded-xl transition-all flex items-center justify-center gap-2",
                                    commTab === 'emojis' ? "bg-bg shadow-md text-ink" : "text-ink/40 hover:text-ink/60"
                                  )}
                                >
                                  <span>😀</span>
                                  <span>EMOJIS</span>
                                </button>
                                <button 
                                  onClick={() => setCommTab('sounds')}
                                  className={cn(
                                    "flex-1 py-3 text-[10px] font-black tracking-widest rounded-xl transition-all flex items-center justify-center gap-2",
                                    commTab === 'sounds' ? "bg-bg shadow-md text-ink" : "text-ink/40 hover:text-ink/60"
                                  )}
                                >
                                  <span>🔊</span>
                                  <span>SOUNDS</span>
                                </button>
                              </div>

                              <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar max-h-[220px] md:max-h-[240px]">
                                {commTab === 'emojis' ? (
                                  <div className="grid grid-cols-4 gap-3 p-1">
                                    {emojis.map(emoji => (
                                      <button
                                        key={emoji.char}
                                        onClick={() => sendEmoji(emoji.gif)}
                                        className="aspect-square flex items-center justify-center hover:bg-ink/5 rounded-2xl transition-all hover:scale-110 active:scale-95 p-1"
                                      >
                                        <img src={emoji.gif} alt={emoji.char} className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                                      </button>
                                    ))}
                                  </div>
                                ) : (
                                  <div className="grid grid-cols-2 gap-2 p-1">
                                    {[...REACTION_SOUNDS, ...customSounds].map(rs => (
                                      <button
                                        key={rs.id}
                                        onClick={() => {
                                          sendReactionSound(rs.id);
                                        }}
                                        className="flex items-center gap-3 px-4 py-4 hover:bg-ink/5 rounded-2xl transition-all border border-line/5 text-left hover:border-orange-500/30 active:scale-[0.98]"
                                      >
                                        <span className="text-xl shrink-0">{rs.icon}</span>
                                        <span className="text-[10px] font-black tracking-tighter leading-tight uppercase">{rs.label}</span>
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </motion.div>
                          </>
                        )}
                      </AnimatePresence>

                      {/* Active Emoji for current player */}
                      <AnimatePresence mode="popLayout">
                        {currentPlayer && activeEmojis[currentPlayer.uid] && (
                          <motion.div
                            key={`emoji-me-${activeEmojis[currentPlayer.uid].timestamp}`}
                            initial={{ opacity: 0, scale: 0.5, y: 0 }}
                            animate={{ opacity: 1, scale: 1.2, y: -40 }}
                            exit={{ opacity: 0, scale: 0.5, y: -60 }}
                            className="absolute -top-4 left-1/2 -translate-x-1/2 text-2xl z-50 pointer-events-none drop-shadow-lg"
                          >
                            {activeEmojis[currentPlayer.uid].emoji.startsWith('http') ? (
                              <img src={activeEmojis[currentPlayer.uid].emoji} alt="emoji" className="w-12 h-12 object-contain" referrerPolicy="no-referrer" />
                            ) : (
                              activeEmojis[currentPlayer.uid].emoji
                            )}
                          </motion.div>
                        )}
                      </AnimatePresence>

                      {/* Audio Indicator for current player */}
                      <AnimatePresence>
                        {currentPlayer && activeAudio[currentPlayer.uid] && (
                          <motion.div
                            key={`audio-me-${activeAudio[currentPlayer.uid]}`}
                            initial={{ opacity: 0, scale: 0.5 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.5 }}
                            className="absolute -bottom-1 -right-1 bg-orange-500 text-white p-1 rounded-full z-30 shadow-lg border-2 border-bg"
                          >
                            <Volume2 size={12} className="animate-pulse" />
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 sm:gap-2">
                    <div className="text-[8px] opacity-50 uppercase tracking-widest mr-1 sm:mr-2 hidden xs:block">SORT BY:</div>
                    {(['number', 'suit', 'duplication'] as const).map((order) => (
                      <button
                        key={order}
                        onClick={() => {
                          setSortOrder(order);
                        }}
                        className={cn(
                          "px-2 py-1 rounded text-[8px] font-bold uppercase tracking-tighter transition-all border",
                          sortOrder === order ? "bg-orange-500 border-orange-600 text-white" : "bg-bg/50 border-line/10 hover:bg-ink/5"
                        )}
                      >
                        {order === 'duplication' ? 'DUP' : order}
                      </button>
                    ))}
                  </div>
                </div>

                {isMyTurn && (
                  <div className="w-full max-w-md h-1.5 bg-ink/10 rounded-full overflow-hidden border border-line/10 shadow-inner relative">
                    <div 
                      className="h-full bg-gradient-to-r from-orange-400 to-orange-600 origin-left transition-transform duration-100" 
                      style={{ transform: `scaleX(${timeLeft / game.config.turnTimer})` }} 
                    />
                    {timeLeft < 5 && <div className="absolute inset-0 bg-red-500/20 animate-pulse" />}
                  </div>
                )}

                <div className="flex flex-wrap justify-center gap-3 md:gap-6">
                  {game.status === 'playing' && isMyTurn && (
                    <>
                      {!needsToDraw ? (
                        <>
                          <button 
                            onClick={handleDiscard}
                            className={cn(
                              "px-8 py-3 md:px-12 md:py-4 rounded-xl font-black uppercase tracking-widest transition-all duration-300 shadow-xl border-b-4 active:border-b-0 active:translate-y-1",
                              selectedCards.length > 0 
                                ? "bg-orange-500 border-orange-700 text-white hover:bg-orange-400 hover:shadow-orange-500/20" 
                                : "bg-ink/10 border-ink/20 text-ink/30 cursor-not-allowed"
                            )}
                          >
                            DISCARD ({selectedCards.length})
                          </button>
                          <button 
                            onClick={handleCall}
                            className={cn(
                              "px-8 py-3 md:px-12 md:py-4 rounded-xl font-black uppercase tracking-widest transition-all duration-300 shadow-xl border-b-4 active:border-b-0 active:translate-y-1",
                              !(needsToDraw || (currentPlayer?.hand && getHandValue(currentPlayer.hand) > game.config.callLimit))
                                ? "bg-orange-500 border-orange-700 text-white hover:bg-orange-400 hover:shadow-orange-500/20"
                                : "bg-ink/10 border-ink/20 text-ink/30 cursor-not-allowed"
                            )}
                          >
                            SHOW
                          </button>
                        </>
                      ) : (
                        <>
                          <button 
                            onClick={() => handleDraw('deck')}
                            className="px-8 py-3 md:px-12 md:py-4 rounded-xl font-black uppercase tracking-widest transition-all duration-300 shadow-xl border-b-4 active:border-b-0 active:translate-y-1 bg-blue-600 border-blue-800 text-white hover:bg-blue-500"
                          >
                            DRAW FROM DECK
                          </button>
                          <button 
                            onClick={() => handleDraw('discard')}
                            className="px-8 py-3 md:px-12 md:py-4 rounded-xl font-black uppercase tracking-widest transition-all duration-300 shadow-xl border-b-4 active:border-b-0 active:translate-y-1 bg-green-600 border-green-800 text-white hover:bg-green-500"
                          >
                            DRAW FROM DISCARD
                          </button>
                        </>
                      )}
                    </>
                  )}
                  {game.status === 'showdown' && game.hostId === user.uid && (
                    <button onClick={handleNextRound} className="hardware-btn bg-blue-600 border-blue-700 flex items-center gap-2 px-6 py-3 md:px-10 md:py-4 text-sm md:text-lg shadow-xl">
                      <RefreshCw size={20} /> NEXT ROUND
                    </button>
                  )}
                </div>

                {currentPlayer?.isAway && (
                  <button 
                    onClick={() => handleSetAway(false)}
                    className="mt-4 px-10 py-4 bg-red-600 border-b-4 border-red-800 text-white rounded-2xl font-black uppercase tracking-[0.2em] shadow-2xl hover:bg-red-500 animate-pulse"
                  >
                    I AM BACK
                  </button>
                )}

                <div className={cn(
                  "flex -space-x-2 md:-space-x-4 hover:space-x-1 transition-all duration-500 max-w-full overflow-x-auto no-scrollbar pb-6 pt-8 md:pt-12 px-8",
                  isMyTurn && "ring-2 ring-green-500/20 rounded-2xl bg-green-500/5"
                )}>
                  {currentPlayer && sortHand(currentPlayer.hand).map((card) => (
                    <motion.div
                      key={card.id}
                      layout
                      whileHover={{ y: -40, scale: 1.1, zIndex: 50 }}
                      onClick={() => {
                        if (selectedCards.includes(card.id)) {
                          setSelectedCards(selectedCards.filter(id => id !== card.id));
                        } else {
                          setSelectedCards([...selectedCards, card.id]);
                        }
                      }}
                      className={cn(
                        "w-16 h-24 md:w-28 md:h-40 bg-white text-black rounded-xl shadow-2xl flex flex-col p-3 md:p-4 border-2 cursor-pointer transition-all shrink-0 relative group",
                        selectedCards.includes(card.id) ? "border-orange-500 -translate-y-8 md:-translate-y-12 shadow-orange-500/20" : "border-transparent hover:border-ink/10",
                        card.rank === game.wildRank && "bg-orange-100 border-orange-500 shadow-[0_0_20px_rgba(249,115,22,0.3)]"
                      )}
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex items-center gap-1">
                          <div className={cn(
                            "text-base md:text-xl font-black",
                            (card.suit === 'hearts' || card.suit === 'diamonds') ? "text-red-600" : "text-ink"
                          )}>{card.rank}</div>
                          {card.rank === game.wildRank && <span className="text-orange-500 text-xs md:text-sm">🃏</span>}
                        </div>
                      </div>
                      <div className="flex-1 flex items-center justify-center text-3xl md:text-5xl">
                        {card.suit === 'hearts' && <span className="text-red-600">♥</span>}
                        {card.suit === 'diamonds' && <span className="text-red-600">♦</span>}
                        {card.suit === 'clubs' && <span>♣</span>}
                        {card.suit === 'spades' && <span>♠</span>}
                        {card.rank === 'Joker' && <span className="text-orange-500">🃏</span>}
                      </div>
                      {card.rank === game.wildRank && (
                        <div className="absolute bottom-1 left-1/2 -translate-x-1/2 bg-orange-500 text-white text-[6px] md:text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-tighter">
                          WILD
                        </div>
                      )}
                      {selectedCards.includes(card.id) && (
                        <div className="absolute -top-3 -right-3 w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center text-white text-xs font-bold border-2 border-white shadow-lg">
                          {selectedCards.indexOf(card.id) + 1}
                        </div>
                      )}
                    </motion.div>
                  ))}
                </div>
                <div className="text-[8px] md:text-[10px] uppercase tracking-[0.4em] font-black opacity-30 animate-pulse">
                  {isMyTurn ? (needsToDraw ? "DRAW ONE CARD TO END TURN" : "DISCARD OR SHOW") : "WAITING FOR OPERATOR..."}
                </div>
              </div>
            </div>
          )}
        </div>
        {/* Right Side Opponents */}
        {rightOpponents.length > 0 && (
          <div className="hidden md:flex flex-col justify-center gap-4 p-4 border-l border-line/5 bg-ink/[0.02] z-10 min-w-[100px] overflow-y-auto no-scrollbar">
            {rightOpponents.map(renderOpponent)}
          </div>
        )}
      </main>

      {/* Showdown Modal */}
      <AnimatePresence>
        {game.status === 'showdown' && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-ink/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 md:p-8"
          >
            <div className="hardware-card bg-bg max-w-2xl w-full p-4 md:p-8 flex flex-col gap-4 md:gap-8 max-h-[95vh] overflow-hidden">
              <div className="flex justify-between items-center border-b border-line/10 pb-2 md:pb-4 shrink-0">
                <div className="flex flex-col items-start gap-1 truncate mr-2">
                  <h2 className="text-xl md:text-3xl font-bold uppercase tracking-widest truncate">ROUND RECAP</h2>
                  <div className="text-[8px] md:text-[10px] font-mono opacity-50 uppercase tracking-widest">ELIMINATION LIMIT: {game.config.eliminationLimit}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-[8px] opacity-50 uppercase tracking-widest">NEXT ROUND IN</div>
                  <div className="text-lg md:text-xl font-bold text-orange-500 font-mono">{showdownTimeLeft.toFixed(1)}s</div>
                </div>
              </div>
              
              <div className="flex-1 overflow-y-auto space-y-6 pr-1 md:pr-2 no-scrollbar">
                <div className="overflow-x-auto no-scrollbar" ref={scoreTableRef}>
                  <table className="w-full text-left border-collapse">
                    <thead className="sticky top-0 bg-bg z-20">
                      <tr className="border-b border-line/20 text-[10px] uppercase tracking-widest opacity-50">
                        <th className="p-2 md:p-3 font-bold whitespace-nowrap sticky left-0 bg-bg z-30 border-r border-line/10 shadow-[4px_0_10px_-4px_rgba(0,0,0,0.1)]">Player</th>
                        {game.roundScores?.map((rs) => (
                          <th key={rs.round} className="p-2 md:p-3 text-center font-bold">R{rs.round}</th>
                        ))}
                        <th className="p-2 md:p-3 text-right font-bold sticky right-0 bg-bg z-30 border-l border-line/10 shadow-[-4px_0_10px_-4px_rgba(0,0,0,0.1)]">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {game.players.map(player => {
                        const isEliminated = player.totalScore >= game.config.eliminationLimit;
                        const isCaught = game.lastRoundCaughtId === player.uid;
                        const isWinner = game.lastRoundWinnerId === player.uid;
                        const wasCaller = game.lastRoundCallerId === player.uid;
                        const isCaughtOnWinner = wasCaller && isCaught;
                        
                        return (
                          <tr key={player.uid} className={cn(
                            "border-b border-line/5 text-xs md:text-sm hover:bg-ink/5 transition-colors",
                            isEliminated ? "text-red-500" : (isCaught ? "text-orange-500" : "text-ink")
                          )}>
                            <td className="p-2 md:p-3 font-bold whitespace-nowrap sticky left-0 bg-bg z-30 border-r border-line/10 shadow-[4px_0_10px_-4px_rgba(0,0,0,0.1)]">
                              <div className="flex items-center gap-2">
                                <div className={cn(
                                  "w-5 h-5 md:w-6 md:h-6 rounded-full flex items-center justify-center text-[8px] shrink-0",
                                  isEliminated ? "bg-red-500/10" : "bg-ink/10"
                                )}>
                                  {player.displayName?.[0] || 'O'}
                                </div>
                                <span className="truncate max-w-[80px] md:max-w-[120px] bg-ink/5 px-2 py-0.5 rounded-md border border-line/5">{player.displayName}</span>
                                {isEliminated && <span className="text-[8px] font-black bg-red-500 text-white px-1 rounded">ELIMINATED</span>}
                              </div>
                            </td>
                            {game.roundScores?.map((rs) => (
                              <td key={rs.round} className="p-2 md:p-3 text-center font-mono opacity-80">{rs.scores[player.uid] ?? '-'}</td>
                            ))}
                            <td className="p-2 md:p-3 text-right font-bold font-mono sticky right-0 bg-bg z-30 border-l border-line/10 shadow-[-4px_0_10px_-4px_rgba(0,0,0,0.1)]">{player.totalScore}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                
                <div className="space-y-3">
                  <h3 className="text-[10px] font-bold uppercase tracking-widest opacity-50">Current Round Hands</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {game.players.map(player => {
                      const isEliminated = player.totalScore >= game.config.eliminationLimit;
                      const isCaught = game.lastRoundCaughtId === player.uid;
                      const isWinner = game.lastRoundWinnerId === player.uid;
                      const wasCaller = game.lastRoundCallerId === player.uid;
                      const isCaughtOnWinner = wasCaller && isCaught;
                      
                      return (
                        <div key={player.uid} className={cn(
                          "flex flex-col gap-2 p-3 border rounded-xl relative overflow-hidden",
                          isWinner ? "border-green-500 bg-green-500/5" : (isCaught ? "border-orange-500 bg-orange-500/5" : "border-line/10 bg-ink/5"),
                          isEliminated && "border-red-500 bg-red-500/5"
                        )}>
                          {/* Stamps */}
                          <div className="absolute top-2 right-2 flex flex-col items-end gap-1 pointer-events-none opacity-20">
                            {isWinner && <div className="text-[14px] md:text-[18px] font-black border-2 border-green-500 text-green-500 px-2 rotate-[-15deg] uppercase">WINNER</div>}
                            {isCaughtOnWinner && <div className="text-[14px] md:text-[18px] font-black border-2 border-orange-500 text-orange-500 px-2 rotate-[15deg] uppercase">CAUGHT ON WINNER</div>}
                            {isCaught && !isCaughtOnWinner && <div className="text-[14px] md:text-[18px] font-black border-2 border-orange-500 text-orange-500 px-2 rotate-[15deg] uppercase">CAUGHT</div>}
                            {isEliminated && <div className="text-[14px] md:text-[18px] font-black border-2 border-red-500 text-red-500 px-2 rotate-[-5deg] uppercase">ELIMINATED</div>}
                          </div>

                          <div className="flex justify-between items-center relative z-10">
                            <span className={cn(
                              "text-xs font-bold uppercase truncate max-w-[120px]",
                              isEliminated ? "text-red-500" : (isWinner ? "text-green-600" : (isCaught ? "text-orange-500" : "text-ink"))
                            )}>{player.displayName}</span>
                            <div className="flex flex-col items-end text-[8px] md:text-[10px] font-mono font-bold opacity-70">
                              <span>HAND VALUE: {getHandValue(player.hand, game.wildRank)}</span>
                              <span className="text-orange-500">POINTS ADDED: {player.score}</span>
                              <span className="text-ink/40">TOTAL CARDS: {player.hand.length}</span>
                            </div>
                          </div>
                          <div className="flex -space-x-4 overflow-x-auto pb-2 pt-2 px-2 no-scrollbar relative z-10">
                            {player.hand.map((card, idx) => (
                              <div 
                                key={card.id} 
                                className="w-10 h-14 bg-white text-black rounded-lg shadow-md flex flex-col items-center justify-center text-[10px] border border-gray-200 shrink-0 relative hover:-translate-y-2 transition-transform z-10 hover:z-20"
                                style={{ zIndex: idx }}
                              >
                                <span className={cn("font-black text-xs leading-none", (card.suit === 'hearts' || card.suit === 'diamonds') ? 'text-red-500' : 'text-black')}>{card.rank}</span>
                                <span className={cn("text-lg leading-none mt-0.5", (card.suit === 'hearts' || card.suit === 'diamonds') ? 'text-red-500' : 'text-black')}>
                                  {card.suit === 'hearts' ? '♥' : card.suit === 'diamonds' ? '♦' : card.suit === 'clubs' ? '♣' : '♠'}
                                  {card.rank === 'Joker' && '🃏'}
                                  {card.rank === game.wildRank && <div className="absolute inset-0 bg-orange-500/10 pointer-events-none" />}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {game.hostId === user.uid && (
                <div className="pt-2 md:pt-4 border-t border-line/10 shrink-0">
                  <button onClick={handleNextRound} className="hardware-btn w-full py-3 md:py-4 text-sm md:text-xl">INITIATE NEXT ROUND NOW</button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Game Over Modal */}
      <AnimatePresence>
        {game.status === 'ended' && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-ink/90 backdrop-blur-md flex items-center justify-center z-[60] p-4 md:p-8"
          >
            <div className="hardware-card bg-bg max-w-2xl w-full p-6 md:p-12 flex flex-col gap-6 md:gap-12 text-center relative max-h-[95vh] overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-orange-500 animate-pulse" />
              
              <div className="space-y-2 md:space-y-4 shrink-0">
                <h2 className="text-3xl md:text-5xl font-black italic uppercase tracking-tighter text-orange-500">MISSION COMPLETE</h2>
                <p className="text-[10px] md:text-xs opacity-50 font-mono tracking-[0.2em] md:tracking-[0.3em] truncate">FINAL STANDINGS // SESSION {roomId}</p>
              </div>

              <div className="flex-1 overflow-y-auto space-y-6 md:space-y-12 no-scrollbar">
                <div className="flex flex-col items-center gap-4 md:gap-6">
                  <div className="w-24 h-24 md:w-32 md:h-32 radial-track flex items-center justify-center relative">
                    <div className="w-20 h-20 md:w-28 md:h-28 rounded-full bg-ink/10 flex items-center justify-center">
                      <Trophy size={48} className="text-orange-500 md:w-16 md:h-16" />
                    </div>
                    <div className="absolute -bottom-3 md:-bottom-4 bg-ink text-bg px-3 md:px-4 py-1 text-xs md:text-sm font-bold rounded-full border border-orange-500">
                      WINNER
                    </div>
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-2xl md:text-3xl font-bold uppercase">{game.players.find(p => p.uid === game.winnerId)?.displayName || 'OPERATOR'}</h3>
                    <p className="text-[10px] md:text-xs opacity-50 font-mono">SCORE: {game.players.find(p => p.uid === game.winnerId)?.totalScore}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 md:gap-4 border-y border-line/10 py-4 md:py-6">
                  {game.players
                    .sort((a, b) => a.totalScore - b.totalScore)
                    .map((player, idx) => (
                      <div key={player.uid} className="flex justify-between items-center opacity-70">
                        <div className="flex items-center gap-3 md:gap-4">
                          <span className="text-[10px] font-mono opacity-30">#{idx + 1}</span>
                          <div className="flex flex-col items-start">
                            <span className="text-xs md:text-sm uppercase font-bold truncate max-w-[150px] md:max-w-[200px] text-left">{player.displayName || 'OPERATOR'}</span>
                            {player.xpGained && (
                              <span className="text-[8px] md:text-[10px] font-mono text-orange-500">+{player.xpGained} XP</span>
                            )}
                          </div>
                        </div>
                        <span className="text-xs md:text-sm font-bold font-mono">{player.totalScore}</span>
                      </div>
                    ))}
                </div>
              </div>

              <div className="shrink-0 pt-2">
                <button onClick={handleLeave} className="hardware-btn w-full py-3 md:py-4 text-sm md:text-xl flex items-center justify-center gap-2 md:gap-4">
                  <ArrowLeft size={20} className="md:w-6 md:h-6" /> RETURN TO BASE
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
