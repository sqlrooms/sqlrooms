import {jest} from '@jest/globals';
import {createRenderedSurfaceAiTools} from '../createRenderedSurfaceAiTools';

type FakeElement = HTMLElement & {
  attributes: Record<string, string>;
  descendants: FakeElement[];
  tagName: string;
  getContext?: HTMLCanvasElement['getContext'];
};

function createElement(
  attributes: Record<string, string>,
  descendants: FakeElement[] = [],
  tagName = 'div',
): FakeElement {
  const normalizedTagName = tagName.toUpperCase();
  return {
    attributes,
    descendants,
    tagName: normalizedTagName,
    getAttribute: (name: string) => attributes[name] ?? null,
    querySelectorAll: (selector: string) => {
      const all = descendants.flatMap(function visit(child): FakeElement[] {
        return [child, ...child.descendants.flatMap(visit)];
      });
      return all.filter((child) => matchesSelector(child, selector));
    },
    matches: (selector: string) =>
      matchesSelector({attributes, tagName: normalizedTagName}, selector),
    querySelector: (selector: string) =>
      findDescendant(descendants, selector) ?? null,
  } as unknown as FakeElement;
}

function matchesSelector(
  element: {attributes: Record<string, string>; tagName: string},
  selector: string,
): boolean {
  if (selector.includes(',')) {
    return selector
      .split(',')
      .some((part) => matchesSelector(element, part.trim()));
  }
  if (selector === 'canvas[data-sqlrooms-deck-canvas]') {
    return (
      element.tagName === 'CANVAS' &&
      'data-sqlrooms-deck-canvas' in element.attributes
    );
  }
  if (selector.startsWith('[')) {
    return selector.slice(1, -1) in element.attributes;
  }
  if (selector === 'iframe') return element.tagName === 'IFRAME';
  if (selector === 'canvas.maplibregl-canvas') {
    return Boolean(
      element.tagName === 'CANVAS' &&
      element.attributes.class?.split(/\s+/).includes('maplibregl-canvas'),
    );
  }
  return false;
}

function findDescendant(
  descendants: FakeElement[],
  selector: string,
): FakeElement | undefined {
  for (const descendant of descendants) {
    if (matchesSelector(descendant, selector)) return descendant;
    const nestedMatch = findDescendant(descendant.descendants, selector);
    if (nestedMatch) return nestedMatch;
  }
  return undefined;
}

function createDocument(elements: FakeElement[]) {
  return {querySelectorAll: () => elements} as unknown as Document;
}

async function executeTool(
  tool: ReturnType<typeof createRenderedSurfaceAiTools>[keyof ReturnType<
    typeof createRenderedSurfaceAiTools
  >],
  input: Record<string, string>,
  toolCallId = 'call-1',
) {
  return tool.execute!(input, {
    toolCallId,
    messages: [],
  } as never);
}

