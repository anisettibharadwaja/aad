import React, { useState, useEffect, useCallback } from 'react';
import { User, signOut } from 'firebase/auth';
import { auth, db } from './firebase';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import Auth from './components/Auth';
import CallBreakRules from './components/callbreak/CallBreakRules';
import UnoRules from './components/uno/UnoRules';
import CallBreakGameBoard from './components/callbreak/GameBoard';
import UnoGameBoard from './components/uno/GameBoard';
import Dashboard from './components/Dashboard';
import GameBoard from './components/leastcount/GameBoard';
import Profile from './components/Profile';
import Leaderboard from './components/Leaderboard';
import DebugPanel from './components/DebugPanel';
import GlobalChat from './components/GlobalChat';
import { Moon, Sun, LogOut, User as UserIcon } from 'lucide-react';
import { registerSound } from './lib/sounds';
import SoundControl from './components/SoundControl';
import { Toaster } from 'sonner';
import { UserProfile, Sound, Presence } from './types';
import { collection, query, orderBy, onSnapshot as firestoreOnSnapshot } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from './lib/firestore-errors';
import { io, Socket } from 'socket.io-client';

type View = 'dashboard' | 'game' | 'profile' | 'leaderboard' | 'callBreakRules' | 'unoRules' | 'callBreakGame' | 'unoGame';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [view, setView] = useState<View>('dashboard');
  const [lastLobbyView, setLastLobbyView] = useState<View>(() => {
    const saved = localStorage.getItem('last_lobby_view');
    return (saved as View) || 'dashboard';
  });

  const [onlineCount, setOnlineCount] = useState(0);
  const [onlineUsers, setOnlineUsers] = useState<Presence[]>([]);
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    localStorage.setItem('last_lobby_view', lastLobbyView);
  }, [lastLobbyView]);

  useEffect(() => {
    if (view === 'dashboard') {
      setLastLobbyView(view);
    }
  }, [view]);
  const [currentRoomId, setCurrentRoomId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isDark, setIsDark] = useState(false);
  const [customSounds, setCustomSounds] = useState<Sound[]>([]);

  // Register custom sounds from Firestore
  useEffect(() => {
    if (!user) return;
    
    const path = 'sounds';
    const q = query(collection(db, path), orderBy('createdAt', 'desc'));
    const unsub = firestoreOnSnapshot(q, (snapshot) => {
      const soundsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Sound[];
      
      setCustomSounds(soundsData);
      
      // Register each custom sound with Howler
      soundsData.forEach(sound => {
        // Prevent custom sounds from overwriting system sounds
        const systemSoundIds = ['click', 'draw', 'discard', 'win', 'lose', 'call', 'declare', 'turn'];
        if (!systemSoundIds.includes(sound.id.toLowerCase())) {
          registerSound(sound.id, `/sounds/${sound.id.toLowerCase()}.mp3`);
        }
      });
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    });

    return () => unsub();
  }, [user]);

  // Sync profile data
  useEffect(() => {
    if (!user) {
      setProfile(null);
      return;
    }

    const path = `users/${user.uid}`;
    const unsub = firestoreOnSnapshot(doc(db, 'users', user.uid), (doc) => {
      if (doc.exists()) {
        setProfile(doc.data() as UserProfile);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    });

    return () => unsub();
  }, [user]);

  // Restore session on mount
  useEffect(() => {
    const savedLeastCountRoomId = localStorage.getItem('least_count_room_id');
    const savedCallBreakRoomId = localStorage.getItem('callbreak_room_id');
    const savedUnoRoomId = localStorage.getItem('uno_room_id');
    
    if (savedLeastCountRoomId) {
      setCurrentRoomId(savedLeastCountRoomId);
      setIsCreating(false);
      setView('game');
      setLastLobbyView('dashboard');
    } else if (savedCallBreakRoomId) {
      setCurrentRoomId(savedCallBreakRoomId);
      setIsCreating(false);
      setView('callBreakGame');
      setLastLobbyView('dashboard');
    } else if (savedUnoRoomId) {
      const savedIsCreating = localStorage.getItem('uno_is_creating') === 'true';
      setCurrentRoomId(savedUnoRoomId);
      setIsCreating(savedIsCreating);
      setView('unoGame');
      setLastLobbyView('dashboard');
    }
  }, []);

  useEffect(() => {
    if (!user) {
      if (socket) {
        socket.disconnect();
        setSocket(null);
      }
      return;
    }

    const newSocket = io();
    setSocket(newSocket);

    newSocket.on('connect', () => {
      newSocket.emit('presence_update', {
        user: {
          uid: user.uid,
          displayName: profile?.displayName || user.displayName || 'GUEST',
          photoURL: user.photoURL
        }
      });
    });

    newSocket.on('online_count', (count: number) => setOnlineCount(count));
    newSocket.on('online_users', (users: any[]) => {
      setOnlineUsers(users.map(u => ({ ...u, isOnline: true, lastSeen: Date.now() })));
    });

    return () => {
      newSocket.disconnect();
    };
  }, [user, profile?.displayName]);

  useEffect(() => {
    if (isDark) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [isDark]);

  const handleSignOut = useCallback(async () => {
    try {
      await signOut(auth);
      setUser(null);
      setView('dashboard');
      setCurrentRoomId(null);
      setIsCreating(false);
      localStorage.removeItem('least_count_room_id');
      localStorage.removeItem('callbreak_room_id');
      localStorage.removeItem('uno_room_id');
    } catch (error) {
      console.error("Sign out failed", error);
    }
  }, []);

  const handleJoinRoom = useCallback((roomId: string, creating: boolean = false) => {
    setCurrentRoomId(roomId);
    setIsCreating(creating);
    setView('game');
    setLastLobbyView('dashboard');
    localStorage.setItem('least_count_room_id', roomId);
  }, []);

  const handleLeaveRoom = useCallback(() => {
    setCurrentRoomId(null);
    setIsCreating(false);
    setView('dashboard');
    setLastLobbyView('dashboard');
    localStorage.removeItem('least_count_room_id');
  }, []);

  const handleJoinCallBreakRoom = useCallback((roomId: string, creating: boolean = false) => {
    setCurrentRoomId(roomId);
    setIsCreating(creating);
    setView('callBreakGame');
    setLastLobbyView('dashboard');
    localStorage.setItem('callbreak_room_id', roomId);
  }, []);

  const handleLeaveCallBreakRoom = useCallback(() => {
    setCurrentRoomId(null);
    setIsCreating(false);
    setView('dashboard');
    setLastLobbyView('dashboard');
    localStorage.removeItem('callbreak_room_id');
  }, []);

  const handleJoinUnoRoom = useCallback((roomId: string, creating: boolean = false) => {
    setCurrentRoomId(roomId);
    setIsCreating(creating);
    setView('unoGame');
    setLastLobbyView('dashboard');
    localStorage.setItem('uno_room_id', roomId);
    localStorage.setItem('uno_is_creating', String(creating));
  }, []);

  const handleLeaveUnoRoom = useCallback(() => {
    setCurrentRoomId(null);
    setIsCreating(false);
    setView('dashboard');
    setLastLobbyView('dashboard');
    localStorage.removeItem('uno_room_id');
    localStorage.removeItem('uno_is_creating');
  }, []);

  const toggleTheme = useCallback(() => {
    setIsDark(prev => !prev);
  }, []);

  if (!user) {
    return <Auth onAuth={setUser} />;
  }

  return (
    <div className="h-screen h-[100dvh] bg-bg text-ink selection:bg-ink selection:text-bg flex flex-col overflow-hidden">
      <Toaster position="top-center" richColors />
      {/* Responsive Header - Only visible on dashboard */}
      {(view === 'dashboard') && (
        <header className="sticky top-0 z-50 bg-bg/80 backdrop-blur-md border-b border-ink/5 px-4 py-2 md:py-3 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 radial-track flex items-center justify-center border border-ink/10 rounded-full">
              <span className="font-bold text-xs">GC</span>
            </div>
            <h1 className="font-bold uppercase tracking-widest text-sm hidden sm:block">
              GAME CENTER
            </h1>
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
            <SoundControl />

            <button 
              onClick={toggleTheme}
              className="p-2 hover:bg-ink hover:text-bg rounded-full border border-ink/10 transition-all"
              title="TOGGLE THEME"
            >
              {isDark ? <Sun size={16} /> : <Moon size={16} />}
            </button>

            <button 
              onClick={() => setView('profile')}
              className="flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all text-xs font-mono uppercase tracking-wider border-ink/10 hover:border-ink/30 bg-ink/5"
            >
              <div className="flex items-center gap-1.5">
                <UserIcon size={14} />
                <span className="hidden xs:inline">{profile?.displayName || user.displayName || 'GUEST'}</span>
              </div>
              <div className="w-px h-3 bg-ink/10 mx-1 hidden xs:block" />
              <div className="flex items-center gap-1 text-orange-500 font-bold">
                <span className="text-[10px]">LVL</span>
                <span>{profile?.level || 1}</span>
              </div>
            </button>
            
            <button 
              onClick={handleSignOut}
              className="p-2 hover:bg-ink hover:text-bg rounded-full border border-ink/10 transition-all group"
              title="SIGN OUT"
            >
              <LogOut size={16} className="group-hover:scale-110 transition-transform" />
            </button>
          </div>
        </header>
      )}

      <main className="flex-1 overflow-y-auto no-scrollbar min-h-0">
        {view === 'dashboard' && (
          <Dashboard 
            user={user}
            profile={profile}
            onJoinLeastCount={handleJoinRoom}
            onJoinCallBreak={handleJoinCallBreakRoom}
            onJoinUno={handleJoinUnoRoom}
            onViewLeaderboard={() => setView('leaderboard')}
            onViewProfile={() => setView('profile')}
            onViewUnoRules={() => setView('unoRules')}
            onViewCallBreakRules={() => setView('callBreakRules')}
            isDark={isDark}
            toggleTheme={toggleTheme}
          />
        )}

        {view === 'callBreakRules' && (
          <CallBreakRules onBack={() => setView('dashboard')} />
        )}

        {view === 'unoRules' && (
          <UnoRules onBack={() => setView('dashboard')} />
        )}

        {view === 'callBreakGame' && currentRoomId && (
          <CallBreakGameBoard 
            user={user} 
            roomId={currentRoomId} 
            isCreating={isCreating}
            onLeave={handleLeaveCallBreakRoom} 
            isDark={isDark}
            toggleTheme={toggleTheme}
            customSounds={customSounds}
          />
        )}
        
        {view === 'game' && currentRoomId && (
          <GameBoard 
            user={user} 
            roomId={currentRoomId} 
            isCreating={isCreating}
            onLeave={handleLeaveRoom} 
            isDark={isDark}
            toggleTheme={toggleTheme}
            customSounds={customSounds}
          />
        )}

        {view === 'unoGame' && currentRoomId && (
          <UnoGameBoard 
            user={user} 
            roomId={currentRoomId} 
            isCreating={isCreating}
            onLeave={handleLeaveUnoRoom} 
            isDark={isDark}
            toggleTheme={toggleTheme}
            customSounds={customSounds}
          />
        )}

        {view === 'profile' && (
          <Profile 
            user={user} 
            profile={profile}
            onBack={() => setView(lastLobbyView)} 
            onlineUsers={onlineUsers}
          />
        )}

        {view === 'leaderboard' && (
          <Leaderboard 
            onBack={() => setView(lastLobbyView)} 
            onlineUsers={onlineUsers}
          />
        )}
      </main>

      {/* Global Footer - Only visible on dashboard */}
      {(view === 'dashboard') && (
        <footer className="bg-bg border-t border-ink/5 px-6 py-3 md:py-4 flex flex-col sm:flex-row justify-between items-center gap-2 sm:gap-4 font-mono text-[8px] md:text-[10px] uppercase tracking-widest opacity-40 shrink-0">
          <div className="flex items-center gap-4">
            <span>MULTIPLAYER GAME CENTER</span>
            <span className="opacity-30">//</span>
            <span>SYSTEM v1.1.0</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              <span>CONNECTION SECURE</span>
            </div>
            <span className="opacity-30">//</span>
            <span>LATENCY: 24MS</span>
          </div>
        </footer>
      )}

      {/* Debug Panel */}
      <DebugPanel />

      {/* Global Chat */}
      <GlobalChat 
        user={user} 
        profile={profile} 
        socket={socket}
        onlineCount={onlineCount}
        onlineUsers={onlineUsers}
      />
    </div>
  );
}
