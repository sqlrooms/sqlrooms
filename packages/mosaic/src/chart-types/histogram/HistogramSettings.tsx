import {type FC} from 'react';
import {Field} from '../../chart-builders/Field';
import {QuantitativeColumnSelector} from '../../chart-builders/ColumnSelector';
import {useChartSettingsContext} from '../../dashboard/chart-settings/ChartSettingsContext';

export const HistogramSettingsComponent: FC = () => {
  const {onChangeConfig, config} = useChartSettingsContext('histogram');

  return (
    <div className="space-y-4">
      <Field label="Field" required>
        <QuantitativeColumnSelector
          value={config.settings.field}
          onChange={(field) => onChangeConfig('field', field)}
        />
      </Field>
    </div>
  );
};
