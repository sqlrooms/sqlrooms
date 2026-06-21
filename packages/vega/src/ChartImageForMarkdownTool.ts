import type {AiSliceState} from '@sqlrooms/ai-core';
import type {DocumentsSliceState} from '@sqlrooms/documents';
import {arrowTableToJson, type DuckDbSliceState} from '@sqlrooms/duckdb';
import {tool} from 'ai';
import {parse as vegaParse, View} from 'vega';
import {compile, type TopLevelSpec} from 'vega-lite';
import {z} from 'zod';
import {darkTheme} from './themes/darkTheme';
import {lightTheme} from './themes/lightTheme';
import type {VegaChartToolOutput} from './VegaChartTool';

const TAILWIND_BACKGROUND_VARIABLE = '--background';
const FALLBACK_LIGHT_BACKGROUND = '#ffffff';
const FALLBACK_DARK_BACKGROUND = 'oklch(0.145 0 0)';

export const ChartImageForMarkdownToolParameters = z
  .object({
    documentArtifactId: z
      .string()
      .describe('Target Markdown document artifact ID.'),
    sourceToolCallId: z
      .string()
      .optional()
      .describe('Prior successful chart tool call ID to render.'),
    sqlQuery: z
      .string()
      .optional()
      .describe('SQL query to render when no sourceToolCallId is provided.'),
    vegaLiteSpec: z
      .string()
      .optional()
      .describe('Vega-Lite JSON spec string without inline data.'),
    format: z.enum(['svg', 'png']).optional().default('svg'),
    assetId: z.string().optional().describe('Stable document-local asset ID.'),
    alt: z.string().describe('Markdown image alt text.'),
    title: z.string().optional().describe('Optional image title.'),
    width: z.number().positive().optional().default(960),
    height: z.number().positive().optional().default(540),
    pngScale: z.number().positive().optional().default(2),
    renderTheme: z
      .enum(['light', 'dark'])
      .optional()
      .default('light')
      .describe(
        'Static chart theme for the rendered image. Defaults to light for portable Markdown documents.',
      ),
    background: z
      .string()
      .optional()
      .describe(
        'CSS color used as the exported image background. Defaults to the resolved Tailwind --background token for the requested theme when available.',
      ),
  })
  .refine(
    (input) =>
      Boolean(input.sourceToolCallId) ||
      (Boolean(input.sqlQuery) && Boolean(input.vegaLiteSpec)),
    {
      message: 'Provide sourceToolCallId or both sqlQuery and vegaLiteSpec.',
    },
  );

export type ChartImageForMarkdownToolParameters = z.infer<
  typeof ChartImageForMarkdownToolParameters
>;

export type ChartImageForMarkdownToolOutput = {
  success: boolean;
  details: string;
  documentArtifactId: string;
  assetId?: string;
  markdown?: string;
  mediaType?: 'image/svg+xml' | 'image/png';
  encoding?: 'utf8' | 'base64';
  format?: 'svg' | 'png';
  renderTheme?: 'light' | 'dark';
  background?: string;
  error?: string;
};

type StoreLike<S> = {
  getState: () => S;
};

type ChartImageToolState = AiSliceState &
  DuckDbSliceState &
  DocumentsSliceState;

export function createChartImageForMarkdownTool<
  S extends ChartImageToolState = ChartImageToolState,
>(store: StoreLike<S>) {
  return tool({
    description: `Render an existing Vega chart analysis as a static SVG or PNG image asset for a Markdown document.
Use this before embedding chart images in document artifacts. The tool stores the image in the target document and returns a Markdown image link using asset://.
For portable Markdown documents, the default renderTheme is light with a white background. Only request dark rendering when the user explicitly wants a dark static image.`,
    inputSchema: ChartImageForMarkdownToolParameters,
    execute: async (params, options) => {
      const abortSignal = options?.abortSignal;
      try {
        const source = resolveChartSource(store.getState(), params);
        if (!source.success) {
          return {
            success: false,
            details: source.error,
            documentArtifactId: params.documentArtifactId,
            error: source.error,
          } satisfies ChartImageForMarkdownToolOutput;
        }

        const connector = await store.getState().db.getConnector();
        const queryResult = await connector.query(source.sqlQuery, {
          signal: abortSignal,
        });
        if (abortSignal?.aborted) {
          throw new Error('Chart image rendering was aborted');
        }

        const values = arrowTableToJson(queryResult);
        const image = await renderVegaLiteImage({
          spec: source.vegaLiteSpec,
          values,
          format: params.format,
          width: params.width,
          height: params.height,
          pngScale: params.pngScale,
          renderTheme: params.renderTheme,
          background: resolveRenderBackground(params),
        });
        const timestamp = Date.now();
        const assetId =
          params.assetId ?? createChartAssetId(params, source.sourceToolCallId);
        const filename = `${assetId}.${params.format}`;

        store.getState().documents.upsertAsset(params.documentArtifactId, {
          id: assetId,
          mediaType: image.mediaType,
          encoding: image.encoding,
          data: image.data,
          filename,
          alt: params.alt,
          title: params.title,
          provenance: {
            sourceToolCallId: source.sourceToolCallId,
            sqlQuery: source.sqlQuery,
            vegaLiteSpec: source.vegaLiteSpec,
            renderTheme: params.renderTheme,
            background: image.background,
            renderedAt: new Date(timestamp).toISOString(),
          },
          createdAt: timestamp,
          updatedAt: timestamp,
        });

        return {
          success: true,
          details: `Stored ${params.format.toUpperCase()} chart image asset "${assetId}" in document "${params.documentArtifactId}".`,
          documentArtifactId: params.documentArtifactId,
          assetId,
          markdown: `![${escapeMarkdownAlt(params.alt)}](asset://${encodeURIComponent(assetId)})`,
          mediaType: image.mediaType,
          encoding: image.encoding,
          format: params.format,
          renderTheme: params.renderTheme,
          background: image.background,
        } satisfies ChartImageForMarkdownToolOutput;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          success: false,
          details: `Failed to render chart image: ${message}`,
          documentArtifactId: params.documentArtifactId,
          error: message,
        } satisfies ChartImageForMarkdownToolOutput;
      }
    },
    toModelOutput: ({output}) => ({
      type: 'text',
      value: JSON.stringify(output),
    }),
  });
}

