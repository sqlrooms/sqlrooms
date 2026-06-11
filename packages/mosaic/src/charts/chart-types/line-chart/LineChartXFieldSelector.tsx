import type {FC} from 'react';
import {ColumnSelector} from '../../../components/ColumnSelector';
import {TemporalGranularitySelector} from '../../../components/TemporalGranularitySelector';
import {useColumnsContext} from '../../../components/ColumnsContext';
import {isTemporalType} from '../../../column-types-utils';
import {useMosaicChartSettingsContext} from '../../chart-settings/MosaicChartSettingsContext';

/**
 * Field selector specifically for line chart X-axis.
 * Includes temporal granularity selector when X field is temporal.
 */
export const LineChartXFieldSelector: FC = () => {
  const {onChangeConfig, config} = useMosaicChartSettingsContext('line-chart');

  const {columns} = useColumnsContext();
  const xColumn = columns.find((c) => c.name === config.settings.x);
  const isXFieldTemporal = xColumn && isTemporalType(xColumn.type);

  return (
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
  );
};
