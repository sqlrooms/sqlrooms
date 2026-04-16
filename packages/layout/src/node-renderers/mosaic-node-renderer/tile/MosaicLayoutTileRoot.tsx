import {FC, PropsWithChildren} from 'react';
import {MosaicLayoutTileProvider} from './MosaicLayoutTileContext';
import {useGetPanelByPath} from '../../../useGetPanel';
import {useMosaicNodeContext} from '../../../LayoutNodeContext';
import {MosaicPath} from 'react-mosaic-component';

type MosaicLayoutTileRootProps = PropsWithChildren<{
  panelId: string;
  tilePath: MosaicPath;
}>;

export const MosaicLayoutTileRoot: FC<MosaicLayoutTileRootProps> = ({
  children,
  panelId,
  tilePath,
}) => {
  const {path} = useMosaicNodeContext();

  const currentPath = [...path, panelId];
  const panel = useGetPanelByPath(currentPath);

  return (
    <MosaicLayoutTileProvider
      panelId={panelId}
      tilePath={tilePath}
      panel={panel}
      path={currentPath}
    >
      {children}
    </MosaicLayoutTileProvider>
  );
};
