import React, { useState } from 'react';
import { generateRoomId } from '../lib/utils';
import { Plus, LogIn, Users, Settings, Bot, Trophy, User as UserIcon, Zap, Target, Trash2, RefreshCw, ArrowLeft, Spade, Play, BookOpen, Gamepad2, Sun, Moon } from 'lucide-react';
import { User } from 'firebase/auth';
import { db } from '../firebase';
import { UserProfile } from '../types';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import GlobalChat from './GlobalChat';

interface DashboardProps {
  user: User;
  profile: UserProfile | null;
  onJoinLeastCount: (roomId: string, isCreating?: boolean) => void;
  onJoinCallBreak: (roomId: string, isCreating?: boolean) => void;
  onJoinUno: (roomId: string, isCreating?: boolean) => void;
  onViewLeaderboard: () => void;
  onViewProfile: () => void;
  onViewUnoRules: () => void;
  onViewCallBreakRules: () => void;
  isDark: boolean;
  toggleTheme: () => void;
  initialTab?: 'leastcount' | 'callbreak' | 'uno';
}

export default function Dashboard({ 
  user, 
  profile, 
  onJoinLeastCount, 
  onJoinCallBreak, 
  onJoinUno,
  onViewLeaderboard, 
  onViewProfile, 
  onViewUnoRules,
  onViewCallBreakRules,
  isDark,
  toggleTheme,
  initialTab = 'leastcount'
}: DashboardProps) {
  const [selectedGame, setSelectedGame] = useState<'leastcount' | 'callbreak' | 'uno' | null>(null);
  const [roomIdInput, setRoomIdInput] = useState('');
  const [isResetting, setIsResetting] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const isAdmin = user.email === 'anisettibharadwaja@gmail.com';

  const handleCreate = () => {
    const newRoomId = generateRoomId();
    if (selectedGame === 'leastcount') {
      onJoinLeastCount(newRoomId, true);
    } else if (selectedGame === 'callbreak') {
      onJoinCallBreak(newRoomId, true);
    } else if (selectedGame === 'uno') {
      onJoinUno(newRoomId, true);
    }
  };

  const handleJoin = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (roomIdInput.length === 6) {
      if (selectedGame === 'leastcount') {
        onJoinLeastCount(roomIdInput.toUpperCase(), false);
      } else if (selectedGame === 'callbreak') {
        onJoinCallBreak(roomIdInput.toUpperCase(), false);
      } else if (selectedGame === 'uno') {
        onJoinUno(roomIdInput.toUpperCase(), false);
      }
    }
  };

  const handleResetDatabase = async () => {
    setShowResetConfirm(false);
    setIsResetting(true);
    try {
      const res = await fetch('/api/admin/reset-database', {
        method: 'POST',
        headers: {
          'x-admin-email': user.email || ''
        }
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message);
        setTimeout(() => window.location.reload(), 2000);
      } else {
        toast.error(data.error || "Reset failed");
      }
    } catch (error) {
      toast.error("Network error during reset");
    } finally {
      setIsResetting(false);
    }
  };

  const renderGameSelection = () => (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-4">
        <Gamepad2 size={24} className="text-ink/60" />
        <h2 className="text-xl md:text-2xl font-bold uppercase tracking-widest font-mono">SELECT GAME</h2>
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
        {/* Least Count Card */}
        <button 
          onClick={() => setSelectedGame('leastcount')}
          className="hardware-card p-6 md:p-8 flex flex-col items-center text-center gap-4 hover:border-orange-500/50 hover:bg-orange-500/5 transition-all group relative overflow-hidden"
        >
          <div className="absolute -right-4 -top-4 opacity-5 group-hover:opacity-10 transition-opacity">
            <Play size={120} />
          </div>
          <div className="w-16 h-16 rounded-2xl bg-orange-500/10 text-orange-500 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
            <Play size={32} />
          </div>
          <div>
            <h3 className="text-xl md:text-2xl font-bold uppercase tracking-tight mb-2 group-hover:text-orange-500 transition-colors">Least Count</h3>
            <p className="text-xs opacity-60 font-mono leading-relaxed">
              A fast-paced card game where the goal is to have the lowest total value of cards in your hand.
            </p>
          </div>
        </button>

        {/* Call Break Card */}
        <button 
          onClick={() => setSelectedGame('callbreak')}
          className="hardware-card p-6 md:p-8 flex flex-col items-center text-center gap-4 hover:border-blue-500/50 hover:bg-blue-500/5 transition-all group relative overflow-hidden"
        >
          <div className="absolute -right-4 -top-4 opacity-5 group-hover:opacity-10 transition-opacity">
            <Spade size={120} />
          </div>
          <div className="w-16 h-16 rounded-2xl bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
            <Spade size={32} />
          </div>
          <div>
            <h3 className="text-xl md:text-2xl font-bold uppercase tracking-tight mb-2 group-hover:text-blue-500 transition-colors">Call Break</h3>
            <p className="text-xs opacity-60 font-mono leading-relaxed">
              A strategic trick-taking card game where Spades are always trump. Bid your tricks and win them all.
            </p>
          </div>
        </button>

        {/* Uno Card */}
        <button 
          onClick={() => setSelectedGame('uno')}
          className="hardware-card p-6 md:p-8 flex flex-col items-center text-center gap-4 hover:border-red-500/50 hover:bg-red-500/5 transition-all group relative overflow-hidden"
        >
          <div className="absolute -right-4 -top-4 opacity-5 group-hover:opacity-10 transition-opacity">
            <BookOpen size={120} />
          </div>
          <div className="w-16 h-16 rounded-2xl bg-red-500/10 text-red-500 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
            <BookOpen size={32} />
          </div>
          <div>
            <h3 className="text-xl md:text-2xl font-bold uppercase tracking-tight mb-2 group-hover:text-red-500 transition-colors">Uno</h3>
            <p className="text-xs opacity-60 font-mono leading-relaxed">
              The classic color and number matching card game. Be the first to get rid of all your cards!
            </p>
          </div>
        </button>
      </div>
    </div>
  );

  const renderGameLobby = () => (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-6"
    >
      <button 
        onClick={() => setSelectedGame(null)}
        className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest opacity-60 hover:opacity-100 transition-opacity mb-4"
      >
        <ArrowLeft size={16} />
        Back to Games
      </button>

      {/* Game Info Section */}
      <div className="hardware-card p-6 bg-ink/5 border-dashed flex flex-col sm:flex-row items-center gap-6">
        <div className={cn(
          "w-16 h-16 rounded-2xl flex items-center justify-center shrink-0",
          selectedGame === 'leastcount' ? "bg-orange-500/10 text-orange-500" : 
          selectedGame === 'callbreak' ? "bg-blue-500/10 text-blue-500" :
          "bg-red-500/10 text-red-500"
        )}>
          {selectedGame === 'leastcount' ? <Play size={32} /> : 
           selectedGame === 'callbreak' ? <Spade size={32} /> : 
           <BookOpen size={32} />}
        </div>
        <div className="flex-1 text-center sm:text-left">
          <h3 className="text-xl font-bold uppercase tracking-tight mb-1">
            {selectedGame === 'leastcount' ? 'Least Count' : 
             selectedGame === 'callbreak' ? 'Call Break' : 
             'Uno'}
          </h3>
          <p className="text-xs opacity-60 font-mono leading-relaxed">
            {selectedGame === 'leastcount' 
              ? 'A fast-paced card game where the goal is to have the lowest total value of cards in your hand.'
              : selectedGame === 'callbreak'
              ? 'A strategic trick-taking card game where Spades are always trump. Bid your tricks and win them all.'
              : 'The classic color and number matching card game. Be the first to get rid of all your cards!'}
          </p>
        </div>
        {selectedGame === 'callbreak' && (
          <button onClick={onViewCallBreakRules} className="hardware-btn text-[10px] py-2 px-4 shrink-0">
            RULES
          </button>
        )}
        {selectedGame === 'uno' && (
          <button onClick={onViewUnoRules} className="hardware-btn text-[10px] py-2 px-4 shrink-0">
            RULES
          </button>
        )}
      </div>

      {/* Create & Join Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
        <div className="hardware-card p-6 md:p-8 space-y-6">
          <div className="flex items-center gap-3">
            <Plus size={24} className="text-ink/60" />
            <h2 className="text-lg md:text-xl font-bold uppercase tracking-widest font-mono">CREATE ROOM</h2>
          </div>
          <p className="text-xs md:text-sm opacity-60 font-mono leading-relaxed">INITIALIZE A NEW ENCRYPTED SESSION WITH CUSTOM CONFIGURATIONS.</p>
          <button 
            onClick={handleCreate} 
            className={cn(
              "hardware-btn w-full py-4 text-base md:text-lg font-bold",
              selectedGame === 'leastcount' ? "hover:bg-orange-500 hover:text-white" : 
              selectedGame === 'callbreak' ? "hover:bg-blue-500 hover:text-white" :
              "hover:bg-red-500 hover:text-white"
            )}
          >
            CREATE SESSION
          </button>
        </div>

        <div className="hardware-card p-6 md:p-8 space-y-6">
          <div className="flex items-center gap-3">
            <LogIn size={24} className="text-ink/60" />
            <h2 className="text-lg md:text-xl font-bold uppercase tracking-widest font-mono">JOIN ROOM</h2>
          </div>
          <p className="text-xs md:text-sm opacity-60 font-mono leading-relaxed">ENTER A 6-CHARACTER SESSION ID TO CONNECT TO AN EXISTING GAME.</p>
          <form onSubmit={handleJoin} className="flex flex-col gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-mono opacity-50 uppercase tracking-widest ml-1">Enter Session ID</label>
              <input 
                type="text" 
                maxLength={6}
                placeholder="ID"
                value={roomIdInput}
                onChange={(e) => setRoomIdInput(e.target.value.toUpperCase())}
                className="hardware-input w-full text-center text-xl md:text-2xl tracking-[0.5em] font-mono focus:border-ink transition-colors py-4"
              />
            </div>
            <button 
              type="submit"
              disabled={roomIdInput.length !== 6}
              className={cn(
                "hardware-btn w-full py-4 font-bold text-lg shadow-lg disabled:opacity-50",
                selectedGame === 'leastcount' ? "hover:bg-orange-500 hover:text-white" : 
                selectedGame === 'callbreak' ? "hover:bg-blue-500 hover:text-white" :
                "hover:bg-red-500 hover:text-white"
              )}
            >
              JOIN SESSION
            </button>
          </form>
        </div>
      </div>
    </motion.div>
  );

  return (
    <div className="max-w-4xl mx-auto p-2 md:p-6 space-y-4 md:space-y-8">
      {/* Theme Toggle & Header */}
      <div className="flex justify-between items-center px-2">
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="w-8 h-8 sm:w-10 sm:h-10 bg-ink text-bg flex items-center justify-center rounded-lg sm:rounded-xl shadow-lg">
            <Gamepad2 size={16} className="sm:w-5 sm:h-5" />
          </div>
          <h1 className="text-xl sm:text-2xl font-black italic tracking-tighter uppercase leading-none">ARCADE</h1>
        </div>
        <button 
          onClick={toggleTheme}
          className="p-2 sm:p-3 rounded-lg sm:rounded-xl border border-ink/10 hover:bg-ink/5 transition-all"
        >
          {isDark ? <Sun size={16} className="sm:w-5 sm:h-5" /> : <Moon size={16} className="sm:w-5 sm:h-5" />}
        </button>
      </div>

      {/* Welcome & Stats Section (Shared) */}
      <div className="hardware-card p-4 md:p-8 space-y-4 md:space-y-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
          <UserIcon size={80} className="md:w-[120px] md:h-[120px]" />
        </div>
        
        <div className="space-y-1 md:space-y-2 relative z-10">
          <h2 className="text-xl md:text-3xl font-bold italic tracking-tighter uppercase font-mono">OPERATOR DASHBOARD</h2>
          <p className="text-[8px] md:text-xs opacity-70 font-mono tracking-[0.2em]">IDENTIFIED AS: {user.displayName?.toUpperCase() || 'ANONYMOUS'}</p>
        </div>

        {/* Quick Stats Dashboard */}
        <div className="space-y-3 md:space-y-4 relative z-10">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 md:gap-4">
            <div className="bg-bg/10 p-2 md:p-3 border border-bg/20 flex flex-col gap-0.5 md:gap-1">
              <div className="flex items-center gap-1.5 md:gap-2 opacity-50">
                <Trophy size={10} className="md:w-3 md:h-3" />
                <span className="text-[7px] md:text-[8px] uppercase font-mono tracking-widest">LEVEL</span>
              </div>
              <div className="text-lg md:text-xl font-bold font-mono">{profile?.level || 1}</div>
            </div>
            <div className="bg-bg/10 p-2 md:p-3 border border-bg/20 flex flex-col gap-0.5 md:gap-1">
              <div className="flex items-center gap-1.5 md:gap-2 text-orange-500">
                <Zap size={10} className="md:w-3 md:h-3" />
                <span className="text-[7px] md:text-[8px] uppercase font-mono tracking-widest">XP</span>
              </div>
              <div className="text-lg md:text-xl font-bold font-mono text-orange-500">{profile?.xp || 0}</div>
            </div>
            <div className="bg-bg/10 p-2 md:p-3 border border-bg/20 flex flex-col gap-0.5 md:gap-1">
              <div className="flex items-center gap-1.5 md:gap-2 opacity-50">
                <Trophy size={10} className="text-orange-400 md:w-3 md:h-3" />
                <span className="text-[7px] md:text-[8px] uppercase font-mono tracking-widest">WINS</span>
              </div>
              <div className="text-lg md:text-xl font-bold font-mono">{profile?.wins || 0}</div>
            </div>
            <div className="bg-bg/10 p-2 md:p-3 border border-bg/20 flex flex-col gap-0.5 md:gap-1">
              <div className="flex items-center gap-1.5 md:gap-2 opacity-50">
                <Target size={10} className="md:w-3 md:h-3" />
                <span className="text-[7px] md:text-[8px] uppercase font-mono tracking-widest">LOSSES</span>
              </div>
              <div className="text-lg md:text-xl font-bold font-mono">{profile?.losses || 0}</div>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="space-y-1.5 md:space-y-2">
            <div className="flex justify-between text-[8px] md:text-[10px] font-black font-mono opacity-60 uppercase tracking-widest">
              <span>XP PROGRESS</span>
              <span>{(profile?.xp || 0) % 100}%</span>
            </div>
            <div className="w-full bg-ink/5 h-2 md:h-3 rounded-full overflow-hidden border-2 border-ink/10 shadow-inner">
              <div 
                className="bg-orange-500 h-full transition-all duration-1000 relative" 
                style={{ width: `${(profile?.xp || 0) % 100}%` }} 
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent to-white/20" />
              </div>
            </div>
          </div>
        </div>

        <div className="pt-1 flex flex-wrap gap-2 md:gap-3 relative z-10">
          <button onClick={onViewProfile} className="hardware-btn bg-bg text-ink text-[8px] md:text-[10px] py-1.5 md:py-2 px-4 md:px-6">VIEW PROFILE</button>
          <button onClick={onViewLeaderboard} className="hardware-btn bg-bg text-ink text-[8px] md:text-[10px] py-1.5 md:py-2 px-4 md:px-6">GLOBAL RANKINGS</button>
        </div>
      </div>

      {/* Main Content Area */}
      <AnimatePresence mode="wait">
        {!selectedGame ? (
          <motion.div
            key="selection"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
          >
            {renderGameSelection()}
          </motion.div>
        ) : (
          <motion.div
            key="lobby"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            {renderGameLobby()}
          </motion.div>
        )}
      </AnimatePresence>

      {/* System Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="hardware-card p-4 flex items-center gap-4 bg-ink/5 border-dashed">
          <Users size={20} className="text-ink/40" />
          <div className="font-mono text-[10px]">
            <div className="font-bold">4,324</div>
            <div className="opacity-50 uppercase">ACTIVE OPERATORS</div>
          </div>
        </div>
        <div className="hardware-card p-4 flex items-center gap-4 bg-ink/5 border-dashed">
          <Bot size={20} className="text-ink/40" />
          <div className="font-mono text-[10px]">
            <div className="font-bold">1,354</div>
            <div className="opacity-50 uppercase">AI AGENTS DEPLOYED</div>
          </div>
        </div>
        <div className="hardware-card p-4 flex items-center gap-4 bg-ink/5 border-dashed">
          <Settings size={20} className="text-ink/40" />
          <div className="font-mono text-[10px]">
            <div className="font-bold">v1.1.0</div>
            <div className="opacity-50 uppercase">SYSTEM STATUS: OPTIMAL</div>
          </div>
        </div>
      </div>

      {/* Admin Section */}
      {isAdmin && (
        <div className="hardware-card p-6 border-red-500/30 bg-red-500/5 space-y-4">
          <div className="flex items-center gap-3 text-red-500">
            <Trash2 size={20} />
            <h2 className="text-sm font-bold uppercase tracking-widest font-mono">ADMINISTRATIVE OVERRIDE</h2>
          </div>
          <p className="text-[10px] opacity-60 font-mono uppercase">DANGER: THIS ACTION WILL WIPE THE ENTIRE DATABASE. USE WITH EXTREME CAUTION.</p>
          <button 
            onClick={() => setShowResetConfirm(true)} 
            disabled={isResetting}
            className="hardware-btn border-red-500 text-red-500 hover:bg-red-500 hover:text-white w-full py-3 text-xs font-bold disabled:opacity-50"
          >
            {isResetting ? 'EXECUTING WIPE...' : 'EXECUTE FULL DATABASE WIPE'}
          </button>
        </div>
      )}

      {/* Custom Confirmation Modal */}
      <AnimatePresence>
        {showResetConfirm && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-bg/80 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="hardware-card max-w-md w-full p-8 space-y-6 border-red-500/30"
            >
              <div className="flex items-center gap-4 text-red-500">
                <Trash2 size={32} />
                <h3 className="text-xl font-black uppercase tracking-tighter">CRITICAL ACTION</h3>
              </div>
              
              <p className="text-sm font-mono opacity-70 leading-relaxed">
                ARE YOU ABSOLUTELY SURE? THIS WILL DELETE ALL USERS, MATCHES, AND STATS PERMANENTLY. THIS ACTION CANNOT BE UNDONE.
              </p>

              <div className="grid grid-cols-2 gap-4">
                <button 
                  onClick={() => setShowResetConfirm(false)}
                  className="hardware-btn bg-bg border-line/10 text-ink/50 hover:text-ink"
                >
                  CANCEL
                </button>
                <button 
                  onClick={handleResetDatabase}
                  className="hardware-btn bg-red-600 border-red-700 text-white hover:bg-red-500"
                >
                  CONFIRM RESET
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <GlobalChat user={user} profile={profile} />
    </div>
  );
}
