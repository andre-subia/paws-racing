import { useFrame, useThree } from '@react-three/fiber';
import type { MutableRefObject } from 'react';
import { Quaternion, Vector3 } from 'three';

const _target = new Vector3();
const _offset = new Vector3();
const _q = new Quaternion();
const _desired = new Vector3();
const _lookAt = new Vector3();
const _up = new Vector3(0, 0.8, 0);

export interface CameraTarget {
  x: number;
  y: number;
  z: number;
  yaw: number;
}

interface ChaseCameraProps {
  targetRef: MutableRefObject<CameraTarget | null>;
}

/**
 * Chase camera that reads from a ref so it stays smooth even when the local
 * player's predicted state mutates outside React.
 */
export function ChaseCamera({ targetRef }: ChaseCameraProps) {
  const { camera } = useThree();

  useFrame((_, dt) => {
    const t = targetRef.current;
    if (!t) return;
    _target.set(t.x, t.y, t.z);
    const half = t.yaw * 0.5;
    _q.set(0, Math.sin(half), 0, Math.cos(half));

    _offset.set(0, 2.2, 5.5).applyQuaternion(_q);
    _desired.copy(_target).add(_offset);

    camera.position.lerp(_desired, Math.min(1, dt * 6));
    _lookAt.copy(_target).add(_up);
    camera.lookAt(_lookAt);
  });

  return null;
}
