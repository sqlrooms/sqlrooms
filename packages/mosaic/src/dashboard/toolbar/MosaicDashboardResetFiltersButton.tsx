import {type FC} from 'react';
import {useDashboardResetFilters} from '../hooks/useDashboardResetFilters';
import {ResetFiltersButton} from '../components/ResetFiltersButton';

interface MosaicDashboardResetFiltersButtonProps {
  dashboardId: string;
}

export const MosaicDashboardResetFiltersButton: FC<
  MosaicDashboardResetFiltersButtonProps
> = ({dashboardId}) => {
  const {hasActiveFilters, reset} = useDashboardResetFilters({dashboardId});

  return (
    <ResetFiltersButton
      className="h-8 w-8"
      iconClassName="h-4 w-4"
      disabled={!hasActiveFilters}
      onClick={reset}
      tooltip="Reset all filters"
    />
  );
};
