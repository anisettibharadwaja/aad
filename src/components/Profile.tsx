import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';
import { User } from 'firebase/auth';
import { UserProfile, Presence } from '../types';
import { Trophy, Target, Zap, Clock, ArrowLeft, Users, RefreshCw } from 'lucide-react';
import { cn } from '../lib/utils';
import { toast } from 'sonner';

export default function Profile({ 
  user, 
  profile: initialProfile, 
  onBack,
  onlineUsers = []
}: { 
  user: User; 
  profile: UserProfile | null; 
  onBack: () => void;
  onlineUsers?: Presence[];
}) {
  const [profile, setProfile] = useState<UserProfile | null>(initialProfile);
  const isOnline = onlineUsers.some(u => u.uid === profile?.uid);
  const [loading, setLoading] = useState(!initialProfile);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [gameFilter, setGameFilter] = useState<'all' | 'leastcount' | 'callbreak' | 'uno'>('all');

  const fetchProfile = async () => {
    setIsRefreshing(true);
    const path = `users/${user.uid}`;
    try {
      const docRef = doc(db, 'users', user.uid);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        setProfile(docSnap.data() as UserProfile);
        toast.success("Profile data refreshed");
      } else {
        const newProfile: UserProfile = {
          uid: user.uid,
          displayName: user.displayName || 'OPERATOR',
          photoURL: user.photoURL || '',
          wins: 0,
          losses: 0,
          leastCountWins: 0,
          leastCountLosses: 0,
          callBreakWins: 0,
          callBreakLosses: 0,
          unoWins: 0,
          unoLosses: 0,
          xp: 0,
          level: 1,
          matchHistory: [],
          following: [],
          createdAt: Date.now()
        };
        await setDoc(docRef, newProfile);
        setProfile(newProfile);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, path);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    if (initialProfile) {
      setProfile(initialProfile);
      setLoading(false);
      return;
    }

    fetchProfile();
  }, [user, initialProfile]);

  if (loading) return <div className="flex items-center justify-center h-screen font-mono text-xs uppercase tracking-[0.2em] opacity-50">RETRIEVING PROFILE DATA...</div>;

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      <header className="flex items-center justify-between border-b border-line pb-4">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 hover:bg-ink hover:text-bg rounded-full transition-all">
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-2xl font-bold uppercase tracking-widest font-mono">OPERATOR PROFILE</h1>
        </div>
        <button 
          onClick={fetchProfile} 
          disabled={isRefreshing}
          className={cn(
            "p-2 hover:bg-ink hover:text-bg rounded-full transition-all",
            isRefreshing && "animate-spin"
          )}
          title="Force Refresh Profile"
        >
          <RefreshCw size={20} />
        </button>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Profile Card */}
        <div className="md:col-span-1 hardware-card p-8 flex flex-col items-center text-center space-y-4">
          <div className="w-32 h-32 radial-track flex items-center justify-center relative">
            {user.photoURL ? (
              <img src={user.photoURL} alt="" className="w-28 h-28 rounded-full object-cover grayscale" referrerPolicy="no-referrer" />
            ) : (
              <Users size={48} className="opacity-30" />
            )}
            <div className="absolute -bottom-2 bg-ink text-bg px-3 py-1 text-xs font-bold rounded-full">
              LVL {profile?.level}
            </div>
          </div>
          <div className="space-y-1">
            <h2 className="text-xl font-bold uppercase tracking-tight">{profile?.displayName}</h2>
            <div className="flex items-center justify-center gap-1.5">
              <div className={cn("w-2 h-2 rounded-full", isOnline ? "bg-green-500 animate-pulse" : "bg-ink/20")} />
              <span className="text-[10px] font-mono uppercase tracking-widest opacity-50">
                {isOnline ? 'ONLINE' : 'OFFLINE'}
              </span>
            </div>
            <p className="text-[10px] opacity-50 font-mono">UID: {profile?.uid.substring(0, 12)}...</p>
          </div>
          <div className="w-full bg-line/10 h-2 rounded-full overflow-hidden">
            <div className="bg-ink h-full" style={{ width: `${(profile?.xp || 0) % 100}%` }} />
          </div>
          <p className="text-[10px] opacity-50 font-mono uppercase tracking-widest">XP: {profile?.xp} / {(profile?.level || 1) * 100}</p>
        </div>

        {/* Stats Grid */}
        <div className="md:col-span-2 grid grid-cols-2 gap-4">
          <div className="hardware-card p-6 flex flex-col justify-between relative overflow-hidden">
            <div className="absolute -right-2 -top-2 opacity-5">
              <Trophy size={64} />
            </div>
            <div className="space-y-1">
              <div className="text-3xl font-bold font-mono">{profile?.wins || 0}</div>
              <div className="text-[10px] uppercase opacity-50 font-mono tracking-widest">TOTAL VICTORIES</div>
            </div>
            <div className="grid grid-cols-3 gap-2 pt-4 border-t border-line/10 mt-2">
              <div>
                <div className="text-[8px] opacity-40 uppercase font-mono">LC</div>
                <div className="text-xs font-mono">{profile?.leastCountWins || 0}</div>
              </div>
              <div>
                <div className="text-[8px] opacity-40 uppercase font-mono">CB</div>
                <div className="text-xs font-mono">{profile?.callBreakWins || 0}</div>
              </div>
              <div>
                <div className="text-[8px] opacity-40 uppercase font-mono">UNO</div>
                <div className="text-xs font-mono">{profile?.unoWins || 0}</div>
              </div>
            </div>
          </div>
          <div className="hardware-card p-6 flex flex-col justify-between relative overflow-hidden">
            <div className="absolute -right-2 -top-2 opacity-5">
              <Target size={64} />
            </div>
            <div className="space-y-1">
              <div className="text-3xl font-bold font-mono">{profile?.losses || 0}</div>
              <div className="text-[10px] uppercase opacity-50 font-mono tracking-widest">TOTAL LOSSES</div>
            </div>
            <div className="grid grid-cols-3 gap-2 pt-4 border-t border-line/10 mt-2">
              <div>
                <div className="text-[8px] opacity-40 uppercase font-mono">LC</div>
                <div className="text-xs font-mono">{profile?.leastCountLosses || 0}</div>
              </div>
              <div>
                <div className="text-[8px] opacity-40 uppercase font-mono">CB</div>
                <div className="text-xs font-mono">{profile?.callBreakLosses || 0}</div>
              </div>
              <div>
                <div className="text-[8px] opacity-40 uppercase font-mono">UNO</div>
                <div className="text-xs font-mono">{profile?.unoLosses || 0}</div>
              </div>
            </div>
          </div>
          <div className="hardware-card p-6 flex flex-col justify-between">
            <Zap size={24} className="opacity-30" />
            <div className="space-y-1">
              <div className="text-3xl font-bold font-mono text-orange-500">{profile?.xp || 0}</div>
              <div className="text-[10px] uppercase opacity-50 font-mono tracking-widest">TOTAL XP</div>
            </div>
          </div>
          <div className="hardware-card p-6 flex flex-col justify-between">
            <Clock size={24} className="opacity-30" />
            <div className="space-y-1">
              <div className="text-3xl font-bold font-mono">{profile ? Math.floor((Date.now() - profile.createdAt) / (1000 * 60 * 60 * 24)) : 0}</div>
              <div className="text-[10px] uppercase opacity-50 font-mono tracking-widest">DAYS ACTIVE</div>
            </div>
          </div>
        </div>
      </div>

      {/* Session History */}
      <div className="hardware-card p-8 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-line pb-4">
          <div className="flex items-center gap-3">
            <Clock size={24} />
            <h2 className="text-xl font-bold uppercase tracking-widest font-mono">SESSION HISTORY</h2>
          </div>
          
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono opacity-50 uppercase tracking-widest">FILTER:</span>
            <select 
              value={gameFilter}
              onChange={(e) => setGameFilter(e.target.value as any)}
              className="bg-bg border border-line/20 text-[10px] font-mono px-2 py-1 focus:outline-none focus:border-ink uppercase tracking-widest"
            >
              <option value="all">ALL GAMES</option>
              <option value="leastcount">LEAST COUNT</option>
              <option value="callbreak">CALL BREAK</option>
              <option value="uno">UNO</option>
            </select>
          </div>
        </div>

        <div className="space-y-6">
          {profile?.matchHistory && profile.matchHistory.length > 0 ? (
            (() => {
              const filtered = profile.matchHistory.filter(match => gameFilter === 'all' || match.gameType === gameFilter);
              if (filtered.length === 0) {
                return (
                  <div className="text-center py-12 opacity-30 font-mono text-xs uppercase tracking-widest border border-dashed border-line/20">
                    NO {gameFilter === 'all' ? '' : gameFilter.replace('leastcount', 'LEAST COUNT').replace('callbreak', 'CALL BREAK').toUpperCase()} SESSION DATA FOUND
                  </div>
                );
              }
              return filtered.map((match) => (
                <div key={match.id} className="border border-line/20 p-4 space-y-4 bg-ink/[0.02]">
                  <div className="flex justify-between items-center border-b border-line/10 pb-2">
                    <div className="flex items-center gap-2">
                      <div className="px-2 py-0.5 bg-ink text-bg text-[8px] font-black uppercase tracking-tighter">
                        {match.gameType === 'leastcount' ? 'LEAST COUNT' : 
                         match.gameType === 'callbreak' ? 'CALL BREAK' : 
                         match.gameType === 'uno' ? 'UNO' : 'LEGACY'}
                      </div>
                      <div className="text-[10px] font-mono opacity-50 uppercase tracking-widest">ROOM: {match.roomId}</div>
                    </div>
                    <div className="text-[10px] font-mono opacity-50">{new Date(match.endedAt).toLocaleString()}</div>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <div className="flex -space-x-2">
                      {match.participants.map((p) => (
                        <div key={p.uid} className={cn(
                          "w-10 h-10 rounded-full border-2 border-bg flex items-center justify-center overflow-hidden bg-bg",
                          p.uid === match.winnerId ? "ring-2 ring-ink z-10" : "opacity-50 grayscale"
                        )} title={p.displayName}>
                          {p.photoURL ? (
                            <img src={p.photoURL} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          ) : (
                            <Users size={16} className="opacity-30" />
                          )}
                        </div>
                      ))}
                    </div>
                    <div className={cn(
                      "px-4 py-1 text-xs font-bold uppercase tracking-widest rounded-full border",
                      match.winnerId === user.uid 
                        ? "bg-green-50 text-green-700 border-green-200" 
                        : "bg-red-50 text-red-700 border-red-200"
                    )}>
                      {match.winnerId === user.uid ? 'VICTORY' : 'DEFEAT'}
                    </div>
                  </div>

                  {/* Round Scores Table */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-[10px] font-mono border-collapse">
                      <thead>
                        <tr className="border-b border-line/10">
                          <th className="text-left py-2 opacity-50">ROUND</th>
                          {match.participants.map(p => (
                            <th key={p.uid} className={cn(
                              "text-right py-2 px-2",
                              p.uid === user.uid && "font-bold text-ink"
                            )}>
                              {p.displayName.split(' ')[0].toUpperCase()}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {match.roundScores.map(rs => (
                          <tr key={rs.round} className="border-b border-line/5 hover:bg-ink/[0.01]">
                            <td className="py-1.5 opacity-50">R{rs.round}</td>
                            {match.participants.map(p => (
                              <td key={p.uid} className={cn(
                                "text-right py-1.5 px-2",
                                p.uid === user.uid && "bg-ink/[0.02]"
                              )}>
                                {rs.scores[p.uid] ?? '-'}
                              </td>
                            ))}
                          </tr>
                        ))}
                        <tr className="font-bold bg-ink/5">
                          <td className="py-2 px-1">TOTAL</td>
                          {match.participants.map(p => (
                            <td key={p.uid} className="text-right py-2 px-2">{p.score}</td>
                          ))}
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              ));
            })()
          ) : (
            <div className="text-center py-12 opacity-30 font-mono text-xs uppercase tracking-widest border border-dashed border-line/20">
              NO SESSION DATA RECORDED
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
