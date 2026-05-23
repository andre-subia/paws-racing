import { VEHICLES } from '@paws/shared';
import { useGame } from '../store/game.ts';

export function MainMenu() {
  const { name, vehicle, setName, setVehicle, setScene } = useGame();
  const trimmed = name.trim();
  const canPlay = trimmed.length > 0;

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-b from-ink via-[#180b35] to-[#0b0418]">
      <div className="w-[420px] rounded-2xl border-2 border-neon-cyan/40 bg-black/60 p-8 shadow-[0_0_60px_rgba(66,245,224,0.25)]">
        <h1 className="mb-1 font-pixel text-3xl tracking-tight text-neon-cyan">PAWS RACING</h1>
        <p className="mb-8 text-sm text-white/60">
          Online voxel arcade racing — Week 1 scaffold.
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
          <div className="grid grid-cols-2 gap-3">
            {Object.values(VEHICLES).map((v) => (
              <button
                type="button"
                key={v.id}
                onClick={() => setVehicle(v.id)}
                className={`rounded-md border-2 p-3 text-left transition ${
                  vehicle === v.id
                    ? 'border-neon-cyan bg-neon-cyan/10 text-neon-cyan'
                    : 'border-white/15 bg-white/5 text-white/80 hover:border-white/40'
                }`}
              >
                <div className="text-lg">{v.label}</div>
                <div className="text-xs text-white/60">
                  accel {v.accel} • top {v.topSpeed}
                </div>
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          disabled={!canPlay}
          onClick={() => setScene('race')}
          className="w-full rounded-md border-2 border-neon-cyan bg-neon-cyan/20 px-4 py-3 text-xl uppercase tracking-widest text-neon-cyan transition hover:bg-neon-cyan/30 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/5 disabled:text-white/30"
        >
          Quick Race
        </button>

        <p className="mt-4 text-center text-xs text-white/40">
          WASD to steer • Space to drift
        </p>
      </div>
    </div>
  );
}
