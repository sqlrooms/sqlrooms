import type {
  DeckArrowTableDatasetInput,
  CreateDeckJsonSpecFromDatasetsOptions,
  DeckJsonMapSpec,
  DeckJsonSpecDatasetHint,
} from './types';
import type {GeometryEncodingHint} from './prepare/types';
import {prepareDeckDataset} from './prepare/prepareDeckDataset';

function buildLayerConfig(options: {
  datasetId: string;
  input: {geometryColumn?: string; geometryEncodingHint?: GeometryEncodingHint};
  hint?: DeckJsonSpecDatasetHint;
}) {
  const {datasetId, input, hint} = options;

  return {
    dataset: datasetId,
    geometryColumn: input.geometryColumn,
    geometryEncodingHint: input.geometryEncodingHint,
    sourceGeometryColumn: hint?.sourceGeometryColumn,
    targetGeometryColumn: hint?.targetGeometryColumn,
    timestampColumn: hint?.timestampColumn,
    hexagonColumn: hint?.hexagonColumn,
  };
}

function resolveExplicitLayerType(hint?: DeckJsonSpecDatasetHint) {
  if (hint?.type) {
    return hint.type;
  }

  if (hint?.prefer === 'heatmap') {
    return 'GeoArrowHeatmapLayer' as const;
  }

  return undefined;
}

function isArrowTableDatasetInput(
  input: unknown,
): input is DeckArrowTableDatasetInput {
  return Boolean(input && typeof input === 'object' && 'arrowTable' in input);
}

function chooseDefaultLayerType(
  datasetId: string,
  input: {
    geometryColumn?: string;
    geometryEncodingHint?: GeometryEncodingHint;
  },
  hint?: DeckJsonSpecDatasetHint,
) {
  const explicitType = resolveExplicitLayerType(hint);
  if (explicitType) {
    return explicitType;
  }

  if (!isArrowTableDatasetInput(input) || !input.arrowTable) {
    return 'GeoJsonLayer' as const;
  }

  try {
    const prepared = prepareDeckDataset({
      datasetId,
      table: input.arrowTable,
      geometryColumn: input.geometryColumn,
      geometryEncodingHint: input.geometryEncodingHint,
    });
    const resolved = prepared.resolveGeometry();

    switch (resolved.encoding) {
      case 'geoarrow.point':
      case 'geoarrow.multipoint':
        return hint?.prefer === 'heatmap'
          ? ('GeoArrowHeatmapLayer' as const)
          : ('GeoArrowScatterplotLayer' as const);
      case 'geoarrow.linestring':
      case 'geoarrow.multilinestring':
        return 'GeoArrowPathLayer' as const;
      case 'geoarrow.polygon':
      case 'geoarrow.multipolygon':
        return 'GeoArrowPolygonLayer' as const;
      default:
        return 'GeoJsonLayer' as const;
    }
  } catch {
    return 'GeoJsonLayer' as const;
  }
}

/**
 * Generate a conservative starter Deck JSON spec from SQLRooms datasets.
 *
 * The helper favors predictable defaults:
 * native point/line/polygon datasets become the matching GeoArrow layer, while
 * mixed or unsupported inputs fall back to `GeoJsonLayer`. Callers can provide
 * semantic hints for special layers such as trips, arcs, H3, A5, or heatmaps.
 */
export function createDeckJsonSpecFromDatasets(
  options: CreateDeckJsonSpecFromDatasetsOptions,
): DeckJsonMapSpec {
  const {datasets, hints} = options;

  return {
    layers: Object.entries(datasets).map(([datasetId, input]) => ({
      '@@type': chooseDefaultLayerType(datasetId, input, hints?.[datasetId]),
      id: datasetId,
      _sqlrooms: buildLayerConfig({
        datasetId,
        input,
        hint: hints?.[datasetId],
      }),
    })),
  };
}
