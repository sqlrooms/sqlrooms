import {LayoutMosaicNode} from '@sqlrooms/layout-config';
import {FC} from 'react';
import {MosaicPath, MosaicWindow} from 'react-mosaic-component';
import 'react-mosaic-component/react-mosaic-component.css';
import {MosaicCloseButton} from './MosaicCloseButton';
import {LayoutPath} from '../types';
import {RendererSwitcher} from './RendererSwitcher';
import {useGetPanelByPath} from '../useGetPanel';
import {LayoutNodeProvider} from '../LayoutNodeContext';

export type MosaicTileRendererProps = {
  panelId: string;
  tilePath: MosaicPath;
  node: LayoutMosaicNode;
  path: LayoutPath;
};

export const MosaicTileRenderer: FC<MosaicTileRendererProps> = ({
  panelId,
  tilePath,
  node,
  path,
}) => {
  const draggable = node.draggable !== false;

  const currentPath = [...path, panelId];

  const panel = useGetPanelByPath(currentPath);

  const content = (
    <LayoutNodeProvider containerType="mosaic" node={node} path={currentPath}>
      <div className="h-full w-full overflow-hidden p-2">
        <RendererSwitcher node={node} path={currentPath} />
      </div>
    </LayoutNodeProvider>
  );

  if (!draggable) {
    return <>{content}</>;
  }

  const title = panel?.title ?? panelId;
  const Icon = panel?.icon;

  return (
    <MosaicWindow<string>
      title={title}
      path={tilePath}
      draggable
      renderToolbar={() => (
        <div className="mosaic-window-toolbar flex w-full items-center justify-between">
          <div className="mosaic-window-title flex items-center">
            {Icon && <Icon className="mr-2 h-4 w-4" />}
            {title}
          </div>
          <div className="mosaic-window-controls flex items-center">
            <MosaicCloseButton />
          </div>
        </div>
      )}
    >
      {content}
    </MosaicWindow>
  );
};
