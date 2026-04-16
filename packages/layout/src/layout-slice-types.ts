import {LayoutConfig} from '@sqlrooms/layout-config';
import type {
  LayoutNode,
  LayoutSplitNode,
  LayoutTabsNode,
} from '@sqlrooms/layout-config';
import type {Panels, PanelDefinition} from './types';

// ---------------------------------------------------------------------------
// Config types
// ---------------------------------------------------------------------------

export const LayoutSliceConfig = LayoutConfig;
export type LayoutSliceConfig = LayoutConfig;

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

export type LayoutSliceState = {
  layout: {
    initialize?: () => Promise<void>;
    destroy?: () => Promise<void>;
    config: LayoutSliceConfig;
    panels: Panels;
    setConfig(layout: LayoutConfig): void;
    /** @deprecated Use setConfig instead */
    setLayout(layout: LayoutConfig): void;

    /** @deprecated Use setActiveTab / addTab / removeTab instead */
    togglePanel: (panel: string, show?: boolean) => void;
    /** @deprecated */
    togglePanelPin: (panel: string) => void;

    /** Set the active (visible) tab in a tabs node */
    setActiveTab: (tabsId: string, tabId: string) => void;
    /** Add a tab to a tabs node */
    addTab: (tabsId: string, tabIdOrNode: string | LayoutNode) => void;
    /** Remove (close) a tab from a tabs node */
    removeTab: (tabsId: string, tabId: string) => void;
    /** Collapse or expand a collapsible node */
    setCollapsed: (id: string, collapsed: boolean) => void;
    /** Toggle collapse state of a collapsible node */
    toggleCollapsed: (id: string) => void;
    /** Get the list of all tab IDs in a tabs node (both visible and hidden) */
    getTabs: (tabsId: string) => string[];
    /** Get the list of visible tab IDs in a tabs node */
    getVisibleTabs: (tabsId: string) => string[];
    /** Get the list of hidden tab IDs in a tabs node */
    getHiddenTabs: (tabsId: string) => string[];
    /** Get the active tab ID in a tabs node */
    getActiveTab: (tabsId: string) => string | undefined;
    /** Check if a node is currently collapsed */
    isCollapsed: (id: string) => boolean;

    /** Register a panel dynamically (adds to panels registry) */
    registerPanel: (panelId: string, info: PanelDefinition) => void;
    /** Unregister a dynamically added panel */
    unregisterPanel: (panelId: string) => void;
    /** Add a panel as a child of a named split node */
    addChildToSplit: (splitId: string, panelId: string) => void;
    /** Add a panel as a child of a named nested mosaic node */
    addChildToMosaic: (mosaicId: string, panelId: string) => void;
    /** Find the nearest ancestor of a given type for a node */
    findAncestorOfType: (
      nodeId: string,
      type: 'tabs' | 'split',
    ) => LayoutTabsNode | LayoutSplitNode | undefined;
  };
};

export type CreateLayoutSliceProps = {
  config?: LayoutSliceConfig;
  panels?: Panels;
};
