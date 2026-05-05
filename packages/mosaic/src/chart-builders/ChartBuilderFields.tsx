import {cn} from '@sqlrooms/ui';
import React, {useCallback, useMemo} from 'react';
import {
  useChartBuilderContext,
  useChartBuilderStore,
} from './ChartBuilderContext';
import {DynamicChartSettings} from '../dashboard/chart-settings/DynamicChartSettings';
import {toChartTypeDefinition} from './types';

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
    (newValues: Record<string, unknown>) => {
      // Update all changed values
      Object.entries(newValues).forEach(([key, value]) => {
        if (fieldValues[key] !== value) {
          setFieldValue(key, value);
        }
      });
    },
    [fieldValues, setFieldValue],
  );

  if (!chartTypeDefinition) return null;

  if (chartTypeDefinition.fields.length === 0) {
    return (
      <p className={cn('text-muted-foreground py-2 text-sm', className)}>
        This chart type has no configurable fields. A starter spec will be
        created that you can edit manually.
      </p>
    );
  }

  return (
    <div className={cn('flex flex-col gap-4 py-2', className)}>
      <DynamicChartSettings
        chartTypeDefinition={chartTypeDefinition}
        columns={columns}
        values={fieldValues}
        onChange={handleChange}
      />
    </div>
  );
};
