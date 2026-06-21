import {type FC} from 'react';
import {Field} from '../../../components/Field';
import {ColumnSelector} from '../../../components/ColumnSelector';
import {useMosaicChartSettingsContext} from '../../chart-settings/MosaicChartSettingsContext';

export const ScatterPlotSettingsComponent: FC = () => {
  const {onChangeConfig, config} =
    useMosaicChartSettingsContext('scatter-plot');

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

      <Field label="Size Field">
        <ColumnSelector.Numeric
          value={config.settings.size}
          onChange={(size) => onChangeConfig('size', size)}
          placeholder="(optional)"
        />
      </Field>
    </div>
  );
};
