import {useCallback, useEffect, useMemo, useState} from 'react';
import {
  getMosaicDashboardSelectionName,
  useStoreWithMosaicDashboard,
} from '../MosaicDashboardSlice';

export type UseDashboardResetFiltersOptions = {
  dashboardId: string;
};

export type UseDashboardResetFiltersReturn = {
  hasActiveFilters: boolean;
  reset: () => void;
};

/**
 * Hook for managing dashboard-wide filter reset logic.
 * Tracks all active filters for the dashboard and provides a reset function
 * that clears all filters.
 */
export function useDashboardResetFilters({
  dashboardId,
}: UseDashboardResetFiltersOptions): UseDashboardResetFiltersReturn {
  const getSelection = useStoreWithMosaicDashboard(
    (state) => state.mosaic.getSelection,
  );
  const dashboardSelectionName = getMosaicDashboardSelectionName(dashboardId);
  const dashboardSelection = useStoreWithMosaicDashboard(
    (state) => state.mosaic.selections[dashboardSelectionName],
  );
  const [selectionVersion, setSelectionVersion] = useState(0);

  useEffect(() => {
    if (!dashboardSelection) {
      getSelection(dashboardSelectionName, 'crossfilter');
    }
  }, [dashboardSelection, dashboardSelectionName, getSelection]);

  useEffect(() => {
    if (!dashboardSelection) {
      return;
    }

    const handleSelectionChange = () => {
      setSelectionVersion((value) => value + 1);
    };

    dashboardSelection.addEventListener('value', handleSelectionChange);
    return () => {
      dashboardSelection.removeEventListener('value', handleSelectionChange);
    };
  }, [dashboardSelection]);

  const hasActiveFilters = useMemo(
    () => Boolean(dashboardSelection?.clauses.length),
    [dashboardSelection, selectionVersion],
  );

  const reset = useCallback(() => {
    dashboardSelection?.reset();
  }, [dashboardSelection]);

  return {
    hasActiveFilters,
    reset,
  };
}
