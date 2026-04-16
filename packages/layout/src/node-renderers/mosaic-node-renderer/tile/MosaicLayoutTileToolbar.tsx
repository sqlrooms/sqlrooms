import {FC} from 'react';
import {MosaicLayoutTileCloseButton} from './MosaicLayoutTileCloseButton';
import {useMosaicLayoutTileContext} from './MosaicLayoutTileContext';

export const MosaicLayoutTileToolbar: FC = () => {
  const {panel, panelId} = useMosaicLayoutTileContext();

  const title = panel?.title ?? panelId;
  const Icon = panel?.icon;

  return (
    <div className="flex w-full items-center justify-between p-2">
      <div className="flex items-center">
        {Icon && <Icon className="mr-2 h-4 w-4" />}
        {title}
      </div>
      <div className="flex items-center">
        <MosaicLayoutTileCloseButton />
      </div>
    </div>
  );
};
