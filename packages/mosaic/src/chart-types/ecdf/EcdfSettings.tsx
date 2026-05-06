import {useCallback, type FC} from 'react';
import {FieldSelector} from '../../chart-builders/FieldSelector';
import {ColumnSelector} from '../../chart-builders/ColumnSelector';
import type {ChartBuilderColumn} from '../../chart-builders/types';
import type {EcdfChartSettings} from './schema';
import {QUANTITATIVE_COLUMN_TYPES} from '../../chart-builders/constants';

export interface EcdfSettingsComponentProps {
  columns: ChartBuilderColumn[];
  values: EcdfChartSettings;
  onChange: (values: EcdfChartSettings) => void;
}

export const EcdfSettingsComponent: FC<EcdfSettingsComponentProps> = ({
  columns,
  values,
  onChange,
}) => {
  const updateField = useCallback(
    (key: keyof EcdfChartSettings, value: any) => {
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
