import {type FC} from 'react';
import {Input} from '@sqlrooms/ui';
import {Field} from '../../chart-builders/Field';
import {ColumnSelector} from '../../chart-builders/ColumnSelector';
import {useChartSettingsContext} from '../../chart/chart-settings/ChartSettingsContext';
import {MIN_BINS_COUNT, MAX_BINS_COUNT, DEFAULT_BINS_COUNT} from './schema';

export const HistogramSettingsComponent: FC = () => {
  const {onChangeConfig, config} = useChartSettingsContext('histogram');

  return (
    <div className="space-y-4">
      <Field label="Field" required>
        <ColumnSelector.Quantitative
          value={config.settings.field}
          onChange={(field) => onChangeConfig('field', field)}
        />
      </Field>
      <Field label="Max Bins">
        <Input
          type="number"
          min={MIN_BINS_COUNT}
          max={MAX_BINS_COUNT}
          value={config.settings.maxBins ?? DEFAULT_BINS_COUNT}
          className="no-spinner"
          onChange={(e) =>
            onChangeConfig('maxBins', parseInt(e.target.value, 10))
          }
          placeholder={String(DEFAULT_BINS_COUNT)}
        />
      </Field>
    </div>
  );
};