function resolveChartSource(
  state: ChartImageToolState,
  params: ChartImageForMarkdownToolParameters,
):
  | {
      success: true;
      sqlQuery: string;
      vegaLiteSpec: TopLevelSpec;
      sourceToolCallId?: string;
    }
  | {success: false; error: string} {
  if (params.sourceToolCallId) {
    const output = findChartToolOutput(state, params.sourceToolCallId);
    if (!output) {
      return {
        success: false,
        error: `No successful chart tool call found for "${params.sourceToolCallId}".`,
      };
    }
    if (!output.sqlQuery || !output.vegaLiteSpec) {
      return {
        success: false,
        error: `Chart tool call "${params.sourceToolCallId}" has no renderable SQL query or Vega-Lite spec.`,
      };
    }
    return {
      success: true,
      sqlQuery: output.sqlQuery,
      vegaLiteSpec: output.vegaLiteSpec,
      sourceToolCallId: params.sourceToolCallId,
    };
  }

  if (!params.sqlQuery || !params.vegaLiteSpec) {
    return {
      success: false,
      error: 'Provide sourceToolCallId or both sqlQuery and vegaLiteSpec.',
    };
  }

  try {
    return {
      success: true,
      sqlQuery: params.sqlQuery,
      vegaLiteSpec: JSON.parse(params.vegaLiteSpec) as TopLevelSpec,
    };
  } catch (error) {
    return {
      success: false,
      error: `Invalid Vega-Lite JSON: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

function findChartToolOutput(
  state: ChartImageToolState,
  sourceToolCallId: string,
): VegaChartToolOutput | undefined {
  const currentSession = state.ai.getCurrentSession();
  const messages = currentSession?.uiMessages ?? [];
  for (const message of messages) {
    if (message.role !== 'assistant') continue;
    for (const part of message.parts) {
      if (!('toolCallId' in part) || part.toolCallId !== sourceToolCallId) {
        continue;
      }
      if (
        part.state === 'output-available' &&
        'output' in part &&
        isVegaChartToolOutput(part.output)
      ) {
        return part.output;
      }
    }
  }
  return undefined;
}

function isVegaChartToolOutput(value: unknown): value is VegaChartToolOutput {
  return (
    typeof value === 'object' &&
    value !== null &&
    'success' in value &&
    (value as VegaChartToolOutput).success === true &&
    'sqlQuery' in value &&
    'vegaLiteSpec' in value
  );
}

async function renderVegaLiteImage({
  spec,
  values,
  format,
  width,
  height,
  pngScale,
  renderTheme,
  background,
}: {
  spec: TopLevelSpec;
  values: Record<string, unknown>[];
  format: 'svg' | 'png';
  width: number;
  height: number;
  pngScale: number;
  renderTheme: 'light' | 'dark';
  background: string;
}) {
  const themeConfig = renderTheme === 'dark' ? darkTheme : lightTheme;
  const specWithData = {
    padding: 10,
    ...spec,
    background,
    config: {
      ...themeConfig,
      ...(spec.config ?? {}),
      background,
    },
    data: {values},
    width,
    height,
    autosize: {contains: 'padding'},
  } as TopLevelSpec;
  const compiled = compile(specWithData).spec;
  const view = new View(vegaParse(compiled), {
    renderer: format === 'png' ? 'canvas' : 'none',
  });

  try {
    await view.runAsync();
    if (format === 'svg') {
      return {
        mediaType: 'image/svg+xml' as const,
        encoding: 'utf8' as const,
        background,
        data: await view.toSVG(),
      };
    }
    const canvas = await view.toCanvas(pngScale);
    return {
      mediaType: 'image/png' as const,
      encoding: 'base64' as const,
      background,
      data: await canvasToBase64(canvas),
    };
  } finally {
    view.finalize();
  }
}

async function canvasToBase64(canvas: HTMLCanvasElement) {
  const dataUrl = canvas.toDataURL('image/png');
  return dataUrl.replace(/^data:image\/png;base64,/, '');
}

function createChartAssetId(
  params: ChartImageForMarkdownToolParameters,
  sourceToolCallId?: string,
) {
  const base = params.title || params.alt || sourceToolCallId || 'chart';
  const slug = base
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return `${slug || 'chart'}-${Date.now().toString(36)}`;
}

function escapeMarkdownAlt(value: string) {
  return value.replace(/]/g, '\\]');
}

function resolveRenderBackground(params: ChartImageForMarkdownToolParameters) {
  if (params.background) return params.background;
  const tailwindBackground = resolveTailwindBackgroundForTheme(
    params.renderTheme,
  );
  if (tailwindBackground) return tailwindBackground;
  return params.renderTheme === 'dark'
    ? FALLBACK_DARK_BACKGROUND
    : FALLBACK_LIGHT_BACKGROUND;
}

function resolveTailwindBackgroundForTheme(renderTheme: 'light' | 'dark') {
  if (typeof document === 'undefined') return undefined;
  const currentTheme = document.documentElement.classList.contains('dark')
    ? 'dark'
    : 'light';
  if (currentTheme !== renderTheme) return undefined;

  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(TAILWIND_BACKGROUND_VARIABLE)
    .trim();
  return value || undefined;
}
