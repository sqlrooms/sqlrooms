import {type FC, useId, useState} from 'react';
import {Input} from '@sqlrooms/ui';
import {Field} from '../../../components/Field';
import {ColumnSelector} from '../../../components/ColumnSelector';
import {ColorSelector} from '../../../components/ColorSelector';
import {useMosaicChartSettingsContext} from '../../chart-settings/MosaicChartSettingsContext';
import {
  DEFAULT_BINS_COUNT,
  HistogramChartSettings,
  MAX_BINS_COUNT,
  MIN_BINS_COUNT,
} from './schema';
import {
  DEFAULT_CHART_COLORS,
  DEFAULT_CHART_FALLBACK_COLOR,
} from '../../../constants/chart-colors';

export type HistogramSettingsComponentProps = {
  /** Show the upper percentile setting. Set false for charts edited as JSON. */
  showUpperPercentile?: boolean;
};

/** Configure the histogram field, color, bin count, and optional percentile. */
export const HistogramSettingsComponent: FC<
  HistogramSettingsComponentProps
> = ({showUpperPercentile = true}) => {
  const {onChangeConfig, config} = useMosaicChartSettingsContext('histogram');
  const [percentileDraft, setPercentileDraft] = useState<string>();
  const [invalidPercentile, setInvalidPercentile] = useState(false);
  const percentileErrorId = useId();

  return (
    <div className="space-y-4">
      <Field label="Field" required>
        <div className="flex items-end gap-2">
          <ColumnSelector.Quantitative
            className="flex-1"
            value={config.settings.field ?? undefined}
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
      {showUpperPercentile && (
        <Field label="Upper percentile">
          <Input
            aria-label="Upper percentile"
            aria-invalid={invalidPercentile || undefined}
            aria-describedby={invalidPercentile ? percentileErrorId : undefined}
            type="number"
            min={0}
            max={100}
            step="any"
            placeholder="Full range"
            value={percentileDraft ?? config.settings.upperPercentile ?? ''}
            onChange={({currentTarget}) => {
              setPercentileDraft(currentTarget.value);
              setInvalidPercentile(false);
            }}
            onBlur={({currentTarget}) => {
              const value =
                currentTarget.value === '' && !currentTarget.validity.badInput
                  ? undefined
                  : currentTarget.valueAsNumber;
              const result =
                HistogramChartSettings.shape.upperPercentile.safeParse(value);
              setInvalidPercentile(!result.success);
              if (result.success) {
                setPercentileDraft(undefined);
                if (
                  result.data !== (config.settings.upperPercentile ?? undefined)
                ) {
                  onChangeConfig('upperPercentile', result.data);
                }
              }
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                event.currentTarget.blur();
              }
            }}
          />
          {invalidPercentile ? (
            <p id={percentileErrorId} className="text-destructive text-xs">
              Enter a percentile greater than 0 and at most 100, or leave it
              blank.
            </p>
          ) : null}
        </Field>
      )}
    </div>
  );
};
