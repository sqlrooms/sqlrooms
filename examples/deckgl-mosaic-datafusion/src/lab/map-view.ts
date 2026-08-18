import {Deck, type Layer} from '@deck.gl/core';
import {BitmapLayer, PolygonLayer} from '@deck.gl/layers';
import {TileLayer} from '@deck.gl/geo-layers';
import {
  type MinimalTileData,
  type RenderTileResult,
} from '@developmentseed/deck.gl-raster';
import {
  ZarrLayer,
  type GetTileDataOptions,
} from '@developmentseed/deck.gl-zarr';
import type {EpsgResolver} from '@developmentseed/proj';
import type {Device, Texture} from '@luma.gl/core';
import type {ShaderModule} from '@luma.gl/shadertools';
import * as zarr from 'zarrita';
import {openEcmwfArray} from './ecmwf-store';
import {MaskFilter} from './gpu-modules/mask-filter';
import {createEcmwfTileSlice, sliceCubeToTile} from './tile-data';
import {
  BOUNDS,
  CELL_COUNT,
  ECMWF_ENSEMBLE_MEMBER,
  ECMWF_RESOLUTION,
  ECMWF_TEMPERATURE_VARIABLE,
  RASTER_HEIGHT,
  RASTER_WIDTH,
} from './types';

const VALUE_MIN = -10;
const VALUE_MAX = 30;
const RASTER_OPACITY = 0.84;

/**
 * The store has no GeoZarr metadata, so the layer receives a synthetic
 * spatial transform describing only the crop. getTileData then works in
 * crop-relative tile coordinates.
 */
const ECMWF_GEOZARR_ATTRS = {
  'spatial:dimensions': ['latitude', 'longitude'],
  'spatial:transform': [
    ECMWF_RESOLUTION,
    0,
    BOUNDS.west,
    0,
    -ECMWF_RESOLUTION,
    BOUNDS.north,
  ],
  'spatial:shape': [RASTER_HEIGHT, RASTER_WIDTH],
  'spatial:bbox': [BOUNDS.west, BOUNDS.south, BOUNDS.east, BOUNDS.north],
  'proj:code': 'EPSG:4326',
} as const;

const EPSG_4326_RESOLVER: EpsgResolver = async (epsg) => {
  if (epsg !== 4326) {
    throw new Error(`Unsupported local EPSG resolver code: ${epsg}`);
  }
  const a = 6378137;
  const b = 6356752.314245179;
  const es = 1 - (b * b) / (a * a);
  const ep2 = (a * a - b * b) / (b * b);
  return {
    title: 'WGS 84',
    projName: 'longlat',
    ellps: 'WGS84',
    datumName: 'WGS84',
    datumCode: 'WGS84',
    units: 'degree',
    a,
    b,
    rf: 298.257223563,
    datum: {datum_type: 4, a, b, es, ep2},
  };
};

type EcmwfTileData = NonNullable<MinimalTileData> & {
  texture: Texture;
  /**
   * Maps the local uv of this tile into the full-crop mask texture.
   * Identity when one tile spans the whole crop.
   */
  maskUvOffset: [number, number];
  maskUvScale: [number, number];
};

export type MapBrushCenter = {
  lon: number;
  lat: number;
};

type SampleEcmwfLeadProps = {
  dataTex: Texture;
  leadIndex: number;
};

type SampleEcmwfLeadUniforms = Omit<SampleEcmwfLeadProps, 'dataTex'>;
type SampleEcmwfLeadBindings = Pick<SampleEcmwfLeadProps, 'dataTex'>;

/**
 * Writes the raw temperature at the active lead into color.r and discards
 * NaN samples. All leads sit in one 2d-array texture, so moving the
 * forecast slider is a uniform update rather than a texture re-upload.
 */
