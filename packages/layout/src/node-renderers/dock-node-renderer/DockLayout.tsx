import {FC} from 'react';
import {LayoutDockNode} from '@sqlrooms/layout-config';
import {useGetPanel} from '../../useGetPanel';
import {useRenderNode} from '../RenderNodeContext';
import {RendererSwitcher} from '../RendererSwitcher';
import {LayoutPath} from '../../types';
import {ParentDirection} from '../../layout-base-types';
import {LayoutNodeProvider} from '../../LayoutNodeContext';

interface RootProps {
  node: LayoutDockNode;
  path: LayoutPath;
  parentDirection?: ParentDirection;
}

const Root: FC<RootProps> = ({node, path, parentDirection}) => {
  const panelInfo = useGetPanel(node);
  const renderNode = useRenderNode();

  const defaultComponent = (
    <div className="flex h-full w-full flex-col" data-dock-id={node.id}>
      {panelInfo?.title && (
        <div className="border-border flex items-center gap-2 border-b px-3 py-2">
          {panelInfo.icon && <panelInfo.icon className="h-4 w-4" />}
          <span className="text-sm font-medium">{panelInfo.title}</span>
        </div>
      )}
      <div className="flex-1 overflow-hidden">
        {renderNode({
          node: node.root,
          path: [...path, node.id],
          containerType: 'root',
          containerId: node.id,
        })}
      </div>
    </div>
  );

  return (
    <LayoutNodeProvider
      containerType="dock"
      node={node}
      path={path}
      parentDirection={parentDirection}
    >
      <RendererSwitcher defaultComponent={defaultComponent} />
    </LayoutNodeProvider>
  );
};

export const DockLayout = {
  Root,
};
