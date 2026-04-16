import {FC} from 'react';
import 'react-mosaic-component/react-mosaic-component.css';
import {RendererSwitcher} from '../RendererSwitcher';
import {useMosaicNodeContext} from '../../LayoutNodeContext';

export type MosaicLayoutTileContentProps = {
  panelId: string;
};

export const MosaicLayoutTileContent: FC<MosaicLayoutTileContentProps> = ({
  panelId,
}) => {
  const {path} = useMosaicNodeContext();

  const currentPath = [...path, panelId];

  return (
    <div className="h-full w-full overflow-hidden p-2">
      <RendererSwitcher path={currentPath} />
    </div>
  );
};
