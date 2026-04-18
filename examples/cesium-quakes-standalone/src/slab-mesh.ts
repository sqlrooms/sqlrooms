/**
 * Parametric Wadati–Benioff slab surface generator.
 *
 * Real subduction-zone geometry is captured by Slab2.0 (Hayes et al., 2018,
 * USGS) as per-zone depth grids, but those grids are tens of MB of netCDF
 * each — too heavy to bundle into a browser demo. Instead we build a
 * smoothed analytical slab whose dip profile starts shallow at the trench
 * and asymptotes to a steep angle at depth:
 *
 *     dip(s) = dipMin + (dipMax − dipMin) · (1 − exp(−s / dipScale))
 *
 * Walking arc-length along this profile gives a 1D path of (horizontal,
 * depth) pairs. Sweeping that path along the trench strike produces the 2D
 * slab top, which we then triangulate into a regular grid mesh. Per-zone
 * parameters (dip range, scale, max depth) are loosely tuned to Slab2 stats
 * so each preset has its own character.
 */

import {
  BoundingSphere,
  Cartesian3,
  Color,
  ColorGeometryInstanceAttribute,
  ComponentDatatype,
  Geometry,
  GeometryAttribute,
  GeometryInstance,
  PerInstanceColorAppearance,
  Primitive,
  PrimitiveType,
} from 'cesium';
import {KM_PER_DEG, type SubductionPreset} from './earthquake-presets';

/** Mesh resolution. 32 × 64 ≈ 4k triangles — trivial for the GPU. */
const STRIKE_STEPS = 32;
const DIP_STEPS = 64;
/** Arc-length step along the dip profile, in km. */
const ARC_STEP_KM = 4;
/** Hard cap on profile length so a misconfigured preset can't loop forever. */
const ARC_CAP_KM = 4000;

type Sample = readonly [number, number]; // [horizontalKm, depthKm]

function buildDipPath(slab: SubductionPreset['slab']): Sample[] {
  if (!slab) return [];
  const {dipMinDeg, dipMaxDeg, dipScaleKm, maxDepthKm} = slab;
  const path: Sample[] = [[0, 0]];
  let arc = 0;
  let h = 0;
  let z = 0;
  while (z < maxDepthKm && arc < ARC_CAP_KM) {
    const dipDeg =
      dipMinDeg + (dipMaxDeg - dipMinDeg) * (1 - Math.exp(-arc / dipScaleKm));
    const dipRad = (dipDeg * Math.PI) / 180;
    h += ARC_STEP_KM * Math.cos(dipRad);
    z += ARC_STEP_KM * Math.sin(dipRad);
    arc += ARC_STEP_KM;
    path.push([h, z]);
  }
  return path;
}

/** Resample any path to exactly `n` evenly-spaced samples via linear interp. */
function resamplePath(path: Sample[], n: number): Sample[] {
  if (path.length === 0) return [];
  const out: Sample[] = new Array(n);
  const last = path.length - 1;
  for (let i = 0; i < n; i++) {
    const t = (i / (n - 1)) * last;
    const lo = Math.min(Math.floor(t), last);
    const hi = Math.min(lo + 1, last);
    const frac = t - lo;
    const a = path[lo]!;
    const b = path[hi]!;
    out[i] = [a[0] + (b[0] - a[0]) * frac, a[1] + (b[1] - a[1]) * frac];
  }
  return out;
}

