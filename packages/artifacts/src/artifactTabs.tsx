import {
  findNodeById,
  getLayoutNodeId,
  isLayoutTabsNode,
  resolvePanelIdentity,
  TabsLayout,
  useLayoutNodeContext,
  type LayoutPanelNode,
  type PanelDefinition,
  type RoomPanelInfo,
} from '@sqlrooms/layout';
import {type BaseRoomStoreState} from '@sqlrooms/room-store';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  TabStrip,
  type TabDescriptor,
  type TabStripProps,
} from '@sqlrooms/ui';
import {PlusIcon} from 'lucide-react';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
} from 'react';
import type {StoreApi} from 'zustand';
import type {ArtifactTypeDefinitions} from './ArtifactTypes';
import {
  useStoreWithArtifactsAndLayout,
  type ArtifactsSliceState,
} from './ArtifactsSlice';
import {
  useArtifactWorkspace,
  type ArtifactWorkspaceDescriptor,
} from './artifactWorkspace';

const DEFAULT_ARTIFACT_PANEL_KEY = 'artifact';

export type ArtifactTabDescriptor = TabDescriptor & ArtifactWorkspaceDescriptor;

export type UseArtifactTabsOptions = {
  tabsId?: string;
  types?: readonly string[];
  panelKey?: string;
};

export type UseArtifactTabsResult = {
  tabsId?: string;
  tabs: ArtifactTabDescriptor[];
  openTabs: string[];
  selectedTabId?: string;
  artifactTypes: ArtifactTypeDefinitions<any>;
  createArtifact: (
    type?: string,
    options?: {
      title?: string;
    },
  ) => string | undefined;
  openArtifact: (artifactId: string) => void;
  closeArtifact: (artifactId: string) => void;
  deleteArtifact: (artifactId: string) => void;
  renameArtifact: (artifactId: string, title: string) => void;
  reorderArtifacts: (openArtifactIds: string[]) => void;
  selectArtifact: (artifactId: string) => void;
  handleOpenTabsChange: (openArtifactIds: string[]) => void;
};

function getArtifactIdsFromTabsNode(
  layoutConfig: unknown,
  tabsId: string | undefined,
  panelKey: string,
) {
  if (!tabsId) return [];
  const found = findNodeById(layoutConfig as any, tabsId);
  if (!found || !isLayoutTabsNode(found.node)) return [];

  return found.node.children
    .map((child) => {
      const {panelId, meta} = resolvePanelIdentity(child);
      const artifactId = meta?.artifactId;
      if (panelId !== panelKey || typeof artifactId !== 'string') {
        return undefined;
      }
      return getLayoutNodeId(child);
    })
    .filter((id): id is string => Boolean(id));
}

function mergeManagedOrder(
  fullOrder: string[],
  managedIds: string[],
  reorderedOpenIds: string[],
) {
  const managedSet = new Set(managedIds);
  const reorderedSet = new Set(reorderedOpenIds);
  const nextManagedOrder = [
    ...reorderedOpenIds,
    ...managedIds.filter((id) => !reorderedSet.has(id)),
  ];
  const next: string[] = [];
  let insertedManaged = false;

  for (const id of fullOrder) {
    if (!managedSet.has(id)) {
      next.push(id);
      continue;
    }
    if (!insertedManaged) {
      next.push(...nextManagedOrder);
      insertedManaged = true;
    }
  }

  if (!insertedManaged) {
    next.push(...nextManagedOrder);
  }

  return next;
}

export function createArtifactLayoutNode(
  artifactId: string,
  panelKey = DEFAULT_ARTIFACT_PANEL_KEY,
): LayoutPanelNode {
  return {
    type: 'panel',
    id: artifactId,
    panel: {
      key: panelKey,
      meta: {artifactId},
    },
  };
}

export function createArtifactPanelDefinition<
  TRoomState extends BaseRoomStoreState & ArtifactsSliceState,
