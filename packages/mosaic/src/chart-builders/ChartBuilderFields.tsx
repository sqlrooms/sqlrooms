import {cn} from '@sqlrooms/ui';
import {FC, useMemo} from 'react';
import {
  useChartBuilderContext,
  useChartBuilderStore,
} from './ChartBuilderContext';
import {MosaicChartSettingsProvider} from '../charts/chart-settings/MosaicChartSettingsContext';
import type {ChartConfig} from '../charts/chart-types';

export interface ChartBuilderFieldsProps {
  className?: string;
}

export const ChartBuilderFields: FC<ChartBuilderFieldsProps> = ({
  className,
}) => {
  const {columns, templates} = useChartBuilderContext();
  const chartTypeDefinitionId = useChartBuilderStore(
    (state) => state.selectedTemplateId,
  );
  const fieldValues = useChartBuilderStore((state) => state.fieldValues);
  const chartOptions = useChartBuilderStore((state) => state.chartOptions);
  const setConfig = useChartBuilderStore((state) => state.setConfig);

  const chartTypeDefinition = useMemo(
    () => templates.find((template) => template.id === chartTypeDefinitionId),
    [templates, chartTypeDefinitionId],
  );

  // Create a config object for the context
  const config: ChartConfig = useMemo(() => {
    if (!chartTypeDefinition) {
      return {
        chartType: 'histogram',
        settings: {},
      };
    }
    return {
      ...chartOptions,
      chartType: chartTypeDefinition.id,
      settings: fieldValues,
    } as ChartConfig;
  }, [chartTypeDefinition, fieldValues, chartOptions]);

  if (!chartTypeDefinition) {
    return null;
  }

  const SettingsComponent = chartTypeDefinition.settingsComponent;
  return (
    <div className={cn('flex flex-col gap-4 py-2', className)}>
      <MosaicChartSettingsProvider
        config={config}
        columns={columns}
        onChange={setConfig}
      >
        <SettingsComponent />
      </MosaicChartSettingsProvider>
    </div>
  );
};
