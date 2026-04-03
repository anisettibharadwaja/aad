import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';
import { UserProfile } from '../types';
import { Trophy, ArrowLeft, Medal, Users, Zap } from 'lucide-react';

export default function Leaderboard({ onBack }: { onBack: () => void }) {
  const [leaders, setLeaders] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLeaders = async () => {
      const path = 'users';
      try {
        const q = query(collection(db, path), orderBy('xp', 'desc'), limit(10));
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

  if (loading) return <div className="flex items-center justify-center h-screen font-mono">RETRIEVING GLOBAL RANKINGS...</div>;

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      <header className="flex items-center gap-4 border-b border-line pb-4">
        <button onClick={onBack} className="p-2 hover:bg-ink hover:text-bg rounded-full transition-all">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-2xl font-bold uppercase tracking-widest font-mono">GLOBAL RANKINGS</h1>
      </header>

      <div className="space-y-4">
        {leaders.map((leader, idx) => (
          <div key={leader.uid} className={cn(
            "hardware-card p-6 flex justify-between items-center transition-all",
            idx === 0 && "bg-ink/5 border-ink/20"
          )}>
            <div className="flex items-center gap-6">
              <div className={cn(
                "w-12 h-12 radial-track flex items-center justify-center font-bold text-xl",
                idx === 0 && "text-orange-500",
                idx === 1 && "text-gray-400",
                idx === 2 && "text-amber-600"
              )}>
                {idx === 0 ? <Trophy size={24} /> : idx + 1}
              </div>
              <div className="flex items-center gap-4">
                {leader.photoURL ? (
                  <img src={leader.photoURL} alt="" className="w-10 h-10 rounded-full object-cover grayscale" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-ink/10 flex items-center justify-center">
                    <Users size={16} className="opacity-30" />
                  </div>
                )}
                <div className="space-y-0.5">
                  <div className="text-sm font-bold uppercase">{leader.displayName}</div>
                  <div className="text-[10px] opacity-50 font-mono tracking-widest">LVL {leader.level}</div>
                </div>
              </div>
            </div>
            
            <div className="flex gap-12 text-right">
              <div className="space-y-0.5">
                <div className="text-xl font-bold font-mono">{leader.wins}</div>
                <div className="text-[10px] uppercase opacity-50 font-mono tracking-widest">WINS</div>
              </div>
              <div className="space-y-0.5">
                <div className="text-xl font-bold font-mono">{leader.xp}</div>
                <div className="text-[10px] uppercase opacity-50 font-mono tracking-widest">XP</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="text-center py-8">
        <div className="text-[10px] uppercase opacity-40 font-mono">
          RANKINGS ARE UPDATED IN REAL-TIME BASED ON GLOBAL SESSION DATA.
        </div>
      </div>
    </div>
  );
}

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(' ');
}
