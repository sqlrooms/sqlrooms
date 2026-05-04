import {FC} from 'react';
import {useChartFieldForm} from '../../chart-builders/hooks/useChartFieldForm';
import {FieldSelectorInput} from '../../chart-builders/FieldSelectorInput';
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

export const DynamicChartSettings: FC<DynamicChartSettingsProps> = ({
  chartTypeDefinition,
  columns,
  values,
  onChange,
}) => {
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
      {fields.map((field) => (
        <FieldSelectorInput
          key={field.key}
          field={field}
          columns={columns}
          value={values[field.key] as string}
          onChange={(value) => handleFieldChange(field.key, value)}
        />
      ))}
    </div>
  );
};
