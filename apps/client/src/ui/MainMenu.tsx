import {
  LAPS_DEFAULT,
  LAPS_MAX,
  LAPS_MIN,
  MAX_PLAYERS_PER_ROOM,
  TRACKS,
  type TrackId,
  VEHICLES,
} from '@paws/shared';
import { useState } from 'react';
import { useGame } from '../store/game.ts';
import { TrackThumb } from './components/TrackThumb.tsx';
import { VehicleThumb } from './components/VehicleThumb.tsx';

type Mode = 'home' | 'join' | 'create';

const TRACK_OPTIONS = Object.values(TRACKS);

export function MainMenu() {
  const { name, vehicle, setName, setVehicle, startRace } = useGame();
  const [mode, setMode] = useState<Mode>('home');
  const [code, setCode] = useState('');
  const [trackId, setTrackId] = useState<TrackId>(TRACK_OPTIONS[0]!.id as TrackId);
  const [laps, setLaps] = useState<number>(LAPS_DEFAULT);
  const [bots, setBots] = useState<number>(0);
  const trimmedName = name.trim();
  const canPlay = trimmedName.length > 0;
  const sanitizedCode = code
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 5);
  const canJoin = canPlay && sanitizedCode.length === 5;
  const clampLaps = (n: number) => Math.min(LAPS_MAX, Math.max(LAPS_MIN, Math.round(n)));
  const MAX_BOTS = MAX_PLAYERS_PER_ROOM - 1;
  const clampBots = (n: number) => Math.min(MAX_BOTS, Math.max(0, Math.round(n)));

  return (
    <div className="synth-bg absolute inset-0 flex items-center justify-center overflow-hidden">
      <div className="mode7-bg" />
      <div className="px-card relative z-10 w-[460px] max-w-[92vw] p-7">
        <h1 className="mb-1 font-pixel text-2xl tracking-tight text-neon-magenta drop-shadow-[2px_2px_0_#000]">
          PAWS<span className="text-neon-yellow">/</span>RACING
        </h1>
        <p className="mb-7 font-pixel text-[10px] uppercase tracking-widest text-neon-cyan">
          Online arcade cat racer
        </p>

        <label className="mb-4 block">
          <span className="mb-1 block text-sm uppercase tracking-widest text-white/70">
            Nickname
          </span>
          <input
            value={name}
            maxLength={16}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-md border-2 border-neon-magenta/40 bg-black/50 px-3 py-2 text-lg outline-none focus:border-neon-magenta"
          />
        </label>

        <div className="mb-6">
          <span className="mb-2 block text-sm uppercase tracking-widest text-white/70">
            Vehicle
          </span>
          <div className="grid grid-cols-4 gap-2">
            {Object.values(VEHICLES).map((v) => (
              <button
                type="button"
                key={v.id}
                onClick={() => setVehicle(v.id)}
                className={`flex flex-col items-center rounded-md border-2 p-2 transition ${
                  vehicle === v.id
                    ? 'border-neon-cyan bg-neon-cyan/10 text-neon-cyan'
                    : 'border-white/15 bg-white/5 text-white/80 hover:border-white/40'
                }`}
              >
                <VehicleThumb spec={v} size={56} />
                <div className="mt-1 text-xs">{v.label}</div>
              </button>
            ))}
          </div>
        </div>

        {mode === 'home' && (
          <div className="flex flex-col gap-5">
            <div className="flex items-center justify-between rounded-md border-2 border-white/15 bg-white/5 px-3 py-2">
              <span className="text-sm uppercase tracking-widest text-white/70">Bots</span>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setBots((n) => clampBots(n - 1))}
                  className="rounded-md border-2 border-white/30 bg-white/5 px-3 py-0.5 text-lg hover:border-white/50"
                >
                  −
                </button>
                <span className="w-6 text-center font-pixel text-xl text-neon-cyan">{bots}</span>
                <button
                  type="button"
                  onClick={() => setBots((n) => clampBots(n + 1))}
                  className="rounded-md border-2 border-white/30 bg-white/5 px-3 py-0.5 text-lg hover:border-white/50"
                >
                  +
                </button>
              </div>
            </div>

            <button
              type="button"
              disabled={!canPlay}
              onClick={() => startRace({ kind: 'quick', bots })}
              className="px-btn cyan w-full"
            >
              ▶ Quick Race
            </button>

            <button
              type="button"
              disabled={!canPlay}
              onClick={() =>
                startRace({ kind: 'create', trackId, laps, bots: bots > 0 ? bots : 7 })
              }
              className="px-btn w-full"
            >
              🤖 Solo vs Bots
            </button>

            <div className="grid grid-cols-2 gap-5">
              <button
                type="button"
                disabled={!canPlay}
                onClick={() => setMode('create')}
                className="px-btn"
              >
                Create
              </button>
              <button type="button" onClick={() => setMode('join')} className="px-btn violet">
                Join Code
              </button>
            </div>
          </div>
        )}

        {mode === 'create' && (
          <div className="space-y-3">
            <div>
              <span className="mb-2 block text-sm uppercase tracking-widest text-white/70">
                Track
              </span>
              <div className="grid grid-cols-2 gap-2">
                {TRACK_OPTIONS.map((t) => (
                  <button
                    type="button"
                    key={t.id}
                    onClick={() => setTrackId(t.id as TrackId)}
                    className={`flex items-center gap-2 rounded-md border-2 px-2 py-2 text-left text-xs transition ${
                      trackId === t.id
                        ? 'border-neon-magenta bg-neon-magenta/10 text-neon-magenta'
                        : 'border-white/15 bg-white/5 text-white/80 hover:border-white/40'
                    }`}
                  >
                    <TrackThumb track={t} width={56} height={40} />
                    <span className="truncate">{t.name}</span>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <span className="mb-2 block text-sm uppercase tracking-widest text-white/70">
                Laps
              </span>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setLaps((n) => clampLaps(n - 1))}
                  className="rounded-md border-2 border-white/30 bg-white/5 px-3 py-1 text-lg hover:border-white/50"
                >
                  −
                </button>
                <span className="flex-1 text-center font-pixel text-2xl text-neon-cyan">
                  {laps}
                </span>
                <button
                  type="button"
                  onClick={() => setLaps((n) => clampLaps(n + 1))}
                  className="rounded-md border-2 border-white/30 bg-white/5 px-3 py-1 text-lg hover:border-white/50"
                >
                  +
                </button>
              </div>
              <p className="mt-1 text-center text-[10px] text-white/40">
                {LAPS_MIN}–{LAPS_MAX} laps
              </p>
            </div>
            <div>
              <span className="mb-2 block text-sm uppercase tracking-widest text-white/70">
                Bots
              </span>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setBots((n) => clampBots(n - 1))}
                  className="rounded-md border-2 border-white/30 bg-white/5 px-3 py-1 text-lg hover:border-white/50"
                >
                  −
                </button>
                <span className="flex-1 text-center font-pixel text-2xl text-neon-cyan">
                  {bots}
                </span>
                <button
                  type="button"
                  onClick={() => setBots((n) => clampBots(n + 1))}
                  className="rounded-md border-2 border-white/30 bg-white/5 px-3 py-1 text-lg hover:border-white/50"
                >
                  +
                </button>
              </div>
              <p className="mt-1 text-center text-[10px] text-white/40">
                0–{MAX_BOTS} AI opponents
              </p>
            </div>
            <div className="grid grid-cols-2 gap-5 pt-1">
              <button type="button" onClick={() => setMode('home')} className="px-btn ghost">
                Back
              </button>
              <button
                type="button"
                disabled={!canPlay}
                onClick={() => startRace({ kind: 'create', trackId, laps, bots })}
                className="px-btn"
              >
                Create
              </button>
            </div>
          </div>
        )}

        {mode === 'join' && (
          <div className="space-y-3">
            <label className="block">
              <span className="mb-1 block text-sm uppercase tracking-widest text-white/70">
                Room Code
              </span>
              <input
                value={sanitizedCode}
                placeholder="ABCDE"
                onChange={(e) => setCode(e.target.value)}
                className="w-full rounded-md border-2 border-neon-violet/40 bg-black/50 px-3 py-2 text-center text-2xl tracking-[0.5em] uppercase outline-none focus:border-neon-violet"
              />
            </label>
            <div className="grid grid-cols-2 gap-5 pt-1">
              <button type="button" onClick={() => setMode('home')} className="px-btn ghost">
                Back
              </button>
              <button
                type="button"
                disabled={!canJoin}
                onClick={() => startRace({ kind: 'join', code: sanitizedCode })}
                className="px-btn violet"
              >
                Join
              </button>
            </div>
          </div>
        )}

        <p className="mt-5 text-center font-pixel text-[9px] uppercase tracking-widest text-white/40">
          WASD steer · Space drift
        </p>
      </div>
    </div>
  );
}
