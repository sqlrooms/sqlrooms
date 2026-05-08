import {cn} from '@sqlrooms/ui';
import React, {useCallback, useMemo} from 'react';
import {
  useChartBuilderContext,
  useChartBuilderStore,
} from './ChartBuilderContext';
import {toChartTypeDefinition} from './types';
import {ChartSettingsProvider} from '../dashboard/chart-settings/ChartSettingsContext';
import type {VgPlotChartConfig} from '../chart-types';

export interface ChartBuilderFieldsProps {
  className?: string;
}

export const ChartBuilderFields: React.FC<ChartBuilderFieldsProps> = ({
  className,
}) => {
  const {columns, templates} = useChartBuilderContext();
  const selectedTemplateId = useChartBuilderStore(
    (state) => state.selectedTemplateId,
  );
  const fieldValues = useChartBuilderStore((state) => state.fieldValues);
  const setFieldValue = useChartBuilderStore((state) => state.setFieldValue);

  const selectedTemplate = React.useMemo(
    () => templates.find((template) => template.id === selectedTemplateId),
    [templates, selectedTemplateId],
  );

  // Convert template to chart type definition
  const chartTypeDefinition = useMemo(() => {
    return selectedTemplate ? toChartTypeDefinition(selectedTemplate) : null;
  }, [selectedTemplate]);

  const handleChange = useCallback(
    (config: VgPlotChartConfig) => {
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
  const config: VgPlotChartConfig = useMemo(() => {
    if (!chartTypeDefinition) {
      return {
        chartType: 'histogram',
        settings: {},
      };
    }
    return {
      chartType: chartTypeDefinition.id,
      settings: fieldValues,
    } as VgPlotChartConfig;
  }, [chartTypeDefinition, fieldValues]);

  if (!chartTypeDefinition) return null;

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
