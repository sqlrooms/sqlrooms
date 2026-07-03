import {type FC} from 'react';
import {Combobox, Input} from '@sqlrooms/ui';
import {Field} from '../../../components/Field';
import {ColumnSelector} from '../../../components/ColumnSelector';
import {AggregationSelector} from '../../../components/AggregationSelector';
import {useMosaicChartSettingsContext} from '../../chart-settings/MosaicChartSettingsContext';
import {
  DEFAULT_COUNT_PLOT_MAX_BARS,
  MAX_COUNT_PLOT_MAX_BARS,
  MIN_COUNT_PLOT_MAX_BARS,
  type CountPlotMetric,
  type CountPlotSort,
} from './schema';

const METRIC_OPTIONS = [
  {value: 'count', label: 'Count'},
  {value: 'aggregate', label: 'Aggregate'},
] as const satisfies readonly {value: CountPlotMetric; label: string}[];

const SORT_OPTIONS = [
  {value: 'value-desc', label: 'Value descending'},
  {value: 'value-asc', label: 'Value ascending'},
  {value: 'label-asc', label: 'Label A-Z'},
  {value: 'label-desc', label: 'Label Z-A'},
] as const satisfies readonly {value: CountPlotSort; label: string}[];

type OptionSelectorProps<TValue extends string> = {
  value: TValue;
  options: readonly {value: TValue; label: string}[];
  onChange: (value: TValue) => void;
};

function OptionSelector<TValue extends string>({
  value,
  options,
  onChange,
}: OptionSelectorProps<TValue>) {
  const selectedOption = options.find((option) => option.value === value);

  return (
    <Combobox
      value={value}
      onChange={(newValue) => onChange(newValue as TValue)}
    >
      <Combobox.Trigger className="shadow-none">
        <span>{selectedOption?.label ?? value}</span>
      </Combobox.Trigger>
      <Combobox.Content>
        {options.map((option) => (
          <Combobox.Item key={option.value} value={option.value}>
            <span className="text-xs">{option.label}</span>
          </Combobox.Item>
        ))}
      </Combobox.Content>
    </Combobox>
  );
}

export const CountPlotSettingsComponent: FC = () => {
  const {onChangeConfig, config} = useMosaicChartSettingsContext('count-plot');
  const metric = config.settings.metric ?? 'count';
  const sort = config.settings.sort ?? 'value-desc';

  return (
    <div className="space-y-4">
      <Field label="Field" required>
        <ColumnSelector.Categorical
          value={config.settings.field}
          onChange={(field) => onChangeConfig('field', field)}
        />
      </Field>
      <Field label="Metric">
        <OptionSelector
          value={metric}
          options={METRIC_OPTIONS}
          onChange={(value) => onChangeConfig('metric', value)}
        />
      </Field>
      {metric === 'aggregate' && (
        <Field label="Value field" required>
          <div className="flex items-end gap-2">
            <ColumnSelector.Numeric
              className="flex-1"
              value={config.settings.valueField}
              onChange={(valueField) =>
                onChangeConfig('valueField', valueField)
              }
            />
            <AggregationSelector
              value={config.settings.aggregate ?? 'sum'}
              onChange={(aggregate) => onChangeConfig('aggregate', aggregate)}
            />
          </div>
        </Field>
      )}
      <Field label="Sort">
        <OptionSelector
          value={sort}
          options={SORT_OPTIONS}
          onChange={(value) => onChangeConfig('sort', value)}
        />
      </Field>
      <Field label="Max bars">
        <Input
          type="number"
          min={MIN_COUNT_PLOT_MAX_BARS}
          max={MAX_COUNT_PLOT_MAX_BARS}
          value={config.settings.maxBars ?? DEFAULT_COUNT_PLOT_MAX_BARS}
          className="no-spinner"
          onChange={(event) => {
            const value = event.target.value;
            onChangeConfig(
              'maxBars',
              value === '' ? DEFAULT_COUNT_PLOT_MAX_BARS : parseInt(value, 10),
            );
          }}
          placeholder={String(DEFAULT_COUNT_PLOT_MAX_BARS)}
        />
      </Field>
      <Field label="Left padding">
        <Input
          type="number"
          min={0}
          max={320}
          value={config.settings.leftMargin ?? ''}
          className="no-spinner"
          onChange={(event) => {
            const value = event.target.value;
            onChangeConfig(
              'leftMargin',
              value === '' ? undefined : parseInt(value, 10),
            );
          }}
          placeholder="Auto"
        />
      </Field>
    </div>
  );
};
