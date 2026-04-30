import {FC} from 'react';
import {FieldSelector} from './FieldSelector';
import {QUANTITATIVE_COLUMN_TYPES} from '../../chart-builders/chartTypeUtils';
import type {HistogramChartSettings} from '../ChartSchemas';
import type {TableColumn} from '@sqlrooms/duckdb';

interface HistogramSettingsProps {
  settings: HistogramChartSettings;
  columns: TableColumn[];
  onChange: (values: HistogramChartSettings) => void;
}

export const HistogramSettings: FC<HistogramSettingsProps> = ({
  settings,
  columns,
  onChange,
}) => {
  return (
    <div className="space-y-4">
      <FieldSelector
        value={settings.field}
        columns={columns}
        onChange={(newField) =>
          onChange({
            ...settings,
            field: newField,
          })
        }
        filterTypes={QUANTITATIVE_COLUMN_TYPES}
      />
    </div>
  );
};
