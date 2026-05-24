import type { VehicleSpec } from '@paws/shared';

interface VehicleThumbProps {
  spec: VehicleSpec;
  size?: number;
}

/**
 * Pixel-art friendly thumbnail of a cat-on-bike sprite. Renders the same PNG
 * used in the game scene, scaled with crisp-edges so it stays sharp.
 */
export function VehicleThumb({ spec, size = 48 }: VehicleThumbProps) {
  return (
    <img
      src={spec.spritePath}
      alt={spec.label}
      width={size}
      height={Math.round(size * 0.625)} // sprites are 128×80 → keep the aspect
      className="pixel-art block"
      style={{ imageRendering: 'pixelated' }}
      draggable={false}
    />
  );
}
