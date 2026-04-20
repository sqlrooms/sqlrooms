import type {LayoutNodeContextValue} from './LayoutNodeContext';
import {PanelIdentityResult} from './resolvePanelIdentity';

export type LayoutPath = (string | number)[];

export type PanelContainerType = 'tabs' | 'split' | 'root';

export type RoomPanelComponentProps = {
  panelInfo: RoomPanelInfo;
} & PanelIdentityResult;

export type RoomPanelComponent = React.ComponentType<RoomPanelComponentProps>;

export type RoomPanelInfo = {
  title?: string;
  icon?: React.ComponentType<{className?: string}>;
  /** @deprecated No longer used — panel area is determined by the layout tree */
  placement?: string;
  component?: RoomPanelComponent;
};

/**
 * Context passed to function-form panel definitions.
 *
 * `panelId` is the direct panel key from the node's `panel` property.
 * `meta` is the optional metadata object from `panel: { key, meta }`.
 * `layoutNode` is only available at render time — non-render callers
 * (command palette, sidebar buttons, etc.) pass `undefined`.
 */
export type PanelDefinitionContext = {
  panelId: string;
  meta?: Record<string, unknown>;
  /** The current layout node context, available only at render time. */
  layoutNode?: LayoutNodeContextValue;
};

export type PanelDefinition =
  | RoomPanelInfo
  | ((context: PanelDefinitionContext) => RoomPanelInfo);

export type Panels = Record<string, PanelDefinition>;
