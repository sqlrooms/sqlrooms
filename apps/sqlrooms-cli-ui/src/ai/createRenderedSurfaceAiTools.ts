import {toPng} from 'html-to-image';
import {tool, type Tool} from 'ai';
import {z} from 'zod';
import {
  createRenderedSurfaceImageStore,
  type CapturedRenderedElement,
  type RenderedSurfaceImageStore,
} from './renderedSurfaceImageStore';

const ARTIFACT_ID_ATTRIBUTE = 'data-artifact-id';
const BLOCK_ID_ATTRIBUTE = 'data-block-document-block-id';
const DASHBOARD_ID_ATTRIBUTE = 'data-dashboard-id';
const DASHBOARD_PANEL_ID_ATTRIBUTE = 'data-dashboard-panel-id';
const MAPLIBRE_CANVAS_SELECTOR = 'canvas.maplibregl-canvas';
const DEFAULT_MAX_IMAGE_EDGE = 1536;

const RenderArtifactImageParameters = z.object({
  artifactId: z
    .string()
    .describe('Artifact ID whose visible rendering to inspect.'),
});

const RenderDocumentBlockImageParameters = z.object({
  blockDocumentId: z
    .string()
    .describe('Document artifact ID containing the block.'),
  blockId: z.string().describe('Exact document block ID to inspect.'),
});

const RenderDashboardPanelImageParameters = z.object({
  dashboardId: z.string().describe('Dashboard ID containing the panel.'),
  panelId: z.string().describe('Exact dashboard panel ID to inspect.'),
});

export type RenderedSurfaceImageTarget =
  | {kind: 'artifact'; artifactId: string}
  | {kind: 'document-block'; blockDocumentId: string; blockId: string}
  | {kind: 'dashboard-panel'; dashboardId: string; panelId: string};

export type RenderedSurfaceImageToolOutput =
  | {
      success: true;
      details: string;
      target: RenderedSurfaceImageTarget;
      mediaType: 'image/png';
      width: number;
      height: number;
      capturedAt: string;
      /** Absent in older persisted results; pixels live only in the runtime cache. */
      captureId?: string;
    }
  | {
      success: false;
      details: string;
      target: RenderedSurfaceImageTarget;
      error: string;
    };

/** Captures a rendered DOM element as a bounded PNG for a vision model. */
export type CaptureRenderedElement = (
  element: HTMLElement,
) => Promise<CapturedRenderedElement>;

/** Test and host seams for the CLI rendered-surface AI tools. */
export type CreateRenderedSurfaceAiToolsOptions = {
  document?: Document;
  captureElement?: CaptureRenderedElement;
  prepareCapture?: () => Promise<void>;
  imageStore?: RenderedSurfaceImageStore;
};

/** AI tools that let a vision-capable model inspect visible SQLRooms surfaces. */
export type RenderedSurfaceAiTools = {
  render_artifact_image: Tool;
  render_document_block_image: Tool;
  render_dashboard_panel_image: Tool;
};

/**
 * Creates tools for inspecting the current rendering of an artifact,
 * document block, or dashboard panel.
 *
 * Targets must already be mounted in the visible workspace. This keeps the
 * tools read-only and avoids changing artifact or chat selection mid-run.
 */