>(
  artifactTypes: ArtifactTypeDefinitions<TRoomState>,
  store: StoreApi<TRoomState>,
): PanelDefinition {
  return (context): RoomPanelInfo => {
    const artifactId = context.meta?.artifactId;
    const artifact =
      typeof artifactId === 'string'
        ? store.getState().artifacts.config.artifactsById[artifactId]
        : undefined;
    const typeDefinition = artifact ? artifactTypes[artifact.type] : undefined;

    if (!artifact || !typeDefinition) {
      return {
        title:
          typeof artifactId === 'string'
            ? `Unknown artifact ${artifactId}`
            : 'Artifact',
        component: () => null,
      };
    }

    return {
      title:
        artifact.title || typeDefinition.defaultTitle || typeDefinition.label,
      icon: typeDefinition.icon,
      component: typeDefinition.component,
    };
  };
}

export function useArtifactTabs(
  options: UseArtifactTabsOptions = {},
): UseArtifactTabsResult {
  const layoutContext = useLayoutNodeContext();
  const tabsId =
    options.tabsId ??
    (layoutContext.containerType === 'tabs'
      ? layoutContext.node.id
      : undefined);
  const panelKey = options.panelKey ?? DEFAULT_ARTIFACT_PANEL_KEY;
  const artifactWorkspace = useArtifactWorkspace({
    types: options.types,
    selectFallback: 'none',
  });

  const artifactsConfig = useStoreWithArtifactsAndLayout(
    (state) => state.artifacts.config,
  );
  const layoutConfig = useStoreWithArtifactsAndLayout(
    (state) => state.layout.config,
  );
  const addTab = useStoreWithArtifactsAndLayout((state) => state.layout.addTab);
  const removeTab = useStoreWithArtifactsAndLayout(
    (state) => state.layout.removeTab,
  );
  const deleteTab = useStoreWithArtifactsAndLayout(
    (state) => state.layout.deleteTab,
  );
  const setActiveTab = useStoreWithArtifactsAndLayout(
    (state) => state.layout.setActiveTab,
  );
  const getVisibleTabs = useStoreWithArtifactsAndLayout(
    (state) => state.layout.getVisibleTabs,
  );
  const getActiveTab = useStoreWithArtifactsAndLayout(
    (state) => state.layout.getActiveTab,
  );
  const reorderTabs = useStoreWithArtifactsAndLayout(
    (state) => state.layout.reorderTabs,
  );
  const artifactTypes = artifactWorkspace.artifactTypes;
  const ensureArtifact = useStoreWithArtifactsAndLayout(
    (state) => state.artifacts.ensureArtifact,
  );
  const closeArtifactInStore = useStoreWithArtifactsAndLayout(
    (state) => state.artifacts.closeArtifact,
  );
  const setCurrentArtifact = useStoreWithArtifactsAndLayout(
    (state) => state.artifacts.setCurrentArtifact,
  );
  const setArtifactOrder = useStoreWithArtifactsAndLayout(
    (state) => state.artifacts.setArtifactOrder,
  );

  const artifactOrder = useMemo(
    () => artifactWorkspace.artifactIds,
    [artifactWorkspace.artifactIds],
  );

  const tabs = useMemo<ArtifactTabDescriptor[]>(
    () => artifactWorkspace.artifacts,
    [artifactWorkspace.artifacts],
  );

  const layoutArtifactTabIds = useMemo(
    () => getArtifactIdsFromTabsNode(layoutConfig, tabsId, panelKey),
    [layoutConfig, panelKey, tabsId],
  );

  const openTabs = useMemo(() => {
    if (!tabsId) return [];
    const visible = new Set(getVisibleTabs(tabsId));
    return artifactOrder.filter((artifactId) => visible.has(artifactId));
  }, [artifactOrder, getVisibleTabs, layoutConfig, tabsId]);

  const selectedTabId = tabsId ? getActiveTab(tabsId) : undefined;

  useEffect(() => {
    if (!tabsId) return;
    const artifactSet = new Set(artifactOrder);
    let didAddTab = false;
    for (const artifactId of artifactOrder) {
      const artifact = artifactsConfig.artifactsById[artifactId];
      if (!artifact) continue;
      ensureArtifact(artifactId, {
        type: artifact.type,
        title: artifact.title,
      });
      if (!layoutArtifactTabIds.includes(artifactId)) {
        didAddTab = true;
        addTab(tabsId, createArtifactLayoutNode(artifactId, panelKey));
      }
    }
    for (const artifactId of layoutArtifactTabIds) {
      if (!artifactSet.has(artifactId)) {
        deleteTab(tabsId, artifactId);
      }
    }
    if (
      didAddTab &&
      artifactsConfig.currentArtifactId &&
      artifactSet.has(artifactsConfig.currentArtifactId)
    ) {
      setActiveTab(tabsId, artifactsConfig.currentArtifactId);
    }
  }, [
    addTab,
    artifactOrder,
    artifactsConfig.currentArtifactId,
    artifactsConfig.artifactsById,
    deleteTab,
    ensureArtifact,
    layoutArtifactTabIds,
    panelKey,
    setActiveTab,
    tabsId,
  ]);

  useEffect(() => {
    if (!tabsId) {
      setCurrentArtifact(undefined);
      return;
    }
    const activeTabId = getActiveTab(tabsId);
    if (activeTabId && artifactOrder.includes(activeTabId)) {
      setCurrentArtifact(activeTabId);
    } else {
      setCurrentArtifact(undefined);
    }
  }, [artifactOrder, getActiveTab, layoutConfig, setCurrentArtifact, tabsId]);

  const createArtifact = useCallback(
    (
      type?: string,
      createOptions?: {
        title?: string;
      },
    ) => {
      const artifactId = artifactWorkspace.createArtifact(type, createOptions);
      if (!artifactId) return undefined;
      if (tabsId) {
        addTab(tabsId, createArtifactLayoutNode(artifactId, panelKey));
      }
      return artifactId;
    },
    [addTab, artifactWorkspace.createArtifact, panelKey, tabsId],
  );

  const openArtifact = useCallback(
    (artifactId: string) => {
      const artifact = artifactsConfig.artifactsById[artifactId];
      if (!tabsId || !artifact || !artifactOrder.includes(artifactId)) {
        return;
      }
      addTab(tabsId, createArtifactLayoutNode(artifactId, panelKey));
      artifactWorkspace.selectArtifact(artifactId);
    },
    [
      addTab,
      artifactOrder,
      artifactWorkspace.selectArtifact,
      artifactsConfig.artifactsById,
      panelKey,
      tabsId,
    ],
  );

  const closeArtifact = useCallback(
    (artifactId: string) => {
      closeArtifactInStore(artifactId);
      if (tabsId) {
        removeTab(tabsId, artifactId);
      }
    },
    [closeArtifactInStore, removeTab, tabsId],
  );

  const deleteArtifact = useCallback(
    (artifactId: string) => {
      artifactWorkspace.deleteArtifact(artifactId);
      if (tabsId) {
        deleteTab(tabsId, artifactId);
      }
    },
    [artifactWorkspace.deleteArtifact, deleteTab, tabsId],
  );

  const renameArtifact = useCallback(
    (artifactId: string, title: string) => {
      artifactWorkspace.renameArtifact(artifactId, title);
    },
    [artifactWorkspace.renameArtifact],
  );

  const reorderArtifacts = useCallback(
    (openArtifactIds: string[]) => {
      if (tabsId) {
        reorderTabs(tabsId, openArtifactIds);
      }
      setArtifactOrder(
        mergeManagedOrder(
          artifactsConfig.artifactOrder,
          artifactOrder,
          openArtifactIds,
        ),
      );
    },
    [
      artifactOrder,
      artifactsConfig.artifactOrder,
      reorderTabs,
      setArtifactOrder,
      tabsId,
    ],
  );

  const selectArtifact = useCallback(
    (artifactId: string) => {
      if (!artifactOrder.includes(artifactId)) return;
      if (tabsId) {
        addTab(tabsId, createArtifactLayoutNode(artifactId, panelKey));
        setActiveTab(tabsId, artifactId);
      }
      artifactWorkspace.selectArtifact(artifactId);
    },
    [
      addTab,
      artifactOrder,
      artifactWorkspace.selectArtifact,
      panelKey,
      setActiveTab,
      tabsId,
    ],
  );

  const handleOpenTabsChange = useCallback(
    (openArtifactIds: string[]) => {
      const reopened = openArtifactIds.find((id) => !openTabs.includes(id));
      if (reopened) {
        openArtifact(reopened);
        return;
      }
      reorderArtifacts(openArtifactIds);
    },
    [openArtifact, openTabs, reorderArtifacts],
  );

  return {
    tabsId,
    tabs,
    openTabs,
    selectedTabId,
    artifactTypes,
    createArtifact,
    openArtifact,
    closeArtifact,
    deleteArtifact,
    renameArtifact,
    reorderArtifacts,
    selectArtifact,
    handleOpenTabsChange,
  };
}

