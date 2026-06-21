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
import {AppWindowIcon} from 'lucide-react';
import {useEffect, useMemo, useRef, type ComponentType, type FC} from 'react';
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

export const HtmlAppState = z.object({
  id: z.string(),
  title: z.string(),
  intent: z.string().optional(),
  files: HtmlAppSourceFileMap,
  entryHtmlPath: z.string().default('/index.html'),
  requestedCapabilities: z.array(AppCapability).default([]),
  grantedCapabilities: z.array(AppCapability).default([]),
  dependencies: z.array(HtmlAppDependency).default([]),
  diagnostics: z.array(AppDiagnostic).default([]),
  createdAt: z.number(),
  updatedAt: z.number(),
});
export type HtmlAppState = z.infer<typeof HtmlAppState>;

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
  const appTitle = useBaseRoomStore((state: HtmlAppRuntimeSliceState) =>
    resolvedAppId
      ? state.htmlApps.config.appsById[resolvedAppId]?.title
      : undefined,
  );
  const files = useBaseRoomStore((state: HtmlAppRuntimeSliceState) =>
    resolvedAppId
      ? state.htmlApps.config.appsById[resolvedAppId]?.files
      : undefined,
  );
  const entryHtmlPath = useBaseRoomStore((state: HtmlAppRuntimeSliceState) =>
    resolvedAppId
      ? state.htmlApps.config.appsById[resolvedAppId]?.entryHtmlPath
      : undefined,
  );
  const dependencies = useBaseRoomStore((state: HtmlAppRuntimeSliceState) =>
    resolvedAppId
      ? state.htmlApps.config.appsById[resolvedAppId]?.dependencies
      : undefined,
  );
  const grantedCapabilities = useBaseRoomStore(
    (state: HtmlAppRuntimeSliceState) =>
      resolvedAppId
        ? state.htmlApps.config.appsById[resolvedAppId]?.grantedCapabilities
        : undefined,
  );
  const hasApp = useBaseRoomStore((state: HtmlAppRuntimeSliceState) =>
    resolvedAppId
      ? Boolean(state.htmlApps.config.appsById[resolvedAppId])
      : false,
  );
  const ensureApp = useBaseRoomStore(
    (state: HtmlAppRuntimeSliceState) => state.htmlApps.ensureApp,
  );
  const addDiagnostic = useBaseRoomStore(
    (state: HtmlAppRuntimeSliceState) => state.htmlApps.addDiagnostic,
  );
  const getState = useMemo(
    () => () =>
      roomStore.getState() as unknown as HtmlAppRuntimeSliceState &
        HtmlAppRuntimeQueryState,
    [roomStore],
  );
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  useEffect(() => {
    if (!resolvedAppId) return;
    ensureApp(resolvedAppId, {title: title ?? 'HTML App'});
  }, [ensureApp, resolvedAppId, title]);

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
    <div className={className ?? 'bg-background h-full min-h-[320px]'}>
      <iframe
        ref={iframeRef}
        className="h-full min-h-[320px] w-full bg-white"
        sandbox="allow-scripts"
        title={appTitle ?? title ?? 'HTML App'}
      />
    </div>
  );
};

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
