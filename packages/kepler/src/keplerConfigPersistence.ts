import type {KeplerGlState} from '@kepler.gl/reducers';

type VisState = KeplerGlState['visState'];

/** Include saved config awaiting datasets, even when no map component is mounted. */
export function getReferencedKeplerDatasetIds(visState: VisState): Set<string> {
  const dataIds = new Set<string>();
  for (const layer of [...visState.layers, ...visState.layerToBeMerged]) {
    if (layer.config.dataId) dataIds.add(layer.config.dataId);
  }
  for (const filter of [...visState.filters, ...visState.filterToBeMerged]) {
    for (const dataId of filter.dataId ?? []) dataIds.add(dataId);
  }
  // A saved tooltip can reference data even when the map has no layers/filters.
  for (const dataId of Object.keys(
    visState.interactionToBeMerged.tooltip?.fieldsToShow ?? {},
  )) {
    dataIds.add(dataId);
  }
  return dataIds;
}

/** Kepler's serializer omits these pending values; saving would discard them. */
export function hasPendingKeplerConfig(visState: VisState): boolean {
  return (
    visState.layerToBeMerged.length > 0 ||
    visState.filterToBeMerged.length > 0 ||
    visState.splitMapsToBeMerged.length > 0 ||
    Object.keys(visState.interactionToBeMerged).length > 0 ||
    Object.values(visState.isMergingDatasets).some(Boolean)
  );
}
