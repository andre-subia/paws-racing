import { LAPS_PER_RACE } from '@paws/shared';

interface HudProps {
  status: string;
  speed: number;
  roomCode?: string;
  players: number;
  lap: number;
  checkpoint: number;
  totalCheckpoints: number;
  rank: number;
  boostUntil: number;
  serverTime: number;
  onLeave: () => void;
}

export function Hud({
  status,
  speed,
  roomCode,
  players,
  lap,
  checkpoint,
  totalCheckpoints,
  rank,
  boostUntil,
  serverTime,
  onLeave,
}: HudProps) {
  const boosting = boostUntil > 0 && boostUntil > serverTime;

  return (
    <div className="pointer-events-none absolute inset-0 select-none">
      <div className="absolute left-4 top-4 rounded border border-neon-cyan/40 bg-black/40 px-3 py-2 text-sm">
        <div className="text-neon-cyan">ROOM {roomCode ?? '…'}</div>
        <div className="text-white/70">PLAYERS {players}</div>
        <div className="text-white/50">{status}</div>
      </div>

      <div className="absolute left-1/2 top-4 -translate-x-1/2 rounded border border-neon-cyan/40 bg-black/50 px-6 py-2 text-center">
        <div className="text-xs uppercase tracking-widest text-white/60">Lap</div>
        <div className="font-pixel text-2xl text-neon-cyan">
          {Math.max(1, lap)}/{LAPS_PER_RACE}
        </div>
        <div className="text-xs text-white/40">
          CP {Math.max(0, checkpoint + 1)}/{totalCheckpoints}
        </div>
      </div>

      <div className="absolute right-6 top-4 rounded border border-neon-magenta/40 bg-black/40 px-4 py-2 text-right">
        <div className="text-xs uppercase tracking-widest text-white/60">Position</div>
        <div className="font-pixel text-2xl text-neon-magenta">{rank || '—'}</div>
      </div>

      <div className="absolute bottom-6 right-6 rounded border border-neon-magenta/40 bg-black/40 px-4 py-3 text-right">
        <div className="text-xs uppercase tracking-widest text-white/60">Speed</div>
        <div
          className={`text-3xl ${boosting ? 'text-neon-orange' : 'text-neon-magenta'}`}
        >
          {Math.round(speed)}
        </div>
        {boosting && (
          <div className="text-xs uppercase tracking-widest text-neon-orange">BOOST</div>
        )}
      </div>

      <button
        type="button"
        onClick={onLeave}
        className="pointer-events-auto absolute right-4 bottom-4 rounded border border-white/30 bg-black/40 px-3 py-1 text-xs uppercase tracking-widest hover:border-white/60"
      >
        Leave
      </button>
    </div>
  );
}