describe('createRenderedSurfaceAiTools', () => {
  it('returns an artifact PNG to the model without persisting its pixels', async () => {
    const artifact = createElement({'data-artifact-id': 'artifact-1'}, [
      createElement({}, [], 'canvas'),
    ]);
    const captureElement = jest.fn(async () => ({
      base64: 'png-base64',
      width: 900,
      height: 600,
    }));
    const tools = createRenderedSurfaceAiTools({
      document: createDocument([artifact]),
      captureElement,
      prepareCapture: async () => {},
    });

    const output = await executeTool(tools.render_artifact_image, {
      artifactId: 'artifact-1',
    });

    expect(captureElement).toHaveBeenCalledWith(artifact);
    expect(output).toMatchObject({
      success: true,
      target: {kind: 'artifact', artifactId: 'artifact-1'},
      mediaType: 'image/png',
      width: 900,
      height: 600,
    });
    expect(output).not.toHaveProperty('base64');
    expect(
      await tools.render_artifact_image.toModelOutput!({
        input: {artifactId: 'artifact-1'},
        output,
        toolCallId: 'call-1',
      }),
    ).toEqual({
      type: 'content',
      value: [
        {
          type: 'text',
          text: 'Captured the current rendering of artifact "artifact-1".',
        },
        {
          type: 'image-data',
          data: 'png-base64',
          mediaType: 'image/png',
        },
      ],
    });
  });

  it('scopes a document block lookup to its containing Document', async () => {
    const wrongBlock = createElement({
      'data-block-document-block-id': 'block-1',
    });
    const expectedBlock = createElement({
      'data-block-document-block-id': 'block-1',
    });
    const otherDocument = createElement(
      {'data-artifact-id': 'document-other'},
      [wrongBlock],
    );
    const targetDocument = createElement({'data-artifact-id': 'document-1'}, [
      expectedBlock,
    ]);
    const captureElement = jest.fn(async () => ({
      base64: 'block-png',
      width: 640,
      height: 320,
    }));
    const tools = createRenderedSurfaceAiTools({
      document: createDocument([otherDocument, targetDocument]),
      captureElement,
      prepareCapture: async () => {},
    });

    const output = await executeTool(tools.render_document_block_image, {
      blockDocumentId: 'document-1',
      blockId: 'block-1',
    });

    expect(output).toMatchObject({success: true});
    expect(captureElement).toHaveBeenCalledWith(expectedBlock);
  });

  it('matches a dashboard panel by both dashboard and panel id', async () => {
    const wrongPanel = createElement({
      'data-dashboard-id': 'dashboard-other',
      'data-dashboard-panel-id': 'panel-1',
    });
    const expectedPanel = createElement({
      'data-dashboard-id': 'dashboard-1',
      'data-dashboard-panel-id': 'panel-1',
    });
    const captureElement = jest.fn(async () => ({
      base64: 'panel-png',
      width: 480,
      height: 300,
    }));
    const tools = createRenderedSurfaceAiTools({
      document: createDocument([wrongPanel, expectedPanel]),
      captureElement,
      prepareCapture: async () => {},
    });

    await executeTool(tools.render_dashboard_panel_image, {
      dashboardId: 'dashboard-1',
      panelId: 'panel-1',
    });

    expect(captureElement).toHaveBeenCalledWith(expectedPanel);
  });

  it('returns an actionable error when the requested surface is not mounted', async () => {
    const tools = createRenderedSurfaceAiTools({
      document: createDocument([]),
      captureElement: jest.fn(async () => {
        throw new Error('should not capture');
      }),
      prepareCapture: async () => {},
    });

    const output = await executeTool(tools.render_artifact_image, {
      artifactId: 'missing',
    });

    expect(output).toEqual({
      success: false,
      details:
        'Failed to capture artifact "missing": artifact "missing" is not currently rendered. Open the containing artifact in the workspace, then retry.',
      target: {kind: 'artifact', artifactId: 'missing'},
      error:
        'artifact "missing" is not currently rendered. Open the containing artifact in the workspace, then retry.',
    });
  });

  it('rejects iframe-backed targets instead of returning a blank image', async () => {
    const iframe = createElement({}, [], 'iframe');
    const artifact = createElement({'data-artifact-id': 'html-app-1'}, [
      iframe,
    ]);
    const captureElement = jest.fn(async () => ({
      base64: 'blank-iframe',
      width: 640,
      height: 480,
    }));
    const tools = createRenderedSurfaceAiTools({
      document: createDocument([artifact]),
      captureElement,
      prepareCapture: async () => {},
    });

    const output = await executeTool(tools.render_artifact_image, {
      artifactId: 'html-app-1',
    });

    expect(captureElement).not.toHaveBeenCalled();
    expect(output).toEqual({
      success: false,
      details:
        'Failed to capture artifact "html-app-1": artifact "html-app-1" contains iframe-backed content, which cannot be included in the generated image. Use the target\'s source and runtime diagnostics instead, or inspect it directly in the workspace.',
      target: {kind: 'artifact', artifactId: 'html-app-1'},
      error:
        'artifact "html-app-1" contains iframe-backed content, which cannot be included in the generated image. Use the target\'s source and runtime diagnostics instead, or inspect it directly in the workspace.',
    });
  });

  it('captures a document map with a preserved WebGL buffer', async () => {
    const canvas = createElement({class: 'maplibregl-canvas'}, [], 'canvas');
    canvas.getContext = jest.fn(() => ({
      isContextLost: () => false,
      getContextAttributes: () => ({preserveDrawingBuffer: true}),
    })) as unknown as HTMLCanvasElement['getContext'];
    const block = createElement({'data-block-document-block-id': 'map-1'}, [
      canvas,
    ]);
    const document = createElement({'data-artifact-id': 'document-1'}, [block]);
    const captureElement = jest.fn(async () => ({
      base64: 'map-png',
      width: 640,
      height: 480,
    }));
    const tools = createRenderedSurfaceAiTools({
      document: createDocument([document]),
      captureElement,
      prepareCapture: async () => {},
    });

    const output = await executeTool(tools.render_document_block_image, {
      blockDocumentId: 'document-1',
      blockId: 'map-1',
    });

    expect(output).toMatchObject({success: true, mediaType: 'image/png'});
    expect(captureElement).toHaveBeenCalledWith(block);
    expect(
      await tools.render_document_block_image.toModelOutput!({
        input: {blockDocumentId: 'document-1', blockId: 'map-1'},
        output,
        toolCallId: 'call-1',
      }),
    ).toMatchObject({
      type: 'content',
      value: expect.arrayContaining([
        {type: 'image-data', data: 'map-png', mediaType: 'image/png'},
      ]),
    });
  });

  it('checks every map in a capture and rejects lost WebGL contexts', async () => {
    const canvases = [false, true].map((lost) => {
      const canvas = createElement({class: 'maplibregl-canvas'}, [], 'canvas');
      canvas.getContext = jest.fn(() => ({
        isContextLost: () => lost,
        getContextAttributes: () => ({preserveDrawingBuffer: true}),
      })) as unknown as HTMLCanvasElement['getContext'];
      return canvas;
    });
    const artifact = createElement(
      {'data-artifact-id': 'document-1'},
      canvases,
    );
    const captureElement = jest.fn(async () => ({
      base64: 'png',
      width: 640,
      height: 480,
    }));
    const tools = createRenderedSurfaceAiTools({
      document: createDocument([artifact]),
      captureElement,
      prepareCapture: async () => {},
    });

    const output = await executeTool(tools.render_artifact_image, {
      artifactId: 'document-1',
    });

    expect(output).toMatchObject({
      success: false,
      error: expect.stringContaining('WebGL context is unavailable'),
    });
    expect(captureElement).not.toHaveBeenCalled();
  });

  it.each(['surface', 'nested map', 'deck layers'])(
    'rejects an incomplete %s and allows a retry after rendering settles',
    async (loadingPart) => {
      const surfaceAttributes = {
        'data-artifact-id': 'document-1',
        'data-sqlrooms-map-loading': String(loadingPart === 'surface'),
      };
      const mapAttributes = {
        'data-sqlrooms-map-loading': String(loadingPart === 'nested map'),
      };
      const deckAttributes = {
        'data-sqlrooms-map-loading': String(loadingPart === 'deck layers'),
      };
      const artifact = createElement(surfaceAttributes, [
        createElement({'data-sqlrooms-map-loading': 'false'}),
        createElement(mapAttributes, [createElement(deckAttributes)]),
      ]);
      const captureElement = jest.fn(async () => ({
        base64: 'complete-map',
        width: 640,
        height: 480,
      }));
      const tools = createRenderedSurfaceAiTools({
        document: createDocument([artifact]),
        captureElement,
        prepareCapture: async () => {},
      });
      const input = {artifactId: 'document-1'};
      const output = await executeTool(tools.render_artifact_image, input);
      expect(output).toMatchObject({
        success: false,
        error: expect.stringContaining(
          'Wait for the map to finish rendering, then retry',
        ),
      });
      expect(captureElement).not.toHaveBeenCalled();

      for (const attributes of [
        surfaceAttributes,
        mapAttributes,
        deckAttributes,
      ]) {
        attributes['data-sqlrooms-map-loading'] = 'false';
      }
      expect(
        await executeTool(tools.render_artifact_image, input),
      ).toMatchObject({success: true});
      expect(captureElement).toHaveBeenCalledTimes(1);
    },
  );

  it.each([
    {preserved: true, lost: false, available: true, success: true},
    {preserved: false, lost: false, available: true, success: false},
    {preserved: true, lost: true, available: true, success: false},
    {preserved: true, lost: false, available: false, success: false},
  ])(
    'validates the separate deck overlay in addition to the basemap: %j',
    async ({preserved, lost, available, success}) => {
      const base = createElement({class: 'maplibregl-canvas'}, [], 'canvas');
      base.getContext = jest.fn(() => ({
        isContextLost: () => false,
        getContextAttributes: () => ({preserveDrawingBuffer: true}),
      })) as unknown as HTMLCanvasElement['getContext'];
      const overlay = createElement(
        {id: 'custom-deck-id', 'data-sqlrooms-deck-canvas': ''},
        [],
        'canvas',
      );
      overlay.getContext = jest.fn(() =>
        available
          ? {
              isContextLost: () => lost,
              getContextAttributes: () => ({preserveDrawingBuffer: preserved}),
            }
          : null,
      ) as unknown as HTMLCanvasElement['getContext'];
      const block = createElement({'data-block-document-block-id': 'map-1'}, [
        base,
        overlay,
      ]);
      const document = createElement({'data-artifact-id': 'document-1'}, [
        block,
      ]);
      const captureElement = jest.fn(async () => ({
        base64: 'both-canvases',
        width: 640,
        height: 480,
      }));
      const tools = createRenderedSurfaceAiTools({
        document: createDocument([document]),
        captureElement,
        prepareCapture: async () => {},
      });

      const output = await executeTool(tools.render_document_block_image, {
        blockDocumentId: 'document-1',
        blockId: 'map-1',
      });

      expect(output).toMatchObject({success});
      if (success) {
        expect(captureElement).toHaveBeenCalledWith(block);
      } else {
        expect(captureElement).not.toHaveBeenCalled();
        expect(output).toMatchObject({
          error: expect.stringContaining(
            !preserved
              ? 'deckProps.deviceProps.webgl.preserveDrawingBuffer'
              : 'deck overlay whose WebGL context is unavailable',
          ),
        });
      }
    },
  );

  it('rejects maps that explicitly disable drawing-buffer preservation', async () => {
    const mapCanvas = createElement(
      {class: 'maplibregl-canvas another-class'},
      [],
      'canvas',
    );
    mapCanvas.getContext = jest.fn(() => ({
      isContextLost: () => false,
      getContextAttributes: () => ({preserveDrawingBuffer: false}),
    })) as unknown as HTMLCanvasElement['getContext'];
    const panel = createElement(
      {
        'data-dashboard-id': 'dashboard-1',
        'data-dashboard-panel-id': 'map-panel-1',
      },
      [mapCanvas],
    );
    const captureElement = jest.fn(async () => ({
      base64: 'blank-webgl-canvas',
      width: 640,
      height: 480,
    }));
    const tools = createRenderedSurfaceAiTools({
      document: createDocument([panel]),
      captureElement,
      prepareCapture: async () => {},
    });

    const output = await executeTool(tools.render_dashboard_panel_image, {
      dashboardId: 'dashboard-1',
      panelId: 'map-panel-1',
    });

    expect(captureElement).not.toHaveBeenCalled();
    expect(output).toEqual({
      success: false,
      details:
        'Failed to capture panel "map-panel-1" in dashboard "dashboard-1": panel "map-panel-1" in dashboard "dashboard-1" contains a map without drawing-buffer preservation. Enable mapProps.canvasContextAttributes.preserveDrawingBuffer and reopen the map, then retry.',
      target: {
        kind: 'dashboard-panel',
        dashboardId: 'dashboard-1',
        panelId: 'map-panel-1',
      },
      error:
        'panel "map-panel-1" in dashboard "dashboard-1" contains a map without drawing-buffer preservation. Enable mapProps.canvasContextAttributes.preserveDrawingBuffer and reopen the map, then retry.',
    });
  });
});
