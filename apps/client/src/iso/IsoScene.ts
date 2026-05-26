import { type PlayerState, type RaceState, type TrackDef } from '@paws/shared';
import { Container, Text, TextStyle } from 'pixi.js';
import type { Room } from 'colyseus.js';
import type { InterpolatedPose, RemoteInterpolator } from '../net/interpolation.js';
import type { PredictionController } from '../net/prediction.js';
import { BikeView } from './BikeView.js';
import { Explosion } from './Explosion.js';
import { TrackView } from './TrackView.js';
import { buildAtlas, type SpriteAtlas } from './sprites.js';
import { Viewport } from './viewport.js';

interface IsoSceneDeps {
  parent: HTMLElement;
  room: Room<RaceState>;
  prediction: PredictionController;
  interpolator: RemoteInterpolator;
  track: TrackDef;
}

/**
 * Owns the Pixi scene. Built once per join; tears down on leave. Listens to
 * the room's Colyseus state to add/remove BikeViews and reads from the net
 * prediction/interpolation each tick.
 */
export class IsoScene {
  static async create(deps: IsoSceneDeps): Promise<IsoScene> {
    const viewport = await Viewport.create(deps.parent);
    const atlas = await buildAtlas(viewport.app.renderer);
    // On touch devices we pull the camera back so more of the track is
    // visible — phones have less screen real estate and the on-screen
    // controls cover the lower corners.
    const isTouch =
      typeof window !== 'undefined' &&
      (window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window);
    if (isTouch) viewport.setZoom(0.65);
    return new IsoScene(viewport, atlas, deps);
  }

  private viewport: Viewport;
  private atlas: SpriteAtlas;
  private trackView: TrackView;
  private bikes = new Map<string, BikeView>();
  private bikesLayer: Container;
  private fxLayer: Container;
  private explosions: Explosion[] = [];
  private lastExplodedAt = new Map<string, number>();
  private deps: IsoSceneDeps;
  private pose: InterpolatedPose = { x: 0, y: 0, z: 0, yaw: 0, drifting: false };
  private resizeListener: () => void;

  private constructor(viewport: Viewport, atlas: SpriteAtlas, deps: IsoSceneDeps) {
    this.viewport = viewport;
    this.deps = deps;
    this.atlas = atlas;
    this.trackView = new TrackView(deps.track, this.atlas);
    this.viewport.world.addChild(this.trackView.container);
    this.bikesLayer = new Container();
    this.bikesLayer.sortableChildren = true;
    this.viewport.world.addChild(this.bikesLayer);
    this.fxLayer = new Container();
    this.fxLayer.sortableChildren = true;
    this.viewport.world.addChild(this.fxLayer);

    this.resizeListener = () => this.viewport.resize();
    window.addEventListener('resize', this.resizeListener);

    this.viewport.app.ticker.maxFPS = 30;
    this.viewport.app.ticker.add((ticker) => {
      const dt = ticker.deltaMS / 1000;
      this.update(dt);
    });
  }

  private ensureBike(player: PlayerState, localSid: string): BikeView {
    let view = this.bikes.get(player.id);
    if (!view) {
      const isLocal = player.id === localSid;
      const label = buildLabel(player.name, isLocal);
      view = new BikeView(this.atlas, player.vehicle, label, isLocal);
      this.bikes.set(player.id, view);
      this.bikesLayer.addChild(view.container);
    } else {
      view.setVehicle(player.vehicle);
    }
    return view;
  }

