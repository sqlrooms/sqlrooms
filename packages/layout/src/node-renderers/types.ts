import type {LayoutNode} from '@sqlrooms/layout-config';
import type {
  LayoutPath,
  PanelContainerType,
  ParentDirection,
} from '../layout-base-types';

export interface NodeRenderProps<TNode extends LayoutNode = LayoutNode> {
  node: TNode;
  path: LayoutPath;
  containerType: PanelContainerType;
  containerId?: string;
  /** Direction of the parent split, used for expand button icon orientation */
  parentDirection?: ParentDirection;
}
