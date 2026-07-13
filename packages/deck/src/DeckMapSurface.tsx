import type {DataTable} from '@sqlrooms/duckdb';
import {useCallback, useEffect, useMemo, type ReactNode} from 'react';
import {DeckJsonMap} from './DeckJsonMap';
import type {DeckMapEntry, DeckMapRuntimeIssue} from './DeckMapsSlice';
import {
  isDeckMapSqlDatasetSource,
  isDeckMapTableDatasetSource,
} from './mapConfig';
import type {DeckDatasetInput, PreparedDeckDatasetState} from './types';

/**
 * Host-neutral data boundary for Deck map resources. Worksheet maps use the
 * direct adapter below and are intentionally independent: no Mosaic selection
 * or cross-filter state is read or published.
 */
export type DeckMapDataAdapter = {
  resolveDatasets: (options: {
    mapId: string;
    map: DeckMapEntry;
  }) => Record<string, DeckDatasetInput>;
  getTableColumns?: (tableName: string) => DataTable['columns'] | undefined;
};

export const directDeckMapDataAdapter: DeckMapDataAdapter = {
  resolveDatasets: ({map}) => {
    const resolved: Record<string, DeckDatasetInput> = {};
    for (const [datasetId, dataset] of Object.entries(map.config.datasets)) {
      const {source, ...datasetConfig} = dataset;
      if (isDeckMapSqlDatasetSource(source)) {
        resolved[datasetId] = {
          ...datasetConfig,
          sqlQuery: source.sqlQuery,
        };
        continue;
      }
      if (isDeckMapTableDatasetSource(source)) {
        resolved[datasetId] = {
          ...datasetConfig,
          tableName: map.selectedTable ?? source.tableName,
          transformSql: source.transformSql,
        };
      }
    }
    return resolved;
  },
};

export type DeckMapSurfaceProps = {
  mapId: string;
  map: DeckMapEntry;
  readOnly?: boolean;
  selected?: boolean;
  caption?: string;
  headerActions?: ReactNode;
  onUpdateMap: (patch: Partial<DeckMapEntry>) => void;
  onReportIssue: (issue: Omit<DeckMapRuntimeIssue, 'mapId'>) => void;
  onClearIssue: () => void;
  dataAdapter?: DeckMapDataAdapter;
};

export function DeckMapSurface({
  mapId,
  map,
  onReportIssue,
  onClearIssue,
  dataAdapter = directDeckMapDataAdapter,
}: DeckMapSurfaceProps) {
  const datasets = useMemo(
    () => dataAdapter.resolveDatasets({mapId, map}),
    [dataAdapter, map, mapId],
  );
  const handleDatasetStates = useCallback(
    (states: Record<string, PreparedDeckDatasetState>) => {
      const failure = Object.values(states).find(
        (
          state,
        ): state is Extract<PreparedDeckDatasetState, {status: 'error'}> =>
          state.status === 'error',
      );
      if (failure) {
        onReportIssue({
          kind: 'sql-error',
          message: failure.error.message,
          recoverable: true,
        });
      } else if (
        Object.values(states).every((state) => state.status === 'ready')
      ) {
        onClearIssue();
      }
    },
    [onClearIssue, onReportIssue],
  );
  useEffect(() => {
    if (Object.keys(datasets).length === 0) onClearIssue();
  }, [datasets, onClearIssue]);

  if (Object.keys(datasets).length === 0) {
    return (
      <div className="text-muted-foreground flex h-full min-h-[320px] items-center justify-center p-4 text-center text-sm">
        Select a geospatial table to configure this map.
      </div>
    );
  }
  return (
    <DeckJsonMap
      spec={map.config.spec}
      datasets={datasets}
      mapStyle={map.config.mapStyle}
      mapProps={map.config.mapProps}
      showLegends={map.config.showLegends}
      className="h-full min-h-[320px]"
      onDatasetStatesChange={handleDatasetStates}
      onRenderingError={(error) =>
        onReportIssue({
          kind: 'render-error',
          message: error.message,
          recoverable: true,
        })
      }
    />
  );
}
