import {type FC, memo, useMemo} from 'react';
import {
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@sqlrooms/ui';
import {ChartNoAxesCombined} from 'lucide-react';
import {type ChartType} from '../../chart-types/base-types';
import {useStoreWithMosaicDashboard} from '../../dashboard/MosaicDashboardSlice';

interface ChartTypeSelectorProps {
  value: ChartType;
  onChange: (chartType: ChartType) => void;
}

export const ChartTypeSelector: FC<ChartTypeSelectorProps> = memo(
  ({value, onChange}) => {
    const chartTypes = useStoreWithMosaicDashboard(
      (state) => state.mosaicDashboard.chartTypes,
    );

    const selectedChartType = useMemo(
      () => chartTypes?.find((chartType) => chartType.id === value),
      [chartTypes, value],
    );

    const SelectedChartTypeIcon =
      selectedChartType?.icon ?? ChartNoAxesCombined;

    return (
      <div className="space-y-2">
        <Label className="text-xs">Chart Type</Label>
        <Select value={value} onValueChange={onChange}>
          <SelectTrigger className="h-8 text-xs">
            {selectedChartType ? (
              <div className="flex items-center gap-2">
                <SelectedChartTypeIcon className="h-3.5 w-3.5" />
                <span>{selectedChartType.label}</span>
              </div>
            ) : (
              <SelectValue placeholder="Select chart type" />
            )}
          </SelectTrigger>
          <SelectContent className="text-xs">
            {chartTypes?.map((chartType) => {
              const Icon = chartType.icon ?? ChartNoAxesCombined;
              return (
                <SelectItem key={chartType.id} value={chartType.id}>
                  <div className="flex items-center gap-2 text-xs">
                    <Icon className="h-3.5 w-3.5" />
                    <span>{chartType.label}</span>
                  </div>
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      </div>
    );
  },
);

ChartTypeSelector.displayName = 'ChartTypeSelector';
