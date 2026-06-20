import {tool} from 'ai';
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
  files: z
    .record(z.string(), z.string())
    .optional()
    .describe('Complete source file map for the html-app block.'),
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

const DEFAULT_DIAGNOSTIC_OBSERVATION_MS = 2_000;
const DIAGNOSTIC_OBSERVATION_POLL_MS = 100;

export function htmlAppAgentTool(store: StoreApi<RoomState>) {
  return tool({
    description: `Write or update a sandboxed HTML app runtime by appId.

Use this after the caller has created or identified the right container:
- top-level html-app artifact id
- embedded worksheet html-app blockInstanceId

This tool does not create artifacts, select artifacts, or create worksheet blocks. It only writes the app file map to durable html-app runtime state and returns runtime diagnostics from the latest iframe observation so the caller can repair the files in a bounded follow-up call.`,
    inputSchema: HtmlAppAgentInputSchema,
    execute: async (input): Promise<Record<string, unknown>> =>
      writeHtmlAppRuntimeState(store, input),
  });
}

export async function writeHtmlAppRuntimeState(
  store: StoreApi<RoomState>,
  input: HtmlAppRuntimeWriteInput,
): Promise<Record<string, unknown>> {
  const appId = input.appId;
  const title = input.title?.trim() || 'HTML App';
  const dependencies = resolveDependencies(input);
  const files = input.files ?? createScaffoldFiles({title, input});

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

function createScaffoldFiles({
  title,
  input,
}: {
  title: string;
  input: HtmlAppRuntimeWriteInput;
}): Record<string, string> {
  const sql = input.querySql || 'select 1 as value';
  return {
    '/index.html': `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    <style>
      body { margin: 0; font-family: ui-sans-serif, system-ui, sans-serif; color: #172026; background: #fbfbf8; }
      main { padding: 24px; }
      h1 { margin: 0 0 8px; font-size: 20px; }
      #chart { min-height: 260px; }
      .muted { color: #5b6472; }
      .error { color: #b42318; white-space: pre-wrap; }
    </style>
  </head>
  <body>
    <main>
      <h1>${escapeHtml(title)}</h1>
      <p class="muted">${escapeHtml(input.prompt)}</p>
      <div id="chart"></div>
      <pre id="error" class="error"></pre>
    </main>
    <script>
      const sql = ${JSON.stringify(sql)};
      const chart = document.getElementById('chart');
      const error = document.getElementById('error');

      window.sqlrooms.queryRows(sql).then((rows) => {
        if (!rows.length) {
          chart.textContent = 'No rows returned.';
          return;
        }
        const keys = Object.keys(rows[0]);
        chart.textContent = JSON.stringify(rows.slice(0, 20), null, 2);
        if (window.d3 && keys.length >= 2) {
          chart.textContent = '';
          const width = 640;
          const height = 260;
          const xKey = keys[0];
          const yKey = keys.find((key) => typeof rows[0][key] === 'number') || keys[1];
          const data = rows.slice(0, 20).map((row) => ({
            label: String(row[xKey]),
            value: Number(row[yKey]) || 0,
          }));
          const x = d3.scaleBand().domain(data.map((d) => d.label)).range([0, width]).padding(0.2);
          const y = d3.scaleLinear().domain([0, d3.max(data, (d) => d.value) || 1]).nice().range([height, 0]);
          const svg = d3.select(chart).append('svg').attr('viewBox', '0 0 ' + width + ' ' + (height + 36));
          svg.selectAll('rect').data(data).join('rect')
            .attr('x', (d) => x(d.label))
            .attr('y', (d) => y(d.value))
            .attr('width', x.bandwidth())
            .attr('height', (d) => height - y(d.value))
            .attr('fill', '#2563eb');
        }
      }).catch((err) => {
        error.textContent = err?.message || String(err);
        window.sqlrooms.reportDiagnostic({
          level: 'error',
          source: 'query',
          message: error.textContent,
        });
      });
    </script>
  </body>
</html>
`,
  };
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
