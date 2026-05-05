import {type FC, memo, useMemo} from 'react';
import {
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@sqlrooms/ui';
import type {TableColumn} from '@sqlrooms/duckdb';
import {isChartTypeAvailable} from '../../chart-builders/chartTypeUtils';
import {createChartBuilderTemplates} from '../../chart-builders/builders';
import {VgPlotChartType, createDefaultChartTypes} from '../../chart-types';
import {useStoreWithMosaicDashboard} from '../MosaicDashboardSlice';

interface ChartTypeSelectorProps {
  value: VgPlotChartType;
  columns: TableColumn[];
  onChange: (chartType: VgPlotChartType) => void;
}

export const ChartTypeSelector: FC<ChartTypeSelectorProps> = memo(
  ({value, columns, onChange}) => {
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

    const availableTemplates = useMemo(
      () =>
        templates.filter((template) => isChartTypeAvailable(template, columns)),
      [columns, templates],
    );

    const selectedTemplate = useMemo(
      () => availableTemplates.find((template) => template.id === value),
      [availableTemplates, value],
    );

    return (
      <div className="space-y-2">
        <Label className="text-xs">Chart Type</Label>
        <Select value={value} onValueChange={onChange}>
          <SelectTrigger className="h-8 text-xs">
            {selectedTemplate ? (
              <div className="flex items-center gap-2">
                <selectedTemplate.icon className="h-3.5 w-3.5" />
                <span>{selectedTemplate.label}</span>
              </div>
            ) : (
              <SelectValue placeholder="Select chart type" />
            )}
          </SelectTrigger>
          <SelectContent className="text-xs">
            {availableTemplates.map((template) => (
              <SelectItem key={template.id} value={template.id}>
                <div className="flex items-center gap-2">
                  <template.icon className="h-3.5 w-3.5" />
                  <span>{template.label}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  },
);

ChartTypeSelector.displayName = 'ChartTypeSelector';
