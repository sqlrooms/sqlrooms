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

  it('supports headless targets without a rendering tool factory', () => {
    expect(
      createCliAiTools({
        store: {} as never,
        profile,
      }),
    ).toEqual({});
  });

  it('registers all image tools without a runtime opt-in or profile tool group', () => {
    const imageTools = {
      render_artifact_image: {} as never,
      render_document_block_image: {} as never,
      render_dashboard_panel_image: {} as never,
    };
    const createRenderedSurfaceImageTools = jest.fn(() => imageTools);

    expect(
      createCliAiTools({
        store: {} as never,
        profile,
        createRenderedSurfaceImageTools,
      }),
    ).toEqual(imageTools);
    expect(createRenderedSurfaceImageTools).toHaveBeenCalledTimes(1);
  });
});
