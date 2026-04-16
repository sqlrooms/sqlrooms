import {FC, PropsWithChildren, ReactElement} from 'react';
import {useSplitNodeContext} from '../../LayoutNodeContext';
import {getLayoutNodeId, LayoutNode} from '@sqlrooms/layout-config';
import {ResizablePanel} from '@sqlrooms/ui';
import {CollapsiblePanelWrapper} from './CollapsiblePanelWrapper';
import {
  convertLayoutNodeSizeToStyle,
  getLayoutNodeSize,
  isCollapsed,
} from '../utils';
import {SplitLayoutPanelResizableHandle} from './SplitLayoutPanelResizableHandle';

export type SplitLayoutPanelProps = PropsWithChildren<{
  node: LayoutNode;
  nodeIndex: number;
  handleComponent?: ReactElement;
}>;

export const SplitLayoutPanel: FC<SplitLayoutPanelProps> = ({
  node,
  nodeIndex,
  handleComponent,
  children,
}) => {
  const {node: parentNode} = useSplitNodeContext();

  const panelId = getLayoutNodeId(node);
  const sizeProps = getLayoutNodeSize(node);
  const collapsed = isCollapsed(node);
  const isLast = nodeIndex === parentNode.children.length - 1;
  const isResizable = parentNode.resizable !== false;

  const handleElement = handleComponent || <SplitLayoutPanelResizableHandle />;

  if (!isResizable) {
    return (
      <div
        className="flex-1"
        style={convertLayoutNodeSizeToStyle(sizeProps, parentNode.direction)}
      >
        {children}
      </div>
    );
  }

  if (sizeProps.collapsible) {
    return (
      <>
        <CollapsiblePanelWrapper
          panelId={panelId}
          collapsed={collapsed}
          {...sizeProps}
        >
          {children}
        </CollapsiblePanelWrapper>
        {!isLast && handleElement}
      </>
    );
  }

  return (
    <>
      <ResizablePanel id={panelId} {...sizeProps}>
        {children}
      </ResizablePanel>
      {!isLast && handleElement}
    </>
  );
};
