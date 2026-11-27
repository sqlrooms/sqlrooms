import {SpinnerPane} from '@sqlrooms/ui';
import {type Coordinator} from '@uwdata/mosaic-core';
import {type Query} from '@uwdata/mosaic-sql';
import {type FC, useEffect, useMemo, useRef, useState} from 'react';
import {createChartRuntimeIssueFromError} from '../../../chart-runtime';
import {VgPlotChart} from '../../../VgPlotChart';
import {MosaicChartError} from '../../MosaicChartError';
import {type ChartRendererProps} from '../base-types';
import {createHistogramPercentileQueries} from './percentile';
import {type HistogramChartConfig} from './schema';
import {createHistogramSpec, getHistogramUpperPercentile} from './spec';
import {validateHistogramSettings} from './validation';

type CutoffResult = {
  coordinator: Coordinator;
  query: Query;
} & ({bound: string | null; error?: never} | {error: Error; bound?: never});

/** Compute the cutoff once, then use it for both marks throughout brushing. */
export const HistogramPercentileRenderer: FC<
  ChartRendererProps<HistogramChartConfig>
> = ({
  config,
  coordinator,
  dataPolicy,
  dataTable,
  params,
  retention,
  runtimeIssueContext,
  runtimeIssueReporter,
  selectionName,
}) => {
  const {field, upperPercentile} = config.settings;
  const prepared = useMemo(() => {
    try {
      const percentile = getHistogramUpperPercentile({upperPercentile});
      if (percentile === undefined) return {};
      const {fieldColumn} = validateHistogramSettings({
        dataTable,
        settings: {field},
      });
      return {
        query: createHistogramPercentileQueries(
          dataTable.table,
          fieldColumn,
          percentile,
        ).cutoff,
      };
    } catch (error) {
      return {error: error instanceof Error ? error : new Error(String(error))};
    }
  }, [dataTable, field, upperPercentile]);

  const [result, setResult] = useState<CutoffResult>();
  const reporterRef = useRef(runtimeIssueReporter);
  useEffect(() => {
    reporterRef.current = runtimeIssueReporter;
  }, [runtimeIssueReporter]);

  const {query} = prepared;
  useEffect(() => {
    if (!query) return;
    let active = true;
    void coordinator.query(query, {cache: false}).then(
      (rows) => {
        if (active) {
          const bound = rows.get(0)?.upper_bound;
          reporterRef.current?.clearIssue();
          setResult({
            coordinator,
            query,
            bound: typeof bound === 'string' ? bound : null,
          });
        }
      },
      (error: unknown) => {
        if (active) {
          setResult({
            coordinator,
            query,
            error: error instanceof Error ? error : new Error(String(error)),
          });
        }
      },
    );
    return () => {
      active = false;
    };
  }, [coordinator, query]);

  const current =
    result?.coordinator === coordinator && result.query === query
      ? result
      : undefined;
  const queryError = current?.error;
  useEffect(() => {
    if (queryError && runtimeIssueContext) {
      runtimeIssueReporter?.reportIssue(
        createChartRuntimeIssueFromError(
          queryError,
          runtimeIssueContext,
          dataPolicy,
        ),
      );
    }
  }, [dataPolicy, queryError, runtimeIssueContext, runtimeIssueReporter]);

  const spec = useMemo(() => {
    if (prepared.error || (query && current?.bound == null)) return;
    return createHistogramSpec(
      {dataTable, selectionName, settings: config.settings},
      current?.bound ?? undefined,
    );
  }, [
    prepared.error,
    query,
    current?.bound,
    dataTable,
    selectionName,
    config.settings,
  ]);

  const error = prepared.error ?? current?.error;
  if (error) return <MosaicChartError error={error} />;
  if (current?.bound === null) {
    return (
      <div
        className="text-muted-foreground grid h-full place-content-center text-sm"
        role="status"
      >
        No finite values to bin.
      </div>
    );
  }
  if (!spec) return <SpinnerPane className="h-full w-full" />;

  return (
    <VgPlotChart
      spec={spec}
      params={params}
      retention={retention}
      dataPolicy={dataPolicy}
      runtimeIssueContext={runtimeIssueContext}
      runtimeIssueReporter={runtimeIssueReporter}
    />
  );
};
