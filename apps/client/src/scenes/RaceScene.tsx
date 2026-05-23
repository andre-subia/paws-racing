import { type PlayerState, type RaceState, getTrack } from '@paws/shared';
import { Environment } from '@react-three/drei';
import { Canvas, useFrame } from '@react-three/fiber';
import { type Room, getStateCallbacks } from 'colyseus.js';
import { useEffect, useMemo, useRef, useState } from 'react';
import { type CameraTarget, ChaseCamera } from '../game/Camera.tsx';
import { Track } from '../game/Track.tsx';
import { Vehicle } from '../game/Vehicle.tsx';
import { createRoom, joinByCode, quickRace } from '../net/client.ts';
import { type InputController, startInputLoop } from '../net/input.ts';
import { type InterpolatedPose, RemoteInterpolator } from '../net/interpolation.ts';
import { PredictionController } from '../net/prediction.ts';
import { useGame } from '../store/game.ts';
import { Hud } from '../ui/Hud.tsx';
import { LobbyPanel } from '../ui/LobbyPanel.tsx';
import { Results } from '../ui/Results.tsx';

type ConnState = 'connecting' | 'connected' | 'error' | 'disconnected';

interface SceneContext {
  room: Room<RaceState>;
  prediction: PredictionController;
  interpolator: RemoteInterpolator;
}

