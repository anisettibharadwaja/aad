import React, { useState, useEffect } from 'react';
import { auth, signInWithGoogle, signInAsGuest } from '../firebase';
import { onAuthStateChanged, User, updateProfile } from 'firebase/auth';
import { LogIn, User as UserIcon, UserCircle, ArrowRight } from 'lucide-react';

export default function Auth({ onAuth }: { onAuth: (user: User) => void }) {
  const [loading, setLoading] = useState(true);
  const [guestName, setGuestName] = useState('');
  const [showGuestInput, setShowGuestInput] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) onAuth(user);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [onAuth]);

  const handleGuestSignIn = async () => {
    if (!guestName.trim()) return;
    setIsSigningIn(true);
    try {
      const user = await signInAsGuest();
      await updateProfile(user, { displayName: guestName.trim() });
      onAuth(user);
    } catch (error) {
      console.error("Guest sign in failed", error);
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsSigningIn(true);
    try {
      await signInWithGoogle();
    } catch (error) {
      console.error("Google sign in failed", error);
    } finally {
      setIsSigningIn(false);
    }
  };

  if (loading) return <div className="flex items-center justify-center h-screen font-mono text-ink/40 animate-pulse">INITIALIZING...</div>;

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-bg text-ink">
      <div className="hardware-card p-6 md:p-10 max-w-md w-full text-center space-y-8 relative overflow-hidden">
        {/* Decorative background element */}
        <div className="absolute top-0 left-0 w-full h-1 bg-ink/10">
          <div className="h-full bg-ink/40 w-1/3 animate-[shimmer_2s_infinite]"></div>
        </div>

        <div className="flex justify-center">
          <div className="w-20 h-20 radial-track flex items-center justify-center border border-ink/10 rounded-full">
            <UserIcon size={40} className="text-ink/80" />
          </div>
        </div>

        <div className="space-y-2">
          <h1 className="text-3xl md:text-4xl font-bold uppercase tracking-[0.2em]">LEAST COUNT</h1>
          <p className="text-[10px] md:text-xs opacity-60 font-mono tracking-widest">SECURE MULTIPLAYER PROTOCOL v1.1</p>
        </div>
        
        <div className="space-y-4">
          {!showGuestInput ? (
            <>
              <button 
                onClick={handleGoogleSignIn}
                disabled={isSigningIn}
                className="hardware-btn w-full flex items-center justify-center gap-3 py-4 group"
              >
                <LogIn size={20} className="group-hover:scale-110 transition-transform" />
                <span className="font-bold tracking-wider">AUTHENTICATE WITH GOOGLE</span>
              </button>

              <button 
                onClick={() => { setShowGuestInput(true); }}
                disabled={isSigningIn}
                className="hardware-btn w-full flex items-center justify-center gap-3 bg-transparent text-ink border-line py-4 group"
              >
                <UserCircle size={20} className="group-hover:scale-110 transition-transform" />
                <span className="font-bold tracking-wider">PLAY AS GUEST</span>
              </button>
            </>
          ) : (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
              <div className="relative">
                <input 
                  type="text" 
                  placeholder="ENTER YOUR NAME" 
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value.toUpperCase())}
                  autoFocus
                  className="w-full bg-ink/5 border-b-2 border-ink/20 p-4 font-mono text-center focus:outline-none focus:border-ink transition-colors uppercase tracking-widest"
                  onKeyDown={(e) => e.key === 'Enter' && handleGuestSignIn()}
                />
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={() => { setShowGuestInput(false); }}
                  className="hardware-btn flex-1 bg-transparent text-ink border-line py-3 text-xs"
                >
                  CANCEL
                </button>
                <button 
                  onClick={handleGuestSignIn}
                  disabled={!guestName.trim() || isSigningIn}
                  className="hardware-btn flex-1 flex items-center justify-center gap-2 py-3 text-xs"
                >
                  CONTINUE <ArrowRight size={14} />
                </button>
              </div>
            </div>
          )}
        </div>
        
        <div className="pt-4 border-t border-ink/5">
          <div className="text-[9px] uppercase opacity-30 font-mono tracking-[0.3em]">
            {isSigningIn ? 'ESTABLISHING HANDSHAKE...' : 'READY FOR CONNECTION'}
          </div>
        </div>
      </div>
    </div>
  );
}
