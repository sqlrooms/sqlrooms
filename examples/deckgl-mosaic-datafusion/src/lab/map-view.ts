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
 * Slices the in-memory temperature cube (the same [lead][cell] Float32Array
 * handed to DataFusion) into a tile-shaped [lead][row][col] buffer. Regions
 * the cube does not cover, or that have not streamed in yet, stay NaN and
 * the shader discards them.
 */
function sliceCubeToTile(
  cube: Float32Array,
  leadCount: number,
  relRow: number,
  relCol: number,
  width: number,
  height: number,
): Float32Array {
  const layerSize = width * height;
  const data = new Float32Array(layerSize * leadCount).fill(Number.NaN);
  const copyHeight = Math.max(0, Math.min(height, RASTER_HEIGHT - relRow));
  const copyWidth = Math.max(0, Math.min(width, RASTER_WIDTH - relCol));
  for (let lead = 0; lead < leadCount; lead += 1) {
    for (let row = 0; row < copyHeight; row += 1) {
      const src = lead * CELL_COUNT + (relRow + row) * RASTER_WIDTH + relCol;
      data.set(
        cube.subarray(src, src + copyWidth),
        lead * layerSize + row * width,
      );
    }
  }
  return data;
}

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
  const relRow = options.y * tileHeight;
  const relCol = options.x * tileWidth;
  const data = sliceCubeToTile(
    cube,
    leadCount,
    relRow,
    relCol,
    options.width,
    options.height,
  );

  const texture = options.device.createTexture({
    dimension: '2d-array',
    format: 'r32float',
    width: options.width,
    height: options.height,
    depth: leadCount,
    mipLevels: 1,
    data,
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
    byteLength: data.byteLength,
    maskUvOffset: [relCol / RASTER_WIDTH, relRow / RASTER_HEIGHT],
    maskUvScale: [options.width / RASTER_WIDTH, options.height / RASTER_HEIGHT],
    liveTile: {
      texture,
      relRow,
      relCol,
      width: options.width,
      height: options.height,
    },
  };
}

export class MapView {
  private readonly deck: Deck;
  private readonly container: HTMLDivElement;
  private readonly leadCount: number;
  /**
   * Mask bytes mirror the DataFusion "SELECT id FROM cells_current_lead
   * WHERE ..." result
   * (255 = selected) and are uploaded into the r8unorm mask texture in place.
   */
  private readonly maskBytes = new Uint8Array(CELL_COUNT).fill(255);
  private maskTexture: Texture | null = null;
  private maskDirty = false;
  private maskVersion = 0;
  /**
   * Tile textures currently alive in the tileset, keyed by texture so
   * refreshCube can rewrite their pixels as streamed chunks land.
   */
  private readonly liveTiles = new Map<Texture, LiveTile>();
  private cubeVersion = 0;
  private device: Device | null = null;
  private leadIndex = 0;
  private brushCenter: MapBrushCenter | null = null;
  private brushRadiusKm = 175;
  private zarrArray: zarr.Array<'float32', zarr.Readable> | null = null;
  private baseLayers: Layer[] = [];
  private baseLayersKey = '';

