import {type FC} from 'react';
import {Field} from '../../../components/Field';
import {ColumnSelector} from '../../../components/ColumnSelector';
import {Switch} from '@sqlrooms/ui';
import {TemporalGranularitySelector} from '../../../components/TemporalGranularitySelector';
import {useMosaicChartSettingsContext} from '../../chart-settings/MosaicChartSettingsContext';
import {MultiFieldSelector} from '../../../components/MultiFieldSelector';
import {isTemporalType} from '../../../column-types-utils';
import {useColumnsContext} from '../../../components/ColumnsContext';

/**
 * Explicit settings component for line chart.
 * Composes primitive and compound components for full control over the UI.
 */
export const LineChartSettingsComponent: FC = () => {
  const {onChangeConfig, config} = useMosaicChartSettingsContext('line-chart');
  const {columns} = useColumnsContext();

  const xColumn = columns.find((c) => c.name === config.settings.x);
  const isXFieldTemporal = xColumn && isTemporalType(xColumn.type);

  return (
    <div className="space-y-4">
      <Field label="X Axis" required>
        <div
          className="grid items-end gap-2"
          style={{
            gridTemplateColumns: isXFieldTemporal
              ? 'minmax(120px, 1fr) 100px'
              : '1fr',
          }}
        >
          <ColumnSelector.Quantitative
            value={config.settings.x}
            onChange={(x) => onChangeConfig('x', x)}
          />
          {isXFieldTemporal && (
            <TemporalGranularitySelector
              value={config.settings.xInterval}
              onChange={(xInterval) => onChangeConfig('xInterval', xInterval)}
              xFieldType={xColumn.type}
            />
          )}
        </div>
      </Field>

      <Field label="Y Axis" required>
        <MultiFieldSelector.Numeric
          value={config.settings.yFields ?? []}
          onChange={(yFields) => onChangeConfig('yFields', yFields)}
          showAggregation={Boolean(
            isXFieldTemporal && config.settings.xInterval,
          )}
        />
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
