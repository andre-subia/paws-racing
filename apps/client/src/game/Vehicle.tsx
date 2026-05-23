import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import { Mesh, Quaternion, Vector3 } from 'three';

interface VehicleProps {
  /** World position target. */
  x: number;
  y: number;
  z: number;
  /** World-space yaw in radians. */
  yaw: number;
  /** Display color (hex). */
  color: string;
  /**
   * If true, the mesh snaps to the target each frame (used for the locally
   * predicted player). If false, the mesh lerps toward the target (used for
   * remote players being interpolated from the network buffer).
   */
  snap?: boolean;
  drifting?: boolean;
}

const _curPos = new Vector3();
const _targetPos = new Vector3();
const _curQ = new Quaternion();
const _targetQ = new Quaternion();

export function Vehicle({ x, y, z, yaw, color, snap = false, drifting = false }: VehicleProps) {
  const ref = useRef<Mesh>(null);

  useFrame((_, dt) => {
    const mesh = ref.current;
    if (!mesh) return;
    _targetPos.set(x, y, z);
    const half = yaw * 0.5;
    _targetQ.set(0, Math.sin(half), 0, Math.cos(half));

    if (snap) {
      mesh.position.copy(_targetPos);
      mesh.quaternion.copy(_targetQ);
    } else {
      const lerp = Math.min(1, dt * 16);
      _curPos.copy(mesh.position);
      mesh.position.copy(_curPos.lerp(_targetPos, lerp));
      _curQ.copy(mesh.quaternion);
      mesh.quaternion.copy(_curQ.slerp(_targetQ, lerp));
    }
  });

  return (
    <mesh ref={ref} castShadow receiveShadow>
      <boxGeometry args={[1, 0.6, 1.8]} />
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={drifting ? 0.7 : 0.3}
      />
    </mesh>
  );
}
