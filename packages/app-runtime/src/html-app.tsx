import type {
  StatefulBlockDefinition,
  StatefulBlockRenderProps,
} from '@sqlrooms/blocks';
import {
  createSlice,
  useBaseRoomStore,
  useRoomStoreApi,
} from '@sqlrooms/room-store';
import {produce} from 'immer';
import {AppWindowIcon, HistoryIcon, RotateCcwIcon} from 'lucide-react';
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
  type FC,
  type ReactNode,
} from 'react';
import {z} from 'zod';
import {createBridgeHost, createDiagnosticPreludeScript} from './host';
import {
  AppCapability,
  AppDiagnostic,
  QueryResult,
  type QueryRequest,
} from './protocol';

export const HTML_APP_BLOCK_TYPE = 'html-app';

export const HtmlAppDependency = z.object({
  package: z.string(),
  version: z.string(),
  entry: z.string().optional(),
  kind: z.enum(['script', 'stylesheet']).optional(),
  global: z.string().optional(),
});
export type HtmlAppDependency = z.infer<typeof HtmlAppDependency>;

export const HtmlAppSourceFileMap = z.record(z.string(), z.string());
export type HtmlAppSourceFileMap = z.infer<typeof HtmlAppSourceFileMap>;

export const HtmlAppRevisionSource = z.enum([
  'assistant',
  'user',
  'restore',
  'system',
]);
export type HtmlAppRevisionSource = z.infer<typeof HtmlAppRevisionSource>;

export const HtmlAppRevision = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  sourcePrompt: z.string().optional(),
  source: HtmlAppRevisionSource,
  sessionId: z.string().optional(),
  toolCallId: z.string().optional(),
  commitGroupId: z.string().optional(),
  parentRevisionId: z.string().optional(),
  createdAt: z.number(),
  title: z.string(),
  files: HtmlAppSourceFileMap,
  entryHtmlPath: z.string().default('/index.html'),
  dependencies: z.array(HtmlAppDependency).default([]),
});
/**
 * Persisted source-bearing snapshot for an HTML app.
 *
 * Diagnostics are intentionally excluded because they describe runtime
 * observations that can be regenerated for the active source.
 */
export type HtmlAppRevision = z.infer<typeof HtmlAppRevision>;

export const HtmlAppState = z.object({
  id: z.string(),
  title: z.string(),
  files: HtmlAppSourceFileMap,
  entryHtmlPath: z.string().default('/index.html'),
  requestedCapabilities: z.array(AppCapability).default([]),
  grantedCapabilities: z.array(AppCapability).default([]),
  dependencies: z.array(HtmlAppDependency).default([]),
  diagnostics: z.array(AppDiagnostic).default([]),
  revisions: z.array(HtmlAppRevision).default([]),
  activeRevisionId: z.string().optional(),
  redoRevisionIds: z.array(z.string()).default([]),
  createdAt: z.number(),
  updatedAt: z.number(),
});
export type HtmlAppState = z.infer<typeof HtmlAppState>;

export type HtmlAppRevisionPatch = Partial<
  Pick<
    HtmlAppState,
    | 'title'
    | 'files'
    | 'entryHtmlPath'
    | 'dependencies'
    | 'requestedCapabilities'
    | 'grantedCapabilities'
    | 'diagnostics'
  >
>;

export type CommitHtmlAppRevisionMetadata = {
  name?: string;
  description?: string;
  source?: HtmlAppRevisionSource;
  sourcePrompt?: string;
  sessionId?: string;
  toolCallId?: string;
  commitGroupId?: string;
  parentRevisionId?: string;
  createdAt?: number;
  revisionId?: string;
  clearRedo?: boolean;
};

export type RestoreHtmlAppRevisionMetadata = Omit<
  CommitHtmlAppRevisionMetadata,
  'source' | 'parentRevisionId' | 'clearRedo'
>;

export type HtmlAppRevisionNavigationState = {
  activeRevision?: HtmlAppRevision;
  activeIndex: number;
  totalRevisions: number;
  canUndo: boolean;
  canRedo: boolean;
  previousRevision?: HtmlAppRevision;
  nextRevision?: HtmlAppRevision;
};

export const HtmlAppRuntimeConfig = z.object({
  appsById: z.record(z.string(), HtmlAppState).default({}),
});
export type HtmlAppRuntimeConfig = z.infer<typeof HtmlAppRuntimeConfig>;

