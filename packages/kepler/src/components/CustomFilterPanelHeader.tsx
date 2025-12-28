import {removeFilter} from '@kepler.gl/actions';
import {StyledPanelHeader, StyledPanelHeaderProps} from '@kepler.gl/components';
import {KeplerTable} from '@kepler.gl/table';
import {Field, Filter, RGBColor} from '@kepler.gl/types';
import {createLinearGradient} from '@kepler.gl/utils';
import {
  Button,
  cn,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@sqlrooms/ui';
import {Trash} from 'lucide-react';
import React from 'react';
import styled from 'styled-components';
import {useStoreWithKepler} from '../KeplerSlice';

interface StyledFilterHeaderProps extends StyledPanelHeaderProps {
  $labelRCGColorValues: RGBColor[];
}

export const StyledFilterHeader: any = styled(
  StyledPanelHeader,
)<StyledFilterHeaderProps>`
  cursor: pointer;
  padding: 10px 12px;

  .field-selector {
    width: 100%;
    flex: 2;
  }

  border-left: 3px solid;
  ${(props) =>
    props.$labelRCGColorValues && props.$labelRCGColorValues.length > 0
      ? `border-image: ${createLinearGradient('bottom', props.$labelRCGColorValues)} 3;`
      : 'border-color: transparent;'};
`;

export type FilterPanelHeaderProps = {
  className?: string;
  datasets: KeplerTable[];
  filter: Filter;
  allAvailableFields?: Field[];
  idx?: number;
  children: React.ReactNode;
};

export function CustomFilterPanelHeaderFactory(): React.ComponentType<FilterPanelHeaderProps> {
  const FilterPanelHeader: React.FC<FilterPanelHeaderProps> = ({
    idx,
    children,
    className = '',
    datasets,
    filter,
  }: FilterPanelHeaderProps) => {
    const dispatchAction = useStoreWithKepler(
      (state) => state.kepler.dispatchAction,
    );
    const mapId = useStoreWithKepler(
      // TODO: pass the mapId via the props, currentMapId is not necessarily the map where filter is originated from
      (state) => state.kepler.config.currentMapId,
    );
    const filterIdx = useStoreWithKepler((state) =>
      state.kepler.map[mapId]?.visState.filters.findIndex(
        (f) => f.id === filter.id,
      ),
    );
    return (
      <StyledFilterHeader
        className={cn('filter-panel__header gap-2', className)}
        $labelRCGColorValues={Object.values(datasets).map(
          (d: KeplerTable) => d.color,
        )}
      >
        <div className="flex flex-1 overflow-hidden">{children}</div>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="hover:bg-foreground/10 h-8 w-8"
              onClick={() => {
                if (filterIdx === undefined) {
                  throw new Error('Filter index not found by id ${filter.id}');
                }
                return dispatchAction(mapId, removeFilter(filterIdx));
              }}
            >
              <Trash className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Delete Filter</TooltipContent>
        </Tooltip>
      </StyledFilterHeader>
    );
  };

  return FilterPanelHeader;
}
