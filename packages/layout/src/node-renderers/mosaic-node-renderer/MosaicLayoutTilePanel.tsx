import {FC, JSX, PropsWithChildren, useCallback} from 'react';
import {MosaicPath, MosaicWindow} from 'react-mosaic-component';
import 'react-mosaic-component/react-mosaic-component.css';
import {useGetPanelByPath} from '../../useGetPanel';
import {useMosaicNodeContext} from '../../LayoutNodeContext';
import {MosaicLayoutTileToolbar} from './MosaicLayoutTileToolbar';

export type MosaicLayoutTilePanelProps = PropsWithChildren<{
  panelId: string;
  tilePath: MosaicPath;
  toolbarComponent?: () => JSX.Element;
}>;

export const MosaicLayoutTilePanel: FC<MosaicLayoutTilePanelProps> = ({
  panelId,
  tilePath,
  children,
  toolbarComponent,
}) => {
  const {node, path} = useMosaicNodeContext();

  const draggable = node.draggable !== false;

  const currentPath = [...path, panelId];

  const panel = useGetPanelByPath(currentPath);

  const renderToolbar = useCallback(() => {
    const toolbar = toolbarComponent ? (
      toolbarComponent()
    ) : (
      <MosaicLayoutTileToolbar panelId={panelId} />
    );

    return <div className="flex w-full flex-1">{toolbar}</div>;
  }, [toolbarComponent, panelId]);

  if (!draggable) {
    return <>{children}</>;
  }

  const title = panel?.title ?? panelId;

  return (
    <MosaicWindow<string>
      title={title}
      path={tilePath}
      draggable
      renderToolbar={renderToolbar}
    >
      {children}
    </MosaicWindow>
  );
};