export type HtmlAppRuntimeSliceState = {
  htmlApps: {
    config: HtmlAppRuntimeConfig;
    ensureApp: (appId: string, app?: Partial<HtmlAppState>) => void;
    updateApp: (appId: string, patch: Partial<HtmlAppState>) => void;
    updateAppFiles: (appId: string, files: HtmlAppSourceFileMap) => void;
    renameApp: (appId: string, title: string) => void;
    commitAppRevision: (
      appId: string,
      patch: HtmlAppRevisionPatch,
      metadata?: CommitHtmlAppRevisionMetadata,
    ) => HtmlAppRevision | undefined;
    restoreAppRevision: (
      appId: string,
      revisionId: string,
      metadata?: RestoreHtmlAppRevisionMetadata,
    ) => HtmlAppRevision | undefined;
    undoAppRevision: (appId: string) => HtmlAppRevision | undefined;
    redoAppRevision: (appId: string) => HtmlAppRevision | undefined;
    getCurrentRevision: (appId: string) => HtmlAppRevision | undefined;
    getRevisionList: (appId: string) => HtmlAppRevision[];
    getRevisionNavigationState: (
      appId: string,
    ) => HtmlAppRevisionNavigationState;
    removeApp: (appId: string) => void;
    addDiagnostic: (appId: string, diagnostic: AppDiagnostic) => void;
    setDiagnostics: (appId: string, diagnostics: AppDiagnostic[]) => void;
    getApp: (appId: string) => HtmlAppState | undefined;
  };
};

export type HtmlAppRuntimeQueryState = {
  db?: {
    sqlSelectToJson?: (sql: string) => Promise<{error: boolean}>;
    connectors?: {
      runQuery?: (request: {
        sql: string;
        queryType: 'json';
        signal?: AbortSignal;
      }) => Promise<{jsonData?: Iterable<Record<string, unknown>>}>;
    };
  };
};

export type CreateHtmlAppRuntimeSliceOptions = {
  config?: Partial<HtmlAppRuntimeConfig>;
};

export type HtmlAppBlockProps<
  TRoomState extends HtmlAppRuntimeSliceState & HtmlAppRuntimeQueryState =
    HtmlAppRuntimeSliceState & HtmlAppRuntimeQueryState,
> = Partial<StatefulBlockRenderProps<TRoomState>> & {
  appId?: string;
  className?: string;
  queryTimeoutMs?: number;
  maxRows?: number;
};

const DEFAULT_QUERY_TIMEOUT_MS = 15_000;
const DEFAULT_MAX_ROWS = 10_000;

/**
 * Creates the persisted slice that owns direct HTML app block state.
 */
