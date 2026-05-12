import {type FC, useMemo} from 'react';
import {MosaicCodeMirrorEditor} from '../../editor/MosaicCodeMirrorEditor';
import {ChartSettings} from './ChartSettings';
import {Spec} from '@uwdata/mosaic-spec';
import {toRenderableMosaicSpec} from '../utils';

interface ChartSpecViewerPanelProps {
  spec: Spec;
  onBack: () => void;
}

export const ChartSpecViewerPanel: FC<ChartSpecViewerPanelProps> = ({
  spec,
  onBack,
}) => {
  const renderableSpec = toRenderableMosaicSpec(spec);

  const serializedValue = useMemo(
    () => (renderableSpec ? JSON.stringify(renderableSpec, null, 2) : ''),
    [renderableSpec],
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