  constructor(
    container: HTMLDivElement,
    private readonly cube: Float32Array,
  ) {
    this.container = container;
    this.leadCount = Math.max(1, Math.floor(cube.length / CELL_COUNT));
    this.deck = new Deck({
      parent: container,
      /**
       * Calling deck.setProps() synchronously from this callback corrupts
       * the initial view state because the callback fires while Deck is
       * still initializing, so the re-render is deferred by one frame.
       */
      onDeviceInitialized: (device) => {
        this.device = device;
        window.requestAnimationFrame(() => this.render());
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
        const value = this.sampleCubeAt(lon, lat);
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
    void this.loadZarrRaster();
  }

  private async loadZarrRaster() {
    try {
      const arr = await openEcmwfArray(ECMWF_TEMPERATURE_VARIABLE);
      if (!arr.is('float32')) {
        throw new Error(
          `Expected ${ECMWF_TEMPERATURE_VARIABLE} to be float32, got ${arr.dtype}`,
        );
      }
      this.zarrArray = arr;
      this.render();
    } catch (error) {
      console.error(error);
    }
  }

  /**
   * Returns the temperature under the cursor at the active lead, matching
   * what the shader draws. Null outside the crop, on NaN samples, or on
   * cells the selection mask has filtered out.
   */
  private sampleCubeAt(lon: number, lat: number): number | null {
    const x = Math.floor((lon - BOUNDS.west) / ECMWF_RESOLUTION);
    const y = Math.floor((BOUNDS.north - lat) / ECMWF_RESOLUTION);
    if (x < 0 || x >= RASTER_WIDTH || y < 0 || y >= RASTER_HEIGHT) return null;
    const cell = y * RASTER_WIDTH + x;
    if (this.maskBytes[cell] < 128) return null;
    const value = this.cube[this.leadIndex * CELL_COUNT + cell];
    return Number.isFinite(value) ? value : null;
  }

  setLeadIndex(leadIndex: number) {
    this.leadIndex = Math.max(0, Math.min(leadIndex, this.leadCount - 1));
    this.render();
  }

  /**
   * Rewrites every live tile texture from the shared cube after new Zarr
   * chunks have been copied into it. Freshly covered cells stop being NaN
   * and start rendering.
   */
  refreshCube() {
    for (const tile of this.liveTiles.values()) {
      tile.texture.writeData(
        sliceCubeToTile(
          this.cube,
          this.leadCount,
          tile.relRow,
          tile.relCol,
          tile.width,
          tile.height,
        ),
      );
    }
    this.cubeVersion += 1;
    this.render();
  }

  setMask(mask: Uint8Array) {
    for (let i = 0; i < this.maskBytes.length; i += 1) {
      this.maskBytes[i] = mask[i] ? 255 : 0;
    }
    this.maskDirty = true;
    this.maskVersion += 1;
    this.render();
  }

  setBrushEnabled(enabled: boolean) {
    if (!enabled) this.brushCenter = null;
    this.deck.setProps({controller: !enabled});
    this.render();
  }

  setBrushRadiusKm(radiusKm: number) {
    this.brushRadiusKm = radiusKm;
    this.renderBrushOnly();
  }

  setBrushCenter(center: MapBrushCenter | null) {
    this.brushCenter = center;
    this.renderBrushOnly();
  }

  screenToLngLat(clientX: number, clientY: number): MapBrushCenter | null {
    const rect = this.container.getBoundingClientRect();
    const viewport =
      (this.deck as any).getViewports?.()[0] ??
      (this.deck as any).viewManager?.getViewports?.()[0];
    if (!viewport?.unproject) return null;
    const [lon, lat] = viewport.unproject([
      clientX - rect.left,
      clientY - rect.top,
    ]);
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) return null;
    return {lon, lat};
  }

  /**
   * Creates the mask texture lazily once the GPU device exists, then keeps
   * it updated in place from maskBytes.
   */
  private getMaskTexture() {
    if (!this.device) return null;
    if (!this.maskTexture) {
      this.maskTexture = this.device.createTexture({
        dimension: '2d',
        format: 'r8unorm',
        width: RASTER_WIDTH,
        height: RASTER_HEIGHT,
        mipLevels: 1,
        data: this.maskBytes,
        sampler: {
          minFilter: 'nearest',
          magFilter: 'nearest',
          addressModeU: 'clamp-to-edge',
          addressModeV: 'clamp-to-edge',
        },
      });
    } else if (this.maskDirty) {
      this.maskTexture.writeData(this.maskBytes);
    }
    this.maskDirty = false;
    return this.maskTexture;
  }

  private zarrRasterLayer(): Layer[] {
    const arr = this.zarrArray;
    if (!arr) return [];
    const maskTex = this.getMaskTexture();
    if (!maskTex) return [];
    const {cube, leadCount, leadIndex} = this;
    const renderTile = (data: EcmwfTileData): RenderTileResult => ({
      renderPipeline: [
        {
          module: SampleEcmwfLead,
          props: {dataTex: data.texture, leadIndex},
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
          this.liveTiles.set(data.texture, data.liveTile);
          return data;
        },
        renderTile,
        maxCacheSize: 10,
        onTileUnload: (tile) => {
          const content = tile.content as EcmwfTileData | undefined;
          if (content) {
            this.liveTiles.delete(content.texture);
            content.texture.destroy();
          }
        },
        updateTriggers: {
          renderTile: [leadIndex, this.maskVersion, this.cubeVersion],
        },
      }),
    ];
  }

  private brushLayer() {
    const brushCenter = this.brushCenter;
    return new PolygonLayer({
      id: 'hover-brush-radius',
      data: brushCenter
        ? [{polygon: circlePolygon(brushCenter, this.brushRadiusKm)}]
        : [],
      pickable: false,
      getPolygon: (item: {polygon: number[][]}) => item.polygon,
      getFillColor: [255, 255, 255, 18],
      getLineColor: [255, 255, 255, 210],
      lineWidthUnits: 'pixels',
      getLineWidth: 2,
    });
  }

  /**
   * Fast path for hover-brush dragging: only the circle overlay moves, so
   * the cached basemap and raster layers are reused instead of constructing
   * new ZarrLayer/TileLayer instances on every pointer move. The mask query
   * that follows each move lands via setMask, which does a full render.
   */
  private renderBrushOnly() {
    this.deck.setProps({layers: [...this.getBaseLayers(), this.brushLayer()]});
  }

  private getBaseLayers() {
    const key = `${this.leadIndex}:${this.maskVersion}:${this.cubeVersion}:${this.zarrArray ? 1 : 0}:${this.device ? 1 : 0}`;
    if (key === this.baseLayersKey) return this.baseLayers;
    this.baseLayersKey = key;

    this.baseLayers = [
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
      ...this.zarrRasterLayer(),
    ];
    return this.baseLayers;
  }

  private render() {
    this.deck.setProps({layers: [...this.getBaseLayers(), this.brushLayer()]});
  }

  finalize() {
    this.maskTexture?.destroy();
    this.maskTexture = null;
    this.deck.finalize();
  }
}