export function createHtmlAppRuntimeSlice({
  config,
}: CreateHtmlAppRuntimeSliceOptions = {}) {
  return createSlice<HtmlAppRuntimeSliceState>((set, get) => ({
    htmlApps: {
      config: HtmlAppRuntimeConfig.parse(config ?? {}),
      ensureApp: (appId, app = {}) => {
        set((state) =>
          produce(state, (draft: HtmlAppRuntimeSliceState) => {
            const existing = draft.htmlApps.config.appsById[appId];
            if (existing) {
              draft.htmlApps.config.appsById[appId] = HtmlAppState.parse({
                ...existing,
                ...app,
                id: appId,
                title: app.title ?? existing.title,
                updatedAt: Date.now(),
              });
              return;
            }
            const title = app.title ?? 'HTML App';
            draft.htmlApps.config.appsById[appId] = HtmlAppState.parse({
              id: appId,
              title,
              files: createDefaultHtmlAppFiles(title),
              entryHtmlPath: '/index.html',
              requestedCapabilities: [],
              grantedCapabilities: [],
              dependencies: [],
              diagnostics: [],
              createdAt: Date.now(),
              updatedAt: Date.now(),
              ...app,
            });
          }),
        );
      },
      updateApp: (appId, patch) => {
        set((state) =>
          produce(state, (draft: HtmlAppRuntimeSliceState) => {
            const existing = draft.htmlApps.config.appsById[appId];
            if (!existing) return;
            draft.htmlApps.config.appsById[appId] = HtmlAppState.parse({
              ...existing,
              ...patch,
              id: appId,
              updatedAt: Date.now(),
            });
          }),
        );
      },
      updateAppFiles: (appId, files) => {
        get().htmlApps.updateApp(appId, {files});
      },
      renameApp: (appId, title) => {
        get().htmlApps.updateApp(appId, {title});
      },
      commitAppRevision: (appId, patch, metadata) => {
        const existing = get().htmlApps.getApp(appId);
        if (!existing) return undefined;
        const {app: nextApp, revision} = commitHtmlAppRevisionState(
          existing,
          patch,
          metadata,
        );
        set((state) =>
          produce(state, (draft: HtmlAppRuntimeSliceState) => {
            draft.htmlApps.config.appsById[appId] = nextApp;
          }),
        );
        return revision;
      },
      restoreAppRevision: (appId, revisionId, metadata) => {
        const existing = get().htmlApps.getApp(appId);
        if (!existing) return undefined;
        const result = restoreHtmlAppRevisionState(
          existing,
          revisionId,
          metadata,
        );
        if (!result) return undefined;
        set((state) =>
          produce(state, (draft: HtmlAppRuntimeSliceState) => {
            draft.htmlApps.config.appsById[appId] = result.app;
          }),
        );
        return result.revision;
      },
      undoAppRevision: (appId) => {
        const existing = get().htmlApps.getApp(appId);
        if (!existing) return undefined;
        const result = undoHtmlAppRevisionState(existing);
        if (!result) return undefined;
        set((state) =>
          produce(state, (draft: HtmlAppRuntimeSliceState) => {
            draft.htmlApps.config.appsById[appId] = result.app;
          }),
        );
        return result.revision;
      },
      redoAppRevision: (appId) => {
        const existing = get().htmlApps.getApp(appId);
        if (!existing) return undefined;
        const result = redoHtmlAppRevisionState(existing);
        if (!result) return undefined;
        set((state) =>
          produce(state, (draft: HtmlAppRuntimeSliceState) => {
            draft.htmlApps.config.appsById[appId] = result.app;
          }),
        );
        return result.revision;
      },
      getCurrentRevision: (appId) =>
        getCurrentHtmlAppRevision(get().htmlApps.getApp(appId)),
      getRevisionList: (appId) =>
        getHtmlAppRevisionList(get().htmlApps.getApp(appId)),
      getRevisionNavigationState: (appId) =>
        getHtmlAppRevisionNavigationState(get().htmlApps.getApp(appId)),
      removeApp: (appId) => {
        set((state) =>
          produce(state, (draft: HtmlAppRuntimeSliceState) => {
            delete draft.htmlApps.config.appsById[appId];
          }),
        );
      },
      addDiagnostic: (appId, diagnostic) => {
        set((state) =>
          produce(state, (draft: HtmlAppRuntimeSliceState) => {
            const app = draft.htmlApps.config.appsById[appId];
            if (!app) return;
            app.diagnostics.push({
              ...diagnostic,
              timestamp: diagnostic.timestamp ?? Date.now(),
            });
            app.diagnostics = app.diagnostics.slice(-50);
            app.updatedAt = Date.now();
          }),
        );
      },
      setDiagnostics: (appId, diagnostics) => {
        get().htmlApps.updateApp(appId, {diagnostics});
      },
      getApp: (appId) => get().htmlApps.config.appsById[appId],
    },
  }));
}

export function commitHtmlAppRevisionState(
  app: HtmlAppState,
  patch: HtmlAppRevisionPatch,
  metadata: CommitHtmlAppRevisionMetadata = {},
): {app: HtmlAppState; revision: HtmlAppRevision} {
  const createdAt = metadata.createdAt ?? Date.now();
  const previousRevision = getCurrentHtmlAppRevision(app);
  const activeRevisionId = previousRevision?.id ?? app.activeRevisionId;
  const activeRevisionIndex = activeRevisionId
    ? app.revisions.findIndex((revision) => revision.id === activeRevisionId)
    : -1;
  const nextBaseApp = HtmlAppState.parse({
    ...app,
    ...patch,
    id: app.id,
    title: patch.title ?? app.title,
    files: patch.files ?? app.files,
    entryHtmlPath: patch.entryHtmlPath ?? app.entryHtmlPath,
    dependencies: patch.dependencies ?? app.dependencies,
    updatedAt: createdAt,
  });
  const revision = HtmlAppRevision.parse({
    id: metadata.revisionId ?? createHtmlAppRevisionId(),
    name: normalizeRevisionName(metadata.name) ?? 'App update',
    description: metadata.description,
    sourcePrompt: metadata.sourcePrompt,
    source: metadata.source ?? 'user',
    sessionId: metadata.sessionId,
    toolCallId: metadata.toolCallId,
    commitGroupId: metadata.commitGroupId,
    parentRevisionId: metadata.parentRevisionId ?? activeRevisionId,
    createdAt,
    title: nextBaseApp.title,
    files: nextBaseApp.files,
    entryHtmlPath: nextBaseApp.entryHtmlPath,
    dependencies: nextBaseApp.dependencies,
  });
  const revisions =
    metadata.clearRedo === false || activeRevisionIndex < 0
      ? nextBaseApp.revisions
      : nextBaseApp.revisions.slice(0, activeRevisionIndex + 1);

  return {
    app: HtmlAppState.parse({
      ...nextBaseApp,
      revisions: [...revisions, revision],
      activeRevisionId: revision.id,
      redoRevisionIds:
        metadata.clearRedo === false ? nextBaseApp.redoRevisionIds : [],
      updatedAt: createdAt,
    }),
    revision,
  };
}

