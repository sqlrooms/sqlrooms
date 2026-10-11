import {type FC, useMemo} from 'react';
import {MosaicChartSettings} from './MosaicChartSettings';
import {Spec} from '@uwdata/mosaic-spec';
import {toRenderableMosaicSpec} from '../../dashboard/utils';
import {MosaicCodeViewerPanel} from '../../editor/MosaicCodeViewerPanel';

interface MosaicChartSpecViewerPanelProps {
  spec: Spec;
  onBack: () => void;
  showHeader?: boolean;
}

export const MosaicChartSpecViewerPanel: FC<
  MosaicChartSpecViewerPanelProps
> = ({spec, onBack, showHeader = true}) => {
  const renderableSpec = toRenderableMosaicSpec(spec);

  const serializedValue = useMemo(
    () => (renderableSpec ? JSON.stringify(renderableSpec, null, 2) : ''),
    [renderableSpec],
  );

  return (
    <div className="flex h-full flex-col">
      {showHeader ? (
        <MosaicChartSettings.Header>
          <div className="flex items-center">
            <span>Spec viewer</span>
          </div>
          <div className="flex items-center gap-1">
            <MosaicChartSettings.CloseButton onClick={onBack} />
          </div>
        </MosaicChartSettings.Header>
      ) : null}
      <MosaicCodeViewerPanel
        value={serializedValue}
        copyTooltipLabel="Copy spec"
        enableSchemaValidation
      />
    </div>
  );
};
