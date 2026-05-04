import {type FC, memo} from 'react';
import {useChartFieldForm} from '../../chart-builders/hooks/useChartFieldForm';
import {FieldSelectorInput} from '../../chart-builders/FieldSelectorInput';
import {MultiFieldSelector} from '../../chart-builders/MultiFieldSelector';
import type {
  ChartTypeDefinition,
  ChartBuilderColumn,
} from '../../chart-builders/types';

interface DynamicChartSettingsProps {
  chartTypeDefinition: ChartTypeDefinition;
  columns: ChartBuilderColumn[];
  values: Record<string, unknown>;
  onChange: (values: Record<string, unknown>) => void;
}

export const DynamicChartSettings: FC<DynamicChartSettingsProps> = memo(
  ({chartTypeDefinition, columns, values, onChange}) => {
    const {fields, handleFieldChange} = useChartFieldForm({
      fields: chartTypeDefinition.fields,
      values,
      onChange: (key, value) => {
        onChange({...values, [key]: value});
      },
    });

    if (fields.length === 0) {
      return (
        <div className="text-muted-foreground text-sm">
          No settings available for this chart type
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {fields.map((field) => {
          if (field.multiple) {
            // Render MultiFieldSelector for multiple fields
            const fieldValue = values[field.key] as
              | Array<{field: string; color?: string}>
              | undefined;

            return (
              <MultiFieldSelector
                key={field.key}
                label={field.label}
                columns={columns}
                types={field.types}
                value={fieldValue || []}
                onChange={(value) => handleFieldChange(field.key, value)}
                required={field.required}
              />
            );
          }

          // Render FieldSelectorInput for single fields
          return (
            <FieldSelectorInput
              key={field.key}
              field={field}
              columns={columns}
              value={values[field.key] as string}
              onChange={(value) => handleFieldChange(field.key, value)}
            />
          );
        })}
      </div>
    );
  },
);

DynamicChartSettings.displayName = 'DynamicChartSettings';
