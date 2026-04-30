import {FC} from 'react';
import {XFieldSelector} from './XFieldSelector';
import {YFieldSelector} from './YFieldSelector';
import {NUMERIC_COLUMN_TYPES} from '../../chart-builders/chartTypeUtils';
import type {BoxPlotChartSettings} from '../ChartSchemas';
import type {TableColumn} from '@sqlrooms/duckdb';

interface BoxPlotSettingsProps {
  settings: BoxPlotChartSettings;
  columns: TableColumn[];
  onChange: (values: BoxPlotChartSettings) => void;
}

export const BoxPlotSettings: FC<BoxPlotSettingsProps> = ({
  settings,
  columns,
  onChange,
}) => {
  return (
    <div className="space-y-4">
      <XFieldSelector
        label="X Field (categorical)"
        value={settings.x}
        columns={columns}
        onChange={(newX) => onChange({...settings, x: newX})}
      />
      <YFieldSelector
        label="Y Field (numeric)"
        value={settings.y}
        columns={columns}
        onChange={(newY) => onChange({...settings, y: newY})}
        filterTypes={NUMERIC_COLUMN_TYPES}
      />
    </div>
  );
};
