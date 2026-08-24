import {describe, expect, it, jest} from '@jest/globals';
import {DOCUMENT_CHARTS_MAPS_CLI_CAPABILITY_PROFILE} from '../profiles';

jest.unstable_mockModule('../runtimeEnvironment', () => ({
  cliCapabilityProfile: DOCUMENT_CHARTS_MAPS_CLI_CAPABILITY_PROFILE,
}));

const {isContextArtifactType} = await import('../components/assistantUtils');

describe('assistant context eligibility', () => {
  it('accepts documents and rejects dashboards for the document profile', () => {
    expect(
      isContextArtifactType(
        'document',
        DOCUMENT_CHARTS_MAPS_CLI_CAPABILITY_PROFILE,
      ),
    ).toBe(true);
    expect(
      isContextArtifactType(
        'dashboard',
        DOCUMENT_CHARTS_MAPS_CLI_CAPABILITY_PROFILE,
      ),
    ).toBe(false);
  });
});