  /** Called every frame. Reads prediction/interp and pushes to sprites. */
  private update(dt: number) {
    const { room, prediction, interpolator } = this.deps;
    const localSid = room.sessionId;
    const players = room.state?.players;
    if (!players) return;

    const phase = room.state?.phase;
    const activeIds = new Set<string>();

    // Pulse the "next" checkpoint based on the local player's progress.
    const me = players.get(localSid);
    if (me) {
      const cpCount = this.deps.track.checkpoints.length;
      const nextId = (me.checkpoint + 1) % cpCount;
      this.trackView.setNextCheckpoint(nextId, performance.now() / 1000);
    }

    const localPlayer = players.get(localSid);
    const localFinished = (localPlayer?.finishedAt ?? 0) > 0;
    let cameraSet = false;

    for (const player of players.values()) {
      activeIds.add(player.id);
      const view = this.ensureBike(player, localSid);
      // Finished or currently exploded racers disappear from the track. The
      // explosion case is transient — the server clears explodedAt back to 0
      // once the bike respawns at the nearest checkpoint.
      view.container.visible = player.finishedAt === 0 && player.explodedAt === 0;

      // Detect explosion transition (server sets explodedAt once on impact).
      const prevExploded = this.lastExplodedAt.get(player.id) ?? 0;
      if (player.explodedAt > 0 && player.explodedAt !== prevExploded) {
        const expl = new Explosion(
          this.atlas.explosionFrames,
          player.position.x,
          player.position.z,
        );
        this.explosions.push(expl);
        this.fxLayer.addChild(expl.container);
      }
      this.lastExplodedAt.set(player.id, player.explodedAt);

      if (player.id === localSid && !localFinished) {
        if (phase === 'racing') {
          const s = prediction.getState();
          view.update(s.x, s.z, s.yaw);
          this.viewport.followTarget(s.x, s.z, dt);
          cameraSet = true;
        } else {
          view.update(player.position.x, player.position.z, quatYaw(player.rotation));
          this.viewport.followTarget(player.position.x, player.position.z, dt);
          cameraSet = true;
        }
      } else if (interpolator.sample(player.id, this.pose)) {
        view.update(this.pose.x, this.pose.z, this.pose.yaw);
      } else {
        view.update(player.position.x, player.position.z, quatYaw(player.rotation));
      }
    }

    // Spectator: local has finished — chase the leading remaining racer.
    if (!cameraSet && localFinished) {
      const target = pickSpectatorTarget(players, localSid);
      if (target) {
        this.viewport.followTarget(target.position.x, target.position.z, dt);
      } else if (localPlayer) {
        this.viewport.followTarget(localPlayer.position.x, localPlayer.position.z, dt);
      }
    }

    // Tick & cull explosions.
    for (let i = this.explosions.length - 1; i >= 0; i--) {
      const expl = this.explosions[i]!;
      expl.update(dt);
      if (expl.done) {
        expl.destroy();
        this.explosions.splice(i, 1);
      }
    }

    // Cleanup bikes whose players left.
    for (const id of Array.from(this.bikes.keys())) {
      if (!activeIds.has(id)) {
        const view = this.bikes.get(id)!;
        view.destroy();
        this.bikes.delete(id);
        this.lastExplodedAt.delete(id);
      }
    }

    this.bikesLayer.sortChildren();
  }

  destroy() {
    window.removeEventListener('resize', this.resizeListener);
    for (const view of this.bikes.values()) view.destroy();
    this.bikes.clear();
    for (const expl of this.explosions) expl.destroy();
    this.explosions = [];
    this.viewport.destroy();
  }
}

function quatYaw(rot: { x: number; y: number; z: number; w: number }): number {
  const siny_cosp = 2 * (rot.w * rot.y + rot.x * rot.z);
  const cosy_cosp = 1 - 2 * (rot.y * rot.y + rot.x * rot.x);
  return Math.atan2(siny_cosp, cosy_cosp);
}

function pickSpectatorTarget(
  players: Map<string, PlayerState>,
  localSid: string,
): PlayerState | null {
  let best: PlayerState | null = null;
  let bestProgress = -1;
  for (const p of players.values()) {
    if (p.id === localSid) continue;
    if (p.finishedAt > 0) continue;
    // Treat lap-then-checkpoint as progress score.
    const progress = p.lap * 1000 + Math.max(0, p.checkpoint);
    if (progress > bestProgress) {
      bestProgress = progress;
      best = p;
    }
  }
  return best;
}

function buildLabel(name: string, isLocal: boolean): Container {
  const style = new TextStyle({
    fontFamily: 'Press Start 2P, VT323, monospace',
    fontSize: 10,
    fill: isLocal ? 0x00e8ff : 0xffffff,
    stroke: { color: 0x000000, width: 3 },
  });
  const text = new Text({ text: name, style });
  text.anchor.set(0.5, 1);
  text.y = -42;
  const wrap = new Container();
  wrap.addChild(text);
  return wrap;
}
