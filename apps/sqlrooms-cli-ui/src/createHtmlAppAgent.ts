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

export const HtmlAppRuntimeInputSchema = z.object({
  reasoning: z
    .string()
    .describe('Reasoning for why the HTML app agent is being called.'),
  prompt: z.string().describe('The app or visualization the user wants.'),
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

const HtmlAppAgentInputSchema = HtmlAppRuntimeInputSchema.extend({
  appId: z
    .string()
    .describe(
      'HTML app runtime id to write. The caller must create or identify the top-level html-app artifact or embedded html-app block before calling this tool.',
    ),
});

type HtmlAppAgentInput = z.infer<typeof HtmlAppAgentInputSchema>;
export type HtmlAppRuntimeWriteInput = Omit<
  HtmlAppAgentInput,
  'maxRepairAttempts'
> & {
  maxRepairAttempts?: number;
};

const WriteHtmlAppFilesInputSchema = HtmlAppRuntimeInputSchema.omit({
  maxRepairAttempts: true,
  prompt: true,
});

const DEFAULT_DIAGNOSTIC_OBSERVATION_MS = 2_000;
const DIAGNOSTIC_OBSERVATION_POLL_MS = 100;

export function htmlAppAgentTool(store: StoreApi<RoomState>) {
  return tool({
    description: `Generate, write, observe, and repair a sandboxed HTML app runtime by appId.

Use this after the caller has created or identified the right container:
- top-level html-app artifact id
- embedded worksheet html-app blockInstanceId

This tool does not create artifacts, select artifacts, or create worksheet blocks. It creates complete app source for the requested prompt, writes it to durable html-app runtime state, observes runtime diagnostics, and repairs files when diagnostics report errors. If explicit html or files are provided, it writes that source directly.`,
    inputSchema: HtmlAppAgentInputSchema,
    execute: async (input, toolOptions): Promise<Record<string, unknown>> => {
      if (input.html || input.files) {
        return writeHtmlAppRuntimeState(store, input);
      }

      return runHtmlAppGenerationAgent(store, input, {
        parentToolCallId: toolOptions?.toolCallId || '',
        abortSignal: toolOptions?.abortSignal,
      });
    },
  });
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
        prompt: input.prompt,
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

  const currentSession = state.ai.getCurrentSession();
  const provider = currentSession?.modelProvider || 'openai';
  const modelId = currentSession?.model || 'gpt-4.1';
  const model = createOpenAICompatible({
    apiKey: state.ai.getApiKeyFromSettings(),
    name: provider || '',
    baseURL: state.ai.getBaseUrlFromSettings() || 'https://api.openai.com/v1',
  }).chatModel(modelId);

  const agent = new ToolLoopAgent({
    model,
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

function formatHtmlAppGenerationPrompt(input: HtmlAppAgentInput) {
  const parts = [
    `App runtime id: ${input.appId}`,
    `Title: ${input.title?.trim() || 'HTML App'}`,
    `User request: ${input.prompt}`,
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
