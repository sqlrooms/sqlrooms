import {
  createCliCapabilityProfileSnapshot,
  DEFAULT_CLI_CAPABILITY_PROFILE,
  EXPERIMENTAL_CLI_CAPABILITY_PROFILE,
  listCliCapabilityProfiles,
  resolveCliCapabilityProfile,
} from '../profiles';
import {validateCliCapabilityProfile} from '../profiles/validateCliCapabilityProfile';

describe('CLI capability profiles', () => {
  it.each(listCliCapabilityProfiles())(
    '$name profile is coherent',
    (profile) => {
      expect(validateCliCapabilityProfile(profile)).toEqual([]);
    },
  );

  it.each(listCliCapabilityProfiles())(
    'locks the $name capability baseline',
    (profile) => {
      expect(createCliCapabilityProfileSnapshot(profile)).toMatchSnapshot();
    },
  );

  it('keeps disabled default capabilities out of UI and AI exposure', () => {
    expect(DEFAULT_CLI_CAPABILITY_PROFILE.artifacts.creatable).toEqual([
      'worksheet',
      'dashboard',
    ]);
    expect(DEFAULT_CLI_CAPABILITY_PROFILE.blocks.stateful).toEqual([
      'dashboard',
      'data-table',
    ]);
    expect(DEFAULT_CLI_CAPABILITY_PROFILE.blocks.aiContext).toEqual([
      'chart',
      'dashboard',
    ]);
    expect(DEFAULT_CLI_CAPABILITY_PROFILE.ai.topLevelToolGroups).not.toContain(
      'html-app-agent',
    );
  });

  it('resolves named profiles and the legacy experimental alias', () => {
    expect(resolveCliCapabilityProfile().name).toBe('default');
    expect(resolveCliCapabilityProfile({profileName: 'experimental'})).toBe(
      EXPERIMENTAL_CLI_CAPABILITY_PROFILE,
    );
    expect(resolveCliCapabilityProfile({experimentalEnabled: true})).toBe(
      EXPERIMENTAL_CLI_CAPABILITY_PROFILE,
    );
  });

  it('rejects unknown and conflicting runtime selections', () => {
    expect(() => resolveCliCapabilityProfile({profileName: 'unknown'})).toThrow(
      'Unknown SQLRooms capability profile',
    );
    expect(() => resolveCliCapabilityProfile({profileName: '   '})).toThrow(
      'Unknown SQLRooms capability profile',
    );
    expect(() =>
      resolveCliCapabilityProfile({
        profileName: 'default',
        experimentalEnabled: true,
      }),
    ).toThrow('Conflicting SQLRooms capability configuration');
  });
});
