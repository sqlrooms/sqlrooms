import {useCallback, type FC} from 'react';
import {FieldSelector} from '../../chart-builders/FieldSelector';
import {ColumnSelector} from '../../chart-builders/ColumnSelector';
import type {ChartBuilderColumn} from '../../chart-builders/types';
import type {HeatmapChartSettings} from './schema';
import {NUMERIC_COLUMN_TYPES} from '../../chart-builders/constants';

export interface HeatmapSettingsComponentProps {
  columns: ChartBuilderColumn[];
  values: HeatmapChartSettings;
  onChange: (values: HeatmapChartSettings) => void;
}

export const HeatmapSettingsComponent: FC<HeatmapSettingsComponentProps> = ({
  columns,
  values,
  onChange,
}) => {
  const updateField = useCallback(
    (key: keyof HeatmapChartSettings, value: any) => {
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
