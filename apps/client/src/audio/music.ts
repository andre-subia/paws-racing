/**
 * Background music. Plain looping <audio> (latency doesn't matter for music),
 * one track per "area": the menu/landing theme and the racing theme. Paths are
 * built off Vite's BASE_URL so they resolve under any deploy base (root or the
 * /paws-racing/ GitHub Pages sub-path).
 *
 * Browsers block autoplay until a user gesture, so a blocked play() registers a
 * one-shot pointer/key listener and retries — the first click anywhere starts it.
 */
const BASE = import.meta.env.BASE_URL; // always ends with '/'

export const MUSIC = {
  menu: `${BASE}assets/audio/Shift_To_Redline.mp3`,
  race: `${BASE}assets/audio/Maximum_Throttle.mp3`,
} as const;

export type MusicTrack = keyof typeof MUSIC;

const VOLUME = 0.45;

let audio: HTMLAudioElement | null = null;
let current: MusicTrack | null = null;
let muted = typeof localStorage !== 'undefined' && localStorage.getItem('paws.muted') === '1';
let awaitingGesture = false;

function ensureAudio(): HTMLAudioElement {
  if (!audio) {
    audio = new Audio();
    audio.loop = true;
    audio.preload = 'auto';
    audio.volume = VOLUME;
  }
  return audio;
}

function tryPlay() {
  if (!audio || muted) return;
  const p = audio.play();
  if (!p || awaitingGesture) return;
  p.catch(() => {
    // Autoplay blocked — resume on the first user interaction.
    awaitingGesture = true;
    const resume = () => {
      awaitingGesture = false;
      window.removeEventListener('pointerdown', resume);
      window.removeEventListener('keydown', resume);
      tryPlay();
    };
    window.addEventListener('pointerdown', resume, { once: true });
    window.addEventListener('keydown', resume, { once: true });
  });
}

/** Switch to `track` (no-op if already playing it). Loops until changed. */
export function playMusic(track: MusicTrack): void {
  const a = ensureAudio();
  if (current === track) {
    tryPlay();
    return;
  }
  current = track;
  a.src = MUSIC[track];
  a.load();
  tryPlay();
}

export function isMuted(): boolean {
  return muted;
}

export function setMuted(value: boolean): void {
  muted = value;
  if (typeof localStorage !== 'undefined') localStorage.setItem('paws.muted', value ? '1' : '0');
  if (!audio) return;
  if (muted) audio.pause();
  else tryPlay();
}