const ArtifactTabsContext = createContext<UseArtifactTabsResult | null>(null);

function useArtifactTabsContext() {
  const context = useContext(ArtifactTabsContext);
  if (!context) {
    throw new Error(
      'ArtifactTabs subcomponents must be used within ArtifactTabs',
    );
  }
  return context;
}

export type ArtifactTabsProps = Omit<
  TabStripProps,
  | 'tabs'
  | 'openTabs'
  | 'selectedTabId'
  | 'onOpenTabsChange'
  | 'onSelect'
  | 'onClose'
  | 'onCreate'
  | 'onRename'
  | 'renderTabMenu'
  | 'renderSearchItemActions'
> &
  UseArtifactTabsOptions & {
    renderTabMenu?: (
      tab: ArtifactTabDescriptor,
      actions: UseArtifactTabsResult,
    ) => React.ReactNode;
    renderSearchItemActions?: (
      tab: ArtifactTabDescriptor,
      actions: UseArtifactTabsResult,
    ) => React.ReactNode;
    /**
     * Called when an artifact tab is activated by the user, including clicks on
     * the already-selected tab. Use this for transient UI that should dismiss
     * whenever the user returns attention to an artifact tab.
     */
    onActivateArtifact?: (artifactId: string) => void;
    /**
     * Called when artifact selection changes through the tab strip.
     */
    onSelectArtifact?: (artifactId: string) => void;
    emptyContent?: React.ReactNode;
    content?: React.ReactNode;
    /**
     * Keep visible artifact tab panels mounted and hide inactive panels.
     *
     * Ignored when a custom `content` renderer is provided.
     */
    forceMountContent?: boolean;
    overlay?:
      | React.ReactNode
      | ((actions: UseArtifactTabsResult) => React.ReactNode);
  };

