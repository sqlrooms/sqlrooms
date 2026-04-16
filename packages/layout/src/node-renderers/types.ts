import type {LayoutNode} from '@sqlrooms/layout-config';
import type {LayoutPath, PanelContainerType} from '../types';

export type ParentDirection = 'row' | 'column';

export interface NodeRenderProps<TNode extends LayoutNode = LayoutNode> {
  node: TNode;
  path: LayoutPath;
  containerType: PanelContainerType;
  containerId?: string;
  /** Direction of the parent split, used for expand button icon orientation */
  parentDirection?: ParentDirection;
}
