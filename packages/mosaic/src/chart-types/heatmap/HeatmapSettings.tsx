import {type FC} from 'react';
import {Field} from '../../chart-builders/Field';
import {NumericColumnSelector} from '../../chart-builders/ColumnSelector';
import {useChartSettingsContext} from '../../chart/chart-settings/ChartSettingsContext';

export const HeatmapSettingsComponent: FC = () => {
  const {onChangeConfig, config} = useChartSettingsContext('heatmap');

  return (
    <div className="space-y-4">
      <Field label="X Field" required>
        <NumericColumnSelector
          value={config.settings.x}
          onChange={(x) => onChangeConfig('x', x)}
        />
      </Field>

      <Field label="Y Field" required>
        <NumericColumnSelector
          value={config.settings.y}
          onChange={(y) => onChangeConfig('y', y)}
        />
      </Field>
    </div>
  );
};
