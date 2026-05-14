import {type FC} from 'react';
import {Field} from '../../chart-builders/Field';
import {ColumnSelector} from '../../chart-builders/ColumnSelector';
import {useChartSettingsContext} from '../../chart/chart-settings/ChartSettingsContext';

export const BubbleChartSettingsComponent: FC = () => {
  const {onChangeConfig, config} = useChartSettingsContext('bubble-chart');

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
