import {type FC, useEffect, useMemo, useState} from 'react';
import {Button} from '@sqlrooms/ui';
import {
  getMosaicDashboardSelectionName,
  useStoreWithMosaicDashboard,
} from '../MosaicDashboardSlice';

interface MosaicDashboardResetFiltersButtonProps {
  dashboardId: string;
}

export const MosaicDashboardResetFiltersButton: FC<
  MosaicDashboardResetFiltersButtonProps
> = ({dashboardId}) => {
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

  const handleResetFilters = () => {
    dashboardSelection?.reset();
  };

  return (
    <Button
      variant="link"
      size="sm"
      className="h-8 px-0"
      disabled={!hasActiveFilters}
      onClick={handleResetFilters}
    >
      Reset filters
    </Button>
  );
};
