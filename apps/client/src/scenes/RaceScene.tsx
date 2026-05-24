import { type PlayerState, type RaceState, type VehicleId, getTrack } from '@paws/shared';
import { type Room, getStateCallbacks } from 'colyseus.js';
import { useEffect, useMemo, useRef, useState } from 'react';
import { IsoScene } from '../iso/IsoScene.ts';
import { createRoom, joinByCode, quickRace } from '../net/client.ts';
import { type InputController, startInputLoop } from '../net/input.ts';
import { RemoteInterpolator } from '../net/interpolation.ts';
import { PredictionController } from '../net/prediction.ts';
import { useGame } from '../store/game.ts';
import { Hud } from '../ui/Hud.tsx';
import { LobbyPanel } from '../ui/LobbyPanel.tsx';
import { MiniMap } from '../ui/MiniMap.tsx';
import { Results } from '../ui/Results.tsx';
import { TouchControls } from '../ui/TouchControls.tsx';

const IS_TOUCH =
  typeof window !== 'undefined' &&
  (window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window);

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
  const [pingMs, setPingMs] = useState(0);

  const pixiHostRef = useRef<HTMLDivElement | null>(null);
  const isoSceneRef = useRef<IsoScene | null>(null);

  useEffect(() => {
    if (!joinIntent) return;
    let cancelled = false;
    let inputCtrl: InputController | null = null;
    let activeRoom: Room<RaceState> | null = null;

    (async () => {
      try {
        const prediction = new PredictionController();
        const interpolator = new RemoteInterpolator();
        prediction.setVehicle(vehicle);

        let room: Room<RaceState>;
        switch (joinIntent.kind) {
          case 'quick':
            room = await quickRace({ name, vehicle });
            break;
          case 'create':
            room = await createRoom({
              name,
              vehicle,
              trackId: joinIntent.trackId,
              laps: joinIntent.laps,
            });
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

        let stateReady = false;
        let trackBound = '';
        room.onStateChange((state) => {
          if (!state || !state.players) return;
          if (state.trackId && state.trackId !== trackBound) {
            prediction.setTrack(getTrack(state.trackId));
            trackBound = state.trackId;
          }
          for (const player of state.players.values()) {
            if (player.id === room.sessionId) {
              prediction.setVehicle(player.vehicle as VehicleId);
              prediction.onSnapshot(player);
            } else {
              interpolator.pushFromSchema(player);
            }
          }
          if (!stateReady) {
            stateReady = true;
            setConn('connected');
            setCtx({ room, prediction, interpolator });
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

        // Roundtrip ping: send our timestamp, server echoes, we measure ms.
        room.onMessage('pong', (sentAt: number) => {
          setPingMs(Math.round(performance.now() - sentAt));
        });
        const sendPing = () => {
          try {
            room.send('ping', performance.now());
          } catch {
            // Connection closed in the middle of the interval — ignore.
          }
        };
        sendPing();
        const pingInterval = window.setInterval(sendPing, 2000);
        const stopPing = () => window.clearInterval(pingInterval);
        room.onLeave(stopPing);

        inputCtrl = startInputLoop(room, prediction);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        setConn('error');
      }
    })();

    return () => {
      cancelled = true;
      inputCtrl?.stop();
      activeRoom?.leave();
      isoSceneRef.current?.destroy();
      isoSceneRef.current = null;
    };
    // Only re-run when the join intent itself changes. `name` and `vehicle`
    // are captured in closure at join time; changing them in the lobby would
    // otherwise leave the room and create a fresh one (with a new code for
    // private rooms), splitting players across rooms.
    // biome-ignore lint/correctness/useExhaustiveDependencies: see above
  }, [joinIntent]);

  // Bring up the Pixi scene once the room is connected. Rebuilds when the
  // track changes (host swaps map from the lobby).
  const sceneTrackId = ctx?.room.state?.trackId ?? 'neo_kibble_city';
  useEffect(() => {
    if (!ctx || !pixiHostRef.current) return;
    if (isoSceneRef.current) {
      isoSceneRef.current.destroy();
      isoSceneRef.current = null;
    }
    const track = getTrack(sceneTrackId);
    let scene: IsoScene | null = null;
    let cancelled = false;
    IsoScene.create({
      parent: pixiHostRef.current,
      room: ctx.room,
      prediction: ctx.prediction,
      interpolator: ctx.interpolator,
      track,
    }).then((s) => {
      if (cancelled) {
        s.destroy();
        return;
      }
      scene = s;
      isoSceneRef.current = s;
    });
    return () => {
      cancelled = true;
      if (scene) {
        scene.destroy();
        isoSceneRef.current = null;
      }
    };
  }, [ctx, sceneTrackId]);

  const room = ctx?.room;
  const phase = (room?.state?.phase ?? 'waiting') as
    | 'waiting'
    | 'countdown'
    | 'racing'
    | 'finished';
  const trackId = room?.state?.trackId ?? 'neo_kibble_city';
  const track = useMemo(() => getTrack(trackId), [trackId]);

  const playersArr = useMemo(
    () => (room?.state?.players ? Array.from(room.state.players.values()) : []),
    // biome-ignore lint/correctness/useExhaustiveDependencies: re-derive on every forced render
    [room, room?.state?.players?.size, ctx, phase],
  );

  const localPlayer = room?.state?.players?.get(room.sessionId);
  const isHost = !!localPlayer?.host;

  const finishOrderIds = useMemo(
    () => (room?.state?.finishOrder ? Array.from(room.state.finishOrder) : []),
    // biome-ignore lint/correctness/useExhaustiveDependencies: re-derive on every forced render
    [room, room?.state?.finishOrder?.length, ctx, phase],
  );

  const ranking = useMemo(() => {
    if (!room || playersArr.length === 0) return [];
    const finishIdx = new Map<string, number>();
    finishOrderIds.forEach((id, i) => finishIdx.set(id, i));
    const cpCount = track.checkpoints.length;
    const sorted = [...playersArr].sort((a, b) => {
      const af = finishIdx.get(a.id);
      const bf = finishIdx.get(b.id);
      if (af !== undefined && bf !== undefined) return af - bf;
      if (af !== undefined) return -1;
      if (bf !== undefined) return 1;
      const aProg = a.lap * cpCount + Math.max(0, a.checkpoint);
      const bProg = b.lap * cpCount + Math.max(0, b.checkpoint);
      return bProg - aProg;
    });
    return sorted.map((p) => ({
      id: p.id,
      name: p.name,
      isLocal: p.id === room.sessionId,
      finished: finishIdx.has(p.id),
      exploded: p.explodedAt > 0,
      health: p.health,
    }));
  }, [room, playersArr, finishOrderIds, track]);

  const localFinished = (localPlayer?.finishedAt ?? 0) > 0;
  const spectatorTarget = useMemo(() => {
    if (!localFinished) return null;
    // Spectate the top-ranked still-racing player.
    const target = ranking.find((r) => !r.finished && !r.isLocal);
    return target ? target.name : null;
  }, [localFinished, ranking]);

  return (
    <>
      <div ref={pixiHostRef} className="absolute inset-0" />

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
          trackId={room.state.trackId}
          laps={room.state.laps}
          onToggleReady={() => room.send('ready', {})}
          onPickVehicle={(v) => {
            setVehicle(v);
            room.send('vehicle', { vehicle: v });
          }}
          onPickTrack={(t) => room.send('track', { trackId: t })}
          onPickLaps={(n) => room.send('laps', { laps: n })}
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
          trackId={room.state.trackId}
          laps={room.state.laps}
          onToggleReady={() => undefined}
          onPickVehicle={() => undefined}
          onPickTrack={() => undefined}
          onPickLaps={() => undefined}
          onStart={() => undefined}
          onLeave={endRace}
        />
      )}

      {phase === 'racing' && room && localPlayer && (
        <>
          <Hud
            status="RACING"
            speed={ctx?.prediction.getState().speed ?? localPlayer.speed}
            roomCode={room.state.code}
            players={playersArr.length}
            lap={localPlayer.lap}
            totalLaps={room.state.laps}
            checkpoint={localPlayer.checkpoint}
            totalCheckpoints={track.checkpoints.length}
            ranking={ranking}
            spectating={spectatorTarget}
            boostUntil={localPlayer.boostUntil}
            serverTime={room.state.serverTime}
            health={localPlayer.health}
            exploded={localPlayer.explodedAt > 0}
            pingMs={pingMs}
            compact={IS_TOUCH}
            onLeave={endRace}
          />
          <MiniMap
            trackId={trackId}
            players={playersArr}
            localSid={room.sessionId}
            compact={IS_TOUCH}
          />
          {IS_TOUCH && !localFinished && <TouchControls />}
        </>
      )}

      {phase === 'finished' && room && (
        <Results
          raceStartedAt={room.state.countdownEndsAt}
          rows={buildResults(playersArr, room.sessionId, room.state)}
          onLeave={endRace}
        />
      )}

      {!ctx && !error && (
        <div className="absolute inset-0 flex items-center justify-center bg-ink/80">
          <div className="rounded-lg border-2 border-neon-cyan/40 bg-black/70 px-8 py-6 text-center">
            <div className="font-pixel text-lg text-neon-cyan">CONNECTING</div>
            <div className="mt-2 text-xs text-white/50">Joining race room…</div>
          </div>
        </div>
      )}

      {error && (
        <>
          <div className="absolute inset-x-0 top-0 bg-red-600/80 px-4 py-2 text-center text-white">
            {error}
          </div>
          <button
            type="button"
            onClick={endRace}
            className="absolute left-1/2 top-12 -translate-x-1/2 rounded border border-white/30 bg-black/60 px-4 py-2 text-sm uppercase tracking-widest hover:border-white/60"
          >
            Back to Menu
          </button>
        </>
      )}
    </>
  );
}

function buildResults(
  players: PlayerState[],
  localSid: string,
  state: RaceState,
): Array<{ rank: number; name: string; finishedAt: number; isLocal: boolean; vehicle: string }> {
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
