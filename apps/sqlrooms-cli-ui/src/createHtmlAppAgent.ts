import {createOpenAICompatible} from '@ai-sdk/openai-compatible';
import {createDefaultAiTools, streamSubAgent} from '@sqlrooms/ai';
import {tool} from 'ai';
import {ToolLoopAgent, stepCountIs} from 'ai';
import type {StoreApi} from 'zustand';
import {z} from 'zod';
import type {HtmlAppDependency} from '@sqlrooms/app-runtime';
import type {RoomState} from './store-types';

const HtmlAppDependencySchema = z.object({
  package: z.string(),
  version: z.string(),
  entry: z.string().optional(),
  kind: z.enum(['script', 'stylesheet']).optional(),
  global: z.string().optional(),
});

const HtmlAppRuntimeInputFields = z.object({
  reasoning: z
    .string()
    .describe('Reasoning for why the HTML app agent is being called.'),
  intent: z
    .string()
    .optional()
    .describe('The app or visualization objective to satisfy.'),
  prompt: z
    .string()
    .optional()
    .describe('Deprecated alias for intent. Use intent for new callers.'),
  title: z.string().optional().describe('Optional app title.'),
  querySql: z
    .string()
    .optional()
    .describe('Optional read-only SQL query the app should run.'),
  html: z
    .string()
    .optional()
    .describe(
      'Single-file HTML source for the html-app runtime. Prefer this for self-contained iframe apps.',
    ),
  files: z
    .record(z.string(), z.string())
    .optional()
    .describe(
      'Complete source file map for advanced multi-file html-app blocks.',
    ),
  dependencies: z
    .array(HtmlAppDependencySchema)
    .optional()
    .describe('Versioned browser dependencies resolved by SQLRooms.'),
  maxRepairAttempts: z
    .number()
    .int()
    .min(0)
    .max(3)
    .optional()
    .default(1)
    .describe('Maximum expected observe/repair attempts for the caller.'),
});

function requireHtmlAppIntent(
  value: {intent?: string; prompt?: string},
  ctx: z.RefinementCtx,
) {
  if (resolveHtmlAppIntent(value)) return;
  ctx.addIssue({
    code: 'custom',
    path: ['intent'],
    message: 'intent is required. prompt is accepted as a deprecated alias.',
  });
}

function resolveHtmlAppIntent(value: {intent?: string; prompt?: string}) {
  return value.intent?.trim() || value.prompt?.trim();
}

function resolvedHtmlAppIntentPatch(value: {intent?: string; prompt?: string}) {
  const intent = resolveHtmlAppIntent(value);
  return intent ? {intent} : {};
}

export const HtmlAppRuntimeInputSchema =
  HtmlAppRuntimeInputFields.superRefine(requireHtmlAppIntent);

const HtmlAppAgentInputSchema = HtmlAppRuntimeInputFields.extend({
  appId: z
    .string()
    .describe(
      'HTML app runtime id to write. The caller must create or identify the top-level html-app artifact or embedded html-app block before calling this tool.',
    ),
}).superRefine(requireHtmlAppIntent);

type HtmlAppAgentInput = z.infer<typeof HtmlAppAgentInputSchema>;
export type HtmlAppRuntimeWriteInput = Omit<
  HtmlAppAgentInput,
  'maxRepairAttempts'
> & {
  maxRepairAttempts?: number;
};

const WriteHtmlAppFilesInputSchema = HtmlAppRuntimeInputFields.omit({
  maxRepairAttempts: true,
  prompt: true,
  intent: true,
});

const DEFAULT_DIAGNOSTIC_OBSERVATION_MS = 2_000;
const DIAGNOSTIC_OBSERVATION_POLL_MS = 100;