function ArtifactTabsRoot({
  children,
  types,
  tabsId,
  panelKey,
  renderTabMenu,
  renderSearchItemActions,
  onActivateArtifact,
  onSelectArtifact,
  emptyContent,
  content,
  forceMountContent = false,
  overlay,
  closeable = true,
  preventCloseLastTab = false,
  getTabDragData,
  ...props
}: ArtifactTabsProps) {
  const artifactTabs = useArtifactTabs({
    types,
    tabsId,
    panelKey,
  });
  const handleSelect = useCallback(
    (artifactId: string) => {
      artifactTabs.selectArtifact(artifactId);
      onSelectArtifact?.(artifactId);
    },
    [artifactTabs.selectArtifact, onSelectArtifact],
  );

  return (
    <ArtifactTabsContext.Provider value={artifactTabs}>
      <TabStrip
        {...props}
        tabs={artifactTabs.tabs}
        openTabs={artifactTabs.openTabs}
        selectedTabId={artifactTabs.selectedTabId}
        closeable={closeable}
        preventCloseLastTab={preventCloseLastTab}
        onOpenTabsChange={artifactTabs.handleOpenTabsChange}
        onActivate={onActivateArtifact}
        onSelect={handleSelect}
        onClose={artifactTabs.closeArtifact}
        onRename={artifactTabs.renameArtifact}
        renderTabMenu={
          renderTabMenu
            ? (tab) => renderTabMenu(tab as ArtifactTabDescriptor, artifactTabs)
            : undefined
        }
        renderSearchItemActions={
          renderSearchItemActions
            ? (tab) =>
                renderSearchItemActions(
                  tab as ArtifactTabDescriptor,
                  artifactTabs,
                )
            : undefined
        }
        getTabDragData={(tab) => {
          const artifactTab = tab as ArtifactTabDescriptor;
          const userData = getTabDragData?.(artifactTab);
          return {
            kind: 'artifact',
            id: artifactTab.artifact.id,
            type: artifactTab.artifact.type,
            title: artifactTab.artifact.title,
            ...userData,
          };
        }}
      >
        {children ?? (
          <>
            <TabStrip.SearchDropdown />
            <TabStrip.Tabs />
            <ArtifactTabsNewButton />
          </>
        )}
      </TabStrip>
      {artifactTabs.openTabs.length === 0 && emptyContent ? (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {emptyContent}
        </div>
      ) : (
        <TabsLayout.TabContentContainer>
          {content ?? <TabsLayout.TabContent forceMount={forceMountContent} />}
        </TabsLayout.TabContentContainer>
      )}
      {typeof overlay === 'function' ? overlay(artifactTabs) : overlay}
    </ArtifactTabsContext.Provider>
  );
}

