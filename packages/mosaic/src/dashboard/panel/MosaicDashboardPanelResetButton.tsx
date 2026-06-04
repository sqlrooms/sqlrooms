import {Button, Tooltip, TooltipContent, TooltipTrigger} from '@sqlrooms/ui';
import {FilterX} from 'lucide-react';
import {type FC, useCallback, useEffect, useMemo, useState} from 'react';
import {useStoreWithMosaicDashboard} from '../MosaicDashboardSlice';
import {usePanelClients} from '../usePanelClients';

export type MosaicDashboardPanelResetButtonProps = {
  dashboardId: string;
  panelId: string;
  selectionName: string;
  onClick?: () => void;
};

export const MosaicDashboardPanelResetButton: FC<
  MosaicDashboardPanelResetButtonProps
> = ({dashboardId, panelId, selectionName, onClick}) => {
  const panelClients = usePanelClients(dashboardId, panelId);

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

    // Direct reference match only - clause.source must be exactly one of this panel's clients
    return selection.clauses.some((clause) => {
      const source = clause.source as any;

      if (!source) {
        return false;
      }

      return panelClients.includes(source);
    });
  }, [panelClients, selection.clauses]);

  const handleClick = useCallback(() => {
    // Remove only clauses from this panel's registered clients
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
    onClick?.();
  }, [onClick, panelClients, selection]);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-6 w-6"
          aria-label="Reset filters"
          title="Reset filters"
          disabled={!hasActiveFilters}
          onClick={handleClick}
        >
          <FilterX className="h-3.5 w-3.5" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>Reset filters</TooltipContent>
    </Tooltip>
  );
};