export function restoreHtmlAppRevisionState(
  app: HtmlAppState,
  revisionId: string,
  metadata: RestoreHtmlAppRevisionMetadata = {},
): {app: HtmlAppState; revision: HtmlAppRevision} | undefined {
  const currentRevisionId =
    getCurrentHtmlAppRevision(app)?.id ?? app.activeRevisionId;
  const targetRevision = app.revisions.find(
    (revision) => revision.id === revisionId,
  );
  if (!targetRevision) return undefined;
  return commitHtmlAppRevisionState(
    app,
    {
      title: targetRevision.title,
      files: targetRevision.files,
      entryHtmlPath: targetRevision.entryHtmlPath,
      dependencies: targetRevision.dependencies,
      diagnostics: [],
    },
    {
      ...metadata,
      name:
        normalizeRevisionName(metadata.name) ??
        `Restore ${targetRevision.name}`,
      source: 'restore',
      parentRevisionId: currentRevisionId,
      clearRedo: true,
    },
  );
}

export function undoHtmlAppRevisionState(
  app: HtmlAppState,
): {app: HtmlAppState; revision: HtmlAppRevision} | undefined {
  const activeIndex = getActiveRevisionIndex(app);
  if (activeIndex <= 0) return undefined;
  const currentRevision = app.revisions[activeIndex];
  const previousRevision = app.revisions[activeIndex - 1];
  if (!currentRevision || !previousRevision) return undefined;
  return {
    app: applyExistingHtmlAppRevision(app, previousRevision, {
      redoRevisionIds: [currentRevision.id, ...app.redoRevisionIds],
    }),
    revision: previousRevision,
  };
}

export function redoHtmlAppRevisionState(
  app: HtmlAppState,
): {app: HtmlAppState; revision: HtmlAppRevision} | undefined {
  const [redoRevisionId, ...remainingRedoRevisionIds] = app.redoRevisionIds;
  if (!redoRevisionId) return undefined;
  const revision = app.revisions.find(
    (candidate) => candidate.id === redoRevisionId,
  );
  if (!revision) return undefined;
  return {
    app: applyExistingHtmlAppRevision(app, revision, {
      redoRevisionIds: remainingRedoRevisionIds,
    }),
    revision,
  };
}

export function getCurrentHtmlAppRevision(
  app?: HtmlAppState,
): HtmlAppRevision | undefined {
  if (!app) return undefined;
  if (app.activeRevisionId) {
    const activeRevision = app.revisions.find(
      (revision) => revision.id === app.activeRevisionId,
    );
    if (activeRevision) return activeRevision;
  }
  return app.revisions.at(-1);
}

export function getHtmlAppRevisionList(app?: HtmlAppState): HtmlAppRevision[] {
  return app?.revisions ?? [];
}

export function getHtmlAppRevisionNavigationState(
  app?: HtmlAppState,
): HtmlAppRevisionNavigationState {
  if (!app) {
    return {
      activeIndex: -1,
      totalRevisions: 0,
      canUndo: false,
      canRedo: false,
    };
  }
  const activeIndex = getActiveRevisionIndex(app);
  const activeRevision =
    activeIndex >= 0 ? app.revisions[activeIndex] : undefined;
  return {
    activeRevision,
    activeIndex,
    totalRevisions: app.revisions.length,
    canUndo: activeIndex > 0,
    canRedo: app.redoRevisionIds.length > 0,
    previousRevision:
      activeIndex > 0 ? app.revisions[activeIndex - 1] : undefined,
    nextRevision:
      activeIndex >= 0 && activeIndex < app.revisions.length - 1
        ? app.revisions[activeIndex + 1]
        : undefined,
  };
}

