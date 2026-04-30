import {FC, useMemo} from 'react';
import {
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@sqlrooms/ui';
import type {TableColumn} from '@sqlrooms/duckdb';
import {getAvailableChartTypes} from '../../chart-builders/chartTypeUtils';
import {createChartBuilderTemplates} from '../../chart-builders/builders';
import {useStoreWithMosaicDashboard, VgPlotChartType} from '../ChartSchemas';
import {createDefaultChartTypes} from '../../chart-builders/chartTypes';

interface ChartTypeSelectorProps {
  value: VgPlotChartType;
  columns: TableColumn[];
  onChange: (chartType: VgPlotChartType) => void;
}

export const ChartTypeSelector: FC<ChartTypeSelectorProps> = ({
  value,
  columns,
  onChange,
}) => {
  const chartTypesFromStore = useStoreWithMosaicDashboard(
    (state) => state.mosaicDashboard.chartTypes,
  );

  const chartTypes = useMemo(
    () => chartTypesFromStore || createDefaultChartTypes(),
    [chartTypesFromStore],
  );

  const templates = useMemo(
    () => createChartBuilderTemplates(chartTypes),
    [chartTypes],
  );

  const availableChartTypes = useMemo(
    () => getAvailableChartTypes(templates, columns),
    [columns, templates],
  );

  return (
    <div className="space-y-2">
      <Label>Chart Type</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue placeholder="Select chart type" />
        </SelectTrigger>
        <SelectContent>
          {availableChartTypes.map((chartType) => (
            <SelectItem key={chartType.id} value={chartType.id}>
              {chartType.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};
