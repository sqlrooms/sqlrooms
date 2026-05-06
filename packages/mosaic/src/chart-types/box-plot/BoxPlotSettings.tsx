import {useCallback, type FC} from 'react';
import {FieldSelector} from '../../chart-builders/FieldSelector';
import {ColumnSelector} from '../../chart-builders/ColumnSelector';
import type {ChartBuilderColumn} from '../../chart-builders/types';
import type {BoxPlotChartSettings} from './schema';
import {NUMERIC_COLUMN_TYPES} from '../../chart-builders/constants';

export interface BoxPlotSettingsComponentProps {
  columns: ChartBuilderColumn[];
  values: BoxPlotChartSettings;
  onChange: (values: BoxPlotChartSettings) => void;
}

export const BoxPlotSettingsComponent: FC<BoxPlotSettingsComponentProps> = ({
  columns,
  values,
  onChange,
}) => {
  const updateField = useCallback(
    (key: keyof BoxPlotChartSettings, value: any) => {
      onChange({...values, [key]: value});
    },
    [values, onChange],
  );

  return (
    <div className="space-y-4">
      <FieldSelector label="X Field (categorical)" required>
        <ColumnSelector
          columns={columns}
          value={values.x}
          onChange={(x) => updateField('x', x)}
        />
      </FieldSelector>

      <FieldSelector label="Y Field (numeric)" required>
        <ColumnSelector
          columns={columns}
          types={NUMERIC_COLUMN_TYPES}
          value={values.y}
          onChange={(y) => updateField('y', y)}
        />
      </FieldSelector>
    </div>
  );
};