function applyExistingHtmlAppRevision(
  app: HtmlAppState,
  revision: HtmlAppRevision,
  patch: Pick<HtmlAppState, 'redoRevisionIds'>,
) {
  return HtmlAppState.parse({
    ...app,
    title: revision.title,
    files: revision.files,
    entryHtmlPath: revision.entryHtmlPath,
    dependencies: revision.dependencies,
    diagnostics: [],
    activeRevisionId: revision.id,
    redoRevisionIds: patch.redoRevisionIds,
    updatedAt: Date.now(),
  });
}

function getActiveRevisionIndex(app: HtmlAppState) {
  const activeRevisionId = app.activeRevisionId ?? app.revisions.at(-1)?.id;
  return app.revisions.findIndex(
    (revision) => revision.id === activeRevisionId,
  );
}

function createHtmlAppRevisionId() {
  return `rev-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 10)}`;
}

function normalizeRevisionName(name?: string) {
  const normalized = name?.replace(/\s+/g, ' ').trim();
  if (!normalized) return undefined;
  return normalized.length > 80 ? `${normalized.slice(0, 77)}...` : normalized;
}

export const HtmlAppBlock: FC<HtmlAppBlockProps> = ({
  blockId,
  appId,
  title,
  className,
  queryTimeoutMs = DEFAULT_QUERY_TIMEOUT_MS,
  maxRows = DEFAULT_MAX_ROWS,
}) => {
  const resolvedAppId = appId ?? blockId;
  const roomStore = useRoomStoreApi();
  const app = useBaseRoomStore((state: HtmlAppRuntimeSliceState) =>
    resolvedAppId ? state.htmlApps.config.appsById[resolvedAppId] : undefined,
  );
  const ensureApp = useBaseRoomStore(
    (state: HtmlAppRuntimeSliceState) => state.htmlApps.ensureApp,
  );
  const addDiagnostic = useBaseRoomStore(
    (state: HtmlAppRuntimeSliceState) => state.htmlApps.addDiagnostic,
  );
  const restoreAppRevision = useBaseRoomStore(
    (state: HtmlAppRuntimeSliceState) => state.htmlApps.restoreAppRevision,
  );
  const getState = useMemo(
    () => () =>
      roomStore.getState() as unknown as HtmlAppRuntimeSliceState &
        HtmlAppRuntimeQueryState,
    [roomStore],
  );
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [previewRevisionId, setPreviewRevisionId] = useState<string>();
  const [historyOpen, setHistoryOpen] = useState(false);

  useEffect(() => {
    if (!resolvedAppId) return;
    ensureApp(resolvedAppId, {title: title ?? 'HTML App'});
  }, [ensureApp, resolvedAppId, title]);

  useEffect(() => {
    setPreviewRevisionId(undefined);
  }, [app?.activeRevisionId]);

  useEffect(() => {
    if (!historyOpen) {
      setPreviewRevisionId(undefined);
    }
  }, [historyOpen]);

  const revisions = app?.revisions ?? [];
  const activeRevision = getCurrentHtmlAppRevision(app);
  const activeRevisionId = activeRevision?.id ?? app?.activeRevisionId;
  const previewRevision = previewRevisionId
    ? revisions.find((revision) => revision.id === previewRevisionId)
    : undefined;
  const displayedRevision = previewRevision ?? activeRevision;
  const displayedRevisionIndex = displayedRevision
    ? revisions.findIndex((revision) => revision.id === displayedRevision.id)
    : -1;
  const isPreviewing =
    Boolean(previewRevision) && previewRevision?.id !== activeRevisionId;
  const appTitle = isPreviewing
    ? (displayedRevision?.title ?? app?.title ?? title)
    : (app?.title ?? displayedRevision?.title ?? title);
  const files = displayedRevision?.files ?? app?.files;
  const entryHtmlPath =
    displayedRevision?.entryHtmlPath ?? app?.entryHtmlPath ?? '/index.html';
  const dependencies = displayedRevision?.dependencies ?? app?.dependencies;
  const grantedCapabilities = app?.grantedCapabilities;
  const hasApp = Boolean(app);

  const srcDoc = useMemo(() => {
    if (!files) return '';
    return createHtmlAppSrcDoc({
      title: appTitle ?? title ?? 'HTML App',
      files,
      entryHtmlPath: entryHtmlPath ?? '/index.html',
      dependencies: dependencies ?? [],
    });
  }, [appTitle, dependencies, entryHtmlPath, files, title]);

  useEffect(() => {
    if (!resolvedAppId || !hasApp || !iframeRef.current) return;
    const iframe = iframeRef.current;
    const targetWindow = iframe.contentWindow;
    if (!targetWindow) return;
    const capabilities = new Set(grantedCapabilities ?? []);

    const host = createBridgeHost({
      targetWindow,
      capabilities: {
        query: capabilities.has('query'),
        schema: capabilities.has('schema'),
        initialData: capabilities.has('initialData'),
      },
      handlers: {
        query: (request) =>
          executeReadonlyQuery({
            request,
            getState,
            timeoutMs: queryTimeoutMs,
            maxRows,
          }),
      },
      onDiagnostic: (diagnostic) => {
        addDiagnostic(resolvedAppId, diagnostic);
      },
    });

    iframe.srcdoc = srcDoc;
    return () => {
      host.dispose();
      iframe.srcdoc = '';
    };
  }, [
    addDiagnostic,
    grantedCapabilities,
    hasApp,
    getState,
    maxRows,
    queryTimeoutMs,
    resolvedAppId,
    srcDoc,
  ]);

  if (!resolvedAppId) {
    return (
      <div className="text-muted-foreground p-4 text-sm">
        HTML app block is missing an app id.
      </div>
    );
  }

  return (
    <div
      className={[
        'bg-background flex h-full min-h-[320px] flex-col overflow-hidden',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className="border-border bg-background flex shrink-0 items-center gap-1 border-b px-2 py-1.5 text-sm">
        <div className="min-w-0 flex-1 truncate font-medium">
          {appTitle ?? 'HTML App'}
        </div>
        <IconButton
          disabled={revisions.length === 0}
          label="Revision history"
          onClick={() => setHistoryOpen((open) => !open)}
        >
          <HistoryIcon className="h-4 w-4" />
        </IconButton>
      </div>
      <div className="flex min-h-0 flex-1">
        <div className="relative min-w-0 flex-1">
          {isPreviewing && previewRevision ? (
            <div className="absolute top-3 left-3 z-10 flex max-w-[calc(100%-24px)] items-center gap-2 rounded border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-xs text-amber-950 shadow-sm">
              <span className="shrink-0 font-medium">
                Preview v{displayedRevisionIndex + 1} of {revisions.length}
              </span>
              <span className="min-w-0 truncate">{previewRevision.name}</span>
              <button
                className="ml-1 inline-flex shrink-0 items-center gap-1 rounded border border-amber-300 bg-white px-2 py-1 font-medium hover:bg-amber-100"
                onClick={() => {
                  if (!resolvedAppId) return;
                  restoreAppRevision(resolvedAppId, previewRevision.id, {
                    name: `Restore ${previewRevision.name}`,
                  });
                }}
                type="button"
              >
                <RotateCcwIcon className="h-3.5 w-3.5" />
                Restore this version
              </button>
            </div>
          ) : null}
          <iframe
            ref={iframeRef}
            className="h-full min-h-0 w-full bg-white"
            sandbox="allow-scripts"
            title={appTitle ?? title ?? 'HTML App'}
          />
        </div>
        {historyOpen && revisions.length > 0 ? (
          <aside className="border-border bg-muted/30 w-56 shrink-0 overflow-auto border-l text-xs sm:w-64">
            <div className="text-muted-foreground border-border border-b px-3 py-2 font-medium">
              History
            </div>
            {revisions.map((revision, index) => (
              <button
                className={`hover:bg-muted flex w-full items-start gap-2 px-3 py-2 text-left ${
                  revision.id === displayedRevision?.id ? 'bg-muted' : ''
                }`}
                key={revision.id}
                onClick={() => setPreviewRevisionId(revision.id)}
                type="button"
              >
                <span className="text-muted-foreground w-8 shrink-0 tabular-nums">
                  v{index + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">
                    {revision.name}
                  </span>
                  <span className="text-muted-foreground block truncate">
                    {revision.source}
                  </span>
                </span>
              </button>
            ))}
          </aside>
        ) : null}
      </div>
    </div>
  );
};

const IconButton: FC<{
  children: ReactNode;
  disabled?: boolean;
  label: string;
  onClick: () => void;
}> = ({children, disabled, label, onClick}) => (
  <button
    aria-label={label}
    className="hover:bg-muted disabled:text-muted-foreground/50 flex h-7 w-7 shrink-0 items-center justify-center rounded disabled:pointer-events-none"
    disabled={disabled}
    onClick={onClick}
    title={label}
    type="button"
  >
    {children}
  </button>
);

export type CreateHtmlAppBlockDefinitionOptions<
  TRoomState extends HtmlAppRuntimeSliceState = HtmlAppRuntimeSliceState,
> = {
  label?: string;
  defaultTitle?: string;
  defaultApp?: Partial<HtmlAppState>;
  render?: ComponentType<StatefulBlockRenderProps<TRoomState>>;
};

/**
 * Creates the `html-app` stateful block definition for block documents and
 * artifact shells.
 */
export function createHtmlAppBlockDefinition<
  TRoomState extends HtmlAppRuntimeSliceState = HtmlAppRuntimeSliceState,
>({
  label = 'HTML App',
  defaultTitle = 'HTML App',
  defaultApp,
  render = HtmlAppBlock as ComponentType<StatefulBlockRenderProps<TRoomState>>,
}: CreateHtmlAppBlockDefinitionOptions<TRoomState> = {}): StatefulBlockDefinition<TRoomState> {
  return {
    type: HTML_APP_BLOCK_TYPE,
    label,
    defaultTitle,
    icon: AppWindowIcon,
    capabilities: {
      stateful: true,
      embeddable: true,
      hasRuntimeCache: true,
    },
    ensureState: ({blockId, title, getState}) => {
      getState().htmlApps.ensureApp(blockId, {
        ...defaultApp,
        title: title ?? defaultTitle,
      });
    },
    deleteState: ({blockId, getState}) => {
      getState().htmlApps.removeApp(blockId);
    },
    rename: ({blockId, title, getState}) => {
      getState().htmlApps.renameApp(blockId, title);
    },
    render,
  };
}

export function createDefaultHtmlAppFiles(
  title = 'HTML App',
): HtmlAppSourceFileMap {
  return {
    '/index.html': `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    <style>
      body { font-family: ui-sans-serif, system-ui, sans-serif; margin: 0; padding: 24px; color: #111827; }
      main { max-width: 760px; margin: 0 auto; }
      h1 { font-size: 20px; margin: 0 0 8px; }
      p { color: #4b5563; line-height: 1.5; }
    </style>
  </head>
  <body>
    <main>
      <h1>${escapeHtml(title)}</h1>
      <p>This sandboxed HTML app is running through the SQLRooms app runtime.</p>
    </main>
  </body>
</html>
`,
  };
}

export function resolveHtmlAppDependencyUrl(dependency: HtmlAppDependency) {
  const entry = dependency.entry
    ? `/${dependency.entry.replace(/^\/+/, '')}`
    : '';
  return `https://cdn.jsdelivr.net/npm/${dependency.package}@${dependency.version}${entry}`;
}

export type CreateHtmlAppSrcDocOptions = Pick<
  HtmlAppState,
  'title' | 'files' | 'entryHtmlPath' | 'dependencies'
>;

export function createHtmlAppSrcDoc(app: CreateHtmlAppSrcDocOptions): string {
  const files = normalizeFileMap(app.files);
  const entryPath = normalizePath(app.entryHtmlPath);
  const html =
    files[entryPath] ??
    files[app.entryHtmlPath] ??
    createDefaultHtmlAppFiles(app.title)['/index.html'] ??
    '';
  const bundledHtml = inlineLocalFileReferences(html, files);
  const prelude = [
    "<meta http-equiv=\"Content-Security-Policy\" content=\"default-src 'none'; script-src 'unsafe-inline' https://cdn.jsdelivr.net; style-src 'unsafe-inline' https://cdn.jsdelivr.net; img-src data: blob:; font-src data:; connect-src 'none';\">",
    ...app.dependencies.map(renderDependencyTag),
    `<script>${createDiagnosticPreludeScript()}</script>`,
  ].join('\n');

  if (/<head[\s>]/i.test(bundledHtml)) {
    return bundledHtml.replace(/<head([^>]*)>/i, `<head$1>\n${prelude}`);
  }
  return `${prelude}\n${bundledHtml}`;
}

export async function executeReadonlyQuery({
  request,
  getState,
  timeoutMs,
  maxRows,
}: {
  request: QueryRequest;
  getState: () => HtmlAppRuntimeSliceState & HtmlAppRuntimeQueryState;
  timeoutMs: number;
  maxRows: number;
}): Promise<QueryResult> {
  const state = getState();
  const runQuery = state.db?.connectors?.runQuery;
  if (!state.db?.sqlSelectToJson || !runQuery) {
    throw new Error('The host does not provide a query runtime.');
  }
  if (hasMultipleStatements(request.sql)) {
    throw new Error('Only a single read-only SELECT statement is allowed.');
  }
  const parsed = await state.db.sqlSelectToJson(request.sql);
  if (parsed.error) {
    throw new Error('Only read-only SELECT statements are allowed.');
  }

  const limit = Math.min(request.maxRows ?? maxRows, maxRows);
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);
  const start = performance.now();
  try {
    const result = await runQuery({
      sql: `select * from (${request.sql}) as sqlrooms_app_query limit ${limit + 1}`,
      queryType: 'json',
      signal: controller.signal,
    });
    const allRows = Array.from(result.jsonData ?? []).map(normalizeQueryRow);
    const rows = allRows.slice(0, limit);
    return QueryResult.parse({
      rows,
      columns:
        rows.length > 0
          ? Object.keys(rows[0] ?? {}).map((name) => ({name}))
          : [],
      rowCount: rows.length,
      truncated: allRows.length > limit,
      executionMs: performance.now() - start,
    });
  } finally {
    window.clearTimeout(timeoutId);
  }
}

function normalizeQueryRow(
  row: Record<string, unknown>,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [
      key,
      normalizeQueryValue(value),
    ]),
  );
}

