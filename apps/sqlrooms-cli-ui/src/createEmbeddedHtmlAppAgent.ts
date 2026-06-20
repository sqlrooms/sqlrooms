import type {HtmlAppDependency} from '@sqlrooms/app-runtime';
import {
  blockDocumentNodeToBlock,
  createDefaultBlockDocumentBlockId,
  type BlockDocumentStatefulBlockBlock,
  type BlockDocumentNode,
} from '@sqlrooms/documents';
import type {ExtraWorksheetAiToolsParams} from '@sqlrooms/mosaic/ai';
import {tool} from 'ai';
import type {StoreApi} from 'zustand';
import {z} from 'zod';
import type {RoomState} from './store-types';

const EmbeddedHtmlAppAgentInputSchema = z.object({
  reasoning: z
    .string()
    .describe('Reasoning for why the embedded HTML app agent is being called.'),
  prompt: z.string().describe('The app or visualization the user wants.'),
  targetHtmlAppId: z
    .string()
    .optional()
    .describe(
      'Existing embedded html-app blockInstanceId to update. Use list_worksheet_blocks first when modifying an existing worksheet app.',
    ),
  title: z.string().optional().describe('Optional app title.'),
  querySql: z
    .string()
    .optional()
    .describe('Optional read-only SQL query the app should run.'),
  files: z
    .record(z.string(), z.string())
    .optional()
    .describe('Complete source file map for the embedded html-app block.'),
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
});

type EmbeddedHtmlAppAgentInput = z.infer<
  typeof EmbeddedHtmlAppAgentInputSchema
>;

const DEFAULT_DIAGNOSTIC_OBSERVATION_MS = 2_000;
const DIAGNOSTIC_OBSERVATION_POLL_MS = 100;

export function createEmbeddedHtmlAppAgentTool(
  store: StoreApi<RoomState>,
  {worksheetId, worksheetAdapter}: ExtraWorksheetAiToolsParams,
) {
  return tool({
    description: `Create or update an embedded html-app block inside the current worksheet.

Use this from worksheet_agent when the user asks for an HTML, D3, Chart.js, or browser app visualization inside a worksheet. This tool writes durable html-app runtime state and ensures the worksheet contains an owned html-app stateful block. Do not use the top-level html_app_agent for worksheet-embedded apps.`,
    inputSchema: EmbeddedHtmlAppAgentInputSchema,
    execute: async (input): Promise<Record<string, unknown>> => {
      worksheetAdapter.ensureWorksheet(worksheetId);
      worksheetAdapter.setCurrentWorksheet(worksheetId);

      const title = input.title?.trim() || 'HTML App';
      const target = resolveEmbeddedHtmlAppTarget({
        blocks: worksheetAdapter.getBlocks(worksheetId) ?? [],
        input,
      });
      const appId = target.appId ?? createDefaultBlockDocumentBlockId();
      const blockId = target.blockId ?? createDefaultBlockDocumentBlockId();
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

      if (!target.blockId) {
        const block: BlockDocumentStatefulBlockBlock = {
          type: 'statefulBlock',
          id: blockId,
          blockType: 'html-app',
          blockInstanceId: appId,
          ownership: 'owned',
          title,
          caption: title,
          height: 560,
        };
        worksheetAdapter.addBlock(worksheetId, block);
      }

      const diagnostics = await observeRuntimeDiagnostics(store, appId);
      const app = store.getState().htmlApps.getApp(appId);
      const latestDiagnostics = app?.diagnostics ?? diagnostics;
      const errorCount = latestDiagnostics.filter(
        (diagnostic) => diagnostic.level === 'error',
      ).length;

      return {
        ok: errorCount === 0,
        worksheetId,
        appId,
        blockId,
        title,
        createdBlock: !target.blockId,
        filePaths: Object.keys(files),
        dependencies,
        diagnostics: latestDiagnostics,
        diagnosticsSummary:
          latestDiagnostics.length === 0
            ? 'No runtime diagnostics have been observed yet.'
            : `${latestDiagnostics.length} diagnostic(s), ${errorCount} error(s).`,
        diagnosticObservationMs: DEFAULT_DIAGNOSTIC_OBSERVATION_MS,
      };
    },
  });
}

async function observeRuntimeDiagnostics(
  store: StoreApi<RoomState>,
  appId: string,
) {
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

function resolveEmbeddedHtmlAppTarget({
  blocks,
  input,
}: {
  blocks: BlockDocumentNode[];
  input: EmbeddedHtmlAppAgentInput;
}) {
  const htmlAppBlocks = blocks
    .map((node) => blockDocumentNodeToBlock(node))
    .filter(
      (block): block is BlockDocumentStatefulBlockBlock =>
        block?.type === 'statefulBlock' && block.blockType === 'html-app',
    );

  if (input.targetHtmlAppId) {
    const target = htmlAppBlocks.find(
      (block) => block.blockInstanceId === input.targetHtmlAppId,
    );
    return {
      appId: input.targetHtmlAppId,
      blockId: target?.id,
    };
  }

  return {};
}

function resolveDependencies(
  input: EmbeddedHtmlAppAgentInput,
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
  input: EmbeddedHtmlAppAgentInput;
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
