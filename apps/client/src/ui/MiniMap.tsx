import { getTrack, type PlayerState } from '@paws/shared';
import { useMemo } from 'react';

interface MiniMapProps {
  trackId: string;
  players: PlayerState[];
  localSid: string;
  /** Touch-device mode: smaller box, positioned above the steering buttons. */
  compact?: boolean;
}

/**
 * Tiny corner radar. Draws the track loop as an SVG path and dots per player.
 * Re-renders on each state patch (cheap).
 */
export function MiniMap({ trackId, players, localSid, compact = false }: MiniMapProps) {
  const track = useMemo(() => getTrack(trackId), [trackId]);

  const { vbX, vbY, vbW, vbH, pathData } = useMemo(() => {
    let minX = Infinity;
    let minZ = Infinity;
    let maxX = -Infinity;
    let maxZ = -Infinity;
    for (const p of track.loop) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.z < minZ) minZ = p.z;
      if (p.z > maxZ) maxZ = p.z;
    }
    const pad = 12;
    const x0 = minX - pad;
    const z0 = minZ - pad;
    const w = maxX - minX + pad * 2;
    const h = maxZ - minZ + pad * 2;
    const pts = track.loop
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.z.toFixed(1)}`)
      .join(' ');
    return { vbX: x0, vbY: z0, vbW: w, vbH: h, pathData: `${pts} Z` };
  }, [track]);

  const w = compact ? 110 : 220;
  const h = compact ? 70 : 150;
  return (
    <div
      className={`pointer-events-none absolute rounded border-2 border-neon-cyan/60 bg-black/80 ${
        compact ? 'bottom-28 left-2 p-1.5' : 'bottom-4 left-4 p-3'
      }`}
    >
      <div
        className={`mb-1 font-pixel uppercase tracking-widest text-neon-cyan/70 ${
          compact ? 'text-[8px]' : 'text-[10px]'
        }`}
      >
        Map
      </div>
      <svg
        width={w}
        height={h}
        viewBox={`${vbX} ${vbY} ${vbW} ${vbH}`}
        className="block"
      >
        <path
          d={pathData}
          fill="none"
          stroke="#42f5e0"
          strokeWidth={4}
          opacity={0.75}
          strokeLinejoin="round"
        />
        {track.boostPads.map((pad, i) => (
          <circle key={i} cx={pad.center.x} cy={pad.center.z} r={4} fill="#ff3aa3" />
        ))}
        <circle
          cx={track.checkpoints[0]!.center.x}
          cy={track.checkpoints[0]!.center.z}
          r={4}
          fill="#ffb142"
        />
        {players
          .filter((p) => p.finishedAt === 0)
          .map((p) => {
            const isLocal = p.id === localSid;
            return (
              <circle
                key={p.id}
                cx={p.position.x}
                cy={p.position.z}
                r={isLocal ? 5.5 : 4}
                fill={isLocal ? '#ffffff' : '#9b59ff'}
                stroke={isLocal ? '#42f5e0' : 'none'}
                strokeWidth={2}
              />
            );
          })}
      </svg>
    </div>
  );
}
