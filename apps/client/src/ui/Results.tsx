interface ResultsRow {
  rank: number;
  name: string;
  finishedAt: number;
  isLocal: boolean;
  vehicle: string;
  /** Points earned this race. */
  points: number;
  /** Cumulative room score, including this race. */
  score: number;
}

interface ResultsProps {
  rows: ResultsRow[];
  raceStartedAt: number;
  onLeave: () => void;
}

/** Rank → accent color for the place number (gold / silver / bronze / rest). */
function rankColor(rank: number): string {
  if (rank === 1) return 'text-neon-yellow';
  if (rank === 2) return 'text-white/80';
  if (rank === 3) return 'text-neon-orange';
  return 'text-neon-magenta';
}

export function Results({ rows, raceStartedAt, onLeave }: ResultsProps) {
  return (
    <div className="absolute inset-0 flex justify-center overflow-y-auto bg-black/60 py-6 backdrop-blur-sm">
      <div className="my-auto w-[760px] max-w-[94vw] rounded-2xl border-2 border-neon-cyan/40 bg-black/80 p-6">
        <h2 className="mb-4 font-pixel text-2xl text-neon-cyan">RESULTS</h2>

        {/* Two columns of four: places 1–4 fill the left column top-to-bottom,
         * 5–8 the right column. grid-flow-col walks down each column first. */}
        <div className="mb-4 grid grid-flow-col grid-cols-2 grid-rows-4 gap-3">
          {rows.map((row) => (
            <div
              key={row.name + row.rank}
              className={`flex flex-col gap-1 rounded-lg border-2 px-3 py-3 ${
                row.isLocal ? 'border-neon-cyan bg-neon-cyan/10' : 'border-white/10 bg-white/5'
              }`}
            >
              <div className="flex items-baseline justify-between">
                <span className={`font-pixel text-2xl ${rankColor(row.rank)}`}>{row.rank}</span>
                <span className="font-pixel text-sm tabular-nums text-neon-yellow">
                  +{row.points}
                </span>
              </div>
              <div className="flex items-center gap-1 truncate text-base">
                <span className="truncate">{row.name}</span>
                {row.isLocal && (
                  <span className="shrink-0 rounded bg-neon-cyan/20 px-1.5 text-[10px] uppercase tracking-widest text-neon-cyan">
                    You
                  </span>
                )}
              </div>
              <div className="flex items-baseline justify-between text-xs text-white/50">
                <span>
                  {row.finishedAt > 0
                    ? `${((row.finishedAt - raceStartedAt) / 1000).toFixed(2)}s`
                    : 'DNF'}
                </span>
                <span className="text-white/40">{row.vehicle}</span>
              </div>
              <div className="mt-0.5 border-t border-white/10 pt-1 text-right font-pixel text-[10px] uppercase tracking-widest text-white/60">
                ★ {row.score} pts
              </div>
            </div>
          ))}
        </div>

        <p className="mb-4 text-center text-xs text-white/50">Returning to lobby…</p>

        <button
          type="button"
          onClick={onLeave}
          className="w-full rounded-md border-2 border-white/30 bg-white/5 px-4 py-2 text-sm uppercase tracking-widest hover:border-white/60"
        >
          Leave Room
        </button>
      </div>
    </div>
  );
}
