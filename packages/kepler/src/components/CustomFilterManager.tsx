import React, {useCallback, useMemo} from 'react';
import {useIntl} from 'react-intl';
import styled from 'styled-components';

import {
  FilterPanelFactory,
  PanelTitleFactory,
  AddFilterButtonFactory,
  SidePanelSection,
} from '@kepler.gl/components';
import {FILTER_VIEW_TYPES, SIDEBAR_PANELS} from '@kepler.gl/constants';
import {Filter} from '@kepler.gl/types';
import {Layer} from '@kepler.gl/layers';
import {isSideFilter} from '@kepler.gl/utils';
import {Datasets} from '@kepler.gl/table';

import {KeplerInjector} from './KeplerInjector';
import {
  KeplerActions,
  useKeplerStateActions,
} from '../hooks/useKeplerStateActions';

// Get the kepler.gl components through the injector
const FilterPanel = KeplerInjector.get(FilterPanelFactory);
const PanelTitle = KeplerInjector.get(PanelTitleFactory);
const AddFilterButton = KeplerInjector.get(AddFilterButtonFactory);

const filterPanelMetadata = SIDEBAR_PANELS.find((p) => p.id === 'filter');

// Custom styled components for your filter manager
const CustomFilterManagerContainer = styled.div`
  .filter-manager {
    /* Add your custom styles here */
  }

  .filter-manager-title {
    /* Custom title styling */
  }

  .add-filter-button {
    background-color: ${(props) =>
      props.theme.sidePanelBg || props.theme.panelBackground};
    color: #2563eb;
    border: 0px;
    height: 28px;
    font-weight: 500;
    font-size: 14px;
  }
`;

type CustomFilterManagerProps = {
  mapId: string;
  showDeleteDataset?: boolean;
};

type FilterListProps = {
  filters: Filter[];
  datasets: Datasets;
  layers: Layer[];
  filtersByIndex: {
    filter: Filter;
    idx: number;
  }[];
  isAnyFilterAnimating: boolean;
  keplerActions: KeplerActions;
};

// Based on Kepler.gl's filterPanelCallbacks pattern
type FilterPanelCallbacks = Record<
  string,
  {
    removeFilter: () => void;
    setFilterView: (view: string) => void;
    toggleAnimation: () => void;
    toggleFilterFeature: () => void;
  }
>;

// Filter List Component
const FilterList: React.FC<FilterListProps> = ({
  filtersByIndex,
  filters,
  datasets,
  layers,
  isAnyFilterAnimating,
  keplerActions,
}) => {
  const {
    removeFilter,
    setFilterView,
    toggleFilterAnimation,
    toggleFilterFeature,
  } = keplerActions.visStateActions;

  const filterPanelProps = useMemo(() => {
    return filtersByIndex.reduce(
      (accu, {filter, idx}) => ({
        ...accu,
        [filter.id]: {
          removeFilter: () => removeFilter(idx),
          setFilterView: (view: string) =>
            setFilterView(
              idx,
              isSideFilter(filter)
                ? FILTER_VIEW_TYPES.enlarged
                : FILTER_VIEW_TYPES.side,
            ),
          toggleAnimation: () => toggleFilterAnimation(idx),
          toggleFilterFeature: () => toggleFilterFeature(idx),
        },
      }),
      {} as FilterPanelCallbacks,
    );
  }, [
    filtersByIndex,
    removeFilter,
    setFilterView,
    toggleFilterAnimation,
    toggleFilterFeature,
  ]);

  return (
    <>
      {[...filtersByIndex].reverse().map(({filter, idx}) => (
        <FilterPanel
          key={`${filter.id}-${idx}`}
          idx={idx}
          filters={filters}
          filter={filter}
          datasets={datasets}
          layers={layers}
          isAnyFilterAnimating={isAnyFilterAnimating}
          removeFilter={filterPanelProps[filter.id]?.removeFilter}
          setFilterView={filterPanelProps[filter.id]?.setFilterView}
          toggleAnimation={filterPanelProps[filter.id]?.toggleAnimation}
          toggleFilterFeature={filterPanelProps[filter.id]?.toggleFilterFeature}
          {...keplerActions.visStateActions}
        />
      ))}
    </>
  );
};

// Custom hook for filter actions
function useCustomFilterActions(keplerActions: KeplerActions) {
  const {addFilter} = keplerActions.visStateActions;

  const onClickAddFilter = useCallback(
    (dataset: string) => addFilter(dataset),
    [addFilter],
  );

  return {
    onClickAddFilter,
  };
}

// Main Custom Filter Manager Component
export const CustomFilterManager: React.FC<CustomFilterManagerProps> = ({
  mapId,
}) => {
  const {keplerActions, keplerState} = useKeplerStateActions({mapId});
  const intl = useIntl();

  const {onClickAddFilter} = useCustomFilterActions(keplerActions);

  const visState = keplerState?.visState;
  const filters = useMemo(() => visState?.filters ?? [], [visState?.filters]);
  const datasets = useMemo(
    () => (visState?.datasets ?? []) as Datasets,
    [visState?.datasets],
  );
  const layers = useMemo(() => visState?.layers ?? [], [visState?.layers]);
  const filtersByIndex = useMemo(
    () =>
      filters?.map((f, idx) => ({
        filter: f,
        idx,
      })) ?? [],
    [filters],
  );

  if (!keplerState || !keplerActions) {
    return null;
  }

  const isAnyFilterAnimating = Object.values(filters).some(
    (f) => f.isAnimating,
  );

  return (
    <CustomFilterManagerContainer>
      <div className="filter-manager">
        <SidePanelSection>
          <PanelTitle
            className="filter-manager-title"
            title={intl.formatMessage({
              id: filterPanelMetadata?.label || 'Filters',
            })}
          >
            <AddFilterButton datasets={datasets} onAdd={onClickAddFilter} />
          </PanelTitle>
        </SidePanelSection>

        <SidePanelSection>
          <FilterList
            filtersByIndex={filtersByIndex}
            filters={filters}
            datasets={datasets}
            layers={layers}
            isAnyFilterAnimating={isAnyFilterAnimating}
            keplerActions={keplerActions}
          />
        </SidePanelSection>
      </div>
    </CustomFilterManagerContainer>
  );
};