export function htmlAppAgentTool(store: StoreApi<RoomState>) {
  return tool({
    description: `Generate, write, observe, and repair a sandboxed HTML app runtime by appId.

Use this after the caller has created or identified the right container:
- top-level html-app artifact id
- embedded worksheet html-app blockInstanceId

This tool does not create artifacts, select artifacts, or create worksheet blocks. It creates complete app source for the requested intent, writes it to durable html-app runtime state, observes runtime diagnostics, and repairs files when diagnostics report errors. If explicit html or files are provided, it writes that source directly. For incremental edits to an existing app, provide appId plus the edit intent; the tool edits the current source without re-discovering data unless the request explicitly changes data/query behavior. For title-only rename requests, provide title without source; the tool updates metadata and obvious HTML title locations without regenerating the app. prompt is accepted only as a deprecated alias for intent.`,
    inputSchema: HtmlAppAgentInputSchema,
    execute: async (input, toolOptions): Promise<Record<string, unknown>> => {
      if (input.html || input.files) {
        return writeHtmlAppRuntimeState(store, input);
      }

      const existingApp = store.getState().htmlApps.getApp(input.appId);

      if (existingApp && isTitleOnlyRequest(input)) {
        return renameHtmlAppTitle(store, input);
      }

      if (existingApp && isIncrementalAppEditRequest(input)) {
        return runHtmlAppSourceEditAgent(store, input, {
          parentToolCallId: toolOptions?.toolCallId || '',
          abortSignal: toolOptions?.abortSignal,
        });
      }

      return runHtmlAppGenerationAgent(store, input, {
        parentToolCallId: toolOptions?.toolCallId || '',
        abortSignal: toolOptions?.abortSignal,
      });
    },
  });
}

function isTitleOnlyRequest(input: HtmlAppAgentInput) {
  if (!input.title?.trim()) return false;
  if (input.html || input.files || input.querySql || input.dependencies) {
    return false;
  }

  const intent = resolveHtmlAppIntent(input)?.toLowerCase() ?? '';
  return (
    /\b(rename|change|set|update)\b[\s\S]{0,80}\b(title|name)\b/.test(intent) ||
    /\b(title|name)\b[\s\S]{0,80}\b(to|as)\b/.test(intent)
  );
}

function renameHtmlAppTitle(
  store: StoreApi<RoomState>,
  input: HtmlAppAgentInput,
): Record<string, unknown> {
  const title = input.title?.trim();
  const app = store.getState().htmlApps.getApp(input.appId);
  if (!title || !app) {
    return {
      ok: false,
      appId: input.appId,
      title: title || input.title || 'HTML App',
      status: 'rename_title_failed',
      errorMessage: 'Cannot rename HTML app title without an existing app.',
    };
  }

  const renamedFiles = renameHtmlDocumentTitle({
    files: app.files,
    entryHtmlPath: app.entryHtmlPath,
    previousTitle: app.title,
    nextTitle: title,
  });

  store.getState().htmlApps.updateApp(input.appId, {
    title,
    ...(renamedFiles ? {files: renamedFiles} : {}),
  });

  return {
    ok: true,
    appId: input.appId,
    title,
    filePaths: renamedFiles
      ? Object.keys(renamedFiles)
      : Object.keys(app.files),
    diagnostics: app.diagnostics,
    diagnosticsSummary:
      'Title updated without regenerating app source or running diagnostics.',
    status: 'renamed_title_only',
    sourceTitleUpdated: Boolean(renamedFiles),
  };
}

function isIncrementalAppEditRequest(input: HtmlAppAgentInput) {
  if (input.html || input.files || input.querySql || input.dependencies) {
    return false;
  }

  const intent = resolveHtmlAppIntent(input)?.toLowerCase() ?? '';
  if (
    /\b(new|another|fresh|separate)\b[\s\S]{0,40}\b(app|artifact)\b/.test(
      intent,
    )
  ) {
    return false;
  }

  return /\b(change|update|edit|modify|rename|set|tweak|adjust|fix|improve|make|remove|replace|add)\b/.test(
    intent,
  );
}

