import {FC, PropsWithChildren} from 'react';
import {MosaicCloseButton} from './MosaicCloseButton';
import {useGetPanelByPath} from '../../../useGetPanel';
import {useMosaicNodeContext} from '../../../LayoutNodeContext';

export type MosaicLayoutTilePanelProps = PropsWithChildren<{
  panelId: string;
}>;

export const MosaicLayoutTileToolbar: FC<MosaicLayoutTilePanelProps> = ({
  panelId,
}) => {
  const {path} = useMosaicNodeContext();

  const currentPath = [...path, panelId];

  const panel = useGetPanelByPath(currentPath);

  const title = panel?.title ?? panelId;
  const Icon = panel?.icon;

  return (
    <div className="mosaic-window-toolbar flex w-full items-center justify-between">
      <div className="mosaic-window-title flex items-center">
        {Icon && <Icon className="mr-2 h-4 w-4" />}
        {title}
      </div>
      <div className="mosaic-window-controls flex items-center">
        <MosaicCloseButton />
      </div>
    </div>
  );
};
