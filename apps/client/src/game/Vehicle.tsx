import type { PlayerState } from '@paws/shared';
import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import { Mesh, Quaternion, Vector3 } from 'three';

interface VehicleProps {
  player: PlayerState;
  isLocal: boolean;
}

const _tPos = new Vector3();
const _tQuat = new Quaternion();
const _cur = new Vector3();
const _curQ = new Quaternion();

export function Vehicle({ player, isLocal }: VehicleProps) {
  const ref = useRef<Mesh>(null);

  useFrame((_, dt) => {
    if (!ref.current) return;
    _tPos.set(player.position.x, player.position.y, player.position.z);
    _tQuat.set(player.rotation.x, player.rotation.y, player.rotation.z, player.rotation.w);

    // Smooth interpolation toward authoritative state. Placeholder for proper
    // entity-interpolation buffer (Week 2).
    _cur.copy(ref.current.position);
    ref.current.position.copy(_cur.lerp(_tPos, Math.min(1, dt * 12)));

    _curQ.copy(ref.current.quaternion);
    ref.current.quaternion.copy(_curQ.slerp(_tQuat, Math.min(1, dt * 12)));
  });

  const color = isLocal ? '#42f5e0' : player.vehicle === 'bruiser' ? '#ff3aa3' : '#ffb142';

  return (
    <mesh ref={ref} castShadow receiveShadow>
      <boxGeometry args={[1, 0.6, 1.8]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.3} />
    </mesh>
  );
}
