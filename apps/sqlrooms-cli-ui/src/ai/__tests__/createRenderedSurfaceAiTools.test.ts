import {jest} from '@jest/globals';
import {createRenderedSurfaceAiTools} from '../createRenderedSurfaceAiTools';

type FakeElement = HTMLElement & {
  attributes: Record<string, string>;
  descendants: FakeElement[];
};

function createElement(
  attributes: Record<string, string>,
  descendants: FakeElement[] = [],
): FakeElement {
  return {
    attributes,
    descendants,
    getAttribute: (name: string) => attributes[name] ?? null,
    querySelectorAll: () => descendants,
  } as unknown as FakeElement;
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
    const artifact = createElement({'data-artifact-id': 'artifact-1'});
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
});
