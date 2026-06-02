import {useMemo} from 'react';
import type {ChartDataPolicy} from '../chart-runtime';
import {resolveChartDataPolicy} from '../chart-runtime';
import type {ChartConfig} from '../chart-types/chart-config';
import {useChartTypeDefinition} from '../chart-types/useChartTypeDefinition';

export function useChartDataPolicy(
  tableName: string | undefined,
  config: ChartConfig,
): ChartDataPolicy | null {
  const chartTypeDefinition = useChartTypeDefinition(config.chartType);

  return useMemo(() => {
    if (!chartTypeDefinition?.getDataPolicy || !tableName) {
      return null;
    }

    const defaultPolicy =
      chartTypeDefinition.getDataPolicy({tableName, config}) ?? null;

    return resolveChartDataPolicy(defaultPolicy, config.dataPolicy);
  }, [config, chartTypeDefinition, tableName]);
}