export function buildSlabPrimitive(preset: SubductionPreset): Primitive | null {
  const slab = preset.slab;
  if (!slab) return null;
  const {longitude, latitude, strikeDeg} = preset;

  const dipPath = resamplePath(buildDipPath(slab), DIP_STEPS);
  if (dipPath.length === 0) return null;

  // dip direction = strike rotated ±90° depending on which side the slab dips
  const dipSign = slab.dipSide === 'right' ? 1 : -1;
  const cosLat = Math.cos((latitude * Math.PI) / 180);
  const strikeRad = (strikeDeg * Math.PI) / 180;
  const dipRad = strikeRad + (dipSign * Math.PI) / 2;
  const strikeE = Math.sin(strikeRad);
  const strikeN = Math.cos(strikeRad);
  const dipE = Math.sin(dipRad);
  const dipN = Math.cos(dipRad);

  const numVerts = STRIKE_STEPS * DIP_STEPS;
  const positions = new Float64Array(numVerts * 3);
  // Reuse a single Cartesian3 scratch instead of allocating per vertex.
  const scratch = new Cartesian3();

  for (let r = 0; r < STRIKE_STEPS; r++) {
    const sKm = (r / (STRIKE_STEPS - 1) - 0.5) * slab.alongStrikeKm;

    for (let c = 0; c < DIP_STEPS; c++) {
      const sample = dipPath[c]!;
      const hKm = sample[0];
      const zKm = sample[1];

      const eastKm = sKm * strikeE + hKm * dipE;
      const northKm = sKm * strikeN + hKm * dipN;

      const lon = longitude + eastKm / (KM_PER_DEG * cosLat);
      const lat = latitude + northKm / KM_PER_DEG;
      const heightM = -zKm * 1000;

      Cartesian3.fromDegrees(lon, lat, heightM, undefined, scratch);
      const i = (r * DIP_STEPS + c) * 3;
      positions[i] = scratch.x;
      positions[i + 1] = scratch.y;
      positions[i + 2] = scratch.z;
    }
  }

  const quadCount = (STRIKE_STEPS - 1) * (DIP_STEPS - 1);
  const indices = new Uint32Array(quadCount * 6);
  let k = 0;
  for (let r = 0; r < STRIKE_STEPS - 1; r++) {
    for (let c = 0; c < DIP_STEPS - 1; c++) {
      const i00 = r * DIP_STEPS + c;
      const i01 = r * DIP_STEPS + c + 1;
      const i10 = (r + 1) * DIP_STEPS + c;
      const i11 = (r + 1) * DIP_STEPS + c + 1;
      indices[k++] = i00;
      indices[k++] = i10;
      indices[k++] = i01;
      indices[k++] = i01;
      indices[k++] = i10;
      indices[k++] = i11;
    }
  }

  // Cesium's GeometryAttributes type lists every attribute slot (normal,
  // st, color, …) as required, but the runtime accepts a subset and the
  // FLAT_VERTEX_FORMAT we use only needs `position`. Cast through `any` to
  // bypass the over-strict type without losing field-level checking above.
  const geometry = new Geometry({
    attributes: {
      position: new GeometryAttribute({
        componentDatatype: ComponentDatatype.DOUBLE,
        componentsPerAttribute: 3,
        values: positions,
      }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any,
    indices,
    primitiveType: PrimitiveType.TRIANGLES,
    // BoundingSphere.fromVertices is typed as number[] but iterates by index,
    // so a Float64Array works at runtime and saves a ~6k-element copy.
    boundingSphere: BoundingSphere.fromVertices(
      positions as unknown as number[],
    ),
  });

  const instance = new GeometryInstance({
    geometry,
    attributes: {
      color: ColorGeometryInstanceAttribute.fromColor(
        Color.fromCssColorString('#4dd3ff').withAlpha(0.18),
      ),
    },
  });

  return new Primitive({
    geometryInstances: instance,
    appearance: new PerInstanceColorAppearance({
      // FLAT_VERTEX_FORMAT — needs only `position`, no normals.
      flat: true,
      translucent: true,
      closed: false,
      // Render both sides of the surface.
      faceForward: true,
    }),
    allowPicking: false,
    // Custom inline Geometry has no worker; Cesium's default asynchronous
    // pipeline would fail with "Must define either _workerName or
    // _workerPath for asynchronous geometry."
    asynchronous: false,
  });
}
