import {type FC, memo, useMemo} from 'react';
import {useChartFieldForm} from '../../chart-builders/hooks/useChartFieldForm';
import {FieldSelectorInput} from '../../chart-builders/FieldSelectorInput';
import {MultiFieldSelector} from '../../chart-builders/MultiFieldSelector';
import {SingleFieldSelector} from '../../chart-builders/SingleFieldSelector';
import type {
  ChartTypeDefinition,
  ChartBuilderColumn,
} from '../../chart-builders/types';
import type {
  YFieldConfig,
  TemporalInterval,
} from '../../chart-types/line-chart/schema';

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

    // Get X field type for temporal detection
    const xFieldName = values.x as string | undefined;
    const xFieldType = useMemo(() => {
      if (!xFieldName) return undefined;
      const col = columns.find((c) => c.name === xFieldName);
      return col?.type;
    }, [xFieldName, columns]);

    // Check if temporal aggregation is active
    const xInterval = values.xInterval as string | undefined;
    const showAggregation = Boolean(xInterval);

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
          // Render X field selector
          if (field.key === 'x') {
            const showTemporalSelector =
              chartTypeDefinition.id === 'line-chart' && Boolean(xFieldType);

            return (
              <SingleFieldSelector
                key={field.key}
                field={field}
                columns={columns}
                value={values[field.key] as string}
                onChange={(value) => handleFieldChange(field.key, value)}
                showTemporalSelector={showTemporalSelector}
                xFieldType={xFieldType}
                temporalValue={xInterval as TemporalInterval | undefined}
                onTemporalChange={(value) =>
                  handleFieldChange('xInterval', value)
                }
              />
            );
          }

          // Render Y fields with aggregation support
          if (field.multiple) {
            const fieldValue =
              (values[field.key] as YFieldConfig[] | undefined) || [];

            return (
              <MultiFieldSelector
                key={field.key}
                label={field.label}
                columns={columns}
                types={field.types}
                value={fieldValue}
                onChange={(value) => handleFieldChange(field.key, value)}
                required={field.required}
                showAggregation={showAggregation}
              />
            );
          }

          // Render other single fields
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
