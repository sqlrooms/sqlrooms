import {FC} from 'react';
import {LayoutPath} from '../../types';
import {LayoutNodeProvider} from '../../LayoutNodeContext';
import {getLayoutNodeId, LayoutSplitNode} from '@sqlrooms/layout-config';
import {SplitLayoutPanel} from './SplitLayoutPanel';
import {SplitLayoutPanelGroup} from './SplitLayoutPanelGroup';
import {SplitLayoutPanelContent} from './SplitLayoutPanelContent';
import {RendererSwitcher} from '../RendererSwitcher';
import {SplitLayoutPanelResizableHandle} from './SplitLayoutPanelResizableHandle';

interface RootProps {
  node: LayoutSplitNode;
  path: LayoutPath;
}

const Root: FC<RootProps> = ({node, path}) => {
  const defaultComponent = (
    <div className="relative h-full w-full" data-layout-split-id={node.id}>
      <SplitLayout.PanelGroup>
        {node.children.map((child, i) => {
          const panelId = getLayoutNodeId(child);

          return (
            <SplitLayout.Panel key={panelId} node={child} nodeIndex={i}>
              <SplitLayout.PanelContent node={child} />
            </SplitLayout.Panel>
          );
        })}
      </SplitLayout.PanelGroup>
    </div>
  );

  return (
    <LayoutNodeProvider containerType="split" node={node} path={path}>
      <RendererSwitcher path={path} defaultComponent={defaultComponent} />
    </LayoutNodeProvider>
  );
};

export const SplitLayout = {
  Root,
  Panel: SplitLayoutPanel,
  PanelGroup: SplitLayoutPanelGroup,
  PanelContent: SplitLayoutPanelContent,
  Handle: SplitLayoutPanelResizableHandle,
};
