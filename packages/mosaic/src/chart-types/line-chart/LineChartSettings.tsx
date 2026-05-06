import {useCallback, type FC} from 'react';
import {FieldSelector} from '../../chart-builders/FieldSelector';
import {ColumnSelector} from '../../chart-builders/ColumnSelector';
import {MultiFieldSelector} from '../../chart-builders/MultiFieldSelector';
import {TemporalGranularitySelector} from '../../chart-builders/TemporalGranularitySelector';
import type {ChartBuilderColumn} from '../../chart-builders/types';
import type {LineChartSettings} from './schema';
import {
  QUANTITATIVE_COLUMN_TYPES,
  NUMERIC_COLUMN_TYPES,
} from '../../chart-builders/constants';

export interface LineChartSettingsComponentProps {
  columns: ChartBuilderColumn[];
  values: LineChartSettings;
  onChange: (values: LineChartSettings) => void;
}

/**
 * Explicit settings component for line chart.
 * Composes primitive and compound components for full control over the UI.
 */
export const LineChartSettingsComponent: FC<
  LineChartSettingsComponentProps
> = ({columns, values, onChange}) => {
  const updateField = useCallback(
    (key: keyof LineChartSettings, value: any) => {
      onChange({...values, [key]: value});
    },
    [values, onChange],
  );

  return (
    <div className="space-y-4">
      {/* X Axis */}
      <FieldSelector label="X Axis" required>
        <ColumnSelector
          columns={columns}
          types={QUANTITATIVE_COLUMN_TYPES}
          value={values.x}
          onChange={(x) => updateField('x', x)}
        />
        {values.x && (
          <TemporalGranularitySelector
            value={values.xInterval}
            onChange={(xInterval) => updateField('xInterval', xInterval)}
            xFieldType={columns.find((c) => c.name === values.x)?.type}
          />
        )}
      </FieldSelector>

      {/* Y Axes */}
      <MultiFieldSelector
        label="Y Axes"
        required
        columns={columns}
        types={NUMERIC_COLUMN_TYPES}
        value={values.yFields || []}
        onChange={(yFields) => updateField('yFields', yFields)}
        showAggregation={Boolean(values.xInterval)}
      />
    </div>
  );
};
