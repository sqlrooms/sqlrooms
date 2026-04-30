import {FC} from 'react';
import {FieldSelector} from './FieldSelector';
import {QUANTITATIVE_COLUMN_TYPES} from '../../chart-builders/chartTypeUtils';
import type {EcdfChartSettings} from '../ChartSchemas';
import type {TableColumn} from '@sqlrooms/duckdb';

interface EcdfSettingsProps {
  settings: EcdfChartSettings;
  columns: TableColumn[];
  onChange: (values: EcdfChartSettings) => void;
}

export const EcdfSettings: FC<EcdfSettingsProps> = ({
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
