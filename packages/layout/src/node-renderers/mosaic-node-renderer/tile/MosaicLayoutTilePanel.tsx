import {FC, JSX, PropsWithChildren, useCallback} from 'react';
import {MosaicWindow} from 'react-mosaic-component';
import 'react-mosaic-component/react-mosaic-component.css';
import {useMosaicNodeContext} from '../../../LayoutNodeContext';
import {MosaicLayoutTileToolbar} from './MosaicLayoutTileToolbar';
import {useMosaicLayoutTileContext} from './MosaicLayoutTileContext';

export type MosaicLayoutTilePanelProps = PropsWithChildren<{
  toolbarRenderer?: () => JSX.Element;
}>;

export const MosaicLayoutTilePanel: FC<MosaicLayoutTilePanelProps> = ({
  children,
  toolbarRenderer,
}) => {
  const {node} = useMosaicNodeContext();
  const {panelId, tilePath, panel} = useMosaicLayoutTileContext();

  const draggable = node.draggable !== false;

  const renderToolbar = useCallback(() => {
    const toolbar = toolbarRenderer ? (
      toolbarRenderer()
    ) : (
      <MosaicLayoutTileToolbar />
    );

    return <div className="flex w-full flex-1">{toolbar}</div>;
  }, [toolbarRenderer]);

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
