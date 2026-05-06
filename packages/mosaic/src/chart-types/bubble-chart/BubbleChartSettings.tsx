import {useCallback, type FC} from 'react';
import {FieldSelector} from '../../chart-builders/FieldSelector';
import {ColumnSelector} from '../../chart-builders/ColumnSelector';
import type {ChartBuilderColumn} from '../../chart-builders/types';
import type {BubbleChartSettings} from './schema';
import {NUMERIC_COLUMN_TYPES} from '../../chart-builders/constants';

export interface BubbleChartSettingsComponentProps {
  columns: ChartBuilderColumn[];
  values: BubbleChartSettings;
  onChange: (values: BubbleChartSettings) => void;
}

export const BubbleChartSettingsComponent: FC<
  BubbleChartSettingsComponentProps
> = ({columns, values, onChange}) => {
  const updateField = useCallback(
    (key: keyof BubbleChartSettings, value: any) => {
      onChange({...values, [key]: value});
    },
    [values, onChange],
  );

  return (
    <div className="space-y-4">
      <FieldSelector label="X Field" required>
        <ColumnSelector
          columns={columns}
          types={NUMERIC_COLUMN_TYPES}
          value={values.x}
          onChange={(x) => updateField('x', x)}
        />
      </FieldSelector>

      <FieldSelector label="Y Field" required>
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
