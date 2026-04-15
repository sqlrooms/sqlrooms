import {LayoutNode, LayoutTabsNode} from '@sqlrooms/layout-config';
import {MatchResult, MatchResultParams} from './getPanelByPath';
import type {LayoutNodeContextValue} from './LayoutNodeContext';

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

/**
 * Context passed to function-form panel definitions.
 *
 * `panelId` and `params` are always available (from path matching).
 * `layoutNode` is only available at render time — non-render callers
 * (command palette, sidebar buttons, etc.) pass `undefined`.
 */
export type PanelDefinitionContext = {
  panelId: string;
  params: MatchResultParams;
  /** The current layout node context, available only at render time. */
  layoutNode?: LayoutNodeContextValue;
};

export type PanelDefinition =
  | RoomPanelInfo
  | ((context: PanelDefinitionContext) => RoomPanelInfo);

export type Panels = Record<string, PanelDefinition>;
