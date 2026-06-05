import {createId} from '@paralleldrive/cuid2';
import {
  Selection as MosaicSelection,
  type Selection,
} from '@uwdata/mosaic-core';
import {useEffect, useMemo, useState} from 'react';
import {useStoreWithMosaic} from '../../MosaicSlice';
import type {DataTableExplorerOptions} from '../types';

export type UseDataTableExplorerSelectionOptions = Pick<
  DataTableExplorerOptions,
  'selection' | 'selectionName'
>;

export type UseDataTableExplorerSelectionReturn = {
  selection: Selection;
  selectionVersion: number;
};

/**
 * Tracks Mosaic selection updates as a monotonically increasing version so
 * memoized queries and lifecycle effects can respond to crossfilter changes.
 */
function useSelectionVersion(selection: Selection) {
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const handleChange = () => setVersion((value) => value + 1);
    selection.addEventListener('value', handleChange);
    return () => selection.removeEventListener('value', handleChange);
  }, [selection]);

  return version;
}

/**
 * Resolves the dataTableExplorer selection, creating a crossfilter selection when the
 * caller does not supply one, and exposes a version that changes with it.
 */
export function useDataTableExplorerSelection(
  options: UseDataTableExplorerSelectionOptions,
): UseDataTableExplorerSelectionReturn {
  const {selection: providedSelection, selectionName} = options;
  const generatedSelectionName = useMemo(
    () => `mosaic-data-table-explorer-${createId()}`,
    [],
  );
  const selectionKey = selectionName ?? generatedSelectionName;
  const existingSelection = useStoreWithMosaic(
    (state) => state.mosaic.selections[selectionKey],
  );
  const getSelection = useStoreWithMosaic((state) => state.mosaic.getSelection);
  const [fallbackSelection] = useState(() => MosaicSelection.crossfilter());

  useEffect(() => {
    if (!providedSelection && !existingSelection) {
      getSelection(selectionKey, 'crossfilter');
    }
  }, [existingSelection, getSelection, providedSelection, selectionKey]);

  const selection = providedSelection ?? existingSelection ?? fallbackSelection;

  return {
    selection,
    selectionVersion: useSelectionVersion(selection),
  };
}
