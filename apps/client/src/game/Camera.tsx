import type { PlayerState } from '@paws/shared';
import { useFrame, useThree } from '@react-three/fiber';
import { Quaternion, Vector3 } from 'three';

const _target = new Vector3();
const _offset = new Vector3();
const _q = new Quaternion();
const _desired = new Vector3();
const _lookAt = new Vector3();

interface ChaseCameraProps {
  player?: PlayerState;
}

export function ChaseCamera({ player }: ChaseCameraProps) {
  const { camera } = useThree();

  useFrame((_, dt) => {
    if (!player) return;
    _target.set(player.position.x, player.position.y, player.position.z);
    _q.set(player.rotation.x, player.rotation.y, player.rotation.z, player.rotation.w);

    _offset.set(0, 2.2, 5.5).applyQuaternion(_q);
    _desired.copy(_target).add(_offset);

    camera.position.lerp(_desired, Math.min(1, dt * 6));
    _lookAt.copy(_target).add(new Vector3(0, 0.8, 0));
    camera.lookAt(_lookAt);
  });

  return null;
}
