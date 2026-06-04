import {type FC} from 'react';
import {Field} from '../../../components/Field';
import {ColumnSelector} from '../../../components/ColumnSelector';
import {useMosaicChartSettingsContext} from '../../chart-settings/MosaicChartSettingsContext';

export const BubbleChartSettingsComponent: FC = () => {
  const {onChangeConfig, config} =
    useMosaicChartSettingsContext('bubble-chart');

  return (
    <div className="space-y-4">
      <Field label="X Field" required>
        <ColumnSelector.Numeric
          value={config.settings.x}
          onChange={(x) => onChangeConfig('x', x)}
        />
      </Field>

      <Field label="Y Field" required>
        <ColumnSelector.Numeric
          value={config.settings.y}
          onChange={(y) => onChangeConfig('y', y)}
        />
      </Field>
    </div>
  );
};