const SampleEcmwfLead = {
  name: 'sampleEcmwfLead',
  fs: `\
uniform sampleEcmwfLeadUniforms {
  float leadIndex;
} sampleEcmwfLead;
`,
  inject: {
    'fs:#decl': `
precision highp sampler2DArray;
uniform sampler2DArray dataTex;
`,
    'fs:DECKGL_FILTER_COLOR': /* glsl */ `
      float v = texture(dataTex, vec3(geometry.uv, sampleEcmwfLead.leadIndex)).r;
      if (isnan(v)) {
        discard;
      }
      color = vec4(v, v, v, 1.0);
    `,
  },
  uniformTypes: {
    leadIndex: 'f32',
  },
  getUniforms: (props: Partial<SampleEcmwfLeadProps>) => ({
    dataTex: props.dataTex,
    leadIndex: props.leadIndex ?? 0,
  }),
} as const satisfies ShaderModule<
  SampleEcmwfLeadProps,
  SampleEcmwfLeadUniforms,
  SampleEcmwfLeadBindings
>;

type TemperatureRampProps = {
  valueMin: number;
  valueMax: number;
  opacity: number;
};

const TemperatureRamp = {
  name: 'temperatureRamp',
  fs: `\
uniform temperatureRampUniforms {
  float valueMin;
  float valueMax;
  float opacity;
} temperatureRamp;
`,
  inject: {
    'fs:DECKGL_FILTER_COLOR': /* glsl */ `
      float t = clamp(
        (color.r - temperatureRamp.valueMin) /
          (temperatureRamp.valueMax - temperatureRamp.valueMin),
        0.0,
        1.0
      );
      vec3 c0 = vec3(0.031, 0.184, 0.286);
      vec3 c1 = vec3(0.247, 0.235, 0.596);
      vec3 c2 = vec3(0.643, 0.310, 0.545);
      vec3 c3 = vec3(0.898, 0.400, 0.380);
      vec3 c4 = vec3(0.937, 0.941, 0.251);
      vec3 rgb = t < 0.25
        ? mix(c0, c1, t / 0.25)
        : t < 0.55
          ? mix(c1, c2, (t - 0.25) / 0.30)
          : t < 0.78
            ? mix(c2, c3, (t - 0.55) / 0.23)
            : mix(c3, c4, (t - 0.78) / 0.22);
      color = vec4(rgb, temperatureRamp.opacity);
    `,
  },
  uniformTypes: {
    valueMin: 'f32',
    valueMax: 'f32',
    opacity: 'f32',
  },
  getUniforms: (props: Partial<TemperatureRampProps>) => ({
    valueMin: props.valueMin ?? VALUE_MIN,
    valueMax: props.valueMax ?? VALUE_MAX,
    opacity: props.opacity ?? RASTER_OPACITY,
  }),
} as const satisfies ShaderModule<TemperatureRampProps>;

function circlePolygon(center: MapBrushCenter, radiusKm: number) {
  const points: number[][] = [];
  const latRadius = radiusKm / 111;
  const lonRadius =
    radiusKm / Math.max(1, 111 * Math.cos((center.lat * Math.PI) / 180));
  for (let i = 0; i <= 72; i += 1) {
    const angle = (i / 72) * Math.PI * 2;
    points.push([
      center.lon + Math.cos(angle) * lonRadius,
      center.lat + Math.sin(angle) * latRadius,
    ]);
  }
  return points;
}

/**
 * Region of the crop covered by a live tile texture, kept so streamed
 * chunks can be written into the texture in place.
 */
type LiveTile = {
  texture: Texture;
  relRow: number;
  relCol: number;
  width: number;
  height: number;
};

/**
 * Builds a tile texture from the in-memory cube instead of re-fetching from
 * the Zarr store. With this store's chunk layout every 32x32 spatial read
 * pulls in all 51 ensemble members and 85 leads, and the streaming cube
 * loader already paid that cost once.
 */
