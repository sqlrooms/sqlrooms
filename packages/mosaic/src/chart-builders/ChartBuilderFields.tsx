import {cn} from '@sqlrooms/ui';
import {FC, useCallback, useMemo} from 'react';
import {
  useChartBuilderContext,
  useChartBuilderStore,
} from './ChartBuilderContext';
import {ChartSettingsProvider} from '../chart/chart-settings/ChartSettingsContext';
import type {ChartConfig} from '../chart-types';

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
  const setFieldValue = useChartBuilderStore((state) => state.setFieldValue);

  const chartTypeDefinition = useMemo(
    () => templates.find((template) => template.id === chartTypeDefinitionId),
    [templates, chartTypeDefinitionId],
  );

  const handleChange = useCallback(
    (config: ChartConfig) => {
      // Update all changed values from settings
      Object.entries(config.settings).forEach(([key, value]) => {
        if (fieldValues[key] !== value) {
          setFieldValue(key, value);
        }
      });
    },
    [fieldValues, setFieldValue],
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
      chartType: chartTypeDefinition.id,
      settings: fieldValues,
    } as ChartConfig;
  }, [chartTypeDefinition, fieldValues]);

  if (!chartTypeDefinition) {
    return null;
  }

  const SettingsComponent = chartTypeDefinition.settingsComponent;
  return (
    <div className={cn('flex flex-col gap-4 py-2', className)}>
      <ChartSettingsProvider
        config={config}
        columns={columns}
        onChange={handleChange}
      >
        <SettingsComponent />
      </ChartSettingsProvider>
    </div>
  );
};
