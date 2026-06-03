import {type FC} from 'react';
import {Field} from '../../../components/Field';
import {ColumnSelector} from '../../../components/ColumnSelector';
import {useMosaicChartSettingsContext} from '../../chart-settings/MosaicChartSettingsContext';

export const CountPlotSettingsComponent: FC = () => {
  const {onChangeConfig, config} = useMosaicChartSettingsContext('count-plot');

  return (
    <div className="space-y-4">
      <Field label="Field" required>
        <ColumnSelector.Categorical
          value={config.settings.field}
          onChange={(field) => onChangeConfig('field', field)}
        />
      </Field>
    </div>
  );
};
