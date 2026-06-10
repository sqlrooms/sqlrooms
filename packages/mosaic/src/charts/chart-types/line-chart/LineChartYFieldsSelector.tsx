import type {FC} from 'react';
import {MultiFieldSelector} from '../../../components/MultiFieldSelector';
import {AggregationSelector} from '../../../components/AggregationSelector';
import {ColorSelector} from '../../../components/ColorSelector';
import {useMosaicChartSettingsContext} from '../../chart-settings/MosaicChartSettingsContext';
import {useColumnsContext} from '../../../components/ColumnsContext';
import {isTemporalType} from '../../../column-types-utils';

/**
 * Field selector specifically for line chart Y-axis fields.
 * Includes aggregation and color selection.
 */
export const LineChartYFieldsSelector: FC = () => {
  const {onChangeConfig, config} = useMosaicChartSettingsContext('line-chart');
  const {columns} = useColumnsContext();

  const yFields = config.settings.yFields ?? [];

  const xColumn = columns.find((c) => c.name === config.settings.x);
  const isXFieldTemporal = xColumn && isTemporalType(xColumn.type);

  const showAggregation = Boolean(
    isXFieldTemporal && config.settings.xInterval,
  );

  return (
    <MultiFieldSelector.Numeric
      value={yFields}
      onChange={(newYFields) => onChangeConfig('yFields', newYFields)}
      renderItem={(fieldConfig, index, handleUpdate) => (
        <div
          className="grid items-end gap-2"
          style={{
            gridTemplateColumns: showAggregation ? 'auto auto' : 'auto',
          }}
        >
          {showAggregation && (
            <AggregationSelector
              value={fieldConfig.aggregate}
              onChange={(newAggregate) =>
                handleUpdate(index, {aggregate: newAggregate})
              }
            />
          )}

          <ColorSelector
            value={fieldConfig.color}
            onChange={(color) => handleUpdate(index, {color})}
          />
        </div>
      )}
    />
  );
};
