import {type FC, useMemo} from 'react';
import {MosaicCodeMirrorEditor} from '../../editor/MosaicCodeMirrorEditor';
import {MosaicChartSettings} from './MosaicChartSettings';
import {Spec} from '@uwdata/mosaic-spec';
import {toRenderableMosaicSpec} from '../../dashboard/utils';

interface MosaicChartSpecViewerPanelProps {
  spec: Spec;
  onBack: () => void;
}

export const MosaicChartSpecViewerPanel: FC<
  MosaicChartSpecViewerPanelProps
> = ({spec, onBack}) => {
  const renderableSpec = toRenderableMosaicSpec(spec);

  const serializedValue = useMemo(
    () => (renderableSpec ? JSON.stringify(renderableSpec, null, 2) : ''),
    [renderableSpec],
  );

  return (
    <div className="flex h-full flex-col">
      <MosaicChartSettings.Header>
        <div className="flex items-center">
          <span>Spec viewer</span>
        </div>
        <div className="flex items-center gap-1">
          <MosaicChartSettings.CloseButton onClick={onBack} />
        </div>
      </MosaicChartSettings.Header>
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
