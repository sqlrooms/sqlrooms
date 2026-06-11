import {useCallback, useMemo, type FC} from 'react';
import {MultiFieldSelector} from '../../../components/MultiFieldSelector';
import {AggregationSelector} from '../../../components/AggregationSelector';
import {ColorSelector} from '../../../components/ColorSelector';
import {useMosaicChartSettingsContext} from '../../chart-settings/MosaicChartSettingsContext';
import {useColumnsContext} from '../../../components/ColumnsContext';
import {isTemporalType} from '../../../column-types-utils';
import {getUnusedColor} from './utils';
import {
  DEFAULT_CHART_COLORS,
  DEFAULT_CHART_FALLBACK_COLOR,
} from '../../../constants/chart-colors';

/**
 * Field selector specifically for line chart Y-axis fields.
 * Includes aggregation and color selection.
 */
export const LineChartYFieldsSelector: FC = () => {
  const {onChangeConfig, config} = useMosaicChartSettingsContext('line-chart');
  const {columns} = useColumnsContext();

  const yFields = useMemo(
    () => config.settings.yFields ?? [],
    [config.settings.yFields],
  );

  const xColumn = columns.find((c) => c.name === config.settings.x);
  const isXFieldTemporal = xColumn && isTemporalType(xColumn.type);

  const showAggregation = Boolean(
    isXFieldTemporal && config.settings.xInterval,
  );

  const handleChange = useCallback(
    (newYFields: typeof yFields) => onChangeConfig('yFields', newYFields),
    [onChangeConfig],
  );

  const handleAdd = useCallback(
    (fieldName: string) => {
      if (fieldName) {
        const usedColors = yFields
          .map((f) => f.color)
          .filter((c): c is string => Boolean(c));

        onChangeConfig('yFields', [
          ...yFields,
          {
            field: fieldName,
            aggregate: 'sum',
            color: getUnusedColor(DEFAULT_CHART_COLORS, usedColors),
          },
        ]);
      }
    },
    [yFields, onChangeConfig],
  );

  return (
    <MultiFieldSelector.Numeric
      value={yFields}
      onChange={handleChange}
      onAdd={handleAdd}
      renderItem={(fieldConfig, index, handleUpdate) => (
        <div
          className="grid items-end gap-2"
          style={{
            gridTemplateColumns: showAggregation ? 'auto auto' : 'auto',
          }}
        >
          {showAggregation && (
            <AggregationSelector
              value={fieldConfig.aggregate || 'sum'}
              onChange={(newAggregate) =>
                handleUpdate(index, {aggregate: newAggregate})
              }
            />
          )}

          <ColorSelector
            items={DEFAULT_CHART_COLORS}
            value={fieldConfig.color ?? DEFAULT_CHART_FALLBACK_COLOR}
            onChange={(color) => handleUpdate(index, {color})}
          />
        </div>
      )}
    />
  );
};