export function RaceScene() {
  const { name, vehicle, joinIntent, setVehicle, endRace } = useGame();
  const [ctx, setCtx] = useState<SceneContext | null>(null);
  const [conn, setConn] = useState<ConnState>('connecting');
  const [error, setError] = useState<string | null>(null);
  const [, force] = useState(0);

  const predictionRef = useRef<PredictionController>(new PredictionController());
  const interpolatorRef = useRef<RemoteInterpolator>(new RemoteInterpolator());
  const cameraTargetRef = useRef<CameraTarget | null>(null);

  useEffect(() => {
    if (!joinIntent) return;
    let cancelled = false;
    let inputCtrl: InputController | null = null;
    let activeRoom: Room<RaceState> | null = null;

    (async () => {
      try {
        predictionRef.current = new PredictionController();
        interpolatorRef.current = new RemoteInterpolator();
        predictionRef.current.setVehicle(vehicle);

        let room: Room<RaceState>;
        switch (joinIntent.kind) {
          case 'quick':
            room = await quickRace({ name, vehicle });
            break;
          case 'create':
            room = await createRoom({ name, vehicle });
            break;
          case 'join':
            room = await joinByCode({ name, vehicle, code: joinIntent.code });
            break;
        }

        if (cancelled) {
          room.leave();
          return;
        }
        activeRoom = room;
        setConn('connected');

        const prediction = predictionRef.current;
        const interpolator = interpolatorRef.current;

        room.onStateChange((state) => {
          for (const player of state.players.values()) {
            if (player.id === room.sessionId) {
              const v = player.vehicle === 'bruiser' ? 'bruiser' : 'scout';
              prediction.setVehicle(v);
              prediction.onSnapshot(player);
            } else {
              interpolator.pushFromSchema(player);
            }
          }
          force((n) => n + 1);
        });

        const $ = getStateCallbacks(room);
        $(room.state).players.onRemove((_player, key) => {
          if (key !== room.sessionId) interpolator.drop(key);
        });

        room.onLeave(() => setConn('disconnected'));
        room.onError((_code, msg) => {
          setError(msg ?? 'room error');
          setConn('error');
        });

        inputCtrl = startInputLoop(room, prediction);

        setCtx({ room, prediction, interpolator });
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
  }, [name, vehicle, joinIntent]);

  const room = ctx?.room;
  const phase = (room?.state.phase ?? 'waiting') as 'waiting' | 'countdown' | 'racing' | 'finished';
  const trackId = room?.state.trackId ?? 'neo_kibble_city';
  const track = useMemo(() => getTrack(trackId), [trackId]);

  const playersArr = useMemo(
    () => (room ? Array.from(room.state.players.values()) : []),
    // biome-ignore lint/correctness/useExhaustiveDependencies: re-derive on every forced render
    [room, room?.state.players.size, ctx, phase],
  );

  const localPlayer = room?.state.players.get(room.sessionId);
  const isHost = !!localPlayer?.host;

  return (
    <>
      <Canvas
        shadows
        camera={{ position: [0, 6, 18], fov: 60 }}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
        dpr={[1, 1.5]}
      >
        <color attach="background" args={['#0b0418']} />
        <fog attach="fog" args={['#0b0418', 80, 220]} />

        <ambientLight intensity={0.4} color="#5a3aa0" />
        <directionalLight
          position={[40, 60, 20]}
          intensity={1.1}
          castShadow
          shadow-mapSize={[1024, 1024]}
        />
        <hemisphereLight args={['#ff7ed3', '#1a0a3a', 0.4]} />
        <Environment preset="night" />

        <Track track={track} />

        {ctx && (
          <SceneRenderer
            players={playersArr}
            localSid={ctx.room.sessionId}
            prediction={ctx.prediction}
            interpolator={ctx.interpolator}
            cameraTargetRef={cameraTargetRef}
            phase={phase}
          />
        )}

        <ChaseCamera targetRef={cameraTargetRef} />
      </Canvas>

      {room && phase === 'waiting' && (
        <LobbyPanel
          code={room.state.code}
          players={playersArr.map((p) => ({
            id: p.id,
            name: p.name,
            vehicle: p.vehicle,
            ready: p.ready,
            host: p.host,
          }))}
          localSid={room.sessionId}
          isHost={isHost}
          countdownEndsAt={room.state.countdownEndsAt}
          phase={phase}
          onToggleReady={() => room.send('ready', {})}
          onPickVehicle={(v) => {
            setVehicle(v);
            room.send('vehicle', { vehicle: v });
          }}
          onStart={() => room.send('start', {})}
          onLeave={endRace}
        />
      )}

      {room && phase === 'countdown' && (
        <LobbyPanel
          code={room.state.code}
          players={[]}
          localSid={room.sessionId}
          isHost={isHost}
          countdownEndsAt={room.state.countdownEndsAt}
          phase={phase}
          onToggleReady={() => undefined}
          onPickVehicle={() => undefined}
          onStart={() => undefined}
          onLeave={endRace}
        />
      )}

      {phase === 'racing' && room && localPlayer && (
        <Hud
          status="RACING"
          speed={ctx?.prediction.getState().speed ?? localPlayer.speed}
          roomCode={room.state.code}
          players={playersArr.length}
          lap={localPlayer.lap}
          checkpoint={localPlayer.checkpoint}
          totalCheckpoints={track.checkpoints.length}
          rank={localPlayer.position_rank}
          boostUntil={localPlayer.boostUntil}
          serverTime={room.state.serverTime}
          onLeave={endRace}
        />
      )}

      {phase === 'finished' && room && (
        <Results
          raceStartedAt={room.state.countdownEndsAt}
          rows={buildResults(playersArr, room.sessionId, room.state)}
          onLeave={endRace}
        />
      )}

      {error && (
        <div className="absolute inset-x-0 top-0 bg-red-600/80 px-4 py-2 text-center text-white">
          {error}
        </div>
      )}
    </>
  );
}

function buildResults(
  players: PlayerState[],
  localSid: string,
  state: RaceState,
): Array<{ rank: number; name: string; finishedAt: number; isLocal: boolean; vehicle: string }> {
  // Finished players in order; then unfinished sorted by lap+checkpoint descending.
  const finishedIds = Array.from(state.finishOrder);
  const finished = finishedIds.map((id, i) => {
    const p = players.find((pp) => pp.id === id);
    return {
      rank: i + 1,
      name: p?.name ?? '???',
      finishedAt: p?.finishedAt ?? 0,
      isLocal: id === localSid,
      vehicle: p?.vehicle ?? '',
    };
  });
  const unfinishedSorted = players
    .filter((p) => p.finishedAt === 0)
    .sort((a, b) => b.lap * 100 + b.checkpoint - (a.lap * 100 + a.checkpoint));
  const unfinished = unfinishedSorted.map((p, i) => ({
    rank: finished.length + i + 1,
    name: p.name,
    finishedAt: 0,
    isLocal: p.id === localSid,
    vehicle: p.vehicle,
  }));
  return [...finished, ...unfinished];
}

interface RendererProps {
  players: PlayerState[];
  localSid: string;
  prediction: PredictionController;
  interpolator: RemoteInterpolator;
  cameraTargetRef: { current: CameraTarget | null };
  phase: 'waiting' | 'countdown' | 'racing' | 'finished';
}

const _pose: InterpolatedPose = { x: 0, y: 0, z: 0, yaw: 0, drifting: false };

function SceneRenderer({
  players,
  localSid,
  prediction,
  interpolator,
  cameraTargetRef,
  phase,
}: RendererProps) {
  const poses = useRef(new Map<string, InterpolatedPose>());

  useFrame(() => {
    for (const p of players) {
      let pose = poses.current.get(p.id);
      if (!pose) {
        pose = { x: 0, y: 0.5, z: 0, yaw: 0, drifting: false };
        poses.current.set(p.id, pose);
      }
      if (p.id === localSid) {
        if (phase === 'racing') {
          const s = prediction.getState();
          pose.x = s.x;
          pose.y = s.y;
          pose.z = s.z;
          pose.yaw = s.yaw;
          pose.drifting = s.drifting;
        } else {
          pose.x = p.position.x;
          pose.y = p.position.y;
          pose.z = p.position.z;
          pose.yaw = quatYaw(p.rotation.x, p.rotation.y, p.rotation.z, p.rotation.w);
          pose.drifting = p.drifting;
        }
        if (!cameraTargetRef.current) cameraTargetRef.current = { x: 0, y: 0, z: 0, yaw: 0 };
        cameraTargetRef.current.x = pose.x;
        cameraTargetRef.current.y = pose.y;
        cameraTargetRef.current.z = pose.z;
        cameraTargetRef.current.yaw = pose.yaw;
      } else {
        if (interpolator.sample(p.id, _pose)) {
          pose.x = _pose.x;
          pose.y = _pose.y;
          pose.z = _pose.z;
          pose.yaw = _pose.yaw;
          pose.drifting = _pose.drifting;
        }
      }
    }
  });

  return (
    <>
      {players.map((p) => {
        const pose = poses.current.get(p.id) ?? { x: 0, y: 0.5, z: 0, yaw: 0, drifting: false };
        const isLocal = p.id === localSid;
        const color = isLocal ? '#42f5e0' : p.vehicle === 'bruiser' ? '#ff3aa3' : '#ffb142';
        return (
          <Vehicle
            key={p.id}
            x={pose.x}
            y={pose.y}
            z={pose.z}
            yaw={pose.yaw}
            color={color}
            snap={isLocal && phase === 'racing'}
            drifting={pose.drifting}
          />
        );
      })}
    </>
  );
}

function quatYaw(x: number, y: number, z: number, w: number): number {
  const siny_cosp = 2 * (w * y + x * z);
  const cosy_cosp = 1 - 2 * (y * y + x * x);
  return Math.atan2(siny_cosp, cosy_cosp);
}
