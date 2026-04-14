/**
 * Subduction zone camera presets for the Wadati–Benioff zone visualizer.
 *
 * Each preset defines a cross-section through a subduction zone: the center
 * point of the trench, the strike azimuth (direction the trench runs, in
 * degrees clockwise from North), and the camera orientation that yields a
 * textbook side view of the descending slab.
 *
 * The section line runs perpendicular to the trench strike. Only earthquakes
 * within ±{sliceHalfWidthKm} km of that line (measured along-strike) are
 * shown when a preset is active, revealing the slab in profile.
 */

export interface SubductionPreset {
  /** Stable key, used as id in buttons and SQL filter state */
  id: string;
  /** Human-readable name shown on the button */
  label: string;
  /** Short blurb describing the slab */
  description: string;
  /** Center longitude of the section, in degrees */
  longitude: number;
  /** Center latitude of the section, in degrees */
  latitude: number;
  /**
   * Trench strike azimuth, in degrees clockwise from North.
   * The section line is perpendicular to this, cutting across the slab.
   */
  strikeDeg: number;
  /** Camera height above ellipsoid at fly-to, in meters */
  cameraHeight: number;
  /** Camera heading in degrees (clockwise from North) */
  cameraHeadingDeg: number;
  /** Camera pitch in degrees (negative = looking down) */
  cameraPitchDeg: number;
  /** Half-width of the slice window, in km. Defaults to 50 km globally. */
  sliceHalfWidthKm?: number;

  /**
   * Parameters for the parametric Wadati–Benioff slab surface drawn beneath
   * the seismicity. Optional — presets without slab params don't render a
   * surface. Numbers are informed by Slab2.0 (Hayes et al., 2018) but
   * deliberately smoothed for a clean cartoon profile.
   */
  slab?: SlabParams;
}

/**
 * Parametric slab geometry. We model the slab top as a swept surface with a
 * dip angle that grows from `dipMinDeg` near the trench to `dipMaxDeg` at
 * depth, with a smooth transition controlled by `dipScaleKm`. Real Slab2.0
 * grids vary in detail per zone, but a single-parameter exponential captures
 * the essential "shallow ramp → steep dive" shape that gives each zone its
 * character (Cascadia stays nearly flat; Tonga plunges almost vertically).
 *
 * Direction is encoded as `dipSide` rather than an absolute azimuth: the
 * dip direction is always perpendicular to the preset's `strikeDeg`, and
 * `dipSide` just picks which of the two perpendiculars (the slab side of
 * the trench) the surface descends into. This keeps strike as the single
 * source of truth for trench orientation.
 */
export interface SlabParams {
  /**
   * Which side of the strike line the slab dips toward, viewed from above:
   * - `'right'` = 90° clockwise from strike (e.g. Chile, Cascadia, Sumatra)
   * - `'left'` = 90° counter-clockwise from strike (e.g. Tonga, Japan)
   */
  dipSide: 'left' | 'right';
  /** Dip angle near the trench (interface zone), degrees. */
  dipMinDeg: number;
  /** Asymptotic dip angle at depth, degrees. */
  dipMaxDeg: number;
  /** Arc-length scale for the dip transition, km. */
  dipScaleKm: number;
  /** Slab terminates at this depth, km. */
  maxDepthKm: number;
  /** Length of the slab segment along strike, km. */
  alongStrikeKm: number;
}

export const DEFAULT_SLICE_HALF_WIDTH_KM = 50;
/** Maximum along-section distance retained in slice filter, in km. */
const SLICE_ALONG_SECTION_KM = 1500;
/** Equatorial km per degree of latitude (and longitude at the equator). */
export const KM_PER_DEG = 111.32;

