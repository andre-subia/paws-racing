interface ResultsRow {
  rank: number;
  name: string;
  finishedAt: number;
  isLocal: boolean;
  vehicle: string;
}

interface ResultsProps {
  rows: ResultsRow[];
  raceStartedAt: number;
  onLeave: () => void;
}

export function Results({ rows, raceStartedAt, onLeave }: ResultsProps) {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-[500px] rounded-2xl border-2 border-neon-cyan/40 bg-black/80 p-6">
        <h2 className="mb-4 font-pixel text-2xl text-neon-cyan">RESULTS</h2>
        <div className="mb-4 rounded border border-white/10 bg-black/40">
          {rows.map((row) => (
            <div
              key={row.name + row.rank}
              className={`flex items-center justify-between border-b border-white/5 px-4 py-3 last:border-b-0 ${
                row.isLocal ? 'bg-neon-cyan/10' : ''
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="font-pixel text-xl text-neon-magenta w-8">{row.rank}</span>
                <span className="text-lg">{row.name}</span>
                {row.isLocal && (
                  <span className="rounded bg-neon-cyan/20 px-2 py-0.5 text-xs uppercase tracking-widest text-neon-cyan">
                    You
                  </span>
                )}
              </div>
              <div className="text-right">
                <div className="text-sm text-white/80">
                  {row.finishedAt > 0
                    ? `${((row.finishedAt - raceStartedAt) / 1000).toFixed(2)}s`
                    : 'DNF'}
                </div>
                <div className="text-xs text-white/40">{row.vehicle}</div>
              </div>
            </div>
          ))}
        </div>

        <p className="mb-4 text-center text-xs text-white/50">
          Returning to lobby…
        </p>

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