export function createRenderedSurfaceAiTools(
  options: CreateRenderedSurfaceAiToolsOptions = {},
): RenderedSurfaceAiTools {
  const rootDocument = options.document ?? globalThis.document;
  const captureElement = options.captureElement ?? captureElementAsPng;
  const prepareCapture = options.prepareCapture ?? waitForUiPaint;
  const imageStore = options.imageStore ?? createRenderedSurfaceImageStore();

  const createTool = <TInput>(config: {
    description: string;
    inputSchema: z.ZodType<TInput>;
    getTarget: (input: TInput) => RenderedSurfaceImageTarget;
    findElement: (input: TInput) => HTMLElement | undefined;
  }) =>
    tool({
      description: config.description,
      inputSchema: config.inputSchema,
      execute: async (input) => {
        const target = config.getTarget(input);
        try {
          await prepareCapture();
          const element = config.findElement(input);
          if (!element) {
            throw new Error(
              `${formatTarget(target)} is not currently rendered. Open the containing artifact in the workspace, then retry.`,
            );
          }
          assertCaptureSupported(element, target);

          const image = await captureElement(element);
          const captureId = imageStore.getState().add(image);
          return {
            success: true,
            details: `Captured the current rendering of ${formatTarget(target)}.`,
            target,
            mediaType: 'image/png',
            width: image.width,
            height: image.height,
            capturedAt: new Date().toISOString(),
            captureId,
          } satisfies RenderedSurfaceImageToolOutput;
        } catch (error) {
          const message =
            error instanceof Error ? error.message : String(error);
          return {
            success: false,
            details: `Failed to capture ${formatTarget(target)}: ${message}`,
            target,
            error: message,
          } satisfies RenderedSurfaceImageToolOutput;
        }
      },
      toModelOutput: ({output}) => {
        if (!output.success) {
          return {type: 'error-text', value: output.details};
        }

        const image = imageStore.getState().images.get(output.captureId);
        if (!image) {
          return {
            type: 'text',
            value: `${output.details} The image pixels are no longer cached; call this rendering tool again to inspect the current view.`,
          };
        }

        return {
          type: 'content',
          value: [
            {type: 'text', text: output.details},
            {
              type: 'image-data',
              data: image.base64,
              mediaType: output.mediaType,
            },
          ],
        };
      },
    });

  return {
    render_artifact_image: createTool({
      description: `Capture the visible rendering of a specific artifact as a PNG and inspect it visually.
Use this after creating or updating a rendered artifact when visual appearance, layout, clipping, labels, or render errors matter. The artifact must be open in the workspace. SQLRooms maps are supported. Iframe-backed content is not supported. This tool requires a vision-capable model.`,
      inputSchema: RenderArtifactImageParameters,
      getTarget: ({artifactId}) => ({kind: 'artifact', artifactId}),
      findElement: ({artifactId}) =>
        findElementByAttributes(rootDocument, {
          [ARTIFACT_ID_ATTRIBUTE]: artifactId,
        }),
    }),
    render_document_block_image: createTool({
      description: `Capture one rendered document block as a PNG and inspect it visually.
Use this when asked what is actually rendered or visible in a chart, table, map, or other document block, and after creating or updating one to verify its appearance. Call it directly once the target IDs are known; no map configuration lookup is needed. The containing Document must be open in the workspace. SQLRooms maps are supported. Iframe-backed content such as HTML apps is not supported. This tool requires a vision-capable model.`,
      inputSchema: RenderDocumentBlockImageParameters,
      getTarget: ({blockDocumentId, blockId}) => ({
        kind: 'document-block',
        blockDocumentId,
        blockId,
      }),
      findElement: ({blockDocumentId, blockId}) => {
        const artifact = findElementByAttributes(rootDocument, {
          [ARTIFACT_ID_ATTRIBUTE]: blockDocumentId,
        });
        return artifact
          ? findElementByAttributes(artifact, {[BLOCK_ID_ATTRIBUTE]: blockId})
          : undefined;
      },
    }),
    render_dashboard_panel_image: createTool({
      description: `Capture one rendered dashboard panel as a PNG and inspect it visually.
Use this after creating or updating a dashboard panel to verify its actual chart, table, map, layout, labels, and render state. The containing dashboard must be open, either as an artifact or a Document block. SQLRooms maps are supported. Iframe-backed content is not supported. This tool requires a vision-capable model.`,
      inputSchema: RenderDashboardPanelImageParameters,
      getTarget: ({dashboardId, panelId}) => ({
        kind: 'dashboard-panel',
        dashboardId,
        panelId,
      }),
      findElement: ({dashboardId, panelId}) =>
        findElementByAttributes(rootDocument, {
          [DASHBOARD_ID_ATTRIBUTE]: dashboardId,
          [DASHBOARD_PANEL_ID_ATTRIBUTE]: panelId,
        }),
    }),
  };
}