export const SUBDUCTION_PRESETS: SubductionPreset[] = [
  {
    id: 'tonga',
    label: 'Tonga',
    description:
      'The deepest slab on Earth — Pacific plate plunging west beneath the Indo-Australian plate to ~700 km.',
    longitude: -174.5,
    latitude: -20.0,
    strikeDeg: 20, // roughly N-NNE
    cameraHeight: 900_000,
    cameraHeadingDeg: 20,
    cameraPitchDeg: -25,
    slab: {
      dipSide: 'left', // Pacific plate dives west of NNE-trending trench
      dipMinDeg: 12,
      dipMaxDeg: 65,
      dipScaleKm: 200,
      maxDepthKm: 680,
      alongStrikeKm: 1500,
    },
  },
  {
    id: 'japan',
    label: 'Japan',
    description:
      'Pacific plate subducting west beneath Honshu — site of the 2011 Tōhoku megaquake.',
    longitude: 143.5,
    latitude: 38.5,
    strikeDeg: 20,
    cameraHeight: 900_000,
    cameraHeadingDeg: 20,
    cameraPitchDeg: -25,
    slab: {
      dipSide: 'left',
      dipMinDeg: 10,
      dipMaxDeg: 45,
      dipScaleKm: 280,
      maxDepthKm: 600,
      alongStrikeKm: 1400,
    },
  },
  {
    id: 'chile',
    label: 'Chile',
    description:
      'Nazca plate diving east under South America — shallow thrust zone hosting the largest earthquakes ever recorded.',
    longitude: -72.5,
    latitude: -32.0,
    strikeDeg: 0, // nearly N-S
    cameraHeight: 900_000,
    cameraHeadingDeg: 0,
    cameraPitchDeg: -25,
    slab: {
      dipSide: 'right', // Nazca dives east beneath South America
      dipMinDeg: 8,
      dipMaxDeg: 30,
      dipScaleKm: 350,
      maxDepthKm: 600,
      alongStrikeKm: 1500,
    },
  },
  {
    id: 'indonesia',
    label: 'Indonesia',
    description:
      'Sunda trench — Indo-Australian plate sliding north-east beneath Sumatra and Java.',
    longitude: 104.5,
    latitude: -5.5,
    strikeDeg: 315, // ~NW-SE
    cameraHeight: 900_000,
    cameraHeadingDeg: 315,
    cameraPitchDeg: -25,
    slab: {
      dipSide: 'right', // Indo-Australian plate dives NE
      dipMinDeg: 10,
      dipMaxDeg: 50,
      dipScaleKm: 250,
      maxDepthKm: 650,
      alongStrikeKm: 1500,
    },
  },
  {
    id: 'cascadia',
    label: 'Cascadia',
    description:
      'Juan de Fuca plate sliding east under North America — a quiet megathrust charging for its next M9.',
    longitude: -124.5,
    latitude: 45.5,
    strikeDeg: 5, // essentially N-S
    cameraHeight: 700_000,
    cameraHeadingDeg: 5,
    cameraPitchDeg: -25,
    slab: {
      dipSide: 'right', // Juan de Fuca dives east
      dipMinDeg: 5,
      dipMaxDeg: 18,
      dipScaleKm: 300,
      maxDepthKm: 100,
      alongStrikeKm: 1100,
    },
  },
  {
    id: 'hellenic',
    label: 'Hellenic',
    description:
      'African plate sinking NE beneath the Aegean — the shortest but most seismically active arc in Europe.',
    longitude: 23.5,
    latitude: 35.0,
    strikeDeg: 290, // Greek arc trends ~ESE-WNW
    cameraHeight: 700_000,
    cameraHeadingDeg: 290,
    cameraPitchDeg: -25,
    slab: {
      dipSide: 'right', // African plate dives NNE beneath the Aegean
      dipMinDeg: 10,
      dipMaxDeg: 40,
      dipScaleKm: 200,
      maxDepthKm: 220,
      alongStrikeKm: 900,
    },
  },
];

/**
 * Build a DuckDB WHERE clause fragment that retains only earthquakes whose
 * along-strike offset from the preset's section line is within the slice
 * half-width and whose along-section distance stays within the section extent.
 *
 * The math is a small-angle flat-earth approximation: we project (Lon, Lat)
 * offsets into local east/north km using 111.32 km/deg and cos(lat), then
 * rotate into the strike/dip frame via precomputed trig. This is accurate
 * enough for section windows of a few hundred kilometres.
 *
 * Accepts a longitude wraparound fix so Tonga (±180° crossing) still works.
 */
export function buildSliceWhereClause(
  preset: SubductionPreset,
  halfWidthKm: number = DEFAULT_SLICE_HALF_WIDTH_KM,
): string {
  const latRad = (preset.latitude * Math.PI) / 180;
  const strikeRad = (preset.strikeDeg * Math.PI) / 180;
  const cosLat = Math.cos(latRad);
  const sinStrike = Math.sin(strikeRad);
  const cosStrike = Math.cos(strikeRad);

  // Maps any longitude into [-180, 180) so Tonga (±180° crossing) works.
  const dLonDeg = `((((Longitude - ${preset.longitude}) + 540.0) - FLOOR(((Longitude - ${preset.longitude}) + 540.0) / 360.0) * 360.0) - 180.0)`;
  const dLonKm = `(${dLonDeg} * ${KM_PER_DEG} * ${cosLat})`;
  const dLatKm = `((Latitude - ${preset.latitude}) * ${KM_PER_DEG})`;

  const alongStrikeKm = `(${dLonKm} * ${sinStrike} + ${dLatKm} * ${cosStrike})`;
  const alongSectionKm = `(${dLonKm} * ${cosStrike} - ${dLatKm} * ${sinStrike})`;

  return `ABS(${alongStrikeKm}) <= ${halfWidthKm} AND ABS(${alongSectionKm}) <= ${SLICE_ALONG_SECTION_KM}`;
}
