import type { VehicleId } from '@paws/shared';
import { create } from 'zustand';

export type Scene = 'menu' | 'race';

interface GameStore {
  scene: Scene;
  name: string;
  vehicle: VehicleId;
  setScene: (s: Scene) => void;
  setName: (n: string) => void;
  setVehicle: (v: VehicleId) => void;
}

const stored = (key: string, fallback: string) =>
  (typeof window !== 'undefined' && window.localStorage.getItem(key)) || fallback;

export const useGame = create<GameStore>((set) => ({
  scene: 'menu',
  name: stored('paws.name', 'Racer'),
  vehicle: (stored('paws.vehicle', 'scout') as VehicleId) ?? 'scout',
  setScene: (scene) => set({ scene }),
  setName: (name) => {
    window.localStorage.setItem('paws.name', name);
    set({ name });
  },
  setVehicle: (vehicle) => {
    window.localStorage.setItem('paws.vehicle', vehicle);
    set({ vehicle });
  },
}));
