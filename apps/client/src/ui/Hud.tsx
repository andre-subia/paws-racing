export interface RankRow {
  id: string;
  name: string;
  isLocal: boolean;
  finished: boolean;
}

interface HudProps {
  status: string;
  speed: number;
  roomCode?: string;
  players: number;
  lap: number;
  totalLaps: number;
  checkpoint: number;
  totalCheckpoints: number;
  ranking: RankRow[];
  spectating: string | null;
  boostUntil: number;
  serverTime: number;
  onLeave: () => void;
}

export function Hud({
  speed,
  roomCode,
  players,
  lap,
  totalLaps,
  totalCheckpoints,
  checkpoint,
  ranking,
  spectating,
  boostUntil,
  serverTime,
  onLeave,
}: HudProps) {
  const boosting = boostUntil > 0 && boostUntil > serverTime;
  const nextCp = ((checkpoint + 1) % totalCheckpoints) + 1;
  const isSpectator = spectating !== null;

  return (
    <div className="pointer-events-none absolute inset-0 select-none">
      {/* Goal banner — dimmed after lap 1. Hidden while spectating. */}
      {!isSpectator && (
        <div
          className={`absolute left-1/2 top-20 -translate-x-1/2 rounded-lg border-2 border-neon-orange/60 bg-black/70 px-4 py-2 text-center transition-opacity ${
            lap > 1 ? 'opacity-40' : 'opacity-100'
          }`}
        >
          <div className="font-pixel text-xs uppercase tracking-widest text-neon-orange">
            Goal
          </div>
          <div className="text-sm text-white/90">
            Drive through the <span className="text-neon-violet">glowing gate</span>{' '}
            (#{nextCp}) — complete {totalLaps} laps
          </div>
        </div>
      )}

      {/* Top-left live ranking. */}
      <div className="absolute left-4 top-4 min-w-[180px] rounded-lg border-2 border-neon-cyan/40 bg-black/70 px-3 py-2">
        <div className="mb-1 flex items-baseline justify-between">
          <span className="font-pixel text-xs uppercase tracking-widest text-white/70">
            Rank
          </span>
          <span className="font-pixel text-[10px] text-white/40">{ranking.length}P</span>
        </div>
        <ol className="space-y-0.5">
          {ranking.map((row, i) => {
            const place = i + 1;
            const accent = row.isLocal
              ? 'text-neon-orange'
              : row.finished
                ? 'text-white/45'
                : 'text-white/85';
            return (
              <li
                key={row.id}
                className={`flex items-baseline gap-2 font-pixel text-xs ${accent}`}
              >
                <span className="w-4 text-right tabular-nums">{place}</span>
                <span className="truncate">{row.name}</span>
                {row.finished && (
                  <span className="ml-auto text-[9px] uppercase tracking-widest text-neon-cyan/70">
                    ✓
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      </div>

      {/* Top-center lap counter (hidden in spectator mode). */}
      {!isSpectator && (
        <div className="absolute left-1/2 top-4 -translate-x-1/2 rounded-lg border-2 border-neon-cyan/40 bg-black/70 px-5 py-2 text-center">
          <div className="font-pixel text-xs uppercase tracking-widest text-white/70">Lap</div>
          <div className="font-pixel text-2xl text-neon-cyan">
            {Math.max(1, lap)}/{totalLaps}
          </div>
        </div>
      )}

      {/* Top-right room code + player count. */}
      <div className="absolute right-4 top-4 rounded-lg border-2 border-neon-magenta/40 bg-black/70 px-3 py-2 text-right">
        <div className="font-pixel text-xs text-neon-magenta">ROOM {roomCode ?? '…'}</div>
        <div className="font-pixel text-xs text-white/60">×{players}</div>
      </div>

      {/* Bottom-right indicator: speed during the race, spectator banner after. */}
      {isSpectator ? (
        <div className="absolute bottom-6 right-6 rounded-lg border-2 border-neon-violet/60 bg-black/70 px-4 py-3 text-right">
          <div className="font-pixel text-xs uppercase tracking-widest text-white/60">
            Spectating
          </div>
          <div className="font-pixel text-xl text-neon-violet">{spectating}</div>
        </div>
      ) : (
        <div className="absolute bottom-6 right-6 rounded-lg border-2 border-neon-cyan/40 bg-black/70 px-4 py-3 text-right">
          <div className="font-pixel text-xs uppercase tracking-widest text-white/60">
            SPEED
          </div>
          <div
            className={`font-pixel text-3xl ${boosting ? 'text-neon-orange' : 'text-neon-cyan'}`}
          >
            {Math.round(speed)}
          </div>
          {boosting && (
            <div className="font-pixel text-xs uppercase tracking-widest text-neon-orange">
              ▶ BOOST
            </div>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={onLeave}
        className="pointer-events-auto absolute bottom-4 right-4 hidden rounded border border-white/30 bg-black/40 px-3 py-1 text-xs uppercase tracking-widest hover:border-white/60"
      >
        Leave
      </button>
    </div>
  );
}