async function runHtmlAppSourceEditAgent(
  store: StoreApi<RoomState>,
  input: HtmlAppAgentInput,
  {
    parentToolCallId,
    abortSignal,
  }: {
    parentToolCallId: string;
    abortSignal?: AbortSignal;
  },
): Promise<Record<string, unknown>> {
  const state = store.getState();
  const app = state.htmlApps.getApp(input.appId);
  if (!app) {
    return {
      ok: false,
      appId: input.appId,
      title: input.title?.trim() || 'HTML App',
      status: 'missing_app',
      errorMessage:
        'Cannot edit an HTML app source without an existing app runtime.',
    };
  }

  let latestWriteResult: Record<string, unknown> | undefined;

  const writeHtmlAppSourceTool = tool({
    description: `Write the complete updated HTML app source to the existing appId and return runtime diagnostics.

Use this after making the requested scoped edit to the existing files. Preserve unrelated source, SQL, styles, and interactions.`,
    inputSchema: WriteHtmlAppFilesInputSchema,
    execute: async (writeInput): Promise<Record<string, unknown>> => {
      latestWriteResult = await writeHtmlAppRuntimeState(store, {
        ...writeInput,
        appId: input.appId,
        title: writeInput.title ?? input.title ?? app.title,
        dependencies: writeInput.dependencies ?? app.dependencies,
        maxRepairAttempts: input.maxRepairAttempts,
      });
      return latestWriteResult;
    },
  });

  const agent = new ToolLoopAgent({
    model: createHtmlAppModel(state),
    tools: {
      write_html_app_source: writeHtmlAppSourceTool,
    },
    temperature: 0.1,
    stopWhen: [
      stepCountIs(
        Math.max(3, Math.min(10, (input.maxRepairAttempts ?? 1) + 4)),
      ),
    ],
    instructions: getHtmlAppEditAgentInstructions(),
  });

  const result = await streamSubAgent(
    agent,
    formatHtmlAppEditPrompt(input, app),
    store,
    parentToolCallId,
    abortSignal,
  );

  if (!latestWriteResult) {
    return {
      ok: false,
      appId: input.appId,
      title: input.title?.trim() || app.title,
      status: 'edit_not_written',
      errorMessage:
        'html_app_agent did not call write_html_app_source, so no app source was updated.',
      finalOutput: result.finalOutput,
      agentSteps: result.agentToolCalls?.length ?? 0,
    };
  }

  return {
    ...latestWriteResult,
    finalOutput: result.finalOutput,
    agentSteps: result.agentToolCalls?.length ?? 0,
    editMode: 'existing_source',
  };
}

async function runHtmlAppGenerationAgent(
  store: StoreApi<RoomState>,
  input: HtmlAppAgentInput,
  {
    parentToolCallId,
    abortSignal,
  }: {
    parentToolCallId: string;
    abortSignal?: AbortSignal;
  },
): Promise<Record<string, unknown>> {
  const state = store.getState();
  let latestWriteResult: Record<string, unknown> | undefined;

  const writeHtmlAppSourceTool = tool({
    description: `Write complete HTML app source to the existing appId and return runtime diagnostics.

For a self-contained iframe app, prefer the html field. Use files only when multiple local files materially improve clarity. Call this only after you have generated the actual requested app source. Do not call it with placeholder or scaffold source.`,
    inputSchema: WriteHtmlAppFilesInputSchema,
    execute: async (writeInput): Promise<Record<string, unknown>> => {
      latestWriteResult = await writeHtmlAppRuntimeState(store, {
        ...writeInput,
        appId: input.appId,
        ...resolvedHtmlAppIntentPatch(input),
        maxRepairAttempts: input.maxRepairAttempts,
      });
      return latestWriteResult;
    },
  });

  const dataTools = createDefaultAiTools(store, {
    query: {},
    tables: true,
    commands: false,
  });

  const agent = new ToolLoopAgent({
    model: createHtmlAppModel(state),
    tools: {
      ...dataTools,
      write_html_app_source: writeHtmlAppSourceTool,
    },
    temperature: 0.2,
    stopWhen: [
      stepCountIs(
        Math.max(4, Math.min(16, (input.maxRepairAttempts ?? 1) + 6)),
      ),
    ],
    instructions: getHtmlAppAgentInstructions(),
  });

  const result = await streamSubAgent(
    agent,
    formatHtmlAppGenerationPrompt(input),
    store,
    parentToolCallId,
    abortSignal,
  );

  if (!latestWriteResult) {
    return {
      ok: false,
      appId: input.appId,
      title: input.title?.trim() || 'HTML App',
      status: 'not_written',
      errorMessage:
        'html_app_agent did not call write_html_app_source, so no app source was written.',
      finalOutput: result.finalOutput,
      agentSteps: result.agentToolCalls?.length ?? 0,
    };
  }

  return {
    ...latestWriteResult,
    finalOutput: result.finalOutput,
    agentSteps: result.agentToolCalls?.length ?? 0,
  };
}

