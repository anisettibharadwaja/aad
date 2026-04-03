import { Howl } from 'howler';

export const sounds: Record<string, Howl> = {
  click: new Howl({ src: ['/sounds/click.mp3'], html5: false }),
  draw: new Howl({ src: ['/sounds/draw.mp3'], html5: false }),
  discard: new Howl({ src: ['/sounds/discard.mp3'], html5: false }),
  win: new Howl({ src: ['/sounds/win.mp3'], html5: false }),
  lose: new Howl({ src: ['/sounds/lose.mp3'], html5: false }),
  call: new Howl({ src: ['/sounds/call.mp3'], html5: false }),
  declare: new Howl({ src: ['/sounds/declare.mp3'], html5: false }),
  turn: new Howl({ src: ['/sounds/turn.mp3'], html5: false }),
  
  // Local Reaction/Meme Sounds
  two_hours_later: new Howl({ src: ['/sounds/two_hours_later.mp3'], html5: false }),
  bruh: new Howl({ src: ['/sounds/bruh.mp3'], html5: false }),
  clap: new Howl({ src: ['/sounds/clap.mp3'], html5: false }),
  coffin_dance: new Howl({ src: ['/sounds/coffin_dance.mp3'], html5: false }),
  emotional_damage: new Howl({ src: ['/sounds/emotional_damage.mp3'], html5: false }),
  fahh: new Howl({ src: ['/sounds/fahh.mp3'], html5: false }),
  fbi_open_up: new Howl({ src: ['/sounds/fbi_open_up.mp3'], html5: false }),
  gay: new Howl({ src: ['/sounds/gay.mp3'], html5: false }),
  lol: new Howl({ src: ['/sounds/lol.mp3'], html5: false }),
  no_god_no: new Howl({ src: ['/sounds/no_god_no.mp3'], html5: false }),
  oops: new Howl({ src: ['/sounds/oops.mp3'], html5: false }),
  sad_trombone: new Howl({ src: ['/sounds/sad_trombone.mp3'], html5: false }),
  suspicious: new Howl({ src: ['/sounds/suspicious.mp3'], html5: false }),
  tada: new Howl({ src: ['/sounds/tada.mp3'], html5: false }),
  vine_boom: new Howl({ src: ['/sounds/vine_boom.mp3'], html5: false }),
  why_are_you_running: new Howl({ src: ['/sounds/why_are_you_running.mp3'], html5: false }),
  why_you_lying: new Howl({ src: ['/sounds/why_you_lying.mp3'], html5: false }),
  wow: new Howl({ src: ['/sounds/wow.mp3'], html5: false }),
  wrecked: new Howl({ src: ['/sounds/wrecked.mp3'], html5: false })
};

// Add error handling to all sounds
Object.entries(sounds).forEach(([name, sound]) => {
  sound.on('loaderror', (id, error) => {
    console.error(`Howl load error for ${name}:`, error, id);
  });
  sound.on('playerror', (id, error) => {
    console.error(`Howl play error for ${name}:`, error, id);
  });
});

const getInitialVolume = () => {
  if (typeof window === 'undefined') return 0.5;
  const muted = localStorage.getItem('app_muted') === 'true';
  if (muted) return 0;
  const saved = localStorage.getItem('app_volume');
  return saved ? parseFloat(saved) : 0.5;
};

let currentVolume = getInitialVolume();

// Apply initial volume to all sounds
Object.values(sounds).forEach(s => s.volume(currentVolume));

export const registerSound = (id: string, src: string) => {
  if (sounds[id]) {
    sounds[id].unload();
  }
  sounds[id] = new Howl({ src: [src], html5: false, volume: currentVolume });
  sounds[id].on('loaderror', (id, error) => {
    console.error(`Howl load error for ${id}:`, error);
  });
  sounds[id].on('playerror', (id, error) => {
    console.error(`Howl play error for ${id}:`, error);
  });
};

export const playSound = (sound: string) => {
  console.log(`Actually playing sound via Howler: ${sound}`);
  const s = sounds[sound];
  if (s) {
    if (s.state() === 'unloaded') {
      s.load();
    }
    s.play();
  } else {
    console.error(`Sound not found: ${sound}`);
  }
};

export const setGlobalVolume = (volume: number) => {
  currentVolume = volume;
  Object.values(sounds).forEach(s => s.volume(volume));
};
