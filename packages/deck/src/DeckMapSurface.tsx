import type {DataTable} from '@sqlrooms/duckdb';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {DeckJsonMap} from './DeckJsonMap';
import type {DeckMapResource, DeckMapRuntimeIssue} from './DeckMapsSlice';
import {DECK_TABLE_DATASET_SOURCE_RELATION} from './datasets/tableDatasetSql';
import {
  isDeckMapSqlDatasetSource,
  isDeckMapTableDatasetSource,
} from './mapConfig';
import {getDeckMapDataPolicy, type DeckMapDataPolicy} from './mapDataPolicy';
import {getDeckMapResourceConfigIssues} from './mapResourceAuthoring';
import {
  getDeckMapDatasetSource,
  resolveDeckMapFitToData,
  useDeckMapFitController,
} from './mapFit';
import type {
  DeckDatasetInput,
  DeckJsonMapHandle,
  PreparedDeckDatasetState,
} from './types';

function sampleDatasetSql(sql: string, maxRows: number) {
  const sourceSql = sql.trim().replace(/(?:\s*;+\s*)+$/, '');
  return `SELECT * FROM (${sourceSql}) USING SAMPLE ${maxRows} ROWS`;
}

function applyDataPolicy(
  input: DeckDatasetInput,
  policy: DeckMapDataPolicy,
): DeckDatasetInput {
  if (policy.disabled) return input;
  const maxRows = Math.max(1, Math.floor(policy.maxRows));
  if ('sqlQuery' in input) {
    return {...input, sqlQuery: sampleDatasetSql(input.sqlQuery, maxRows)};
  }
  if ('tableName' in input) {
    return {
      ...input,
      transformSql: sampleDatasetSql(
        input.transformSql ??
          `SELECT * FROM ${DECK_TABLE_DATASET_SOURCE_RELATION}`,
        maxRows,
      ),
    };
  }
  return input;
}

/**
 * Host-neutral data boundary for Deck map resources. Worksheet maps use the
 * direct adapter below and are intentionally independent: no Mosaic selection
 * or cross-filter state is read or published.
 */
export type DeckMapDataAdapter = {
  resolveDatasets: (options: {
    mapId: string;
    map: DeckMapResource;
  }) => Record<string, DeckDatasetInput>;
  /** Resolves an unsampled dataset input for fit-to-data bounds queries. */
  resolveFitDataset?: (options: {
    mapId: string;
    map: DeckMapResource;
    datasetId: string;
  }) => DeckDatasetInput | undefined;
  getTableColumns?: (tableName: string) => DataTable['columns'] | undefined;
};

function resolveDirectDeckMapDatasets(
  map: DeckMapResource,
  dataPolicy?: DeckMapDataPolicy,
) {
  const resolved: Record<string, DeckDatasetInput> = {};
  // A top-level selected table is only an unambiguous override when the map
  // has one table-backed dataset. Multi-source maps retain authored tables.
  const tableDatasetCount = Object.values(map.config.datasets).filter(
    (dataset) => isDeckMapTableDatasetSource(dataset.source),
  ).length;
  for (const [datasetId, dataset] of Object.entries(map.config.datasets)) {
    const {source, ...datasetConfig} = dataset;
    let input: DeckDatasetInput | undefined;
    if (isDeckMapSqlDatasetSource(source)) {
      input = {...datasetConfig, sqlQuery: source.sqlQuery};
    } else if (isDeckMapTableDatasetSource(source)) {
      input = {
        ...datasetConfig,
        tableName:
          tableDatasetCount === 1
            ? (map.selectedTable ?? source.tableName)
            : source.tableName,
        transformSql: source.transformSql,
      };
    }
    if (input) {
      resolved[datasetId] = dataPolicy
        ? applyDataPolicy(input, dataPolicy)
        : input;
    }
  }
  return resolved;
}

