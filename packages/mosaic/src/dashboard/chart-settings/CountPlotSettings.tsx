import {FC} from 'react';
import {FieldSelector} from './FieldSelector';
import {QUANTITATIVE_COLUMN_TYPES} from '../../chart-builders/chartTypeUtils';
import type {CountPlotChartSettings} from '../ChartSchemas';
import type {TableColumn} from '@sqlrooms/duckdb';

interface CountPlotSettingsProps {
  settings: CountPlotChartSettings;
  columns: TableColumn[];
  onChange: (values: CountPlotChartSettings) => void;
}

export const CountPlotSettings: FC<CountPlotSettingsProps> = ({
  settings,
  columns,
  onChange,
}) => {
  return (
    <div className="space-y-4">
      <FieldSelector
        value={settings.field}
        columns={columns}
        onChange={(newField) => onChange({...settings, field: newField})}
        filterTypes={QUANTITATIVE_COLUMN_TYPES}
      />
    </div>
  );
};
