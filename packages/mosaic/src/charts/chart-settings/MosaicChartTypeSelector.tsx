import {type FC, memo, useMemo} from 'react';
import {ChartNoAxesCombined} from 'lucide-react';
import {Combobox} from '@sqlrooms/ui';
import {type ChartType} from '../chart-types/base-types';
import {useStoreWithMosaicDashboard} from '../../dashboard/MosaicDashboardSlice';

interface MosaicChartTypeSelectorProps {
  value: ChartType;
  onChange: (chartType: ChartType) => void;
}

export const MosaicChartTypeSelector: FC<MosaicChartTypeSelectorProps> = memo(
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
      <Combobox value={value} onChange={onChange}>
        <Combobox.Trigger className="w-full" ariaLabel="Chart type">
          {selectedChartType ? (
            <div className="flex items-center gap-2">
              <SelectedChartTypeIcon className="h-3.5 w-3.5" />
              <span>{selectedChartType.label}</span>
            </div>
          ) : (
            <span className="text-muted-foreground">Select chart type</span>
          )}
        </Combobox.Trigger>
        <Combobox.Content
          searchable
          searchPlaceholder="Search chart types..."
          emptyMessage="No matching chart type."
        >
          {chartTypes?.map((chartType) => {
            const Icon = chartType.icon ?? ChartNoAxesCombined;
            return (
              <Combobox.Item
                key={chartType.id}
                value={chartType.id}
                keywords={[chartType.label ?? chartType.id]}
              >
                <Icon className="mr-2 h-3.5 w-3.5 shrink-0" />
                <span className="truncate text-xs">
                  {chartType.label ?? chartType.id}
                </span>
              </Combobox.Item>
            );
          })}
        </Combobox.Content>
      </Combobox>
    );
  },
);

MosaicChartTypeSelector.displayName = 'MosaicChartTypeSelector';