export async function writeHtmlAppRuntimeState(
  store: StoreApi<RoomState>,
  input: HtmlAppRuntimeWriteInput,
): Promise<Record<string, unknown>> {
  const appId = input.appId;
  const title = input.title?.trim() || 'HTML App';
  const intent = resolveHtmlAppIntent(input);
  const dependencies = resolveDependencies(input);
  const files = normalizeHtmlAppFiles(input);

  if (!files || Object.keys(files).length === 0) {
    return {
      ok: false,
      appId,
      title,
      filePaths: [],
      dependencies,
      diagnostics: [],
      diagnosticsSummary: 'No files were provided.',
      repairAttempts: 0,
      maxRepairAttempts: input.maxRepairAttempts ?? 1,
      diagnosticObservationMs: DEFAULT_DIAGNOSTIC_OBSERVATION_MS,
      status: 'missing_files',
      errorMessage:
        'html_app_agent requires html source or a complete files map. It no longer writes the generic fallback scaffold when source is missing.',
    };
  }

  if (!files['/index.html']) {
    return {
      ok: false,
      appId,
      title,
      filePaths: Object.keys(files),
      dependencies,
      diagnostics: [],
      diagnosticsSummary:
        'The normalized files map does not include /index.html.',
      repairAttempts: 0,
      maxRepairAttempts: input.maxRepairAttempts ?? 1,
      diagnosticObservationMs: DEFAULT_DIAGNOSTIC_OBSERVATION_MS,
      status: 'missing_entry_html',
      errorMessage:
        'html_app_agent requires html source or files["/index.html"].',
    };
  }

  store.getState().htmlApps.ensureApp(appId, {
    title,
    ...(intent ? {intent} : {}),
    files,
    entryHtmlPath: '/index.html',
    dependencies,
    diagnostics: [],
    requestedCapabilities: ['query'],
    grantedCapabilities: ['query'],
  });

  const diagnostics = await observeHtmlAppRuntimeDiagnostics(store, appId);
  const app = store.getState().htmlApps.getApp(appId);
  const latestDiagnostics = app?.diagnostics ?? diagnostics;
  const errorCount = latestDiagnostics.filter(
    (diagnostic) => diagnostic.level === 'error',
  ).length;

  return {
    ok: errorCount === 0,
    appId,
    title,
    filePaths: Object.keys(files),
    dependencies,
    capabilities: {
      requested: ['query'],
      granted: ['query'],
    },
    diagnostics: latestDiagnostics,
    diagnosticsSummary:
      latestDiagnostics.length === 0
        ? 'No runtime diagnostics have been observed yet.'
        : `${latestDiagnostics.length} diagnostic(s), ${errorCount} error(s).`,
    repairAttempts: 0,
    maxRepairAttempts: input.maxRepairAttempts ?? 1,
    diagnosticObservationMs: DEFAULT_DIAGNOSTIC_OBSERVATION_MS,
    status:
      latestDiagnostics.length === 0
        ? 'written_pending_iframe_observation'
        : errorCount === 0
          ? 'written_no_errors_observed'
          : 'written_errors_observed',
  };
}

export async function observeHtmlAppRuntimeDiagnostics(
  store: StoreApi<RoomState>,
  appId: string,
): Promise<
  NonNullable<ReturnType<RoomState['htmlApps']['getApp']>>['diagnostics']
