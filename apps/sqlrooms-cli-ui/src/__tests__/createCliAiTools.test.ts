import {jest} from '@jest/globals';
import {createCliAiTools} from '../createCliAiTools';
import {DEFAULT_CLI_CAPABILITY_PROFILE} from '../profiles';

describe('createCliAiTools rendered surface images', () => {
  const profile = {
    ...DEFAULT_CLI_CAPABILITY_PROFILE,
    ai: {
      ...DEFAULT_CLI_CAPABILITY_PROFILE.ai,
      topLevelToolGroups: [],
    },
  };

  it('does not register image tools unless the runtime opts in', () => {
    const createRenderedSurfaceImageTools = jest.fn(() => ({
      render_artifact_image: {} as never,
    }));

    expect(
      createCliAiTools({
        store: {} as never,
        profile,
        createRenderedSurfaceImageTools,
      }),
    ).toEqual({});
    expect(createRenderedSurfaceImageTools).not.toHaveBeenCalled();
  });

  it('registers the image tools when the runtime explicitly enables them', () => {
    const renderArtifactImage = {} as never;

    expect(
      createCliAiTools({
        store: {} as never,
        profile,
        renderedSurfaceImageToolsEnabled: true,
        createRenderedSurfaceImageTools: () => ({
          render_artifact_image: renderArtifactImage,
        }),
      }),
    ).toEqual({render_artifact_image: renderArtifactImage});
  });
});