function sliceEcmwfTileData(
  cube: Float32Array,
  leadCount: number,
  arr: zarr.Array<'float32', zarr.Readable>,
  options: GetTileDataOptions,
): EcmwfTileData & {liveTile: LiveTile} {
  const tileWidth = arr.chunks[arr.chunks.length - 1];
  const tileHeight = arr.chunks[arr.chunks.length - 2];
  const slice = createEcmwfTileSlice(cube, leadCount, {
    tileRow: options.y,
    tileCol: options.x,
    tileWidth,
    tileHeight,
    width: options.width,
    height: options.height,
  });

  const texture = options.device.createTexture({
    dimension: '2d-array',
    format: 'r32float',
    width: options.width,
    height: options.height,
    depth: leadCount,
    mipLevels: 1,
    data: slice.data,
    sampler: {
      minFilter: 'nearest',
      magFilter: 'nearest',
      addressModeU: 'clamp-to-edge',
      addressModeV: 'clamp-to-edge',
    },
  });

  return {
    texture,
    width: options.width,
    height: options.height,
    byteLength: slice.data.byteLength,
    maskUvOffset: slice.maskUvOffset,
    maskUvScale: slice.maskUvScale,
    liveTile: {
      texture,
      relRow: slice.relRow,
      relCol: slice.relCol,
      width: options.width,
      height: options.height,
    },
  };
}

/**
 * Owns the imperative deck.gl WebGL lifecycle (raster tiles, mask/brush
 * overlays, GPU textures) behind a narrow closure-scoped API. React only
 * calls the returned methods and finalize(); it never touches deck.gl or
 * GPU resources directly.
 */
