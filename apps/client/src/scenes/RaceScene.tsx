import type { PlayerState, RaceState } from '@paws/shared';
import { Environment, Grid } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import type { Room } from 'colyseus.js';
import { useEffect, useState } from 'react';
import { ChaseCamera } from '../game/Camera.tsx';
import { Vehicle } from '../game/Vehicle.tsx';
import { joinRace } from '../net/client.ts';
import { type InputController, startInputLoop } from '../net/input.ts';
import { useGame } from '../store/game.ts';
import { Hud } from '../ui/Hud.tsx';

type ConnState = 'connecting' | 'connected' | 'error' | 'disconnected';

export function RaceScene() {
  const { name, vehicle, setScene } = useGame();
  const [room, setRoom] = useState<Room<RaceState> | null>(null);
  const [conn, setConn] = useState<ConnState>('connecting');
  const [error, setError] = useState<string | null>(null);
  const [, force] = useState(0);

  // Connect on mount.
  useEffect(() => {
    let cancelled = false;
    let inputCtrl: InputController | null = null;
    let activeRoom: Room<RaceState> | null = null;

    (async () => {
      try {
        const r = await joinRace({ name, vehicle });
        if (cancelled) {
          r.leave();
          return;
        }
        activeRoom = r;
        setRoom(r);
        setConn('connected');

        // Force a render on every state patch (cheap because Three is imperative).
        r.onStateChange(() => force((n) => n + 1));
        r.onLeave(() => setConn('disconnected'));
        r.onError((_code, msg) => {
          setError(msg ?? 'room error');
          setConn('error');
        });

        inputCtrl = startInputLoop(r);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        setConn('error');
      }
    })();

    return () => {
      cancelled = true;
      inputCtrl?.stop();
      activeRoom?.leave();
    };
  }, [name, vehicle]);

  const players: PlayerState[] = room ? Array.from(room.state.players.values()) : [];
  const localPlayer = room ? room.state.players.get(room.sessionId) : undefined;

  return (
    <>
      <Canvas
        shadows
        camera={{ position: [0, 4, 10], fov: 60 }}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
        dpr={[1, 1.5]}
      >
        <color attach="background" args={['#1a0a3a']} />
        <fog attach="fog" args={['#1a0a3a', 30, 140]} />

        <ambientLight intensity={0.4} />
        <directionalLight
          position={[20, 30, 10]}
          intensity={1.2}
          castShadow
          shadow-mapSize={[1024, 1024]}
        />
        <Environment preset="night" />

        {/* Placeholder ground until W3 track lands. */}
        <Grid
          args={[200, 200]}
          cellColor="#42f5e0"
          sectionColor="#9b59ff"
          fadeDistance={120}
          infiniteGrid
          position={[0, 0, 0]}
        />

        {players.map((p) => (
          <Vehicle key={p.id} player={p} isLocal={p.id === room?.sessionId} />
        ))}

        <ChaseCamera player={localPlayer} />
      </Canvas>

      <Hud
        status={conn === 'connected' ? 'CONNECTED' : conn.toUpperCase()}
        speed={localPlayer?.speed ?? 0}
        roomCode={room?.state.code}
        players={players.length}
        onLeave={() => setScene('menu')}
      />

      {error && (
        <div className="absolute inset-x-0 top-0 bg-red-600/80 px-4 py-2 text-center text-white">
          {error}
        </div>
      )}
    </>
  );
}
