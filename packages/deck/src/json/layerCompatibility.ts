import type {LayerConfigColumnKey} from './layerConfig';

type GeoJsonCompatibility = {
  representation: 'geojson';
  vectorAccessorProps: string[];
};

type GeoArrowBinding = {
  prop: string;
  kind: 'geometry' | 'column';
  configKey: LayerConfigColumnKey;
  required?: boolean;
};

type GeoArrowCompatibility = {
  representation: 'geoarrow';
  bindings: GeoArrowBinding[];
  vectorAccessorProps: string[];
  allowGeoArrowPromotion?: boolean;
};

type LayerCompatibility = GeoJsonCompatibility | GeoArrowCompatibility;

const LAYER_COMPATIBILITY: Record<string, LayerCompatibility> = {
  GeoJsonLayer: {
    representation: 'geojson',
    vectorAccessorProps: [],
  },
  GeoArrowScatterplotLayer: {
    representation: 'geoarrow',
    bindings: [
      {
        prop: 'getPosition',
        kind: 'geometry',
        configKey: 'geometryColumn',
      },
    ],
    vectorAccessorProps: [
      'getPosition',
      'getRadius',
      'getFillColor',
      'getLineColor',
      'getLineWidth',
    ],
    allowGeoArrowPromotion: true,
  },
  GeoArrowHeatmapLayer: {
    representation: 'geoarrow',
    bindings: [
      {
        prop: 'getPosition',
        kind: 'geometry',
        configKey: 'geometryColumn',
      },
    ],
    vectorAccessorProps: ['getPosition', 'getWeight'],
    allowGeoArrowPromotion: true,
  },
  GeoArrowColumnLayer: {
    representation: 'geoarrow',
    bindings: [
      {
        prop: 'getPosition',
        kind: 'geometry',
        configKey: 'geometryColumn',
      },
    ],
    vectorAccessorProps: [
      'getPosition',
      'getFillColor',
      'getLineColor',
      'getLineWidth',
      'getElevation',
    ],
    allowGeoArrowPromotion: true,
  },
  GeoArrowPathLayer: {
    representation: 'geoarrow',
    bindings: [
      {
        prop: 'getPath',
        kind: 'geometry',
        configKey: 'geometryColumn',
      },
    ],
    vectorAccessorProps: ['getPath', 'getColor', 'getWidth'],
  },
  GeoArrowTripsLayer: {
    representation: 'geoarrow',
    bindings: [
      {
        prop: 'getPath',
        kind: 'geometry',
        configKey: 'geometryColumn',
      },
      {
        prop: 'getTimestamps',
        kind: 'column',
        configKey: 'timestampColumn',
        required: true,
      },
    ],
    vectorAccessorProps: ['getPath', 'getTimestamps', 'getColor', 'getWidth'],
  },
  GeoArrowPolygonLayer: {
    representation: 'geoarrow',
    bindings: [
      {
        prop: 'getPolygon',
        kind: 'geometry',
        configKey: 'geometryColumn',
      },
    ],
    vectorAccessorProps: [
      'getPolygon',
      'getFillColor',
      'getLineColor',
      'getLineWidth',
      'getElevation',
    ],
  },
  GeoArrowSolidPolygonLayer: {
    representation: 'geoarrow',
    bindings: [
      {
        prop: 'getPolygon',
        kind: 'geometry',
        configKey: 'geometryColumn',
      },
    ],
    vectorAccessorProps: [
      'getPolygon',
      'getElevation',
      'getFillColor',
      'getLineColor',
    ],
  },
  GeoArrowArcLayer: {
    representation: 'geoarrow',
    bindings: [
      {
        prop: 'getSourcePosition',
        kind: 'geometry',
        configKey: 'sourceGeometryColumn',
        required: true,
      },
      {
        prop: 'getTargetPosition',
        kind: 'geometry',
        configKey: 'targetGeometryColumn',
        required: true,
      },
    ],
    vectorAccessorProps: [
      'getSourcePosition',
      'getTargetPosition',
      'getSourceColor',
      'getTargetColor',
      'getWidth',
      'getHeight',
      'getTilt',
    ],
  },
  GeoArrowH3HexagonLayer: {
    representation: 'geoarrow',
    bindings: [
      {
        prop: 'getHexagon',
        kind: 'column',
        configKey: 'hexagonColumn',
        required: true,
      },
    ],
    vectorAccessorProps: [
      'getHexagon',
      'getFillColor',
      'getLineColor',
      'getElevation',
    ],
  },
};

export function getLayerCompatibility(layerName: string) {
  return LAYER_COMPATIBILITY[layerName];
}
