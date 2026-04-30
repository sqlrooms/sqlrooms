import {Spec} from '@uwdata/mosaic-spec';
import {mosaicChartTypes} from '../chart-builders/chartTypes';
import {VgPlotChartSettings, VgPlotChartType} from './ChartSchemas';

export function generateMosaicChartSpec(
  tableName: string | undefined,
  chartType: VgPlotChartType,
  settings: VgPlotChartSettings,
): Spec | null {
  if (!tableName) {
    return null;
  }

  const chartTypeDef = Object.values(mosaicChartTypes).find(
    ({id}) => id === chartType,
  );

  if (!chartTypeDef) {
    return null;
  }

  return chartTypeDef.createSpec(tableName, settings);
}
