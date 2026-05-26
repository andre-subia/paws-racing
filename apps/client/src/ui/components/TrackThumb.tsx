import type { TrackDef } from '@paws/shared';
import { useMemo } from 'react';

interface TrackThumbProps {
  track: TrackDef;
  width?: number;
  height?: number;
  showAccent?: boolean;
}

/**
 * Tiny SVG preview of a track's centerline loop. Same geometry the in-game
 * MiniMap uses, scaled down for menu cards.
 */
export function TrackThumb({
  track,
  width = 96,
  height = 64,
  showAccent = true,
}: TrackThumbProps) {
  const { viewBox, pathData, start } = useMemo(() => {
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
    const pad = 10;
    const x0 = minX - pad;
    const z0 = minZ - pad;
    const w = maxX - minX + pad * 2;
    const h = maxZ - minZ + pad * 2;
    const pts = track.loop
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.z.toFixed(1)}`)
      .join(' ');
    return {
      viewBox: `${x0} ${z0} ${w} ${h}`,
      pathData: `${pts} Z`,
      start: track.checkpoints[0]?.center,
    };
  }, [track]);

  return (
    <svg
      width={width}
      height={height}
      viewBox={viewBox}
      preserveAspectRatio="xMidYMid meet"
      className="block"
    >
      <path
        d={pathData}
        fill="rgba(155, 89, 255, 0.12)"
        stroke="#00e8ff"
        strokeWidth={4}
        opacity={0.9}
        strokeLinejoin="round"
      />
      {showAccent && start && (
        <circle cx={start.x} cy={start.z} r={4.5} fill="#ff7a1a" />
      )}
    </svg>
  );
}
