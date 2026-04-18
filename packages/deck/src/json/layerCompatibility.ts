import type {SupportedGeoArrowLayerType} from '../prepare/geometryDecoder';

type GeoJsonCompatibility = {
  representation: 'geojson';
  vectorAccessorProps: string[];
};

type GeoArrowCompatibility = {
  representation: 'geoarrow';
  geometryProp: string;
  vectorAccessorProps: string[];
};

type LayerCompatibility = GeoJsonCompatibility | GeoArrowCompatibility;

const LAYER_COMPATIBILITY: Record<string, LayerCompatibility> = {
  GeoJsonLayer: {
    representation: 'geojson',
    vectorAccessorProps: [],
  },
  GeoArrowScatterplotLayer: {
    representation: 'geoarrow',
    geometryProp: 'getPosition',
    vectorAccessorProps: [
      'getPosition',
      'getRadius',
      'getFillColor',
      'getLineColor',
      'getLineWidth',
    ],
  },
  GeoArrowPathLayer: {
    representation: 'geoarrow',
    geometryProp: 'getPath',
    vectorAccessorProps: ['getPath', 'getColor', 'getWidth'],
  },
  GeoArrowSolidPolygonLayer: {
    representation: 'geoarrow',
    geometryProp: 'getPolygon',
    vectorAccessorProps: ['getPolygon', 'getElevation', 'getFillColor', 'getLineColor'],
  },
};

export function getLayerCompatibility(layerName: string) {
  return LAYER_COMPATIBILITY[layerName];
}

export function isSupportedGeoArrowLayerType(
  layerName: string,
): layerName is SupportedGeoArrowLayerType {
  return [
    'GeoArrowScatterplotLayer',
    'GeoArrowPathLayer',
    'GeoArrowSolidPolygonLayer',
  ].includes(layerName);
}