> {
  const start = Date.now();
  let diagnostics = store.getState().htmlApps.getApp(appId)?.diagnostics ?? [];
  while (Date.now() - start < DEFAULT_DIAGNOSTIC_OBSERVATION_MS) {
    if (diagnostics.some((diagnostic) => diagnostic.level === 'error')) {
      return diagnostics;
    }
    await new Promise((resolve) =>
      setTimeout(resolve, DIAGNOSTIC_OBSERVATION_POLL_MS),
    );
    diagnostics = store.getState().htmlApps.getApp(appId)?.diagnostics ?? [];
  }
  return diagnostics;
}

function resolveDependencies(
  input: HtmlAppRuntimeWriteInput,
): HtmlAppDependency[] {
  if (input.dependencies) return input.dependencies;
  return [
    {
      package: 'd3',
      version: '7.9.0',
      entry: 'dist/d3.min.js',
      kind: 'script',
      global: 'd3',
    },
  ];
}

function normalizeHtmlAppFiles(
  input: HtmlAppRuntimeWriteInput,
): Record<string, string> | undefined {
  if (input.html) {
    return {'/index.html': input.html};
  }
  return input.files;
}

function createHtmlAppModel(state: RoomState) {
  const currentSession = state.ai.getCurrentSession();
  const provider = currentSession?.modelProvider || 'openai';
  const modelId = currentSession?.model || 'gpt-4.1';
  return createOpenAICompatible({
    apiKey: state.ai.getApiKeyFromSettings(),
    name: provider || '',
    baseURL: state.ai.getBaseUrlFromSettings() || 'https://api.openai.com/v1',
  }).chatModel(modelId);
}

function getHtmlAppAgentInstructions() {
  return `You are an HTML app builder agent for SQLRooms.

Your job is to generate the actual requested browser app files for an existing html-app runtime, write them, observe diagnostics, and repair runtime errors.

Required workflow:
1. Understand the requested app.
2. Use list_tables, read_table_schema, and query when needed to verify table and column names.
3. Generate complete app source. Prefer a single self-contained html string for iframe apps; use files only for advanced multi-file cases.
4. Call write_html_app_source with either html or files.
5. If diagnostics include errors, fix the source and call write_html_app_source again.
6. Do not finish without calling write_html_app_source at least once.

Important constraints:
- Do not write a placeholder, scaffold, generic bar chart, or prompt summary. The rendered app must implement the requested app.
- Use window.sqlrooms.queryRows(sql) or window.sqlrooms.query(sql) for data access.
- Query results may contain BigInt values. Convert all plotted numeric values with Number(value) before passing them to D3, Chart.js, scales, Math functions, or SVG attributes.
- Prefer the html field with a complete self-contained document unless multiple files materially improve clarity.
- If you use D3, rely on the default d3 dependency unless the user asks for another library.
- If you need another browser dependency, include it in the dependencies array with package, version, entry, kind, and global when appropriate.
- Keep CSS and layout responsive inside an iframe.
- Report visible errors inside the app and also call window.sqlrooms.reportDiagnostic for caught query/render failures.`;
}

function getHtmlAppEditAgentInstructions() {
  return `You are an HTML app source editor for SQLRooms.

Your job is to make a scoped edit to an existing html-app runtime. You receive the current files and must write the complete updated source.

Required workflow:
1. Read the current source and the user's requested change.
2. Modify only what is needed for the request. Preserve unrelated SQL, data access, layout, styles, interactions, and dependencies.
3. Call write_html_app_source with either html or files.
4. If diagnostics include errors caused by the edit, fix the source and call write_html_app_source again.
5. Do not finish without calling write_html_app_source at least once.

Important constraints:
- This is an incremental edit path, not a rebuild path.
- Do not re-discover data or change SQL unless the user explicitly asks for a data/schema/query change.
- Do not replace the app with a placeholder, scaffold, generic chart, or prompt summary.
- Query results may contain BigInt values. Preserve or add Number(value) conversions before passing values to D3, Chart.js, scales, Math functions, or SVG attributes.
- Prefer preserving the existing file structure. Use the html field only when the app is currently a single /index.html file.`;
}