type ArtifactTabsNewButtonProps = React.ComponentProps<
  typeof TabStrip.Button
> & {
  artifactType?: string;
};

function ArtifactTabsNewButton({
  artifactType,
  ...props
}: ArtifactTabsNewButtonProps) {
  const {createArtifact} = useArtifactTabsContext();
  return (
    <TabStrip.Button
      {...props}
      aria-label={props['aria-label'] ?? 'Create new artifact'}
      onClick={(event) => {
        createArtifact(artifactType);
        props.onClick?.(event);
      }}
    >
      {props.children ?? <PlusIcon className="h-4 w-4" />}
    </TabStrip.Button>
  );
}

function ArtifactTabsAddMenu({
  children,
}: {
  children?: (actions: UseArtifactTabsResult) => React.ReactNode;
}) {
  const artifactTabs = useArtifactTabsContext();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <TabStrip.Button aria-label="Create new artifact">
          <PlusIcon className="h-4 w-4" />
        </TabStrip.Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {children
          ? children(artifactTabs)
          : Object.entries(artifactTabs.artifactTypes).map(
              ([type, definition]) => (
                <DropdownMenuItem
                  key={type}
                  onClick={() => artifactTabs.createArtifact(type)}
                >
                  {definition.icon ? <definition.icon /> : null}
                  {`New ${definition.label}`}
                </DropdownMenuItem>
              ),
            )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export const ArtifactTabs = Object.assign(ArtifactTabsRoot, {
  useActions: useArtifactTabsContext,
  SearchDropdown: TabStrip.SearchDropdown,
  Tabs: TabStrip.Tabs,
  Button: TabStrip.Button,
  NewButton: ArtifactTabsNewButton,
  AddMenu: ArtifactTabsAddMenu,
  MenuItem: TabStrip.MenuItem,
  MenuSeparator: TabStrip.MenuSeparator,
  SearchItemAction: TabStrip.SearchItemAction,
});
