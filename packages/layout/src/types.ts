import {LayoutNode, LayoutTabsNode} from '@sqlrooms/layout-config';
import {MatchResult} from './getPanelByPath';

export type LayoutPath = (string | number)[];

export type PanelContainerType = 'tabs' | 'mosaic' | 'split' | 'root';

export type PanelRenderContext = {
  panelId: string;
  containerType: PanelContainerType;
  containerId?: string;
  path: LayoutPath;
};

export type TabStripRenderContext = {
  node: LayoutTabsNode;
  path: LayoutPath;
};

export type RoomPanelComponentProps = {
  panelInfo: MatchResult<RoomPanelInfo>;
  node: LayoutNode;
  path: LayoutPath;
  id: string;
};

export type RoomPanelComponent = React.ComponentType<RoomPanelComponentProps>;

export type RoomPanelInfo = {
  title?: string;
  icon?: React.ComponentType<{className?: string}>;
  /** @deprecated No longer used — panel area is determined by the layout tree */
  placement?: 'sidebar' | 'sidebar-bottom' | 'main' | string;
  component?: RoomPanelComponent;
};

export type Panels = Record<string, RoomPanelInfo>;
