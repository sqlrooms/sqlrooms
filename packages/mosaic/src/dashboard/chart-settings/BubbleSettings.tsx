import {FC} from 'react';
import {XFieldSelector} from './XFieldSelector';
import {YFieldSelector} from './YFieldSelector';
import {NUMERIC_COLUMN_TYPES} from '../../chart-builders/chartTypeUtils';
import type {BubbleChartSettings} from '../ChartSchemas';
import type {TableColumn} from '@sqlrooms/duckdb';

interface BubbleSettingsProps {
  settings: BubbleChartSettings;
  columns: TableColumn[];
  onChange: (values: BubbleChartSettings) => void;
}

export const BubbleSettings: FC<BubbleSettingsProps> = ({
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
        filterTypes={NUMERIC_COLUMN_TYPES}
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
