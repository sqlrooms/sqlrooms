import {type FC} from 'react';
import {Field} from '../../../components/Field';
import {Switch} from '@sqlrooms/ui';
import {useMosaicChartSettingsContext} from '../../chart-settings/MosaicChartSettingsContext';
import {LineChartYFieldsSelector} from './LineChartYFieldsSelector';
import {LineChartXFieldSelector} from './LineChartXFieldSelector';

/**
 * Explicit settings component for line chart.
 * Composes primitive and compound components for full control over the UI.
 */
export const LineChartSettingsComponent: FC = () => {
  const {onChangeConfig, config} = useMosaicChartSettingsContext('line-chart');

  return (
    <div className="space-y-4">
      <Field label="X Axis" required>
        <LineChartXFieldSelector />
      </Field>

      <Field label="Y Axis" required>
        <LineChartYFieldsSelector />
      </Field>

      <label className="flex cursor-pointer items-center gap-2">
        <Switch
          checked={config.settings.showLegend ?? true}
          onCheckedChange={(showLegend) =>
            onChangeConfig('showLegend', showLegend)
          }
          className="h-4 w-7 data-[state=checked]:bg-gray-800 data-[state=unchecked]:bg-gray-300"
        >
          <Switch.Thumb className="h-3 w-3 data-[state=checked]:translate-x-3 data-[state=checked]:bg-white data-[state=unchecked]:bg-gray-800" />
        </Switch>
        <span className="text-xs">Show Legend</span>
      </label>
    </div>
  );
};