export const directDeckMapDataAdapter: DeckMapDataAdapter = {
  resolveDatasets: ({map}) =>
    resolveDirectDeckMapDatasets(map, getDeckMapDataPolicy(map.config)),
  resolveFitDataset: ({map, datasetId}) =>
    resolveDirectDeckMapDatasets(map)[datasetId],
};

export type DeckMapSurfaceProps = {
  mapId: string;
  map: DeckMapResource;
  readOnly?: boolean;
  selected?: boolean;
  caption?: string;
  headerActions?: ReactNode;
  fitRequestVersion?: number;
  onUpdateMap: (patch: Partial<DeckMapResource>) => void;
  onReportIssue: (issue: Omit<DeckMapRuntimeIssue, 'mapId'>) => void;
  /** Clears the current issue when its kind matches, or all issues when omitted. */
  onClearIssue: (kind?: DeckMapRuntimeIssue['kind']) => void;
  dataAdapter?: DeckMapDataAdapter;
};

export function DeckMapSurface({
  mapId,
  map,
  onReportIssue,
  onClearIssue,
  fitRequestVersion = 0,
  dataAdapter = directDeckMapDataAdapter,
}: DeckMapSurfaceProps) {
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  const deckMapRef = useRef<DeckJsonMapHandle>(null);
  const datasets = useMemo(
    () => dataAdapter.resolveDatasets({mapId, map}),
    [dataAdapter, map, mapId],
  );
  const configIssues = useMemo(
    () => getDeckMapResourceConfigIssues(map.config, {allowEmpty: true}),
    [map.config],
  );
  useEffect(() => {
    if (configIssues.length > 0) {
      onReportIssue({
        kind: 'config-error',
        message: `${configIssues[0]!.path}: ${configIssues[0]!.message}`,
        recoverable: true,
        details: {issues: configIssues},
      });
    } else {
      onClearIssue('config-error');
    }
  }, [configIssues, onClearIssue, onReportIssue]);
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
        onClearIssue('sql-error');
      }
    },
    [onClearIssue, onReportIssue],
  );
  useEffect(() => {
    if (configIssues.length === 0 && Object.keys(datasets).length === 0) {
      onClearIssue();
    }
  }, [configIssues, datasets, onClearIssue]);
  const fitToData = useMemo(
    () => resolveDeckMapFitToData(map.config),
    [map.config],
  );
  const fitSource = useMemo(() => {
    if (!fitToData) return null;
    const fitDataset =
      dataAdapter.resolveFitDataset?.({
        mapId,
        map,
        datasetId: fitToData.dataset,
      }) ?? datasets[fitToData.dataset];
    return getDeckMapDatasetSource(fitDataset);
  }, [dataAdapter, datasets, fitToData, map, mapId]);
  const handleFitError = useCallback(
    (error: Error) =>
      onReportIssue({
        kind: 'fit-error',
        message: error.message,
        recoverable: true,
      }),
    [onReportIssue],
  );
  const handleFitSuccess = useCallback(
    () => onClearIssue('fit-error'),
    [onClearIssue],
  );
  useDeckMapFitController({
    scopeId: mapId,
    fitToData,
    source: fitSource,
    container,
    deckMapRef,
    requestVersion: fitRequestVersion,
    autoFit: true,
    onSuccess: handleFitSuccess,
    onError: handleFitError,
  });

  if (configIssues.length > 0) {
    return (
      <div className="text-destructive flex h-full min-h-[320px] items-center justify-center p-4 text-center text-sm">
        {`Invalid map configuration: ${configIssues[0]!.path}: ${configIssues[0]!.message}`}
      </div>
    );
  }
  if (Object.keys(datasets).length === 0) {
    return (
      <div className="text-muted-foreground flex h-full min-h-[320px] items-center justify-center p-4 text-center text-sm">
        Select a geospatial table to configure this map.
      </div>
    );
  }
  return (
    <div ref={setContainer} className="h-full min-h-[320px]">
      <DeckJsonMap
        ref={deckMapRef}
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
    </div>
  );
}
