import {
  type BikeState,
  type InputFlags,
  type PlayerState,
  SIM_DT,
  type TrackDef,
  VEHICLES,
  type VehicleId,
  emptyBikeState,
  quatToYaw,
  stepBike,
} from '@paws/shared';

interface PendingInput {
  seq: number;
  flags: InputFlags;
}

/**
 * Client-side prediction for the local player.
 *
 * Each call to `applyInput` advances a local BikeState by one sim tick AND
 * records the input. When `onSnapshot` is called with the latest server state
 * for the local player, we snap to the server's authoritative state, drop all
 * pending inputs that have been ack'd, then replay the remaining inputs so the
 * predicted state lands back at "now" relative to render time.
 *
 * This is the classic Quake/Source/Gaffer-on-Games pattern.
 */
export class PredictionController {
  private bike: BikeState = emptyBikeState();
  private pending: PendingInput[] = [];
  private vehicle: VehicleId = 'scout';
  private track: TrackDef | undefined;
  private initialized = false;

  setVehicle(v: VehicleId) {
    this.vehicle = v;
  }

  setTrack(track: TrackDef) {
    this.track = track;
  }

  /** Read-only snapshot of the predicted state. */
  getState(): Readonly<BikeState> {
    return this.bike;
  }

  /** Step once with these inputs and record for replay. */
  applyInput(seq: number, flags: InputFlags) {
    if (!this.initialized) return;
    const spec = VEHICLES[this.vehicle] ?? VEHICLES.scout;
    stepBike(this.bike, flags, SIM_DT, spec, this.track);
    this.pending.push({ seq, flags });
    // Bound the buffer; 60 inputs ≈ 2 s at 30Hz, well beyond worst RTT.
    if (this.pending.length > 60) this.pending.shift();
  }

  /**
   * Reconcile against the server's authoritative state. Called on every state
   * change for the local player.
   */
  onSnapshot(player: PlayerState) {
    // First snapshot establishes our baseline.
    if (!this.initialized) {
      this.bike.x = player.position.x;
      this.bike.y = player.position.y;
      this.bike.z = player.position.z;
      this.bike.yaw = quatToYaw(
        player.rotation.x,
        player.rotation.y,
        player.rotation.z,
        player.rotation.w,
      );
      this.bike.vx = player.velocity.x;
      this.bike.vz = player.velocity.z;
      this.bike.speed = player.speed;
      this.bike.drifting = player.drifting;
      this.initialized = true;
      return;
    }

    const ackSeq = player.lastSeq;

    // Drop ack'd inputs.
    while (this.pending.length > 0 && this.pending[0]!.seq <= ackSeq) {
      this.pending.shift();
    }

    // Reset to server authoritative.
    this.bike.x = player.position.x;
    this.bike.y = player.position.y;
    this.bike.z = player.position.z;
    this.bike.yaw = quatToYaw(
      player.rotation.x,
      player.rotation.y,
      player.rotation.z,
      player.rotation.w,
    );
    this.bike.vx = player.velocity.x;
    this.bike.vy = player.velocity.y;
    this.bike.vz = player.velocity.z;
    this.bike.speed = player.speed;
    this.bike.drifting = player.drifting;

    // Replay unacked inputs on top of the authoritative baseline.
    const spec = VEHICLES[this.vehicle] ?? VEHICLES.scout;
    for (const p of this.pending) {
      stepBike(this.bike, p.flags, SIM_DT, spec, this.track);
    }
  }
}
