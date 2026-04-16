import {FC} from 'react';
import 'react-mosaic-component/react-mosaic-component.css';
import {RendererSwitcher} from '../../RendererSwitcher';
import {useMosaicLayoutTileContext} from './MosaicLayoutTileContext';

export const MosaicLayoutTileContent: FC = () => {
  const {path} = useMosaicLayoutTileContext();

  return (
    <div className="h-full w-full overflow-hidden p-2">
      <RendererSwitcher path={path} />
    </div>
  );
};
