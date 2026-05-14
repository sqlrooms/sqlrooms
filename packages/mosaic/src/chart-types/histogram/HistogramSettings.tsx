import {type FC} from 'react';
import {Field} from '../../chart-builders/Field';
import {ColumnSelector} from '../../chart-builders/ColumnSelector';
import {useChartSettingsContext} from '../../chart/chart-settings/ChartSettingsContext';

export const HistogramSettingsComponent: FC = () => {
  const {onChangeConfig, config} = useChartSettingsContext('histogram');

  return (
    <div className="space-y-4">
      <Field label="Field" required>
        <ColumnSelector.Quantitative
          value={config.settings.field}
          onChange={(field) => onChangeConfig('field', field)}
        />
      </Field>
    </div>
  );
};
