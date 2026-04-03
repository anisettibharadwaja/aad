import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';
import { UserProfile, Presence } from '../types';
import { Trophy, ArrowLeft, Users, Target, Swords, Hash } from 'lucide-react';
import { cn } from '../lib/utils';

export default function Leaderboard({ 
  onBack,
  onlineUsers = []
}: { 
  onBack: () => void;
  onlineUsers?: Presence[];
}) {
  const [leaders, setLeaders] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLeaders = async () => {
      const path = 'users';
      try {
        // Order by total wins
        const q = query(collection(db, path), orderBy('wins', 'desc'), limit(20));
        const querySnapshot = await getDocs(q);
        const data = querySnapshot.docs.map(doc => doc.data() as UserProfile);
        setLeaders(data);
        setLoading(false);
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, path);
      }
    };
    fetchLeaders();
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center h-screen font-mono text-xs uppercase tracking-[0.2em] opacity-50">
      SYNCHRONIZING GLOBAL RANKINGS...
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-8 space-y-8">
      <header className="flex items-center gap-4 border-b border-line pb-6">
        <button onClick={onBack} className="p-2 hover:bg-ink hover:text-bg rounded-full transition-all">
          <ArrowLeft size={20} />
        </button>
        <div className="space-y-1">
          <h1 className="text-xl md:text-3xl font-bold uppercase tracking-widest font-mono">GLOBAL RANKINGS</h1>
          <p className="text-[10px] md:text-xs opacity-50 font-mono uppercase tracking-widest">TOP OPERATORS BY TOTAL VICTORIES</p>
        </div>
      </header>

      <div className="hidden md:block overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
        <table className="w-full border-collapse min-w-[800px]">
          <thead>
            <tr className="border-b border-line/20 text-[10px] font-mono opacity-50 uppercase tracking-widest">
              <th className="py-4 px-2 text-left w-16">RANK</th>
              <th className="py-4 px-4 text-left">OPERATOR</th>
              <th className="py-4 px-4 text-center bg-ink/[0.02]">TOTAL WINS</th>
              <th className="py-4 px-4 text-center">LEAST COUNT</th>
              <th className="py-4 px-4 text-center">CALL BREAK</th>
              <th className="py-4 px-4 text-center">UNO</th>
              <th className="py-4 px-4 text-center text-red-500/70">LOSSES</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line/10">
            {leaders.map((leader, idx) => (
              <tr key={leader.uid} className={cn(
                "group hover:bg-ink/[0.02] transition-colors",
                idx === 0 && "bg-ink/[0.03]"
              )}>
                <td className="py-6 px-2">
                  <div className={cn(
                    "w-10 h-10 flex items-center justify-center font-mono font-bold text-lg",
                    idx === 0 && "text-orange-500",
                    idx === 1 && "text-gray-400",
                    idx === 2 && "text-amber-600",
                    idx > 2 && "opacity-30"
                  )}>
                    {idx === 0 ? <Trophy size={24} /> : idx + 1}
                  </div>
                </td>
                <td className="py-6 px-4">
                  <div className="flex items-center gap-4">
                    <div className="relative">
                      {leader.photoURL ? (
                        <img src={leader.photoURL} alt="" className="w-10 h-10 rounded-full object-cover grayscale group-hover:grayscale-0 transition-all" referrerPolicy="no-referrer" />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-ink/10 flex items-center justify-center">
                          <Users size={16} className="opacity-30" />
                        </div>
                      )}
                      {onlineUsers.some(u => u.uid === leader.uid) && (
                        <div className="absolute top-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-bg animate-pulse" />
                      )}
                      <div className="absolute -bottom-1 -right-1 bg-ink text-bg text-[8px] font-bold px-1.5 py-0.5 rounded-full border border-bg">
                        L{leader.level}
                      </div>
                    </div>
                    <div className="space-y-0.5">
                      <div className="text-sm font-bold uppercase tracking-tight">{leader.displayName}</div>
                      <div className="text-[9px] opacity-30 font-mono uppercase tracking-tighter">ID: {leader.uid.substring(0, 8)}</div>
                    </div>
                  </div>
                </td>
                <td className="py-6 px-4 text-center bg-ink/[0.02]">
                  <div className="text-xl font-bold font-mono">{leader.wins || 0}</div>
                </td>
                <td className="py-6 px-4 text-center">
                  <div className="text-sm font-mono opacity-70">{leader.leastCountWins || 0}</div>
                </td>
                <td className="py-6 px-4 text-center">
                  <div className="text-sm font-mono opacity-70">{leader.callBreakWins || 0}</div>
                </td>
                <td className="py-6 px-4 text-center">
                  <div className="text-sm font-mono opacity-70">{leader.unoWins || 0}</div>
                </td>
                <td className="py-6 px-4 text-center">
                  <div className="text-sm font-mono text-red-500/50">{leader.losses || 0}</div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile View Card Layout (Hidden on Desktop) */}
      <div className="md:hidden space-y-4">
        {leaders.map((leader, idx) => (
          <div key={leader.uid} className={cn(
            "hardware-card p-4 space-y-4",
            idx === 0 && "border-orange-500/30 bg-orange-500/[0.02]"
          )}>
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className={cn(
                  "w-8 h-8 flex items-center justify-center font-mono font-bold",
                  idx === 0 && "text-orange-500",
                  idx === 1 && "text-gray-400",
                  idx === 2 && "text-amber-600",
                  idx > 2 && "opacity-30"
                )}>
                  {idx === 0 ? <Trophy size={20} /> : idx + 1}
                </div>
                <div className="flex items-center gap-2">
                  {leader.photoURL ? (
                    <img src={leader.photoURL} alt="" className="w-8 h-8 rounded-full object-cover grayscale" referrerPolicy="no-referrer" />
                  ) : (
                    <Users size={14} className="opacity-30" />
                  )}
                  {onlineUsers.some(u => u.uid === leader.uid) && (
                    <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-green-500 rounded-full border border-bg animate-pulse" />
                  )}
                  <div className="text-xs font-bold uppercase">{leader.displayName}</div>
                </div>
              </div>
              <div className="text-lg font-bold font-mono">{leader.wins || 0} WINS</div>
            </div>
            
            <div className="grid grid-cols-4 gap-2 pt-2 border-t border-line/10">
              <div className="text-center">
                <div className="text-[8px] opacity-40 font-mono uppercase">LC</div>
                <div className="text-xs font-mono">{leader.leastCountWins || 0}</div>
              </div>
              <div className="text-center">
                <div className="text-[8px] opacity-40 font-mono uppercase">CB</div>
                <div className="text-xs font-mono">{leader.callBreakWins || 0}</div>
              </div>
              <div className="text-center">
                <div className="text-[8px] opacity-40 font-mono uppercase">UNO</div>
                <div className="text-xs font-mono">{leader.unoWins || 0}</div>
              </div>
              <div className="text-center">
                <div className="text-[8px] opacity-40 font-mono uppercase text-red-500">LOSS</div>
                <div className="text-xs font-mono text-red-500/70">{leader.losses || 0}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="text-center py-8">
        <div className="text-[10px] uppercase opacity-40 font-mono tracking-widest">
          RANKINGS ARE UPDATED IN REAL-TIME BASED ON GLOBAL SESSION DATA.
        </div>
      </div>
    </div>
  );
}
