import {cn} from '@sqlrooms/ui';
import React, {useMemo} from 'react';
import {
  useChartBuilderContext,
  useChartBuilderStore,
} from './ChartBuilderContext';
import {FieldSelectorInput} from './FieldSelectorInput';

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

  const selectedTemplate = useMemo(
    () => templates.find((template) => template.id === selectedTemplateId),
    [templates, selectedTemplateId],
  );

  if (!selectedTemplate) return null;

  if (selectedTemplate.fields.length === 0) {
    return (
      <p className={cn('text-muted-foreground py-2 text-sm', className)}>
        This chart type has no configurable fields. A starter spec will be
        created that you can edit manually.
      </p>
    );
  }

  return (
    <div className={cn('flex flex-col gap-4 py-2', className)}>
      {selectedTemplate.fields.map((field) => (
        <FieldSelectorInput
          key={field.key}
          field={field}
          columns={columns}
          value={fieldValues[field.key]}
          onChange={(value) => setFieldValue(field.key, value)}
        />
      ))}
    </div>
  );
};
