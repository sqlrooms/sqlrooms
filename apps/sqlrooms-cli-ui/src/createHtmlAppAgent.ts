import {tool} from 'ai';
import type {StoreApi} from 'zustand';
import {z} from 'zod';
import type {HtmlAppDependency} from '@sqlrooms/app-runtime';
import type {RoomState} from './store-types';

const HtmlAppAgentInputSchema = z.object({
  reasoning: z
    .string()
    .describe('Reasoning for why the HTML app agent is being called.'),
  prompt: z.string().describe('The app or visualization the user wants.'),
  targetHtmlAppId: z
    .string()
    .optional()
    .describe(
      'Existing html-app block/artifact id to update. If omitted, a new html-app artifact is created.',
    ),
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
    .array(
      z.object({
        package: z.string(),
        version: z.string(),
        entry: z.string().optional(),
        kind: z.enum(['script', 'stylesheet']).optional(),
        global: z.string().optional(),
      }),
    )
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

type HtmlAppAgentInput = z.infer<typeof HtmlAppAgentInputSchema>;

export function htmlAppAgentTool(store: StoreApi<RoomState>) {
  return tool({
    description: `Create or update a sandboxed html-app block/artifact.

Use this for generated HTML, JavaScript, D3, or small browser apps that should call SQLRooms through window.sqlrooms.query(...) or window.sqlrooms.queryRows(...). The tool writes the app file map to durable html-app state and returns runtime diagnostics from the latest iframe observation so the caller can repair the files in a bounded follow-up call.`,
    inputSchema: HtmlAppAgentInputSchema,
    execute: async (input): Promise<Record<string, unknown>> => {
      const state = store.getState();
      const appId = resolveTargetHtmlAppId(state, input);
      const title = input.title?.trim() || 'HTML App';
      const dependencies = resolveDependencies(input);
      const files = input.files ?? createScaffoldFiles({title, input});

      state.htmlApps.ensureApp(appId, {
        title,
        files,
        entryHtmlPath: '/index.html',
        dependencies,
        requestedCapabilities: ['query'],
        grantedCapabilities: ['query'],
      });

      const app = store.getState().htmlApps.getApp(appId);
      const diagnostics = app?.diagnostics ?? [];
      const errorCount = diagnostics.filter(
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
        diagnostics,
        diagnosticsSummary:
          diagnostics.length === 0
            ? 'No runtime diagnostics have been observed yet.'
            : `${diagnostics.length} diagnostic(s), ${errorCount} error(s).`,
        repairAttempts: 0,
        maxRepairAttempts: input.maxRepairAttempts,
        status:
          diagnostics.length === 0
            ? 'written_pending_iframe_observation'
            : errorCount === 0
              ? 'written_no_errors_observed'
              : 'written_errors_observed',
      };
    },
  });
}

function resolveTargetHtmlAppId(
  state: RoomState,
  input: HtmlAppAgentInput,
): string {
  if (input.targetHtmlAppId) return input.targetHtmlAppId;

  const currentArtifactId = state.artifacts.config.currentArtifactId;
  const currentArtifact = currentArtifactId
    ? state.artifacts.getArtifact(currentArtifactId)
    : undefined;
  if (currentArtifact?.type === 'html-app') return currentArtifact.id;

  return state.artifacts.createArtifact({
    type: 'html-app',
    title: input.title || 'HTML App',
  });
}

function resolveDependencies(input: HtmlAppAgentInput): HtmlAppDependency[] {
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
  input: HtmlAppAgentInput;
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
