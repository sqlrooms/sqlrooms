import {useCallback, type FC} from 'react';
import {FieldSelector} from '../../chart-builders/FieldSelector';
import {ColumnSelector} from '../../chart-builders/ColumnSelector';
import {QUANTITATIVE_COLUMN_TYPES} from '../../chart-builders/constants';
import {useChartSettingsContext} from '../../dashboard/chart-settings/ChartSettingsContext';

export const HistogramSettingsComponent: FC = () => {
  const {columns, onChange, config} = useChartSettingsContext('histogram');

  const handleOnChange = useCallback(
    (field: string) => {
      onChange({
        ...config,
        settings: {
          ...config.settings,
          field,
        },
      });
    },
    [onChange, config],
  );

  return (
    <div className="space-y-4">
      <FieldSelector label="Field" required>
        <ColumnSelector
          columns={columns}
          types={QUANTITATIVE_COLUMN_TYPES}
          value={config.settings.field}
          onChange={handleOnChange}
        />
      </FieldSelector>
    </div>
  );
};
