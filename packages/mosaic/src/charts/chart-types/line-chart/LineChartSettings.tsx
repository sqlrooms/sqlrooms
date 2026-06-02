import {type FC} from 'react';
import {Field} from '../../../chart-builders/Field';
import {ColumnSelector} from '../../../chart-builders/ColumnSelector';

import {TemporalGranularitySelector} from '../../../chart-builders/TemporalGranularitySelector';
import {useMosaicChartSettingsContext} from '../../chart-settings/MosaicChartSettingsContext';
import {MultiFieldSelector} from '../../../chart-builders/MultiFieldSelector';
import {isTemporalType} from '../../../chart-builders/constants';
import {useColumnsContext} from '../../../chart-builders/ColumnsContext';

/**
 * Explicit settings component for line chart.
 * Composes primitive and compound components for full control over the UI.
 */
export const LineChartSettingsComponent: FC = () => {
  const {onChangeConfig, config} = useMosaicChartSettingsContext('line-chart');
  const {columns} = useColumnsContext();

  const xField = columns.find((c) => c.name === config.settings.x);
  const isXFieldTemporal = xField && isTemporalType(xField.type);

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
              xFieldType={xField.type}
            />
          )}
        </div>
      </Field>

      <Field label="Y Axis" required>
        <MultiFieldSelector.Numeric
          value={config.settings.yFields ?? []}
          onChange={(yFields) => onChangeConfig('yFields', yFields)}
          showAggregation={Boolean(config.settings.xInterval)}
        />
      </Field>
    </div>
  );
};
