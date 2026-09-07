import {createRenderedSurfaceImageStore} from '../renderedSurfaceImageStore';
import {createRenderedSurfaceAiTools} from '../createRenderedSurfaceAiTools';

const image = {base64: 'exact-png', width: 320, height: 180};

describe('rendered surface image cache', () => {
  it('keeps only six captures with distinct IDs', () => {
    const store = createRenderedSurfaceImageStore();
    const ids = Array.from({length: 7}, () => store.getState().add(image));
    expect(new Set(ids).size).toBe(7);
    expect(store.getState().images.size).toBe(6);
    expect(store.getState().images.has(ids[0]!)).toBe(false);
    expect(store.getState().images.get(ids[6]!)).toBe(image);
  });

  it('uses the preview cache pixels for model output and reports expired captures', async () => {
    const store = createRenderedSurfaceImageStore();
    const captureId = store.getState().add(image);
    const output = {
      success: true,
      details: 'Captured the map.',
      target: {kind: 'artifact', artifactId: 'map'},
      captureId,
      capturedAt: '2026-09-02T12:00:00.000Z',
      mediaType: 'image/png',
      width: 320,
      height: 180,
    };
    const tools = createRenderedSurfaceAiTools({imageStore: store});
    const getModelOutput = () =>
      tools.render_artifact_image.toModelOutput!({
        toolCallId: 'call-1',
        input: {artifactId: 'map'},
        output,
      });
    expect(await getModelOutput()).toMatchObject({
      type: 'content',
      value: expect.arrayContaining([
        {
          type: 'image-data',
          data: store.getState().images.get(captureId)!.base64,
          mediaType: 'image/png',
        },
      ]),
    });
    for (let i = 0; i < 6; i++)
      store.getState().add({...image, base64: `new-${i}`});
    expect(await getModelOutput()).toEqual({
      type: 'text',
      value:
        'Captured the map. The image pixels are no longer cached; call this rendering tool again to inspect the current view.',
    });
    expect(
      await tools.render_artifact_image.toModelOutput!({
        toolCallId: 'legacy-call',
        input: {},
        output: {...output, captureId: undefined},
      }),
    ).toMatchObject({type: 'text'});
  });
});
