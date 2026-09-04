import {type FC} from 'react';
import {Field} from '../../../components/Field';
import {Combobox, Switch} from '@sqlrooms/ui';
import {useMosaicChartSettingsContext} from '../../chart-settings/MosaicChartSettingsContext';
import {LineChartYFieldsSelector} from './LineChartYFieldsSelector';
import {LineChartXFieldSelector} from './LineChartXFieldSelector';

/**
 * Explicit settings component for line chart.
 * Numeric series are saved in the chart config while count mode is active, so
 * switching back restores aggregations and colors even after reopening it.
 */
export const LineChartSettingsComponent: FC = () => {
  const {onChange, onChangeConfig, config} =
    useMosaicChartSettingsContext('line-chart');
  const metric = config.settings.metric ?? 'aggregate';

  return (
    <div className="space-y-4">
      <Field label="X Axis" required>
        <LineChartXFieldSelector />
      </Field>

      <Field label="Y Metric">
        <Combobox
          value={metric}
          onChange={(value) => {
            if (value !== 'count' && value !== 'aggregate') return;
            if (value === metric) return;
            const {lastAggregateYFields, ...chartConfig} = config;
            onChange({
              ...chartConfig,
              ...(value === 'count'
                ? {lastAggregateYFields: config.settings.yFields}
                : {}),
              settings: {
                ...config.settings,
                metric: value,
                yFields:
                  value === 'count'
                    ? []
                    : (lastAggregateYFields ?? config.settings.yFields),
              },
            });
          }}
        >
          <Combobox.Trigger className="shadow-none">
            {metric === 'count' ? 'Row count' : 'Numeric fields'}
          </Combobox.Trigger>
          <Combobox.Content>
            <Combobox.Item value="aggregate">Numeric fields</Combobox.Item>
            <Combobox.Item value="count">Row count</Combobox.Item>
          </Combobox.Content>
        </Combobox>
      </Field>

      {metric === 'aggregate' && (
        <Field label="Y Axis" required>
          <LineChartYFieldsSelector />
        </Field>
      )}

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
