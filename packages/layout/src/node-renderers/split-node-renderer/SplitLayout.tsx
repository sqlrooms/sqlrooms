import {FC, Fragment} from 'react';
import {LayoutPath} from '../../types';
import {LayoutNodeProvider} from '../../LayoutNodeContext';
import {LayoutSplitNode} from '@sqlrooms/layout-config';
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@sqlrooms/ui';
import {CollapsiblePanelWrapper} from '../CollapsiblePanelWrapper';
import {getPanelId, getLayoutNodeSize, isCollapsed} from '../types';
import {convertLayoutNodeSizeToStyle} from '../utils';
import {NodeRenderer} from '../NodeRenderer';

interface NodeProps {
  node: LayoutSplitNode;
  path: LayoutPath;
}

const Root: FC<NodeProps> = ({node, path}) => {
  const orientation = node.direction === 'column' ? 'vertical' : 'horizontal';
  const isResizable = node.resizable !== false;

  return (
    <LayoutNodeProvider containerType="split" node={node} path={path}>
      <ResizablePanelGroup orientation={orientation}>
        {node.children.map((child, i) => {
          const panelId = getPanelId(child);
          const sizeProps = getLayoutNodeSize(child);
          const isLast = i === node.children.length - 1;
          const collapsed = isCollapsed(child);
          const childPathSegment = panelId ?? i;

          const childContent = (
            <NodeRenderer
              node={child}
              path={[...path, childPathSegment]}
              containerType="split"
              containerId={node.id}
              parentDirection={node.direction}
            />
          );

          const panelElement = !isResizable ? (
            <div
              className="flex-1"
              style={convertLayoutNodeSizeToStyle(sizeProps, orientation)}
            >
              {childContent}
            </div>
          ) : sizeProps.collapsible ? (
            <CollapsiblePanelWrapper
              panelId={panelId}
              collapsed={collapsed}
              {...sizeProps}
            >
              {childContent}
            </CollapsiblePanelWrapper>
          ) : (
            <ResizablePanel id={panelId} {...sizeProps}>
              {childContent}
            </ResizablePanel>
          );

          return (
            <Fragment key={panelId}>
              {panelElement}
              {!isLast && isResizable && (
                <ResizableHandle className="bg-border hover:bg-primary/60 transition-colors" />
              )}
            </Fragment>
          );
        })}
      </ResizablePanelGroup>
    </LayoutNodeProvider>
  );
};

export const SplitLayout = {
  Root,
};
