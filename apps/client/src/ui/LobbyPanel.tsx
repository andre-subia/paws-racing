import { VEHICLES } from '@paws/shared';

interface LobbyPlayer {
  id: string;
  name: string;
  vehicle: string;
  ready: boolean;
  host: boolean;
}

interface LobbyPanelProps {
  code: string;
  players: LobbyPlayer[];
  localSid: string;
  isHost: boolean;
  countdownEndsAt: number;
  phase: 'waiting' | 'countdown' | 'racing' | 'finished';
  onToggleReady: () => void;
  onPickVehicle: (v: 'scout' | 'bruiser') => void;
  onStart: () => void;
  onLeave: () => void;
}

export function LobbyPanel({
  code,
  players,
  localSid,
  isHost,
  countdownEndsAt,
  phase,
  onToggleReady,
  onPickVehicle,
  onStart,
  onLeave,
}: LobbyPanelProps) {
  const me = players.find((p) => p.id === localSid);
  const allReady = players.length > 0 && players.every((p) => p.ready || p.host);
  const showLobby = phase === 'waiting';
  const showCountdown = phase === 'countdown';

  if (showCountdown) {
    const secs = Math.max(0, Math.ceil((countdownEndsAt - Date.now()) / 1000));
    return (
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="font-pixel text-[160px] text-neon-cyan drop-shadow-[0_0_30px_rgba(66,245,224,0.8)]">
          {secs === 0 ? 'GO' : secs}
        </div>
      </div>
    );
  }

  if (!showLobby) return null;

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-[520px] rounded-2xl border-2 border-neon-cyan/40 bg-black/70 p-6">
        <div className="mb-4 flex items-baseline justify-between">
          <div>
            <div className="text-xs uppercase tracking-widest text-white/60">Room Code</div>
            <div className="font-pixel text-3xl tracking-[0.5em] text-neon-cyan">{code}</div>
          </div>
          <button
            type="button"
            onClick={onLeave}
            className="rounded border border-white/30 bg-white/5 px-3 py-1 text-xs uppercase tracking-widest hover:border-white/60"
          >
            Leave
          </button>
        </div>

        <div className="mb-4 rounded border border-white/10 bg-black/40">
          {players.map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between border-b border-white/5 px-4 py-2 last:border-b-0"
            >
              <div className="flex items-center gap-3">
                <span
                  className={`inline-block h-2 w-2 rounded-full ${
                    p.ready || p.host ? 'bg-neon-cyan' : 'bg-white/30'
                  }`}
                />
                <span className="text-lg">{p.name}</span>
                {p.host && (
                  <span className="rounded bg-neon-magenta/20 px-2 py-0.5 text-xs uppercase tracking-widest text-neon-magenta">
                    Host
                  </span>
                )}
              </div>
              <div className="text-sm text-white/60">
                {VEHICLES[p.vehicle as 'scout' | 'bruiser']?.label ?? p.vehicle}
              </div>
            </div>
          ))}
        </div>

        <div className="mb-4 grid grid-cols-2 gap-2">
          {Object.values(VEHICLES).map((v) => (
            <button
              type="button"
              key={v.id}
              onClick={() => onPickVehicle(v.id)}
              className={`rounded border-2 px-3 py-2 text-sm transition ${
                me?.vehicle === v.id
                  ? 'border-neon-cyan bg-neon-cyan/10 text-neon-cyan'
                  : 'border-white/15 bg-white/5 text-white/70 hover:border-white/40'
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={onToggleReady}
            disabled={isHost}
            className={`rounded-md border-2 px-4 py-3 text-sm uppercase tracking-widest transition disabled:cursor-not-allowed disabled:opacity-30 ${
              me?.ready
                ? 'border-neon-cyan bg-neon-cyan/20 text-neon-cyan'
                : 'border-white/30 bg-white/5 text-white/80 hover:border-white/60'
            }`}
          >
            {isHost ? 'Host' : me?.ready ? 'Ready ✓' : 'Ready?'}
          </button>
          <button
            type="button"
            onClick={onStart}
            disabled={!isHost || !allReady}
            className="rounded-md border-2 border-neon-magenta bg-neon-magenta/20 px-4 py-3 text-sm uppercase tracking-widest text-neon-magenta transition hover:bg-neon-magenta/30 disabled:cursor-not-allowed disabled:opacity-30"
          >
            Start Race
          </button>
        </div>

        <p className="mt-4 text-center text-xs text-white/40">
          Share the room code to invite friends • up to 8 players
        </p>
      </div>
    </div>
  );
}
