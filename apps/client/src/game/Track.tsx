import type { TrackDef } from '@paws/shared';
import { useMemo } from 'react';
import { BufferAttribute, BufferGeometry } from 'three';

interface TrackProps {
  track: TrackDef;
}

/**
 * Procedural placeholder rendering of a TrackDef. Replaced by real glTF
 * voxel art in Phase 2 — until then we get the *shape* of the track on
 * screen so all the gameplay systems are testable.
 */
export function Track({ track }: TrackProps) {
  const surfaceGeometry = useMemo(() => buildRibbonGeometry(track), [track]);
  const startGate = track.checkpoints[0]!;

  return (
    <group>
      <mesh geometry={surfaceGeometry} receiveShadow>
        <meshStandardMaterial color="#241246" roughness={0.7} metalness={0.05} />
      </mesh>

      {/* Centerline neon stripe — purely cosmetic. */}
      <CenterLine track={track} />

      {/* Checkpoint arches: lit at the start, dim elsewhere. */}
      {track.checkpoints.map((cp) => (
        <CheckpointArch
          key={cp.id}
          x={cp.center.x}
          z={cp.center.z}
          y={cp.center.y}
          yaw={cp.yaw}
          width={cp.width}
          isStart={cp.id === 0}
        />
      ))}

      {/* Boost pads — animated magenta chevrons (kept simple here). */}
      {track.boostPads.map((pad, i) => (
        <BoostPad
          key={i}
          x={pad.center.x}
          z={pad.center.z}
          y={pad.center.y}
          yaw={pad.yaw}
          width={pad.width}
          length={pad.length}
        />
      ))}

      {/* Start-finish line strip. */}
      <StartLine
        x={startGate.center.x}
        z={startGate.center.z}
        y={track.surfaceY + 0.02}
        yaw={startGate.yaw}
        width={track.trackWidth}
      />
    </group>
  );
}

function CenterLine({ track }: { track: TrackDef }) {
  const geometry = useMemo(() => {
    const geom = new BufferGeometry();
    const positions: number[] = [];
    for (let i = 0; i < track.loop.length; i++) {
      const a = track.loop[i]!;
      const b = track.loop[(i + 1) % track.loop.length]!;
      positions.push(a.x, track.surfaceY + 0.03, a.z, b.x, track.surfaceY + 0.03, b.z);
    }
    geom.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
    return geom;
  }, [track]);
  return (
    <lineSegments geometry={geometry}>
      <lineBasicMaterial color="#42f5e0" transparent opacity={0.6} />
    </lineSegments>
  );
}

interface ArchProps {
  x: number;
  y: number;
  z: number;
  yaw: number;
  width: number;
  isStart: boolean;
}

function CheckpointArch({ x, y, z, yaw, width, isStart }: ArchProps) {
  const color = isStart ? '#ffb142' : '#9b59ff';
  return (
    <group position={[x, y, z]} rotation={[0, yaw, 0]}>
      <mesh position={[width, 2.5, 0]}>
        <boxGeometry args={[0.4, 5, 0.4]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.8} />
      </mesh>
      <mesh position={[-width, 2.5, 0]}>
        <boxGeometry args={[0.4, 5, 0.4]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.8} />
      </mesh>
      <mesh position={[0, 5, 0]}>
        <boxGeometry args={[width * 2 + 0.4, 0.4, 0.4]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.6} />
      </mesh>
    </group>
  );
}

interface BoostPadProps {
  x: number;
  y: number;
  z: number;
  yaw: number;
  width: number;
  length: number;
}

function BoostPad({ x, y, z, yaw, width, length }: BoostPadProps) {
  return (
    <mesh position={[x, y + 0.01, z]} rotation={[-Math.PI / 2, 0, yaw]}>
      <planeGeometry args={[width, length]} />
      <meshStandardMaterial
        color="#ff3aa3"
        emissive="#ff3aa3"
        emissiveIntensity={1.4}
        transparent
        opacity={0.85}
      />
    </mesh>
  );
}

interface StartLineProps {
  x: number;
  y: number;
  z: number;
  yaw: number;
  width: number;
}

function StartLine({ x, y, z, yaw, width }: StartLineProps) {
  return (
    <mesh position={[x, y, z]} rotation={[-Math.PI / 2, 0, yaw]}>
      <planeGeometry args={[width, 1]} />
      <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={0.3} />
    </mesh>
  );
}

/**
 * Builds a ribbon mesh from the loop centerline by extruding the trackWidth
 * perpendicular to each segment.
 */
function buildRibbonGeometry(track: TrackDef): BufferGeometry {
  const halfW = track.trackWidth / 2;
  const N = track.loop.length;
  const positions: number[] = [];
  const indices: number[] = [];
  const normals: number[] = [];

  // For each point, compute the average perpendicular of the in/out segments
  // so corners look smooth.
  const perps: Array<{ x: number; z: number }> = [];
  for (let i = 0; i < N; i++) {
    const prev = track.loop[(i - 1 + N) % N]!;
    const next = track.loop[(i + 1) % N]!;
    const dx = next.x - prev.x;
    const dz = next.z - prev.z;
    const len = Math.hypot(dx, dz) || 1;
    // Perpendicular (rotate 90° CCW): (-dz, dx)
    perps.push({ x: -dz / len, z: dx / len });
  }

  for (let i = 0; i < N; i++) {
    const p = track.loop[i]!;
    const perp = perps[i]!;
    positions.push(p.x + perp.x * halfW, track.surfaceY, p.z + perp.z * halfW);
    positions.push(p.x - perp.x * halfW, track.surfaceY, p.z - perp.z * halfW);
    normals.push(0, 1, 0, 0, 1, 0);
  }

  for (let i = 0; i < N; i++) {
    const a = i * 2;
    const b = i * 2 + 1;
    const c = ((i + 1) % N) * 2;
    const d = ((i + 1) % N) * 2 + 1;
    indices.push(a, c, b, b, c, d);
  }

  const geom = new BufferGeometry();
  geom.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
  geom.setAttribute('normal', new BufferAttribute(new Float32Array(normals), 3));
  geom.setIndex(indices);
  geom.computeBoundingSphere();
  return geom;
}
