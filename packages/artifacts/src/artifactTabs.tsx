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
import type {ArtifactMetadata as ArtifactMetadataType} from './ArtifactsSliceConfig';
import {
  useStoreWithArtifactsAndLayout,
  type ArtifactsSliceState,
} from './ArtifactsSlice';

const DEFAULT_ARTIFACT_PANEL_KEY = 'artifact';

export type ArtifactTabDescriptor = TabDescriptor & {
  artifact: ArtifactMetadataType;
  type: string;
};

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
    options?: {title?: string},
  ) => string | undefined;
  openArtifact: (artifactId: string) => void;
  closeArtifact: (artifactId: string) => void;
  deleteArtifact: (artifactId: string) => void;
  renameArtifact: (artifactId: string, title: string) => void;
  reorderArtifacts: (openArtifactIds: string[]) => void;
  selectArtifact: (artifactId: string) => void;
  handleOpenTabsChange: (openArtifactIds: string[]) => void;
};

function isManagedType(types: readonly string[] | undefined, type: string) {
  return !types || types.includes(type);
}

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
  const typesKey = options.types?.join('\u0000') ?? '';
  const managedTypes = useMemo(
    () => (options.types ? [...options.types] : undefined),
    // Keep inline arrays like types={['notebook']} stable by value.
    [typesKey],
  );

  const artifactsConfig = useStoreWithArtifactsAndLayout(
    (state) => state.artifacts.config,
  );
  const artifactTypes = useStoreWithArtifactsAndLayout(
    (state) => state.artifacts.artifactTypes,
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
  const createArtifactInStore = useStoreWithArtifactsAndLayout(
    (state) => state.artifacts.createArtifact,
  );
  const ensureArtifact = useStoreWithArtifactsAndLayout(
    (state) => state.artifacts.ensureArtifact,
  );
  const closeArtifactInStore = useStoreWithArtifactsAndLayout(
    (state) => state.artifacts.closeArtifact,
  );
  const deleteArtifactFromStore = useStoreWithArtifactsAndLayout(
    (state) => state.artifacts.deleteArtifact,
  );
  const renameArtifactInStore = useStoreWithArtifactsAndLayout(
    (state) => state.artifacts.renameArtifact,
  );
  const setCurrentArtifact = useStoreWithArtifactsAndLayout(
    (state) => state.artifacts.setCurrentArtifact,
  );
  const setArtifactOrder = useStoreWithArtifactsAndLayout(
    (state) => state.artifacts.setArtifactOrder,
  );

  const artifactOrder = useMemo(
    () =>
      artifactsConfig.artifactOrder.filter((artifactId) => {
        const artifact = artifactsConfig.artifactsById[artifactId];
        return artifact && isManagedType(managedTypes, artifact.type);
      }),
    [
      artifactsConfig.artifactsById,
      artifactsConfig.artifactOrder,
      managedTypes,
    ],
  );

  const tabs = useMemo<ArtifactTabDescriptor[]>(
    () =>
      artifactOrder
        .map((artifactId) => artifactsConfig.artifactsById[artifactId])
        .filter((artifact): artifact is ArtifactMetadataType =>
          Boolean(artifact),
        )
        .map((artifact) => ({
          id: artifact.id,
          name: artifact.title,
          type: artifact.type,
          icon: artifactTypes[artifact.type]?.icon,
          artifact,
        })),
    [artifactOrder, artifactsConfig.artifactsById, artifactTypes],
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
    if (activeTabId && artifactsConfig.artifactsById[activeTabId]) {
      setCurrentArtifact(activeTabId);
    } else {
      setCurrentArtifact(undefined);
    }
  }, [
    artifactsConfig.artifactsById,
    getActiveTab,
    layoutConfig,
    setCurrentArtifact,
    tabsId,
  ]);

  const createArtifact = useCallback(
    (type?: string, createOptions?: {title?: string}) => {
      const artifactType =
        type ?? managedTypes?.[0] ?? Object.keys(artifactTypes)[0];
      if (!artifactType) return undefined;
      const artifactId = createArtifactInStore({
        type: artifactType,
        title: createOptions?.title,
      });
      if (tabsId) {
        addTab(tabsId, createArtifactLayoutNode(artifactId, panelKey));
      }
      return artifactId;
    },
    [
      addTab,
      artifactTypes,
      createArtifactInStore,
      managedTypes,
      panelKey,
      tabsId,
    ],
  );

  const openArtifact = useCallback(
    (artifactId: string) => {
      if (!tabsId || !artifactsConfig.artifactsById[artifactId]) return;
      addTab(tabsId, createArtifactLayoutNode(artifactId, panelKey));
      setCurrentArtifact(artifactId);
    },
    [
      addTab,
      artifactsConfig.artifactsById,
      panelKey,
      setCurrentArtifact,
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
      deleteArtifactFromStore(artifactId);
      if (tabsId) {
        deleteTab(tabsId, artifactId);
      }
    },
    [deleteArtifactFromStore, deleteTab, tabsId],
  );

  const renameArtifact = useCallback(
    (artifactId: string, title: string) => {
      renameArtifactInStore(artifactId, title);
    },
    [renameArtifactInStore],
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
      if (tabsId) {
        addTab(tabsId, createArtifactLayoutNode(artifactId, panelKey));
        setActiveTab(tabsId, artifactId);
      }
      setCurrentArtifact(artifactId);
    },
    [addTab, panelKey, setActiveTab, setCurrentArtifact, tabsId],
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
    emptyContent?: React.ReactNode;
    content?: React.ReactNode;
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
  emptyContent,
  content,
  overlay,
  closeable = true,
  preventCloseLastTab = false,
  ...props
}: ArtifactTabsProps) {
  const artifactTabs = useArtifactTabs({types, tabsId, panelKey});

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
        onSelect={artifactTabs.selectArtifact}
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
      >
        {children ?? (
          <>
            <TabStrip.SearchDropdown />
            <TabStrip.Tabs />
            <ArtifactTabsNewButton />
          </>
        )}
      </TabStrip>
      <TabsLayout.TabContentContainer>
        {content ?? <TabsLayout.TabContent />}
        {artifactTabs.tabs.length === 0 ? emptyContent : null}
      </TabsLayout.TabContentContainer>
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
