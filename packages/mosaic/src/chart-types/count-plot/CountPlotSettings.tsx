import {useCallback, type FC} from 'react';
import {FieldSelector} from '../../chart-builders/FieldSelector';
import {ColumnSelector} from '../../chart-builders/ColumnSelector';
import type {ChartBuilderColumn} from '../../chart-builders/types';
import type {CountPlotChartSettings} from './schema';
import {QUANTITATIVE_COLUMN_TYPES} from '../../chart-builders/constants';

export interface CountPlotSettingsComponentProps {
  columns: ChartBuilderColumn[];
  values: CountPlotChartSettings;
  onChange: (values: CountPlotChartSettings) => void;
}

export const CountPlotSettingsComponent: FC<
  CountPlotSettingsComponentProps
> = ({columns, values, onChange}) => {
  const updateField = useCallback(
    (key: keyof CountPlotChartSettings, value: any) => {
      onChange({...values, [key]: value});
    },
    [values, onChange],
  );

  return (
    <div className="space-y-4">
      <FieldSelector label="Field" required>
        <ColumnSelector
          columns={columns}
          types={QUANTITATIVE_COLUMN_TYPES}
          value={values.field}
          onChange={(field) => updateField('field', field)}
        />
      </FieldSelector>
    </div>
  );
};
