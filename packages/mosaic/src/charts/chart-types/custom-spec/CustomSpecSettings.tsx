import {type FC, useCallback, useMemo} from 'react';
import {useMosaicChartSettingsContext} from '../../chart-settings/MosaicChartSettingsContext';
import {MosaicCodeMirrorEditor} from '../../../editor/MosaicCodeMirrorEditor';
import {Field} from '../../../components/Field';

/**
 * Settings component for custom spec chart type.
 * Shows a full editor for the vgplot spec.
 */
export const CustomSpecSettingsComponent: FC = () => {
  const {config, onChangeConfig} = useMosaicChartSettingsContext('custom-spec');

  const vgplotValue = config.settings.vgPlotSpec;

  const serializedValue = useMemo(
    () =>
      vgplotValue
        ? JSON.stringify(vgplotValue, null, 2)
        : JSON.stringify({plot: []}, null, 2),
    [vgplotValue],
  );

  const handleChange = useCallback(
    (nextValue: string | undefined) => {
      if (!nextValue) {
        return;
      }

      try {
        const parsed = JSON.parse(nextValue);
        onChangeConfig('vgPlotSpec', parsed);
      } catch {
        // Invalid JSON - ignore
      }
    },
    [onChangeConfig],
  );

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-hidden">
        <Field label="Spec" required>
          <div className="border-input overflow-hidden rounded-md border">
            <MosaicCodeMirrorEditor
              value={serializedValue}
              onChange={handleChange}
              className="h-full"
              enableSchemaValidation
            />
          </div>
        </Field>
      </div>
    </div>
  );
};
