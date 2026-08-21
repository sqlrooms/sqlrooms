import {describe, expect, it, jest} from '@jest/globals';
import {WORKSHEET_CHARTS_MAPS_CLI_CAPABILITY_PROFILE} from '../profiles';

jest.unstable_mockModule('../runtimeEnvironment', () => ({
  cliCapabilityProfile: WORKSHEET_CHARTS_MAPS_CLI_CAPABILITY_PROFILE,
}));

const {isContextArtifactType} = await import('../components/assistantUtils');

describe('assistant context eligibility', () => {
  it('accepts worksheets and rejects dashboards for the worksheet profile', () => {
    expect(
      isContextArtifactType(
        'worksheet',
        WORKSHEET_CHARTS_MAPS_CLI_CAPABILITY_PROFILE,
      ),
    ).toBe(true);
    expect(
      isContextArtifactType(
        'dashboard',
        WORKSHEET_CHARTS_MAPS_CLI_CAPABILITY_PROFILE,
      ),
    ).toBe(false);
  });
});
