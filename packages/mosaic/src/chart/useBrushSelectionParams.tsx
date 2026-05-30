import type {Selection} from '@uwdata/mosaic-core';
import {useEffect, useMemo} from 'react';
import {useStoreWithMosaicDashboard} from '../dashboard/MosaicDashboardSlice';
import {BrushSelectionParams} from '../chart-types/base-types';

export function useBrushSelectionParams(
  selectionName: string | undefined,
): BrushSelectionParams | undefined {
  const brushSelection = useStoreWithMosaicDashboard((state) =>
    selectionName ? state.mosaic.selections[selectionName] : undefined,
  );

  const getSelection = useStoreWithMosaicDashboard(
    (state) => state.mosaic.getSelection,
  );

  useEffect(() => {
    if (selectionName && !brushSelection) {
      getSelection(selectionName, 'crossfilter');
    }
  }, [brushSelection, getSelection, selectionName]);

  const params = useMemo(
    () =>
      brushSelection
        ? new Map<string, Selection>([['brush', brushSelection]])
        : undefined,
    [brushSelection],
  );

  return params;
}