export function createMapView(container: HTMLDivElement, cube: Float32Array) {
  const leadCount = Math.max(1, Math.floor(cube.length / CELL_COUNT));
  /**
   * Mask bytes mirror the DataFusion "SELECT id FROM cells_current_lead
   * WHERE ..." result
   * (255 = selected) and are uploaded into the r8unorm mask texture in place.
   */
  const maskBytes = new Uint8Array(CELL_COUNT).fill(255);
  let maskTexture: Texture | null = null;
  let maskDirty = false;
  let maskVersion = 0;
  /**
   * Tile textures currently alive in the tileset, keyed by texture so
   * refreshCube can rewrite their pixels as streamed chunks land.
   */
  const liveTiles = new Map<Texture, LiveTile>();
  let cubeVersion = 0;
  let device: Device | null = null;
  let leadIndex = 0;
  let brushCenter: MapBrushCenter | null = null;
  let brushRadiusKm = 175;
  let zarrArray: zarr.Array<'float32', zarr.Readable> | null = null;
  let baseLayers: Layer[] = [];
  let baseLayersKey = '';
  /**
   * Guards every render path (including the deferred first-frame render and
   * in-flight loadZarrRaster()/openEcmwfArray() completions) so callbacks
   * that resolve after finalize() cannot call deck.setProps() on a
   * finalized Deck instance.
   */
  let disposed = false;
  let deferredRenderFrame: number | null = null;

  /**
   * Returns the temperature under the cursor at the active lead, matching
   * what the shader draws. Null outside the crop, on NaN samples, or on
   * cells the selection mask has filtered out.
   */
  function sampleCubeAt(lon: number, lat: number): number | null {
    const x = Math.floor((lon - BOUNDS.west) / ECMWF_RESOLUTION);
    const y = Math.floor((BOUNDS.north - lat) / ECMWF_RESOLUTION);
    if (x < 0 || x >= RASTER_WIDTH || y < 0 || y >= RASTER_HEIGHT) return null;
    const cell = y * RASTER_WIDTH + x;
    if (maskBytes[cell] < 128) return null;
    const value = cube[leadIndex * CELL_COUNT + cell];
    return Number.isFinite(value) ? value : null;
  }

  /**
   * Hover-brush moves reuse the cached base layers. Mask, lead, and cube
   * version changes invalidate getBaseLayers() and rebuild the raster layer.
   */
  function render() {
    if (disposed) return;
    deck.setProps({layers: [...getBaseLayers(), brushLayer()]});
  }

  const deck = new Deck({
    parent: container,
    /**
     * Calling deck.setProps() synchronously from this callback corrupts
     * the initial view state because the callback fires while Deck is
     * still initializing, so the re-render is deferred by one frame.
     */
    onDeviceInitialized: (nextDevice) => {
      if (disposed) return;
      device = nextDevice;
      deferredRenderFrame = window.requestAnimationFrame(() => {
        deferredRenderFrame = null;
        if (!disposed) render();
      });
    },
    initialViewState: {
      longitude: (BOUNDS.west + BOUNDS.east) / 2,
      latitude: (BOUNDS.south + BOUNDS.north) / 2 + 0.5,
      zoom: 5,
      bearing: 0,
      pitch: 0,
    },
    controller: true,
    layers: [],
    /**
     * Cursor-following tooltip with the temperature under the pointer at
     * the active lead. Hidden outside the crop or over NaN samples.
     */
    getTooltip: (info) => {
      if (!info.coordinate) return null;
      const [lon, lat] = info.coordinate;
      const value = sampleCubeAt(lon, lat);
      if (value === null) return null;
      return {
        text: `${value.toFixed(1)} °C`,
        style: {
          background: 'rgba(20, 24, 23, 0.86)',
          color: '#f4f7f4',
          border: '1px solid rgba(255, 255, 255, 0.18)',
          padding: '5px 8px',
          fontSize: '12px',
          fontFamily: 'inherit',
          backdropFilter: 'blur(10px)',
        },
      };
    },
  });

  async function loadZarrRaster() {
    try {
      const arr = await openEcmwfArray(ECMWF_TEMPERATURE_VARIABLE);
      if (disposed) return;
      if (!arr.is('float32')) {
        throw new Error(
          `Expected ${ECMWF_TEMPERATURE_VARIABLE} to be float32, got ${arr.dtype}`,
        );
      }
      zarrArray = arr;
      render();
    } catch (error) {
      console.error(error);
    }
  }

  /**
   * Creates the mask texture lazily once the GPU device exists, then keeps
   * it updated in place from maskBytes.
   */
  function getMaskTexture() {
    if (!device) return null;
    if (!maskTexture) {
      maskTexture = device.createTexture({
        dimension: '2d',
        format: 'r8unorm',
        width: RASTER_WIDTH,
        height: RASTER_HEIGHT,
        mipLevels: 1,
        data: maskBytes,
        sampler: {
          minFilter: 'nearest',
          magFilter: 'nearest',
          addressModeU: 'clamp-to-edge',
          addressModeV: 'clamp-to-edge',
        },
      });
    } else if (maskDirty) {
      maskTexture.writeData(maskBytes);
    }
    maskDirty = false;
    return maskTexture;
  }

  function zarrRasterLayer(): Layer[] {
    const arr = zarrArray;
    if (!arr) return [];
    const maskTex = getMaskTexture();
    if (!maskTex) return [];
    const currentLeadIndex = leadIndex;
    const renderTile = (data: EcmwfTileData): RenderTileResult => ({
      renderPipeline: [
        {
          module: SampleEcmwfLead,
          props: {dataTex: data.texture, leadIndex: currentLeadIndex},
        },
        /*
         * DataFilterExtension semantics for the raster: the DataFusion
         * selection drives the mask texture and unselected pixels are
         * discarded.
         */
        {
          module: MaskFilter,
          props: {
            maskTexture: maskTex,
            maskUvOffset: data.maskUvOffset,
            maskUvScale: data.maskUvScale,
          },
        },
        {
          module: TemperatureRamp,
          props: {
            valueMin: VALUE_MIN,
            valueMax: VALUE_MAX,
            opacity: RASTER_OPACITY,
          },
        },
      ],
    });

    return [
      new ZarrLayer<zarr.Readable, 'float32', EcmwfTileData>({
        id: 'ecmwf-zarr-raster',
        node: arr,
        metadata: ECMWF_GEOZARR_ATTRS,
        epsgResolver: EPSG_4326_RESOLVER,
        selection: {
          init_time: (arr.shape[0] ?? 1) - 1,
          lead_time: null,
          ensemble_member: ECMWF_ENSEMBLE_MEMBER,
        },
        extent: [BOUNDS.west, BOUNDS.south, BOUNDS.east, BOUNDS.north],
        getTileData: async (node, options) => {
          const data = sliceEcmwfTileData(cube, leadCount, node, options);
          liveTiles.set(data.texture, data.liveTile);
          return data;
        },
        renderTile,
        maxCacheSize: 10,
        onTileUnload: (tile) => {
          const content = tile.content as EcmwfTileData | undefined;
          if (content) {
            liveTiles.delete(content.texture);
            content.texture.destroy();
          }
        },
        updateTriggers: {
          renderTile: [leadIndex, maskVersion, cubeVersion],
        },
      }),
    ];
  }

  function brushLayer() {
    return new PolygonLayer({
      id: 'hover-brush-radius',
      data: brushCenter
        ? [{polygon: circlePolygon(brushCenter, brushRadiusKm)}]
        : [],
      pickable: false,
      getPolygon: (item: {polygon: number[][]}) => item.polygon,
      getFillColor: [255, 255, 255, 18],
      getLineColor: [255, 255, 255, 210],
      lineWidthUnits: 'pixels',
      getLineWidth: 2,
    });
  }

  function getBaseLayers() {
    const key = `${leadIndex}:${maskVersion}:${cubeVersion}:${zarrArray ? 1 : 0}:${device ? 1 : 0}`;
    if (key === baseLayersKey) return baseLayers;
    baseLayersKey = key;

    baseLayers = [
      new TileLayer<HTMLImageElement>({
        id: 'carto-basemap',
        data: 'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
        minZoom: 0,
        maxZoom: 19,
        tileSize: 256,
        renderSubLayers: (props) => {
          const [[west, south], [east, north]] = props.tile.boundingBox;
          return new BitmapLayer({
            id: `${props.id}-bitmap`,
            image: props.data,
            bounds: [west, south, east, north],
          });
        },
      }),
      ...zarrRasterLayer(),
    ];
    return baseLayers;
  }

  void loadZarrRaster();

  return {
    setLeadIndex(nextLeadIndex: number) {
      leadIndex = Math.max(0, Math.min(nextLeadIndex, leadCount - 1));
      render();
    },
    /**
     * Rewrites every live tile texture from the shared cube after new Zarr
     * chunks have been copied into it. Freshly covered cells stop being NaN
     * and start rendering.
     */
    refreshCube() {
      for (const tile of liveTiles.values()) {
        tile.texture.writeData(
          sliceCubeToTile(
            cube,
            leadCount,
            tile.relRow,
            tile.relCol,
            tile.width,
            tile.height,
          ),
          {
            width: tile.width,
            height: tile.height,
            depthOrArrayLayers: leadCount,
            rowsPerImage: tile.height,
          },
        );
      }
      cubeVersion += 1;
      render();
    },
    setMask(mask: Uint8Array) {
      for (let i = 0; i < maskBytes.length; i += 1) {
        maskBytes[i] = mask[i] ? 255 : 0;
      }
      maskDirty = true;
      maskVersion += 1;
      render();
    },
    setBrushEnabled(enabled: boolean) {
      if (!enabled) brushCenter = null;
      deck.setProps({controller: !enabled});
      render();
    },
    setBrushRadiusKm(radiusKm: number) {
      brushRadiusKm = radiusKm;
      render();
    },
    setBrushCenter(center: MapBrushCenter | null) {
      brushCenter = center;
      render();
    },
    screenToLngLat(clientX: number, clientY: number): MapBrushCenter | null {
      const rect = container.getBoundingClientRect();
      const viewport = deck.getViewports()[0];
      if (!viewport?.unproject) return null;
      const [lon, lat] = viewport.unproject([
        clientX - rect.left,
        clientY - rect.top,
      ]);
      if (!Number.isFinite(lon) || !Number.isFinite(lat)) return null;
      return {lon, lat};
    },
    finalize() {
      if (disposed) return;
      disposed = true;
      if (deferredRenderFrame !== null) {
        window.cancelAnimationFrame(deferredRenderFrame);
        deferredRenderFrame = null;
      }
      maskTexture?.destroy();
      maskTexture = null;
      for (const tile of liveTiles.values()) tile.texture.destroy();
      liveTiles.clear();
      deck.finalize();
    },
  };
}

export type MapView = ReturnType<typeof createMapView>;
