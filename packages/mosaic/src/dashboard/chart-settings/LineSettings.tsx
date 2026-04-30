import {FC} from 'react';
import {XFieldSelector} from './XFieldSelector';
import {YFieldSelector} from './YFieldSelector';
import {
  QUANTITATIVE_COLUMN_TYPES,
  NUMERIC_COLUMN_TYPES,
} from '../../chart-builders/chartTypeUtils';
import type {LineChartSettings} from '../ChartSchemas';
import type {TableColumn} from '@sqlrooms/duckdb';

interface LineSettingsProps {
  settings: LineChartSettings;
  columns: TableColumn[];
  onChange: (values: LineChartSettings) => void;
}

export const LineSettings: FC<LineSettingsProps> = ({
  settings,
  columns,
  onChange,
}) => {
  return (
    <div className="space-y-4">
      <XFieldSelector
        value={settings.x}
        columns={columns}
        onChange={(newX) => onChange({...settings, x: newX})}
        filterTypes={QUANTITATIVE_COLUMN_TYPES}
      />
      <YFieldSelector
        value={settings.y}
        columns={columns}
        onChange={(newY) => onChange({...settings, y: newY})}
        filterTypes={NUMERIC_COLUMN_TYPES}
      />
    </div>
  );
};
