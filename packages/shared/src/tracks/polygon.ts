import type { Vec3Lit } from '../track.js';

export interface Vec2 {
  x: number;
  z: number;
}

export interface PolygonLoopOptions {
  /** Polygon corners in traversal order (CCW in math = CW on screen for our iso). */
  vertices: Vec2[];
  /** Rounding radius applied at every corner. */
  cornerRadius: number;
  /** Index of the side V[i] → V[(i+1)%n] containing the start point. */
  startSegment: number;
  /** Position along the straight portion of the start segment (0 = right after the previous arc, 1 = just before the next arc). */
  startFraction: number;
  /** y coordinate written into every sample (default 0). */
  surfaceY?: number;
  /** Samples used to draw each corner arc (default 8). */
  samplesPerArc?: number;
  /** Sample density along straight sections in world units per sample (default 2). */
  samplesPerWorldUnit?: number;
}

export interface PolygonLoopResult {
  /** The closed centerline loop. loop[0] is the start point. */
  loop: Vec3Lit[];
  startX: number;
  startZ: number;
  /** Bike yaw at start so forward = direction of travel. */
  startYaw: number;
  /** Unit vector of direction of travel at the start. */
  startForward: Vec2;
}

interface CornerArc {
  center: Vec2;
  radius: number;
  startAngle: number;
  sweep: number;
  /** Last point of the arc (where the next straight begins). */
  exitPoint: Vec2;
  /** First point of the arc (where the previous straight ended). */
  entryPoint: Vec2;
}

/**
 * Build a closed loop polyline that traces a polygon with rounded corners.
 * The first sample of the returned loop is the start point, sitting on the
 * straight portion of `startSegment` at `startFraction` interpolation.
 *
 * Vertices must form a convex polygon traversed CCW in math coordinates
 * (equivalent to CW on the iso screen since +z goes to the bottom-right).
 */
export function buildPolygonLoop(opts: PolygonLoopOptions): PolygonLoopResult {
  const {
    vertices,
    cornerRadius,
    startSegment,
    startFraction,
    surfaceY = 0,
    samplesPerArc = 8,
    samplesPerWorldUnit = 2,
  } = opts;

  const n = vertices.length;
  if (n < 3) throw new Error('polygon needs at least 3 vertices');

  // Compute one CornerArc per vertex (radius/center/sweep tangent to both sides).
  const corners: CornerArc[] = vertices.map((curr, i) => {
    const prev = vertices[(i - 1 + n) % n]!;
    const next = vertices[(i + 1) % n]!;

    const inX = curr.x - prev.x;
    const inZ = curr.z - prev.z;
    const inLen = Math.hypot(inX, inZ);
    const inUx = inX / inLen;
    const inUz = inZ / inLen;

    const outX = next.x - curr.x;
    const outZ = next.z - curr.z;
    const outLen = Math.hypot(outX, outZ);
    const outUx = outX / outLen;
    const outUz = outZ / outLen;

    const cosTheta = Math.min(1, Math.max(-1, inUx * outUx + inUz * outUz));
    const theta = Math.acos(cosTheta);
    const d = cornerRadius / Math.tan(theta / 2);

    const entryPoint = { x: curr.x - inUx * d, z: curr.z - inUz * d };
    const exitPoint = { x: curr.x + outUx * d, z: curr.z + outUz * d };

    // Cross product sign tells turn direction (CCW math = positive cross).
    const cross = inUx * outUz - inUz * outUx;
    const perpX = cross > 0 ? -inUz : inUz;
    const perpZ = cross > 0 ? inUx : -inUx;
    const center = {
      x: entryPoint.x + perpX * cornerRadius,
      z: entryPoint.z + perpZ * cornerRadius,
    };

    const startAngle = Math.atan2(entryPoint.z - center.z, entryPoint.x - center.x);
    const endAngle = Math.atan2(exitPoint.z - center.z, exitPoint.x - center.x);
    let sweep = endAngle - startAngle;
    if (cross > 0 && sweep < 0) sweep += Math.PI * 2;
    if (cross < 0 && sweep > 0) sweep -= Math.PI * 2;

    return { center, radius: cornerRadius, startAngle, sweep, entryPoint, exitPoint };
  });

  // The "straight" of segment i runs from corners[i].exitPoint to
  // corners[(i+1)%n].entryPoint. Compute the start point inside the requested
  // segment's straight.
  const segA = corners[startSegment]!.exitPoint;
  const segB = corners[(startSegment + 1) % n]!.entryPoint;
  const startPt = {
    x: segA.x + (segB.x - segA.x) * startFraction,
    z: segA.z + (segB.z - segA.z) * startFraction,
  };
  const segDx = segB.x - segA.x;
  const segDz = segB.z - segA.z;
  const segLen = Math.hypot(segDx, segDz);
  const startForward: Vec2 = { x: segDx / segLen, z: segDz / segLen };
  const startYaw = Math.atan2(-startForward.x, -startForward.z);

  // Emit the loop: start point → rest of segment → arc → segment → arc → ...
  // → arc at the start segment's corner V[startSegment] → leading portion of
  // segment startSegment back up to start point.
  const out: Vec3Lit[] = [];
  const push = (x: number, z: number) => out.push({ x, y: surfaceY, z });

  push(startPt.x, startPt.z);

  const addLine = (from: Vec2, to: Vec2) => {
    const len = Math.hypot(to.x - from.x, to.z - from.z);
    const n2 = Math.max(2, Math.round(len / samplesPerWorldUnit));
    for (let i = 1; i <= n2; i++) {
      const t = i / n2;
      push(from.x + (to.x - from.x) * t, from.z + (to.z - from.z) * t);
    }
  };

  const addArc = (c: CornerArc) => {
    for (let i = 1; i <= samplesPerArc; i++) {
      const t = i / samplesPerArc;
      const a = c.startAngle + c.sweep * t;
      push(c.center.x + Math.cos(a) * c.radius, c.center.z + Math.sin(a) * c.radius);
    }
  };

  // 1) Trailing portion of start segment: from startPt to next corner's entry.
  const nextCorner = corners[(startSegment + 1) % n]!;
  addLine(startPt, nextCorner.entryPoint);
  addArc(nextCorner);

  // 2) Loop around the remaining (n - 1) segments.
  let idx = (startSegment + 1) % n;
  for (let s = 0; s < n - 1; s++) {
    const nextIdx = (idx + 1) % n;
    addLine(corners[idx]!.exitPoint, corners[nextIdx]!.entryPoint);
    addArc(corners[nextIdx]!);
    idx = nextIdx;
  }

  // 3) Leading portion of start segment: from start corner exit back to startPt.
  const startCornerExit = corners[startSegment]!.exitPoint;
  const closingLen = Math.hypot(startPt.x - startCornerExit.x, startPt.z - startCornerExit.z);
  if (closingLen > samplesPerWorldUnit) {
    const n3 = Math.max(1, Math.round(closingLen / samplesPerWorldUnit));
    for (let i = 1; i < n3; i++) {
      const t = i / n3;
      push(
        startCornerExit.x + (startPt.x - startCornerExit.x) * t,
        startCornerExit.z + (startPt.z - startCornerExit.z) * t,
      );
    }
  }

  // Drop a trailing duplicate of the start (closed loops shouldn't duplicate).
  const first = out[0]!;
  const last = out[out.length - 1]!;
  if (Math.hypot(last.x - first.x, last.z - first.z) < 0.05) out.pop();

  return { loop: out, startX: startPt.x, startZ: startPt.z, startYaw, startForward };
}
