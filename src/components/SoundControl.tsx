import React, { useState, useEffect } from 'react';
import { Volume2, VolumeX, Plus, Minus } from 'lucide-react';
import { setGlobalVolume } from '../lib/sounds';

interface SoundControlProps {
  className?: string;
}

export default function SoundControl({ className }: SoundControlProps) {
  const [volume, setVolume] = useState(() => {
    const saved = localStorage.getItem('app_volume');
    return saved ? parseFloat(saved) : 0.5;
  });
  const [isMuted, setIsMuted] = useState(() => {
    return localStorage.getItem('app_muted') === 'true';
  });

  useEffect(() => {
    setGlobalVolume(isMuted ? 0 : volume);
    localStorage.setItem('app_volume', volume.toString());
    localStorage.setItem('app_muted', isMuted.toString());
    
    // Dispatch a custom event so other SoundControl components can sync
    window.dispatchEvent(new CustomEvent('app_sound_change', { 
      detail: { volume, isMuted } 
    }));
  }, [volume, isMuted]);

  useEffect(() => {
    const handleSync = (e: any) => {
      if (e.detail.volume !== volume) setVolume(e.detail.volume);
      if (e.detail.isMuted !== isMuted) setIsMuted(e.detail.isMuted);
    };
    window.addEventListener('app_sound_change', handleSync);
    return () => window.removeEventListener('app_sound_change', handleSync);
  }, [volume, isMuted]);

  const toggleMute = () => setIsMuted(!isMuted);
  const increaseVolume = () => {
    setVolume(prev => Math.min(1, prev + 0.1));
    if (isMuted) setIsMuted(false);
  };
  const decreaseVolume = () => {
    setVolume(prev => Math.max(0, prev - 0.1));
  };

  return (
    <div className={`flex items-center gap-1 bg-ink/5 rounded-full border border-ink/10 p-1 ${className}`}>
      <button 
        onClick={toggleMute}
        className={`p-1.5 rounded-full transition-all ${isMuted ? 'bg-red-500 text-white' : 'hover:bg-ink/10'}`}
        title={isMuted ? "UNMUTE" : "MUTE"}
      >
        {isMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
      </button>
      
      <div className="flex items-center gap-0.5 px-1">
        <button 
          onClick={decreaseVolume}
          className="p-1 hover:bg-ink/10 rounded-full transition-all"
          disabled={isMuted}
        >
          <Minus size={12} />
        </button>
        <div className="w-12 h-1.5 bg-ink/10 rounded-full overflow-hidden relative">
          <div 
            className="absolute inset-y-0 left-0 bg-ink transition-all duration-300" 
            style={{ width: `${isMuted ? 0 : volume * 100}%` }}
          />
        </div>
        <button 
          onClick={increaseVolume}
          className="p-1 hover:bg-ink/10 rounded-full transition-all"
          disabled={isMuted}
        >
          <Plus size={12} />
        </button>
      </div>
    </div>
  );
}
