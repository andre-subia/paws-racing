import type { TrackId, VehicleId } from '@paws/shared';
import { create } from 'zustand';

export type Scene = 'landing' | 'menu' | 'race';
export type JoinIntent =
  | { kind: 'quick' }
  | { kind: 'create'; trackId: TrackId; laps: number; bots?: number }
  | { kind: 'join'; code: string };

interface GameStore {
  scene: Scene;
  name: string;
  vehicle: VehicleId;
  joinIntent: JoinIntent | null;
  setScene: (s: Scene) => void;
  setName: (n: string) => void;
  setVehicle: (v: VehicleId) => void;
  startRace: (intent: JoinIntent) => void;
  endRace: () => void;
}

const stored = (key: string, fallback: string) =>
  (typeof window !== 'undefined' && window.localStorage.getItem(key)) || fallback;

export const useGame = create<GameStore>((set) => ({
  scene: 'landing',
  name: stored('paws.name', 'Racer'),
  vehicle: (stored('paws.vehicle', 'scout') as VehicleId) ?? 'scout',
  joinIntent: null,
  setScene: (scene) => set({ scene }),
  setName: (name) => {
    window.localStorage.setItem('paws.name', name);
    set({ name });
  },
  setVehicle: (vehicle) => {
    window.localStorage.setItem('paws.vehicle', vehicle);
    set({ vehicle });
  },
  startRace: (intent) => set({ scene: 'race', joinIntent: intent }),
  endRace: () => set({ scene: 'menu', joinIntent: null }),
}));