function assertCaptureSupported(
  element: HTMLElement,
  target: RenderedSurfaceImageTarget,
) {
  if (element.matches('iframe') || element.querySelector('iframe')) {
    throw new Error(
      `${formatTarget(target)} contains iframe-backed content, which cannot be included in the generated image. Use the target's source and runtime diagnostics instead, or inspect it directly in the workspace.`,
    );
  }
  const mapCanvases = element.matches(MAPLIBRE_CANVAS_SELECTOR)
    ? [element as HTMLCanvasElement]
    : Array.from(
        element.querySelectorAll<HTMLCanvasElement>(MAPLIBRE_CANVAS_SELECTOR),
      );
  for (const canvas of mapCanvases) {
    const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl');
    if (!gl || gl.isContextLost()) {
      throw new Error(
        `${formatTarget(target)} contains a map whose WebGL context is unavailable. Wait for the map to finish loading or reopen it, then retry.`,
      );
    }
    if (!gl.getContextAttributes()?.preserveDrawingBuffer) {
      throw new Error(
        `${formatTarget(target)} contains a map without drawing-buffer preservation. Enable mapProps.canvasContextAttributes.preserveDrawingBuffer and reopen the map, then retry.`,
      );
    }
  }
}

function findElementByAttributes(
  root: ParentNode,
  attributes: Record<string, string>,
): HTMLElement | undefined {
  const entries = Object.entries(attributes);
  const firstAttribute = entries[0]?.[0];
  if (!firstAttribute) return undefined;

  return Array.from(
    root.querySelectorAll<HTMLElement>(`[${firstAttribute}]`),
  ).find((element) =>
    entries.every(
      ([attribute, value]) => element.getAttribute(attribute) === value,
    ),
  );
}

async function waitForUiPaint() {
  if (globalThis.document?.fonts) {
    await globalThis.document.fonts.ready;
  }
  await nextAnimationFrame();
  await nextAnimationFrame();
}

function nextAnimationFrame() {
  return new Promise<void>((resolve) => {
    if (typeof globalThis.requestAnimationFrame === 'function') {
      globalThis.requestAnimationFrame(() => resolve());
    } else {
      globalThis.setTimeout(resolve, 0);
    }
  });
}

async function captureElementAsPng(
  element: HTMLElement,
): Promise<CapturedRenderedElement> {
  const bounds = element.getBoundingClientRect();
  const sourceWidth = Math.round(bounds.width);
  const sourceHeight = Math.round(bounds.height);
  if (sourceWidth < 1 || sourceHeight < 1) {
    throw new Error('The target is mounted but has no visible dimensions.');
  }

  const scale = Math.min(
    1,
    DEFAULT_MAX_IMAGE_EDGE / sourceWidth,
    DEFAULT_MAX_IMAGE_EDGE / sourceHeight,
  );
  const width = Math.max(1, Math.round(sourceWidth * scale));
  const height = Math.max(1, Math.round(sourceHeight * scale));
  const dataUrl = await toPng(element, {
    backgroundColor: resolveCaptureBackground(element.ownerDocument),
    cacheBust: true,
    canvasWidth: width,
    canvasHeight: height,
    pixelRatio: 1,
    width: sourceWidth,
    height: sourceHeight,
  });

  return {
    base64: dataUrl.replace(/^data:image\/png;base64,/, ''),
    width,
    height,
  };
}

function resolveCaptureBackground(ownerDocument: Document) {
  const bodyBackground = ownerDocument.defaultView
    ?.getComputedStyle(ownerDocument.body)
    .backgroundColor.trim();
  return bodyBackground && bodyBackground !== 'rgba(0, 0, 0, 0)'
    ? bodyBackground
    : '#ffffff';
}

function formatTarget(target: RenderedSurfaceImageTarget) {
  switch (target.kind) {
    case 'artifact':
      return `artifact "${target.artifactId}"`;
    case 'document-block':
      return `block "${target.blockId}" in Document "${target.blockDocumentId}"`;
    case 'dashboard-panel':
      return `panel "${target.panelId}" in dashboard "${target.dashboardId}"`;
  }
}
