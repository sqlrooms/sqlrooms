import {type FC} from 'react';
import {Field} from '../../chart-builders/Field';
import {QuantitativeColumnSelector} from '../../chart-builders/ColumnSelector';

import {TemporalGranularitySelector} from '../../chart-builders/TemporalGranularitySelector';
import {useChartSettingsContext} from '../../dashboard/chart-settings/ChartSettingsContext';
import {NumericMultiFieldSelector} from '../../chart-builders/MultiFieldSelector';
import {isTemporalType} from '../../chart-builders/constants';

/**
 * Explicit settings component for line chart.
 * Composes primitive and compound components for full control over the UI.
 */
export const LineChartSettingsComponent: FC = () => {
  const {columns, onChangeConfig, config} =
    useChartSettingsContext('line-chart');

  const xField = columns.find((c) => c.name === config.settings.x);

  return (
    <div className="space-y-4">
      <Field label="X Axis" required>
        <div
          className="grid items-end gap-2"
          style={{
            gridTemplateColumns: xField ? 'minmax(120px, 1fr) 100px' : '1fr',
          }}
        >
          <QuantitativeColumnSelector
            value={config.settings.x}
            onChange={(x) => onChangeConfig('x', x)}
          />
          {xField && isTemporalType(xField.type) && (
            <TemporalGranularitySelector
              value={config.settings.xInterval}
              onChange={(xInterval) => onChangeConfig('xInterval', xInterval)}
              xFieldType={xField.type}
            />
          )}
        </div>
      </Field>

      <Field label="Y Axis" required>
        <NumericMultiFieldSelector
          value={config.settings.yFields ?? []}
          onChange={(yFields) => onChangeConfig('yFields', yFields)}
          showAggregation={Boolean(config.settings.xInterval)}
        />
      </Field>
    </div>
  );
};
