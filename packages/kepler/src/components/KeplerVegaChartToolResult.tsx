import {layerSetIsValid} from '@kepler.gl/actions';
import {Layer} from '@kepler.gl/layers';
import {Datasets} from '@kepler.gl/table';
import {
  BrushFieldMapping,
  VegaChartToolResult,
  VegaChartToolResultProps,
  VegaBrushSelectionRanges,
  computeBrushMapping,
  extractTableNameFromSql,
  resolveBrushToRowIndices,
} from '@sqlrooms/vega';
import {ReactNode, useCallback, useEffect, useMemo, useRef} from 'react';
import {useStoreWithKepler} from '../KeplerSlice';
import type {DbSliceState} from '@sqlrooms/room-shell';

function highlightRows(
  datasets: Datasets,
  layers: Layer[],
  datasetName: string,
  selectedRowIndices: number[],
  dispatchLayerSetIsValid: (layer: Layer, isValid: boolean) => void,
) {
  const datasetId = Object.keys(datasets).find(
    (dataId) => datasets[dataId]?.label === datasetName,
  );
  if (!datasetId) return;
  const dataset = datasets[datasetId];
  if (!dataset) return;
  dataset.filteredIndex =
    selectedRowIndices.length === 0 ? dataset.allIndexes : selectedRowIndices;
  const affectedLayers = layers.filter(
    (layer) => layer.config.dataId === dataset.id,
  );
  affectedLayers.forEach((layer) => {
    layer.formatLayerData(datasets);
    dispatchLayerSetIsValid(layer, true);
  });
}

/**
 * Wraps `VegaChartToolResult` with Kepler.gl brush-to-map highlighting.
 * When the user brushes data in the chart, matching rows are highlighted
 * on the Kepler.gl map layers.
 *
 * The brush field mapping is computed lazily on the first brush interaction
 * and cached for subsequent brushes.
 *
 * This component reads from the Kepler slice of the room store via
 * `useStoreWithKepler`, so it must be rendered inside a room that includes
 * the Kepler slice.
 */
export function KeplerVegaChartToolResult(
  props: VegaChartToolResultProps,
): ReactNode {
  const sqlQuery = props.output?.sqlQuery ?? '';

  const datasetName = useMemo(
    () => extractTableNameFromSql(sqlQuery),
    [sqlQuery],
  );

  const getConnector = useStoreWithKepler(
    (state: DbSliceState) => state.db.getConnector,
  );
  const currentMapId = useStoreWithKepler(
    (state) => state.kepler.config.currentMapId,
  );
  const keplerMap = useStoreWithKepler(
    (state) => state.kepler.map[currentMapId],
  );
  const dispatchAction = useStoreWithKepler(
    (state) => state.kepler.dispatchAction,
  );

  const hasMatchingLayer = useMemo(() => {
    if (!keplerMap || !datasetName) return false;
    const {datasets, layers} = keplerMap.visState;
    const datasetId = Object.keys(datasets).find(
      (dataId) => datasets[dataId]?.label === datasetName,
    );
    if (!datasetId) return false;
    return layers.some((layer) => layer.config.dataId === datasetId);
  }, [keplerMap, datasetName]);

  const dispatchLayerSetIsValid = useCallback(
    (layer: Layer, isValid: boolean) => {
      dispatchAction(currentMapId, layerSetIsValid(layer, isValid));
    },
    [dispatchAction, currentMapId],
  );

  const keplerMapRef = useRef(keplerMap);
  useEffect(() => {
    keplerMapRef.current = keplerMap;
  }, [keplerMap]);

  // Lazy cache: computed once on first brush, then reused.
  // `null` = not yet attempted, `undefined` = attempted but unavailable.
  const brushCacheRef = useRef<{
    mapping: BrushFieldMapping | undefined;
    promise: Promise<BrushFieldMapping | null> | null;
  }>({mapping: undefined, promise: null});

  const sqlQueryRef = useRef(sqlQuery);
  useEffect(() => {
    if (sqlQueryRef.current !== sqlQuery) {
      sqlQueryRef.current = sqlQuery;
      brushCacheRef.current = {mapping: undefined, promise: null};
    }
  }, [sqlQuery]);

  const onBrushSelection = useCallback(
    async (ranges: VegaBrushSelectionRanges) => {
      const map = keplerMapRef.current;
      if (!map || !datasetName || !sqlQuery) return;

      const cache = brushCacheRef.current;

      if (cache.mapping !== undefined) {
        const hasRanges = Object.keys(ranges).length > 0;
        const indices = hasRanges
          ? resolveBrushToRowIndices(cache.mapping, ranges)
          : [];
        highlightRows(
          map.visState.datasets,
          map.visState.layers,
          datasetName,
          indices,
          dispatchLayerSetIsValid,
        );
        return;
      }

      if (!cache.promise) {
        cache.promise = (async () => {
          try {
            const connector = await getConnector();
            return await computeBrushMapping(connector, sqlQuery);
          } catch (e) {
            console.warn('Failed to compute brush field mapping:', e);
            return null;
          }
        })();
      }

      const mapping = await cache.promise;
      if (!mapping) {
        cache.mapping = {} as BrushFieldMapping;
        return;
      }
      cache.mapping = mapping;

      const freshMap = keplerMapRef.current;
      if (!freshMap) return;
      const hasRanges = Object.keys(ranges).length > 0;
      const indices = hasRanges
        ? resolveBrushToRowIndices(mapping, ranges)
        : [];
      highlightRows(
        freshMap.visState.datasets,
        freshMap.visState.layers,
        datasetName,
        indices,
        dispatchLayerSetIsValid,
      );
    },
    [datasetName, sqlQuery, getConnector, dispatchLayerSetIsValid],
  );

  return (
    <VegaChartToolResult
      {...props}
      onBrushSelection={hasMatchingLayer ? onBrushSelection : undefined}
      brushAvailable={hasMatchingLayer}
    />
  );
}