function normalizeQueryValue(value: unknown): unknown {
  if (typeof value === 'bigint') {
    const numberValue = Number(value);
    return Number.isSafeInteger(numberValue) ? numberValue : value.toString();
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (Array.isArray(value)) {
    return value.map(normalizeQueryValue);
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => [
        key,
        normalizeQueryValue(nestedValue),
      ]),
    );
  }
  return value;
}

function renderDependencyTag(dependency: HtmlAppDependency) {
  const url = resolveHtmlAppDependencyUrl(dependency);
  if (dependency.kind === 'stylesheet') {
    return `<link rel="stylesheet" href="${escapeHtml(url)}">`;
  }
  return `<script src="${escapeHtml(url)}"></script>`;
}

function normalizePath(path: string) {
  return path.startsWith('/') ? path : `/${path}`;
}

function normalizeFileMap(files: HtmlAppSourceFileMap): HtmlAppSourceFileMap {
  return Object.fromEntries(
    Object.entries(files).map(([path, content]) => [
      normalizePath(path),
      content,
    ]),
  );
}

function inlineLocalFileReferences(
  html: string,
  files: HtmlAppSourceFileMap,
): string {
  return html
    .replace(
      /<script\b([^>]*?)\bsrc=(["'])([^"']+)\2([^>]*)><\/script>/gi,
      (match, before: string, quote: string, src: string, after: string) => {
        const content = files[normalizePath(src)];
        if (content == null || isExternalUrl(src)) return match;
        return `<script${before}${after}>${escapeScriptContent(content)}</script>`;
      },
    )
    .replace(
      /<link\b([^>]*?)\bhref=(["'])([^"']+)\2([^>]*?)>/gi,
      (match, before: string, quote: string, href: string, after: string) => {
        const content = files[normalizePath(href)];
        if (content == null || isExternalUrl(href)) return match;
        const attrs = `${before} ${after}`;
        if (!/\brel=(["'])stylesheet\1/i.test(attrs)) return match;
        return `<style>${escapeStyleContent(content)}</style>`;
      },
    );
}

function isExternalUrl(value: string) {
  return /^[a-z][a-z0-9+.-]*:/i.test(value) || value.startsWith('//');
}

function escapeScriptContent(value: string) {
  return value.replace(/<\/script/gi, '<\\/script');
}

function escapeStyleContent(value: string) {
  return value.replace(/<\/style/gi, '<\\/style');
}

function hasMultipleStatements(sql: string) {
  return (
    sql
      .split(';')
      .map((part) => part.trim())
      .filter(Boolean).length > 1
  );
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
