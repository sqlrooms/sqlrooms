import {type FC} from 'react';
import {Input} from '@sqlrooms/ui';
import {Field} from '../../../components/Field';
import {ColumnSelector} from '../../../components/ColumnSelector';
import {ColorSelector} from '../../../components/ColorSelector';
import {useMosaicChartSettingsContext} from '../../chart-settings/MosaicChartSettingsContext';
import {MIN_BINS_COUNT, MAX_BINS_COUNT, DEFAULT_BINS_COUNT} from './schema';
import {
  DEFAULT_CHART_COLORS,
  DEFAULT_CHART_FALLBACK_COLOR,
} from '../../../constants/chart-colors';

export const HistogramSettingsComponent: FC = () => {
  const {onChangeConfig, config} = useMosaicChartSettingsContext('histogram');

  return (
    <div className="space-y-4">
      <Field label="Field" required>
        <div className="flex items-end gap-2">
          <ColumnSelector.Quantitative
            className="flex-1"
            value={config.settings.field}
            onChange={(field) => onChangeConfig('field', field)}
          />
          <ColorSelector
            items={DEFAULT_CHART_COLORS}
            value={config.settings.color ?? DEFAULT_CHART_FALLBACK_COLOR}
            onChange={(color) => onChangeConfig('color', color)}
          />
        </div>
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
