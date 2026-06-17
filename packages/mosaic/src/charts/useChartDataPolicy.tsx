import {useMemo} from 'react';
import type {ChartDataPolicy} from '../chart-runtime';
import {resolveChartDataPolicy} from '../chart-runtime';
import type {ChartConfig} from './chart-types/chart-config';
import {useChartTypeDefinition} from './useChartTypeDefinition';
import {DataTable} from '@sqlrooms/db';

export function useChartDataPolicy(
  dataTable: DataTable | undefined,
  config: ChartConfig,
): ChartDataPolicy | null {
  const chartTypeDefinition = useChartTypeDefinition(config.chartType);

  return useMemo(() => {
    if (!chartTypeDefinition?.getDataPolicy || !dataTable) {
      return null;
    }

    const defaultPolicy =
      chartTypeDefinition.getDataPolicy({
        tableName: dataTable.table.table,
        config,
      }) ?? null;

    return resolveChartDataPolicy(defaultPolicy, config.dataPolicy);
  }, [config, chartTypeDefinition, dataTable]);
}
