interface HudProps {
  status: string;
  speed: number;
  roomCode?: string;
  players: number;
  onLeave: () => void;
}

export function Hud({ status, speed, roomCode, players, onLeave }: HudProps) {
  return (
    <div className="pointer-events-none absolute inset-0 select-none">
      <div className="absolute left-4 top-4 rounded border border-neon-cyan/40 bg-black/40 px-3 py-2 text-sm">
        <div className="text-neon-cyan">ROOM {roomCode ?? '…'}</div>
        <div className="text-white/70">PLAYERS {players}</div>
        <div className="text-white/50">{status}</div>
      </div>

      <div className="absolute bottom-6 right-6 rounded border border-neon-magenta/40 bg-black/40 px-4 py-3 text-right">
        <div className="text-xs uppercase tracking-widest text-white/60">Speed</div>
        <div className="text-3xl text-neon-magenta">{Math.round(speed)}</div>
      </div>

      <button
        type="button"
        onClick={onLeave}
        className="pointer-events-auto absolute right-4 top-4 rounded border border-white/30 bg-black/40 px-3 py-1 text-xs uppercase tracking-widest hover:border-white/60"
      >
        Leave
      </button>
    </div>
  );
}
