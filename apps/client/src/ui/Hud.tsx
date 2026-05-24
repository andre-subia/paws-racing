export interface RankRow {
  id: string;
  name: string;
  isLocal: boolean;
  finished: boolean;
  exploded: boolean;
  health: number;
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
  health: number;
  exploded: boolean;
  pingMs: number;
  /** Touch-device mode: smaller widgets, repositioned so they don't sit
   * under the on-screen buttons. */
  compact?: boolean;
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
  health,
  exploded,
  pingMs,
  compact = false,
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
      <div
        className={`absolute rounded-lg border-2 border-neon-cyan/40 bg-black/70 ${
          compact
            ? 'left-2 top-2 max-w-[140px] px-2 py-1.5'
            : 'left-4 top-4 min-w-[180px] px-3 py-2'
        }`}
      >
        <div className="mb-1 flex items-baseline justify-between">
          <span className="font-pixel text-[10px] uppercase tracking-widest text-white/70">
            Rank
          </span>
          <span className="font-pixel text-[9px] text-white/40">{ranking.length}P</span>
        </div>
        <ol className="space-y-0.5">
          {ranking.map((row, i) => {
            const place = i + 1;
            const accent = row.isLocal
              ? 'text-neon-orange'
              : row.finished
                ? 'text-white/45'
                : 'text-white/85';
            const badge = row.exploded ? '✕' : row.finished ? '✓' : null;
            return (
              <li
                key={row.id}
                className={`flex items-baseline gap-2 font-pixel text-xs ${accent}`}
              >
                <span className="w-4 text-right tabular-nums">{place}</span>
                <span className="truncate">{row.name}</span>
                {badge && (
                  <span
                    className={`ml-auto text-[9px] uppercase tracking-widest ${
                      row.exploded ? 'text-red-400/80' : 'text-neon-cyan/70'
                    }`}
                  >
                    {badge}
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      </div>

      {/* Top-center lap counter (hidden in spectator mode). */}
      {!isSpectator && (
        <div
          className={`absolute left-1/2 -translate-x-1/2 rounded-lg border-2 border-neon-cyan/40 bg-black/70 text-center ${
            compact ? 'top-2 px-3 py-1' : 'top-4 px-5 py-2'
          }`}
        >
          <div
            className={`font-pixel uppercase tracking-widest text-white/70 ${
              compact ? 'text-[9px]' : 'text-xs'
            }`}
          >
            Lap
          </div>
          <div className={`font-pixel text-neon-cyan ${compact ? 'text-lg' : 'text-2xl'}`}>
            {Math.max(1, lap)}/{totalLaps}
          </div>
        </div>
      )}

      {/* Top-right room code + player count + ping. */}
      <div
        className={`absolute rounded-lg border-2 border-neon-magenta/40 bg-black/70 text-right ${
          compact ? 'right-2 top-2 px-2 py-1' : 'right-4 top-4 px-3 py-2'
        }`}
      >
        <div className={`font-pixel text-neon-magenta ${compact ? 'text-[10px]' : 'text-xs'}`}>
          ROOM {roomCode ?? '…'}
        </div>
        <div className={`font-pixel text-white/60 ${compact ? 'text-[9px]' : 'text-xs'}`}>
          ×{players}
        </div>
        <div
          className={`mt-0.5 font-pixel uppercase tracking-widest ${
            compact ? 'text-[9px]' : 'text-[10px]'
          } ${
            pingMs > 200 ? 'text-red-400' : pingMs > 100 ? 'text-neon-orange' : 'text-white/60'
          }`}
        >
          {pingMs > 0 ? `${pingMs} ms` : '— ms'}
        </div>
      </div>

      {/* Bottom-center HP indicator (your own bike). Hidden in spectator. */}
      {!isSpectator && (() => {
        const hpPct = Math.max(0, Math.min(100, health));
        const hpColor =
          hpPct > 50 ? 'bg-green-500' : hpPct >= 20 ? 'bg-yellow-400' : 'bg-red-500';
        const labelColor =
          hpPct > 50 ? 'text-green-400' : hpPct >= 20 ? 'text-yellow-300' : 'text-red-400';
        const borderColor =
          hpPct > 50
            ? 'border-green-500/40'
            : hpPct >= 20
              ? 'border-yellow-400/40'
              : 'border-red-500/60';
        return (
          <div
            className={`absolute left-1/2 -translate-x-1/2 rounded-lg border-2 bg-black/80 ${borderColor} ${
              compact ? 'bottom-2 px-3 py-1.5' : 'bottom-6 px-5 py-2.5'
            }`}
          >
            <div className="flex items-baseline gap-3">
              <span
                className={`font-pixel uppercase tracking-widest text-white/60 ${
                  compact ? 'text-[10px]' : 'text-xs'
                }`}
              >
                HP
              </span>
              <span
                className={`font-pixel tabular-nums ${labelColor} ${
                  compact ? 'text-xl' : 'text-3xl'
                }`}
              >
                {Math.round(hpPct)}
              </span>
              <div
                className={`overflow-hidden rounded-sm border border-white/10 bg-white/10 ${
                  compact ? 'h-2 w-[140px]' : 'h-3 w-[240px]'
                }`}
              >
                <div
                  className={`h-full transition-[width] duration-200 ${hpColor}`}
                  style={{ width: `${hpPct}%` }}
                />
              </div>
            </div>
            {exploded && (
              <div className="mt-1 text-center font-pixel text-[9px] uppercase tracking-widest text-red-400">
                ✕ Wrecked — respawning…
              </div>
            )}
          </div>
        );
      })()}

      {/* Bottom-right indicator: speed during the race, spectator banner after.
       * In compact mode it sits higher so it stays clear of the GAS/BRK buttons. */}
      {isSpectator ? (
        <div
          className={`absolute right-2 rounded-lg border-2 border-neon-violet/60 bg-black/70 text-right ${
            compact ? 'bottom-44 px-2 py-1.5' : 'bottom-6 right-6 px-4 py-3'
          }`}
        >
          <div
            className={`font-pixel uppercase tracking-widest text-white/60 ${
              compact ? 'text-[9px]' : 'text-xs'
            }`}
          >
            Spectating
          </div>
          <div className={`font-pixel text-neon-violet ${compact ? 'text-sm' : 'text-xl'}`}>
            {spectating}
          </div>
        </div>
      ) : (
        <div
          className={`absolute right-2 rounded-lg border-2 border-neon-cyan/40 bg-black/70 text-right ${
            compact ? 'bottom-44 px-2 py-1.5' : 'bottom-6 right-6 px-4 py-3'
          }`}
        >
          <div
            className={`font-pixel uppercase tracking-widest text-white/60 ${
              compact ? 'text-[9px]' : 'text-xs'
            }`}
          >
            SPEED
          </div>
          <div
            className={`font-pixel ${boosting ? 'text-neon-orange' : 'text-neon-cyan'} ${
              compact ? 'text-xl' : 'text-3xl'
            }`}
          >
            {Math.round(speed)}
          </div>
          {boosting && (
            <div
              className={`font-pixel uppercase tracking-widest text-neon-orange ${
                compact ? 'text-[9px]' : 'text-xs'
              }`}
            >
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
