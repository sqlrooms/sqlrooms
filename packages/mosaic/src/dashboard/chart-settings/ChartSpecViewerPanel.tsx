import {type FC, useMemo} from 'react';
import {type VgPlotChartConfig} from '../../chart-types/chart-config';
import {useGenerateSpec} from '../useGenerateSpec';
import {MosaicCodeMirrorEditor} from '../../editor/MosaicCodeMirrorEditor';
import {ChartSettings} from './ChartSettings';

interface ChartSpecViewerPanelProps {
  tableName?: string;
  config: VgPlotChartConfig;
  onBack: () => void;
}

export const ChartSpecViewerPanel: FC<ChartSpecViewerPanelProps> = ({
  tableName,
  config,
  onBack,
}) => {
  const {spec} = useGenerateSpec(tableName, config.chartType, config.settings);

  const serializedValue = useMemo(
    () => (spec ? JSON.stringify(spec, null, 2) : ''),
    [spec],
  );

  return (
    <div className="flex h-full flex-col">
      <ChartSettings.Header>
        <div className="flex items-center">
          <span>Spec viewer</span>
        </div>
        <div className="flex items-center gap-1">
          <ChartSettings.CloseButton onClick={onBack} />
        </div>
      </ChartSettings.Header>
      <div className="flex-1 overflow-auto p-2">
        <div className="border-input h-full overflow-hidden rounded-md border">
          <MosaicCodeMirrorEditor
            value={serializedValue}
            className="h-full"
            enableSchemaValidation
            readOnly
          />
        </div>
      </div>
    </div>
  );
};
