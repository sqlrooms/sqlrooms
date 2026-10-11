import type {FC} from 'react';
import {useMemo} from 'react';
import {VgPlotChart} from '../../../../VgPlotChart';
import type {ChartRendererProps} from '../../base-types';
import type {CountPlotChartConfig} from '../schema';
import {createCountPlotSpec} from '../spec';
import {useCountPlotCategoryCount} from './useCountPlotCategoryCount';

/**
 * Count plot renderer that sizes the vgplot chart to runtime category count.
 */
export const CountPlotPanelRenderer: FC<
  ChartRendererProps<CountPlotChartConfig>
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
  table,
}) => {
  const field =
    typeof config.settings.field === 'string'
      ? config.settings.field
      : undefined;
  const categoryCount = useCountPlotCategoryCount({
    coordinator,
    field,
    table,
  });

  const specResult = useMemo(() => {
    try {
      return {
        spec: createCountPlotSpec({
          dataTable,
          selectionName,
          settings: config.settings,
          visibleCategoryCount: categoryCount.count,
        }),
      };
    } catch (error) {
      return {error: error instanceof Error ? error : new Error(String(error))};
    }
  }, [categoryCount.count, config.settings, dataTable, selectionName]);

  if (specResult.error) {
    return (
      <div className="text-muted-foreground flex h-full flex-col items-center justify-center text-sm">
        {specResult.error.message}
      </div>
    );
  }

  const specHeight = (specResult.spec as {height?: unknown}).height;
  const height = typeof specHeight === 'number' ? specHeight : 240;

  return (
    <div className="flex h-full min-h-0 w-full overflow-auto">
      <div className="my-auto w-full shrink-0" style={{height}}>
        <VgPlotChart
          spec={specResult.spec}
          params={params}
          retention={retention}
          dataPolicy={dataPolicy}
          runtimeIssueContext={runtimeIssueContext}
          runtimeIssueReporter={runtimeIssueReporter}
        />
      </div>
    </div>
  );
};
