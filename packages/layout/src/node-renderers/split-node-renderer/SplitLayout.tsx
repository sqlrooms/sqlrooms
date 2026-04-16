import {FC} from 'react';
import {LayoutPath} from '../../types';
import {LayoutNodeProvider} from '../../LayoutNodeContext';
import {LayoutSplitNode} from '@sqlrooms/layout-config';
import {getPanelId} from '../types';
import {SplitLayoutPanel} from './SplitLayoutPanel';
import {SplitLayoutPanelGroup} from './SplitLayoutPanelGroup';
import {SplitLayoutPanelContent} from './SplitLayoutPanelContent';
import {RendererSwitcher} from '../RendererSwitcher';
import {SplitLayoutPanelResizableHandle} from './SplitLayoutPanelResizableHandle';

interface NodeProps {
  node: LayoutSplitNode;
  path: LayoutPath;
}

const Root: FC<NodeProps> = ({node, path}) => {
  const defaultComponent = (
    <SplitLayout.PanelGroup>
      {node.children.map((child, i) => {
        const panelId = getPanelId(child);

        return (
          <SplitLayout.Panel key={panelId} node={child} nodeIndex={i}>
            <SplitLayout.PanelContent node={child} />
          </SplitLayout.Panel>
        );
      })}
    </SplitLayout.PanelGroup>
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
