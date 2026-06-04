import {useCallback, useEffect, useMemo, useState} from 'react';
import type {MosaicClient} from '@uwdata/mosaic-core';
import {useStoreWithMosaicDashboard} from '../MosaicDashboardSlice';

export type UsePanelResetFiltersOptions = {
  panelClients: MosaicClient[];
  selectionName: string;
};

export type UsePanelResetFiltersReturn = {
  hasActiveFilters: boolean;
  reset: () => void;
};

/**
 * Hook for managing panel-specific filter reset logic.
 * Tracks active filters from the given panel clients and provides a reset function
 * that only clears filters originating from those clients.
 */
export function usePanelResetFilters({
  panelClients,
  selectionName,
}: UsePanelResetFiltersOptions): UsePanelResetFiltersReturn {
  const getSelection = useStoreWithMosaicDashboard(
    (state) => state.mosaic.getSelection,
  );

  const selection = useMemo(
    () => getSelection(selectionName, 'crossfilter'),
    [getSelection, selectionName],
  );

  // Force rerender when selection changes
  const [, setForceUpdate] = useState(0);

  useEffect(() => {
    const listener = () => setForceUpdate((n) => n + 1);
    selection.addEventListener('value', listener);
    return () => selection.removeEventListener('value', listener);
  }, [selection]);

  const hasActiveFilters = useMemo(() => {
    if (panelClients.length === 0) {
      return false;
    }

    return selection.clauses.some((clause) => {
      const source = clause.source as any;

      if (!source) {
        return false;
      }

      return panelClients.includes(source);
    });
  }, [panelClients, selection.clauses]);

  const reset = useCallback(() => {
    const clausesToRemove = selection.clauses.filter((clause) => {
      const source = clause.source as any;
      if (!source) {
        return false;
      }

      return panelClients.includes(source);
    });

    if (clausesToRemove.length > 0) {
      selection.reset(clausesToRemove);
    }
  }, [panelClients, selection]);

  return {
    hasActiveFilters,
    reset,
  };
}
