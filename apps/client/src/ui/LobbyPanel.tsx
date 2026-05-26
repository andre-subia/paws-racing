import {
  LAPS_MAX,
  LAPS_MIN,
  TRACKS,
  type TrackId,
  VEHICLES,
  type VehicleId,
} from '@paws/shared';
import { TrackThumb } from './components/TrackThumb.tsx';
import { VehicleThumb } from './components/VehicleThumb.tsx';

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
  trackId: string;
  laps: number;
  onToggleReady: () => void;
  onPickVehicle: (v: VehicleId) => void;
  onPickTrack: (t: TrackId) => void;
  onPickLaps: (n: number) => void;
  onStart: () => void;
  onLeave: () => void;
}

const TRACK_OPTIONS = Object.values(TRACKS);

export function LobbyPanel({
  code,
  players,
  localSid,
  isHost,
  countdownEndsAt,
  phase,
  trackId,
  laps,
  onToggleReady,
  onPickVehicle,
  onPickTrack,
  onPickLaps,
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
      <div className="pointer-events-none absolute inset-x-0 top-16 flex justify-center">
        <div className="font-pixel text-[120px] leading-none text-neon-cyan drop-shadow-[0_0_30px_rgba(66,245,224,0.8)]">
          {secs === 0 ? 'GO' : secs}
        </div>
      </div>
    );
  }

  if (!showLobby) return null;

  const clampLaps = (n: number) => Math.min(LAPS_MAX, Math.max(LAPS_MIN, Math.round(n)));

  return (
    <div className="synth-bg absolute inset-0 flex items-center justify-center overflow-hidden">
      <div className="mode7-bg" />
      <div className="px-card relative z-10 w-[560px] max-w-[94vw] p-6">
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
                {VEHICLES[p.vehicle as VehicleId]?.label ?? p.vehicle}
              </div>
            </div>
          ))}
        </div>

        {/* Track + laps — only the host can edit; everyone sees the values. */}
        <div className="mb-4 rounded border border-white/10 bg-black/40 p-3">
          <div className="mb-2 text-xs uppercase tracking-widest text-white/60">Race</div>
          <div className="mb-3">
            <span className="mb-1 block text-[10px] uppercase tracking-widest text-white/50">
              Track
            </span>
            <div className="grid grid-cols-2 gap-2">
              {TRACK_OPTIONS.map((t) => {
                const selected = trackId === t.id;
                return (
                  <button
                    type="button"
                    key={t.id}
                    onClick={() => isHost && onPickTrack(t.id as TrackId)}
                    disabled={!isHost}
                    className={`flex items-center gap-2 rounded border-2 px-2 py-1.5 text-left text-xs transition ${
                      selected
                        ? 'border-neon-magenta bg-neon-magenta/10 text-neon-magenta'
                        : 'border-white/15 bg-white/5 text-white/70 hover:border-white/40'
                    } ${!isHost ? 'cursor-not-allowed opacity-70 hover:border-white/15' : ''}`}
                  >
                    <TrackThumb track={t} width={48} height={32} />
                    <span className="truncate">{t.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-widest text-white/50">Laps</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => isHost && onPickLaps(clampLaps(laps - 1))}
                disabled={!isHost}
                className="rounded border-2 border-white/30 bg-white/5 px-2 py-0.5 text-sm hover:border-white/50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                −
              </button>
              <span className="w-8 text-center font-pixel text-lg text-neon-cyan">{laps}</span>
              <button
                type="button"
                onClick={() => isHost && onPickLaps(clampLaps(laps + 1))}
                disabled={!isHost}
                className="rounded border-2 border-white/30 bg-white/5 px-2 py-0.5 text-sm hover:border-white/50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                +
              </button>
            </div>
          </div>
        </div>

        <div className="mb-4 grid grid-cols-4 gap-2">
          {Object.values(VEHICLES).map((v) => (
            <button
              type="button"
              key={v.id}
              onClick={() => onPickVehicle(v.id)}
              className={`flex flex-col items-center rounded border-2 px-2 py-2 text-xs transition ${
                me?.vehicle === v.id
                  ? 'border-neon-cyan bg-neon-cyan/10 text-neon-cyan'
                  : 'border-white/15 bg-white/5 text-white/70 hover:border-white/40'
              }`}
            >
              <VehicleThumb spec={v} size={48} />
              <span className="mt-1">{v.label}</span>
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-5">
          <button
            type="button"
            onClick={onToggleReady}
            disabled={isHost}
            className={`px-btn ${me?.ready ? 'cyan' : 'ghost'}`}
          >
            {isHost ? 'Host' : me?.ready ? 'Ready ✓' : 'Ready?'}
          </button>
          <button
            type="button"
            onClick={onStart}
            disabled={!isHost || !allReady}
            className="px-btn"
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