function formatHtmlAppGenerationPrompt(input: HtmlAppAgentInput) {
  const intent = resolveHtmlAppIntent(input) ?? '';
  const parts = [
    `App runtime id: ${input.appId}`,
    `Title: ${input.title?.trim() || 'HTML App'}`,
    `Intent: ${intent}`,
  ];

  if (input.querySql) {
    parts.push(`Suggested read-only SQL query: ${input.querySql}`);
  }

  if (input.dependencies?.length) {
    parts.push(
      `Requested dependencies: ${JSON.stringify(input.dependencies, null, 2)}`,
    );
  }

  parts.push(
    'Generate and write the complete app source now. Prefer the html field for a self-contained app. Do not use a placeholder scaffold.',
  );

  return parts.join('\n\n');
}

function formatHtmlAppEditPrompt(
  input: HtmlAppAgentInput,
  app: NonNullable<ReturnType<RoomState['htmlApps']['getApp']>>,
) {
  const intent = resolveHtmlAppIntent(input) ?? '';
  const parts = [
    `App runtime id: ${input.appId}`,
    `Current title: ${app.title}`,
    `Requested title: ${input.title?.trim() || app.title}`,
    ...(app.intent ? [`Current intent: ${app.intent}`] : []),
    `Edit intent: ${intent}`,
    `Entry HTML path: ${app.entryHtmlPath || '/index.html'}`,
  ];

  if (app.dependencies.length) {
    parts.push(
      `Current dependencies: ${JSON.stringify(app.dependencies, null, 2)}`,
    );
  }

  if (app.diagnostics.length) {
    parts.push(
      `Current diagnostics: ${JSON.stringify(app.diagnostics, null, 2)}`,
    );
  }

  parts.push(
    [
      'Current files:',
      ...Object.entries(app.files).map(
        ([path, source]) =>
          `\n${path}\n\`\`\`${fileFenceLanguage(path)}\n${source}\n\`\`\``,
      ),
    ].join('\n'),
  );

  parts.push(
    'Write the complete updated app source now. Preserve unrelated behavior and avoid data discovery unless the request explicitly changes data/query behavior.',
  );

  return parts.join('\n\n');
}

function fileFenceLanguage(path: string) {
  if (path.endsWith('.html')) return 'html';
  if (path.endsWith('.css')) return 'css';
  if (path.endsWith('.js') || path.endsWith('.mjs')) return 'js';
  if (path.endsWith('.ts')) return 'ts';
  if (path.endsWith('.tsx')) return 'tsx';
  return '';
}

function renameHtmlDocumentTitle({
  files,
  entryHtmlPath,
  previousTitle,
  nextTitle,
}: {
  files: Record<string, string>;
  entryHtmlPath?: string;
  previousTitle: string;
  nextTitle: string;
}) {
  const entryPath = entryHtmlPath || '/index.html';
  const sourcePath = files[entryPath] !== undefined ? entryPath : '/index.html';
  const html = files[sourcePath];
  if (typeof html !== 'string') return undefined;

  const nextHtml = replaceHtmlTitleText(html, previousTitle, nextTitle);
  if (nextHtml === html) return undefined;
  return {...files, [sourcePath]: nextHtml};
}

function replaceHtmlTitleText(
  html: string,
  previousTitle: string,
  nextTitle: string,
) {
  const escapedTitle = escapeHtml(nextTitle);
  let nextHtml = html.replace(
    /<title\b([^>]*)>[\s\S]*?<\/title>/i,
    `<title$1>${escapedTitle}</title>`,
  );

  const h1Matches = Array.from(
    nextHtml.matchAll(/<h1\b([^>]*)>([\s\S]*?)<\/h1>/gi),
  );
  const previousTitleText = previousTitle.trim();
  const shouldReplaceH1 =
    h1Matches.length === 1 ||
    h1Matches.some(
      (match) => stripHtmlTags(match[2]).trim() === previousTitleText,
    );

  if (shouldReplaceH1) {
    nextHtml = nextHtml.replace(
      /<h1\b([^>]*)>[\s\S]*?<\/h1>/i,
      `<h1$1>${escapedTitle}</h1>`,
    );
  }

  return nextHtml;
}

function stripHtmlTags(value: string) {
  return value.replace(/<[^>]*>/g, '');
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
